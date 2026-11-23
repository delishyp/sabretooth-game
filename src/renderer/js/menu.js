/**
 * Main menu controller (spec v1.3). State machine (§5):
 *   boot → root; root → newGameSetup (slot free) | slotsFull (both full) | load | settings | credits | quitConfirm | loading (continue)
 *   slotsFull → replaceConfirm → newGameSetup (replaceRunId set) | root;  newGameSetup → creator (Begin) → starting (Start) → root (placeholder)
 *   creator: step 1 Look ⇄ step 2 Personality; Back on step 1 → newGameSetup (choices kept, replaceRunId kept, nothing deleted)
 *   load → loadRunExpanded → loading | deleteSaveConfirm → loadRunExpanded | deleteRunConfirm → load; back → load
 *   legacy (game:legacyEnd hook) → menu:newLineage | root
 *   slice 1: creator Start → game; Continue / Load of a slice save → game | summary (run over); game → root (Esc / Main menu); summary → root
 * Text: t(id, vars) over Saga's copy (js/i18n.js). New Game setup navigation: pure Nav.setupReduce (js/nav.js).
 */
(async () => {
  const api = window.sabretooth;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const copy = await api.copy.get();
  const t = I18n.create(copy.strings);
  let settings = await api.settings.get();
  let runs = [null, null];
  let state = 'boot';
  let dialog = null;
  let setup = null;                 // Nav New Game setup model, fresh per New Game (B7; defaults Standard + Heir)
  let continueTarget = null;        // saves:list continueTarget {runId, saveId} | null
  let replaceRunId = null;
  let expandedRunId = null;
  const music = Music.create();   // spec v1.3.2 §7 Menu music
  music.setAudio(settings.audio);
  let legacyRunId = null;
  let settingsTab = 'audio';
  let settingsDirty = false;

  // ---------- static text ----------
  document.title = t('app.windowTitle');
  $$('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  $('#logo').alt = t('app.titleLogo');

  // ---------- scaling: min(w/1920, h/1080) × settings uiScale, applied live (B6) ----------
  // N1: uiScale enlarges the UI but must never push it off-window. The stage's logical size shrinks by
  // uiScale (1920/u × 1080/u) and the fit scale grows by uiScale, so the stage always fits the window exactly
  // and its anchored/flex content reflows into the smaller logical area.
  function scale() {
    const u = Math.min(Math.max(Number(settings.display.uiScale) || 1, 0.5), 2);
    const stage = $('#stage');
    stage.style.width = innerWidth + 'px';
    stage.style.height = innerHeight + 'px';
    stage.style.transform = 'translate(-50%, -50%) scale(1)';
    const px = Math.round(Math.min(28, Math.max(18, innerWidth / 110) * u));
    document.documentElement.style.fontSize = px + 'px';
    const unit = Math.max(1, (innerHeight / 1080) * u);
    document.documentElement.style.setProperty('--ui', String(u));
    document.documentElement.style.setProperty('--s', unit + 'px');
    document.documentElement.dataset.choiceStack = (innerHeight <= 760 && u >= 1.5) ? '1' : '2';
    fitActive();
    placeToasts();
  }
  /** Chrome that sticks out is a layout bug. Full-bleed plates are not chrome, and this never zooms or rescales a screen. */
  function fitActive() {
    const sc = document.querySelector('.screen.active');
    if (!sc) return;
    const stage = $('#stage');
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const margin = 24 * (box.height / (stage.offsetHeight || box.height));
    let right = 0, bottom = 0;
    for (const el of sc.querySelectorAll('*')) {
      if (el.classList.contains('creator-scene') || el.classList.contains('home-landscape')) continue;
      if (el.closest('.home-dock') && !el.classList.contains('home-dock')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      right = Math.max(right, r.right - box.left);
      bottom = Math.max(bottom, r.bottom - box.top);
    }
    sc.dataset.chromeOverflow = (right + margin > box.width + 1 || bottom + margin > box.height + 1) ? '1' : '0';
  }
  if (document.fonts) document.fonts.ready.then(() => fitActive());
  addEventListener('resize', scale);

  // ---------- toast ----------
  function placeToasts() {
    const box = $('#toasts');
    if (!box) return;
    const shell = document.querySelector('.shell-top');
    const hud = document.querySelector('#game-hud');
    const edge = shell && shell.getBoundingClientRect().height ? shell.getBoundingClientRect().bottom : (hud ? hud.getBoundingClientRect().bottom : 0);
    box.style.setProperty('top', Math.round(Math.max(8, edge) + 8) + 'px', 'important');
    box.style.setProperty('bottom', 'auto', 'important');
    box.style.setProperty('left', '50%', 'important');
    box.style.setProperty('right', 'auto', 'important');
    box.style.setProperty('transform', 'translateX(-50%)', 'important');
    box.style.setProperty('z-index', '30', 'important');
  }
  function clearToasts() {
    const box = $('#toasts');
    if (box) box.replaceChildren();
  }
  function toast(text) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    $('#toasts').appendChild(el);
    placeToasts();
    setTimeout(() => el.remove(), 5000);
  }
  api.onToast(({ id, vars, text }) => toast(id ? t(id, vars) : text));

  // ---------- generic focus (all screens except difficulty) ----------
  function viewerOpen() { const v = $('#cat-viewer'); return !!(v && !v.hidden); }
  function inspectOpen() { const v = $('#encounter-inspect'); return !!(v && !v.hidden); }
  function modalOpen() { return viewerOpen() || inspectOpen(); }
  function inspectButtons() {
    return $$('#encounter-inspect button').filter((b) => !b.disabled && b.offsetParent !== null);
  }
  function syncInert() {
    const stage = $('#stage');
    if (stage) stage.inert = modalOpen();
  }
  function closeInspect() {
    const box = $('#encounter-inspect');
    if (!box || box.hidden) return false;
    box.hidden = true;
    const opener = box._opener;
    box._opener = null;
    syncInert();
    if (opener && opener.isConnected && !opener.disabled) focus(opener);
    else if (state === 'game' && game) game.refocus();
    return true;
  }
  function viewerButtons() {
    return $$('#cat-viewer button').filter((b) => !b.disabled && !b.classList.contains('cat-viewer-backdrop') && b.offsetParent !== null);
  }
  function focusables() {
    if (inspectOpen()) return inspectButtons();
    if (viewerOpen()) return viewerButtons();
    const scope = dialog ? $('#dialog') : (state === 'game' && game && game.focusScope()) || $('.screen.active');
    if (!scope) return [];
    return $$('button, [data-scroll="prose"]', scope).filter((b) => !b.disabled && b.offsetParent !== null && !b.closest('.tabs'));
  }
  function focus(el) {
    $$('.focused').forEach((b) => b.classList.remove('focused'));
    if (!el) return;
    el.classList.add('focused');
    el.focus({ preventScroll: true });
    const box = el.closest && el.closest('.bond-choices');
    if (!box) return;
    const er = el.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    if (er.top < br.top) box.scrollTop -= br.top - er.top;
    else if (er.bottom > br.bottom) box.scrollTop += er.bottom - br.bottom;
  }
  const current = () => $('.focused') || null;
  function scrollProse(a) {
    const el = current();
    if (!el || el.dataset.scroll !== 'prose') return false;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    const before = el.scrollTop;
    if (a === 'up') el.scrollTop = Math.max(0, before - 48);
    else if (a === 'down') el.scrollTop = Math.min(max, before + 48);
    else if (a === 'pageup') el.scrollTop = Math.max(0, before - el.clientHeight);
    else if (a === 'pagedown') el.scrollTop = Math.min(max, before + el.clientHeight);
    else if (a === 'home') el.scrollTop = 0;
    else if (a === 'end') el.scrollTop = max;
    else return false;
    if ((a === 'up' || a === 'down') && el.scrollTop === before) return false;
    return true;
  }
  function move(delta) {
    const f = focusables(); if (!f.length) return;
    const j = Nav.step(f.length, f.indexOf(current()), delta);
    focus(f[j]);
  }
  document.addEventListener('mouseover', (ev) => {
    if (viewerOpen()) return;
    if (state === 'creator') return;   // creator hover uses real mouse movement only (below)
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    // C2: only a real focus change re-renders; repeated mouseover on the focused control does nothing.
    if (!dialog && state === 'newGameSetup' && b.dataset.nav) return b.dataset.nav === setup.focus ? undefined : setupDispatch('hover', b.dataset.nav);
    if (state === 'creator') return;
    if (focusables().includes(b)) focus(b);
  });

  // ---------- screens ----------
  function show(screen, focusTarget) {
    state = screen;
    const el = ['starting', 'loading'].includes(screen) ? 'placeholder' : screen === 'loadRunExpanded' ? 'load' : screen;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === el));
    applyMotion();
    if (screen === 'root') { renderRoot(); music.play(); }
    if (['starting', 'loading', 'game', 'summary'].includes(screen)) music.fadeOutAndStop();   // §7.5 v1.4.4: creator Start / Continue / Load (keeps playing through the creator)
    clearToasts();
    if (screen === 'game') { game.render(); scale(); placeToasts(); return; }
    if (screen === 'summary') game.renderSummary();
    if (screen === 'newGameSetup') return renderSetup();
    if (screen === 'creator') return renderCreator();
    if (screen === 'settings') renderSettings();
    if (screen === 'load' || screen === 'loadRunExpanded') renderLoad();
    if (screen === 'slotsFull') renderReplace();
    if (screen === 'credits') startCredits();
    scale();
    if (typeof focusTarget === 'string') focusTarget = $(focusTarget);
    // B9: never land on a removed or disabled control; fall back to the screen's default.
    if (focusTarget && (!focusTarget.isConnected || focusTarget.disabled)) focusTarget = null;
    focus(focusTarget || (screen === 'root' ? rootDefaultFocus() : focusables()[0]));
  }

  function pickTagline() {
    const list = copy.taglines; const last = localStorage.getItem('lastTagline');
    let i; do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && String(i) === last);
    localStorage.setItem('lastTagline', String(i));
    $('#tagline').textContent = list[i];
  }

  async function refreshSlots() { ({ runs, continueTarget } = await api.saves.list()); }
  /** The save Continue would load (main's saves:list continueTarget), or null. Future menu cat reads its mainCat. */
  function latestValid() {
    if (!continueTarget) return null;
    const r = runs.find((x) => x && x.runId === continueTarget.runId);
    return (r && r.saves.find((x) => x.saveId === continueTarget.saveId)) || null;
  }
  const hasRuns = () => runs.some(Boolean);
  function renderRoot() {
    $('#btn-continue').disabled = !latestValid();   // §3: Continue needs a valid save
    $('#btn-load').disabled = !hasRuns();           // §3: Load enabled whenever any run exists
  }
  function rootDefaultFocus() { return latestValid() ? $('#btn-continue') : $('[data-action="newGame"]'); }

  // ---------- labels ----------
  const diffName = (id) => copy.difficulties.find((d) => d.id === id)?.name || id;
  const styleName = (id) => (id === 'standard' ? 'Balanced' : (copy.playStyles.find((d) => d.id === id)?.name || id));
  const GENERATION_WORDS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
  const generationWord = (n) => {
    const name = GENERATION_WORDS[Number(n)] || '';
    return name ? `${name} generation` : 'A later generation';
  };
  const playedWords = (iso) => {
    const then = new Date(iso);
    const ms = then.getTime();
    if (!Number.isFinite(ms)) return 'Played a while ago';
    const now = new Date();
    const days = (now.getTime() - ms) / 86400000;
    const sameDay = then.getFullYear() === now.getFullYear() && then.getMonth() === now.getMonth() && then.getDate() === now.getDate();
    if (sameDay) return days < 1 / 24 ? 'Played just now' : 'Played earlier today';
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (then.getFullYear() === yesterday.getFullYear() && then.getMonth() === yesterday.getMonth() && then.getDate() === yesterday.getDate()) return 'Played yesterday';
    if (days < 6) return 'Played a few days ago';
    if (days < 14) return 'Played last week';
    return 'Played a while ago';
  };
  const runLabel = (r) => (r.damaged ? t('run.damagedName') : t('run.label', { catName: r.catName, prideName: r.prideName }));
  function runCard(r, i) {
    const b = document.createElement('button'); b.className = 'run'; b.dataset.slotIndex = i;
    const name = document.createElement('span'); name.className = 'rname';
    const meta = document.createElement('span'); meta.className = 'rmeta';
    if (!r) { name.textContent = t('run.emptyName'); meta.textContent = 'An empty run slot'; b.disabled = true; }
    else if (r.damaged) { name.textContent = t('run.damagedName'); meta.textContent = 'A damaged run slot'; b.dataset.runId = r.runId; }
    else {
      b.dataset.runId = r.runId;
      name.textContent = runLabel(r);
      // run.modes on its own line, run.sandboxTag after it for Sandbox runs (copy §6 notes). Pre-v1.3 runs = Standard (store).
      const modes = document.createElement('span'); modes.className = 'rmodes';
      modes.textContent = t('run.modes', { styleName: styleName(r.style), deathRuleName: diffName(r.difficulty) }) + (r.difficulty === 'sandbox' ? ` · ${t('run.sandboxTag')}` : '');
      meta.textContent = `${generationWord(r.generation)} · ${playedWords(r.lastPlayedAt)}`;
      b.append(name, modes, meta); return b;
    }
    b.append(name, meta); return b;
  }

  // ---------- New Game setup (spec v1.3; B1/B2 focus ≠ selection, via Nav.setupReduce) ----------
  const optionDefs = () => copy.sandboxPanel.options;
  const SCREEN = '.screen[data-screen="newGameSetup"]';
  function cardButton(kind, d, unavailable) {
    const b = document.createElement('button'); b.className = 'card'; b.dataset.nav = `${kind}:${d.id}`;
    b.innerHTML = '<span class="name"></span><span class="desc"></span>';
    b.querySelector('.name').textContent = d.id === 'standard' ? 'Balanced' : d.name; b.querySelector('.desc').textContent = d.description;
    if (unavailable) {
      b.disabled = true;
      b.classList.add('is-unavailable');
      const note = document.createElement('span'); note.className = 'soon'; note.textContent = "Not yet available. It's coming in a later update.";
      b.append(note);
    }
    return b;
  }
  /** Slice 1 lock: Story, Sim, Heir and Sandbox stay on screen, greyed, and cannot be selected. */
  const setupStyles = () => (copy.menuLock ? copy.playStyles.filter((d) => copy.menuLock.styles.includes(d.id)) : copy.playStyles);
  const setupDeaths = () => (copy.menuLock ? copy.difficulties.filter((d) => copy.menuLock.difficulties.includes(d.id)) : copy.difficulties);
  function renderSetup() {
    const styleTitle = document.querySelector(`${SCREEN} [data-t="newGame.styleRow"]`);
    const deathTitle = document.querySelector(`${SCREEN} [data-t="newGame.deathRuleRow"]`);
    if (styleTitle) styleTitle.textContent = 'Play style';
    if (deathTitle) deathTitle.textContent = 'When your cat dies';
    const styleOpen = new Set(setupStyles().map((d) => d.id));
    $('#style-cards').replaceChildren(...copy.playStyles.map((d) => cardButton('style', d, !styleOpen.has(d.id))));
    const deathOpen = new Set(setupDeaths().map((d) => d.id));
    $('#death-cards').replaceChildren(...copy.difficulties.map((d) => cardButton('death', d, !deathOpen.has(d.id))));
    renderLevelCards();
    $('#sandbox-title').textContent = copy.sandboxPanel.title; $('#sandbox-note').textContent = copy.sandboxPanel.note;
    applySetup();
  }
  /**
   * Sandbox option rows. Built once per option list; later renders only update text, so the button under a resting pointer stays the same
   * node (Tracker C2: rebuilding on hover detached it ~300×/s and real mouse clicks never landed).
   */
  function renderSandboxRows() {
    const box = $('#sandbox-rows'); const defs = optionDefs();
    const ids = defs.map((o) => o.id).join(',');
    if (box.dataset.ids !== ids) {
      box.replaceChildren(...defs.map((o) => {
        const b = document.createElement('button'); b.className = 'setting opt'; b.dataset.opt = o.id; b.dataset.nav = `opt:${o.id}`;
        b.innerHTML = '<span class="top"><span></span><span class="val"></span></span><span class="desc"></span>';
        return b;
      }));
      box.dataset.ids = ids;
    }
    const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };
    for (const o of defs) {
      const b = box.querySelector(`[data-opt="${o.id}"]`); const vi = o.values.indexOf(setup.opts[o.id]);
      set(b.querySelector('.top').children[0], o.name); set(b.querySelector('.val'), `◀ ${o.labels[vi]} ▶`);
      set(b.querySelector('.desc'), (o.descriptions && o.descriptions[vi]) || o.description || '');
    }
  }
  function fitSandboxDescs() {   // per-value line too long → general description
    for (const b of $$('#sandbox-rows .opt')) {
      const o = optionDefs().find((x) => x.id === b.dataset.opt); const d = b.querySelector('.desc');
      if (d.clientWidth && d.scrollWidth > d.clientWidth && o.description) d.textContent = o.description;
    }
  }
  const LEVEL_NAMES = { gentle: 'Gentle', standard: 'Standard', harsh: 'Harsh', ice_age: 'Ice Age' };
  function levelFlavour(id) {
    const bank = window.Deeds && window.Deeds.copy && window.Deeds.copy.creator && window.Deeds.copy.creator.difficulty;
    return (bank && bank[id]) || '';
  }
  function renderLevelCards() {
    const box = $('#level-cards');
    if (!box || !window.Difficulty) return;
    const title = $('#level-title');
    if (title) title.textContent = 'Difficulty';
    box.replaceChildren(...window.Difficulty.LEVELS.map((id) => {
      const b = document.createElement('button');
      b.className = 'card'; b.type = 'button'; b.dataset.level = id;
      b.innerHTML = '<span class="name"></span><span class="desc"></span>';
      b.querySelector('.name').textContent = LEVEL_NAMES[id] || id;
      b.querySelector('.desc').textContent = levelFlavour(id);
      return b;
    }));
  }
  /** Render the Nav model: selected cards, panel only when Sandbox is SELECTED, summary line, focus ring. */
  function applySetup() {
    $$('#style-cards .card').forEach((c) => c.classList.toggle('selected', c.dataset.nav === `style:${setup.style}`));
    $$('#death-cards .card').forEach((c) => c.classList.toggle('selected', c.dataset.nav === `death:${setup.death}`));
    $$('#level-cards .card').forEach((c) => c.classList.toggle('selected', c.dataset.level === (setup.level || 'standard')));
    const sandbox = setup.death === 'sandbox';
    $('#sandbox-panel').hidden = !sandbox;
    if (sandbox) { renderSandboxRows(); fitSandboxDescs(); }
    const target = replaceRunId && runs.find((r) => r && r.runId === replaceRunId);
    const styleLabel = setup.style === 'standard' ? 'Balanced' : styleName(setup.style);
    const difficulty = LEVEL_NAMES[setup.level || 'standard'] || 'Standard';
    const death = diffName(setup.death);
    $('#setup-summary').textContent = target
      ? `You picked ${difficulty} difficulty, the ${styleLabel} play style and ${death}. Replaces ${runLabel(target)}.`
      : `You picked ${difficulty} difficulty, the ${styleLabel} play style and ${death}. You can't change any of them once the story starts.`;
    const tipCopy = (typeof Tutorial !== 'undefined' && Tutorial.copy && Tutorial.copy.newGame) || {};
    const toggle = $('#tutorial-toggle'); const hint = $('#tutorial-hint');
    if (toggle) toggle.textContent = `${tipCopy.label || ''} · ${t(setup.tutorial ? 'common.on' : 'common.off')}`;
    if (hint) hint.textContent = tipCopy.description || '';
    fitActive();
    focus($(`${SCREEN} [data-nav="${setup.focus}"]`));
  }
  function setupDispatch(action, arg) {
    const { state: next, effect } = Nav.setupReduce(setup, action, arg);
    setup = next; applySetup();
    if (effect && effect.type === 'start') openCreator(effect);   // v1.4: Begin opens Make Your Sabrecat
    if (effect && effect.type === 'leave') goBack();
  }
  $(SCREEN).addEventListener('click', (ev) => {
    const level = ev.target.closest('[data-level]');
    if (level && !dialog) { setup = { ...setup, level: level.dataset.level }; applySetup(); return; }
    const b = ev.target.closest('[data-nav]'); if (b && !dialog) setupDispatch('click', b.dataset.nav);
  });

  // ---------- Make Your Sabrecat (cat-creator-spec v0.3.1; model = pure js/creator.js) ----------
  const CSCREEN = '.screen[data-screen="creator"]';
  let creator = null;               // Creator model
  let pendingSetup = null;          // {style, difficulty, sandboxOptions?} from Begin
  let starting = false;             // guards a double Start
  const preview = { token: 0, key: null, ms: null, drawn: [], skipped: [], pose: null, poses: new Map(), tints: new Map(), plates: new Map(), bodies: new Map(), log: [], preloadMs: null };
  const PREVIEW_SCALE = 0.5;
  const creatorNames = () => (copy.creator && copy.creator.defaultNames) || [];
  const device = () => document.body.dataset.device || 'keyboard';
  const creatorEnv = () => ({ names: creatorNames(), nameData: copy.nameData || null, device: device() });
  const optLabel = (row, id) => t(`creator.${row}.${id}`);
  // §3c rows: Left/Right Eye show eye names and reuse the Eyes help line; Odd Eyes has no help copy (Saga gave none), so none is shown.
  const valueOf = (c, id) => (id === 'eyeLeft' ? optLabel('eyes', c.eyes) : id === 'eyeRight' ? optLabel('eyes', c.eyeRight) : optLabel(id, c[id]));
  const HELP_ID = { eyeLeft: 'eyes', eyeRight: 'eyes', oddEyes: null };
  const helpText = (row) => { const id = row in HELP_ID ? HELP_ID[row] : row; return id ? t(`creator.help.${id}`) : ''; };
  /** Small "Rare" tag on Sandbox-only options (§3c): the Odd Eyes row and the pale/ash coats. */
  const isRareOption = (c, id) => id === 'oddEyes' || (id === 'coat' && Creator.RARE_COATS.includes(c.coat));

  function openCreator(effect) {
    pendingSetup = { style: effect.style, difficulty: effect.difficulty, level: effect.level || setup.level || 'standard', tutorial: effect.tutorial === true, ...(effect.sandboxOptions ? { sandboxOptions: effect.sandboxOptions } : {}) };
    renderCreatorLevels();
    const ids = portraits.registry().portraits.map((p) => p.id);
    creator = Creator.init({ names: creatorNames(), difficulty: effect.difficulty, sandboxOptions: effect.sandboxOptions, portraitIds: ids });
    starting = false; preview.key = null;
    show('creator');
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function optionRow(id) {
    const row = el('div', 'crow'); row.dataset.row = id;
    const head = el('div', 'crow-head'); head.append(el('span', 'crow-label', t(`creator.row.${id}`)));
    const ctl = el('div', 'crow-ctl');
    const l = el('button', 'arrow', '◀'); l.dataset.arrow = '-1';
    const v = el('button', 'crow-val'); v.dataset.cnav = id;
    const r = el('button', 'arrow', '▶'); r.dataset.arrow = '1';
    const tag = el('span', 'rare-tag', t('creator.rareTag')); tag.hidden = true;
    ctl.append(l, v, r, tag);
    row.append(head, ctl, el('p', 'crow-help'));
    return row;
  }
  function nameRow() {
    const row = el('div', 'crow'); row.dataset.row = 'name';
    const head = el('div', 'crow-head'); head.append(el('span', 'crow-label', t('creator.row.name')));
    const ctl = el('div', 'crow-ctl');
    const inp = el('input'); inp.type = 'text'; inp.id = 'creator-name'; inp.placeholder = t('creator.name.placeholder'); inp.spellcheck = false; inp.autocomplete = 'off';
    inp.dataset.cnav = 'name';
    inp.addEventListener('input', () => {
      const pos = inp.selectionStart; const before = inp.value;
      creatorDispatch('nameInput', before);
      if (inp.value !== creator.name) { inp.value = creator.name; const p = Math.max(0, Math.min(creator.name.length, pos - (before.length - creator.name.length))); inp.setSelectionRange(p, p); }
    });
    // Anna bug 6: dice rerolls only the name (names.json); label/tooltip = Saga's creator.name.reroll.
    const dice = el('button', 'name-dice', '⚄'); dice.type = 'button'; dice.id = 'creator-name-dice';
    dice.setAttribute('aria-label', t('creator.name.reroll')); dice.title = t('creator.name.reroll');
    dice.addEventListener('click', (ev) => { ev.stopPropagation(); creatorDispatch('rerollName'); });
    dice.addEventListener('keydown', (ev) => {                  // keep Enter/Space on the dice (input.js would turn them into row actions)
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); creatorDispatch('rerollName'); }
    });
    ctl.append(inp, dice);
    row.append(head, ctl, el('p', 'crow-help'));
    return row;
  }
  function sliderRow(trait) {
    const id = `trait:${trait}`;
    const row = el('div', 'crow slider'); row.dataset.row = id;
    const head = el('div', 'crow-head');
    head.append(el('span', 'crow-label', t(`creator.trait.${trait}`)), el('span', 'crow-desc', t(`creator.trait.${trait}.desc`)), el('span', 'sval'));
    const ctl = el('div', 'crow-ctl');
    const l = el('button', 'arrow', '◀'); l.dataset.arrow = '-1';
    const r = el('button', 'arrow', '▶'); r.dataset.arrow = '1';
    const track = el('div', 'track'); track.dataset.trait = trait; track.append(el('div', 'fill'), el('div', 'knob'));
    ctl.append(l, el('span', 'end low', t(`creator.trait.${trait}.low`)), track, el('span', 'end high', t(`creator.trait.${trait}.high`)), r);
    row.append(head, ctl);
    return row;
  }
  /** Builds the right panel when its row list changes (step, or the §3c odd-eyes split), so the Name field otherwise keeps its caret. */
  const traitHint = (id) => (window.WordBar && window.WordBar.label ? window.WordBar.label(id) : id);
  const panelKey = (c) => {
    if (c.step === 3) return `3:${c.tab}:${(c.picks || []).join(',')}`;
    if (c.step === 4) return `4:${(c.appearanceTags || []).join(',')}:${(c.droppedTags || []).join(',')}:${(c.picks || []).join(',')}`;
    return `${c.step}:${Creator.ROWS(c).join(',')}`;
  };
  function traitPanel() {
    const api = window.CatTraits;
    const wrap = el('div', 'trait-picker');
    const tally = api.tally(creator.picks || []);
    const pips = el('div', 'trait-tally');
    const strengths = el('span', 'trait-pips is-plus');
    const flaws = el('span', 'trait-pips is-minus');
    for (let i = 0; i < 3; i++) strengths.append(el('i', i < tally.pos ? 'is-on' : ''));
    for (let i = 0; i < 3; i++) flaws.append(el('i', i < tally.neg ? 'is-on' : ''));
    const balance = tally.spend === 0 && tally.give === 0 ? '' : tally.spend < tally.give ? traitHint('ui.traits.balance.left') : tally.spend === tally.give ? traitHint('ui.traits.balance.even') : traitHint('ui.traits.balance.short');
    pips.append(strengths, flaws, el('p', 'trait-balance', balance));
    wrap.append(pips);
    const tabs = el('div', 'trait-tabs');
    for (const group of api.GROUPS) {
      const count = api.ROWS.filter((item) => item.group === group.id).length;
      const labels = { body: 'Body', mind: 'Mind and temperament', social: 'Social', lineage: 'Lineage and scars' };
      const b = el('button', 'trait-tab' + (creator.tab === group.id ? ' is-on' : ''), labels[group.id] + ' ' + count);
      b.type = 'button'; b.dataset.tab = group.id;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); creatorDispatch('setTab', group.id); });
      tabs.append(b);
    }
    wrap.append(tabs, el('p', 'trait-legend', traitHint('ui.traits.lookTag')));
    const cols = el('div', 'trait-cols');
    const strengthCol = el('div', 'trait-col');
    const flawCol = el('div', 'trait-col');
    strengthCol.append(el('h3', '', 'Strengths'));
    flawCol.append(el('h3', '', 'Flaws'));
    const reasons = { play: 'Earned in play.', blood: 'Passed down a bloodline.', opposite: 'You already picked the other side of this trait.', positives: 'Three strengths already.', negatives: 'Three flaws already.', fight: 'Two fight strengths already.', points: 'Not enough flaw points yet.' };
    for (const item of api.ROWS.filter((row) => row.group === creator.tab && row.id !== 'den_father')) {
      const spec = api.copy.traits[item.id] || {};
      const on = (creator.picks || []).includes(item.id);
      const gate = api.toggle(creator.picks || [], item.id);
      const chip = el('button', 'trait-chip' + (on ? ' is-on' : '') + (item.playOnly ? ' is-play' : '') + (item.effect.tag ? ' has-tag' : ''));
      chip.type = 'button'; chip.dataset.pick = item.id;
      const name = item.id === 'tainted_blood' ? 'Frail Blood' : (spec.name || item.id);
      chip.append(el('span', 'trait-name', name), el('span', 'trait-hint', spec.hint || ''));
      if (!on && gate && gate.ok === false && reasons[gate.reason]) {
        chip.title = reasons[gate.reason];
        chip.append(el('span', 'trait-why', reasons[gate.reason]));
      }
      chip.addEventListener('click', (ev) => { ev.stopPropagation(); creatorDispatch('togglePick', item.id); });
      (item.kind === '-' ? flawCol : strengthCol).append(chip);
    }
    cols.append(strengthCol, flawCol);
    const focused = (creator.picks || [])[0];
    const shown = api.copy.traits[focused] || api.copy.traits[(creator.focus || '').replace('pick:', '')] || {};
    const detail = el('p', 'trait-detail', '');
    detail.textContent = shown.flavour ? shown.name + '. ' + shown.flavour : '';
    wrap.append(cols, detail);
    if (creator.pickReason === 'fight') wrap.append(el('p', 'trait-lock', traitHint('ui.traits.fightLock')));
    return wrap;
  }
  function reviewPanel() {
    const wrap = el('div', 'ready-step');
    wrap.append(el('h3', '', 'Ready'));
    wrap.append(el('p', 'ready-name', creator.name || ''));
    wrap.append(el('p', 'ready-look', creator.appearanceText || 'Stand-in art'));
    const api = window.CatTraits;
    const names = (creator.picks || []).map((id) => (api && api.copy.traits[id] && api.copy.traits[id].name) || id);
    if (names.length) wrap.append(el('p', 'ready-traits', names.join(', ')));
    return wrap;
  }
  function appearancePanel() {
    const api = window.CatTraits;
    const genes = Creator.genesFor(creator);
    const look = api.appearanceOf(creator.appearanceText || '', genes, creator.picks || [], creator.droppedTags || []);
    const wrap = el('div', 'appearance-step');
    const box = el('textarea', 'appearance-text');
    box.maxLength = api.APPEARANCE_MAX;
    box.value = creator.appearanceText || '';
    box.addEventListener('input', () => creatorDispatch('setAppearance', box.value));
    const chips = el('div', 'appearance-chips');
    for (const tag of look.tags) {
      const spec = api.copy.appearance.tags[tag] || {};
      const chip = el('button', 'appearance-chip', traitHint('ui.traits.tag.' + tag));
      chip.type = 'button';
      chip.addEventListener('click', (ev) => { ev.stopPropagation(); creatorDispatch('dropTag', tag); });
      chips.append(chip);
    }
    wrap.append(el('p', 'stand-in', 'Stand-in art'), box, chips, el('p', 'appearance-note', traitHint('ui.traits.portraitWins')), el('p', 'appearance-room', traitHint('ui.traits.room')));
    if (look.colourNote) wrap.append(el('p', 'appearance-gentle', traitHint(look.colourNote)));
    if (look.geneNote) wrap.append(el('p', 'appearance-gentle', traitHint(look.geneNote)));
    return wrap;
  }
  function paintLookChips() {
    const panel = $('#creator-panel');
    if (!panel) return;
    const old = panel.querySelector('.look-chips');
    if (old) old.remove();
    if (!creator || creator.step !== 1 || !window.PortraitView) return;
    const box = el('div', 'look-chips');
    const label = (text) => { const p = el('div', 'label', text); p.style.fontSize = '18px'; p.style.fontWeight = '700'; return p; };
    const row = el('div', 'chip-row pic-row');
    const ids = (creator.portraitIds || []).slice(0, 3);
    const pictureCoat = (id) => {
      const entry = window.PortraitView && portraitReg ? window.PortraitView.entryFor(portraitReg, id) : null;
      const label = String((entry && entry.sourceLabel) || '').toLowerCase();
      const paren = label.match(/\(([^)]+)\)/);
      const blob = paren ? paren[1] : label;
      let name = 'Brown';
      if (/black/.test(blob) || /donor/.test(label)) name = 'Black';
      else if (/gray|grey/.test(blob)) name = 'Gray';
      else if (/sandy|orange|gold/.test(blob)) name = 'Sandy';
      else if (/tan|golden|cream|pale|white/.test(blob)) name = 'Tan';
      else if (/brown/.test(blob)) name = 'Brown';
      if (name === 'Pale') name = 'Tan';
      return name;
    };
    ids.forEach((id) => {
      const b = el('button', 'pic' + (creator.portraitId === id ? ' is-on' : ''));
      b.type = 'button';
      const swatch = el('i', '');
      const file = '../../assets/portraits/cats/' + id + '.png';
      swatch.style.backgroundImage = `url("${file}")`;
      b.append(swatch, document.createTextNode(pictureCoat(id)));
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        creator = Creator.coerceLook({ ...creator, portraitId: id });
        preview.key = '';
        applyCreator();
        renderPreview();
      });
      row.append(b);
    });
    const sexRow = el('div', 'chip-row');
    for (const id of ['male', 'female']) {
      const b = el('button', 'trait-chip' + (creator.sex === id ? ' is-on' : ''), id === 'male' ? 'Male' : 'Female');
      b.type = 'button';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); setLook('sex', id); });
      sexRow.append(b);
    }
    const coatRow = el('div', 'chip-row');
    for (const id of Creator.COATS) {
      const b = el('button', 'trait-chip' + (creator.coat === id ? ' is-on' : ''), id[0].toUpperCase() + id.slice(1));
      b.type = 'button';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); setLook('coat', id); });
      coatRow.append(b);
    }
    const buildRow = el('div', 'chip-row');
    for (const word of ['Lean', 'Heavy', 'Large', 'Small']) {
      const on = (creator.appearanceText || '').toLowerCase().includes(word.toLowerCase());
      const b = el('button', 'trait-chip' + (on ? ' is-on' : ''), word);
      b.type = 'button';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        creatorDispatch('setAppearance', word);
      });
      buildRow.append(b);
    }
    box.append(label('Picture'), el('p', 'stand-in', 'Stand-in art'), row, label('Sex'), sexRow, label('Coat'), coatRow, label('Build'), buildRow, el('p', 'muted', 'Changes how the story describes your cat.'));
    panel.append(box);
  }
  function setLook(key, value) {
    let guard = 0;
    while (creator[key] !== value && guard++ < 8) creator = Creator.reduce(creator, 'click', key).state;
    applyCreator();
    renderPreview();
  }
  function buildCreatorPanel() {
    const panel = $('#creator-panel');
    if (creator.step === 1) panel.replaceChildren(nameRow(), ...Creator.ROWS(creator).slice(1).map(optionRow), appearancePanel());
    else if (creator.step === 2) panel.replaceChildren(optionRow('preset'), ...Creator.TRAITS.map(sliderRow));
    else if (creator.step === 3) panel.replaceChildren(traitPanel());
    else panel.replaceChildren(reviewPanel());
    panel.dataset.step = String(creator.step); panel.dataset.rows = panelKey(creator);
    if (creator.step === 1) $('#creator-name').value = creator.name;
  }
  function renderCreator() { buildCreatorPanel(); applyCreator(); renderPreview(); }
  const pctOf = (v, r) => ((v - r.min) / (r.max - r.min)) * 100;
  function nameHelp() {
    if (creator.nameError) return { text: t(creator.nameError, { max: Creator.NAME_MAX }), error: true };
    if (!Creator.normalizeName(creator.name)) return { text: t('creator.name.emptyHint') };
    return { text: t(device() === 'controller' && creator.focus === 'name' ? 'creator.help.nameGamepad' : 'creator.help.name') };
  }
  function applyCreator() {
    const c = creator; const sc = $(CSCREEN);
    if (sc.querySelector('#creator-panel').dataset.rows !== panelKey(c)) buildCreatorPanel();
    const stepNames = ['Look', 'Personality', 'Strengths and flaws', 'Ready'];
    const stepHost = $('#creator-step');
    stepHost.textContent = '';
    stepNames.forEach((name, i) => {
      const n = i + 1;
      const bit = document.createElement('span');
      bit.className = 'step-bit' + (c.step === n ? ' is-on' : '');
      const pip = document.createElement('span');
      pip.className = 'step-pip';
      pip.textContent = c.step > n ? '✓' : String(n);
      bit.append(pip, document.createTextNode(name));
      stepHost.append(bit);
    });
    paintLookChips();
    const nameUnder = document.getElementById('creator-portrait-name');
    if (!nameUnder && document.querySelector('.creator-preview')) {
      const cap = document.createElement('p');
      cap.id = 'creator-portrait-name';
      cap.style.fontSize = '22px';
      cap.style.margin = '8px 0 0';
      document.querySelector('.creator-preview').append(cap);
    }
    const shownName = document.getElementById('creator-portrait-name');
    if (shownName) shownName.textContent = Creator.normalizeName(c.name) || t('run.defaultCatName');
    for (const row of $$('#creator-panel .crow')) {
      const id = row.dataset.row; const help = row.querySelector('.crow-help');
      row.classList.toggle('focused', c.focus === id);
      if (id === 'name') {
        const inp = row.querySelector('input'); if (inp.value !== c.name) inp.value = c.name;
        const h = nameHelp(); help.textContent = h.text; help.classList.toggle('error', !!h.error);
      } else if (id === 'preset') {
        row.querySelector('.crow-val').textContent = t(`creator.preset.${c.preset}`);
        help.textContent = t(`creator.preset.${c.preset}.desc`);
      } else if (id === 'portrait') {
        const entry = PortraitView.entryFor(portraitReg, c.portraitId);
        const label = entry.sourceLabel || c.portraitId || '';
        const eye = entry.eyeLabel || 'unknown';
        const val = row.querySelector('.crow-val');
        val.textContent = label;
        val.title = `${label} · ${eye} · ${c.portraitId || ''}`;
        val.setAttribute('aria-label', val.title);
        help.textContent = t('creator.help.portrait');
        row.querySelector('.rare-tag').hidden = true;
      } else if (id.startsWith('trait:')) {
        const k = id.slice(6); const v = c.traits[k];
        row.querySelector('.sval').textContent = String(v);
        row.querySelector('.fill').style.width = `${pctOf(v, c.range)}%`;
        row.querySelector('.knob').style.left = `${pctOf(v, c.range)}%`;
        row.dataset.value = String(v);
      } else {
        row.querySelector('.crow-val').textContent = valueOf(c, id);
        row.querySelector('.rare-tag').hidden = !isRareOption(c, id);
        help.textContent = helpText(id);
      }
    }
    if (c.step === 1 && window.CatTraits) {
      const look = window.CatTraits.appearanceOf(c.appearanceText || '', Creator.genesFor(c), c.picks || [], c.droppedTags || []);
      const chips = document.querySelector('.appearance-chips');
      if (chips && chips.dataset.tags !== look.tags.join(',')) {
        chips.dataset.tags = look.tags.join(',');
        chips.replaceChildren(...look.tags.map((tag) => {
          const chip = el('button', 'appearance-chip', traitHint('ui.traits.tag.' + tag));
          chip.type = 'button';
          chip.addEventListener('click', (ev) => { ev.stopPropagation(); creatorDispatch('dropTag', tag); });
          return chip;
        }));
      }
      const gentle = document.querySelector('.appearance-gentle');
      if (gentle) gentle.textContent = look.colourNote ? traitHint(look.colourNote) : look.geneNote ? traitHint(look.geneNote) : '';
    }
    $('#creator-actions [data-cnav="next"]').hidden = c.step === 4;
    $('#creator-actions [data-cnav="start"]').hidden = c.step !== 4;
    $('#creator-actions [data-cnav="randomize"]').hidden = c.step > 2;
    $$('#creator-actions button').forEach((b) => b.classList.toggle('focused', b.dataset.cnav === c.focus));
    $('#creator-rand-help').textContent = t(c.step === 1 ? 'creator.help.randomize' : 'creator.help.randomizePersonality');
    const hintKey = { keyboard: 'creator.hint.keyboard', controller: 'creator.hint.gamepad', mouse: c.step === 2 ? 'creator.hint.mousePersonality' : 'creator.hint.mouse' }[device()] || 'creator.hint.keyboard';
    $('#creator-hint').textContent = t(hintKey);
    const preview = document.querySelector('.creator-preview');
    if (preview && !document.getElementById('stand-in-art')) {
      const cap = document.createElement('p');
      cap.id = 'stand-in-art';
      cap.textContent = 'Stand-in art';
      preview.append(cap);
    }
    const nm = Creator.normalizeName(c.name) || t('run.defaultCatName');
    const expand = $('#creator-expand'); if (expand) expand.dataset.name = nm;
    $('#creator-canvas').setAttribute('aria-label', t('creator.preview.alt', { catName: nm, sex: optLabel('sex', c.sex).toLowerCase(),
      coat: optLabel('coat', c.coat).toLowerCase(), markings: t(`creator.preview.markings.${c.markings}`), eyes: (c.oddEyes === 'on' && c.eyeRight ? `${optLabel('eyes', c.eyes)}/${optLabel('eyes', c.eyeRight)}` : optLabel('eyes', c.eyes)).toLowerCase() }));
    // Real DOM focus: the Name field takes it so typing works; everything else focuses its control (never the text field).
    const target = c.focus === 'name' ? $('#creator-name')
      : $(`#creator-actions [data-cnav="${c.focus}"]`) || $(`#creator-panel [data-row="${c.focus}"] .crow-val`) || $(`#creator-panel [data-row="${c.focus}"] .arrow[data-arrow="1"]`);
    const onDice = c.focus === 'name' && document.activeElement && document.activeElement.id === 'creator-name-dice';
    if (target && document.activeElement !== target && !onDice) target.focus({ preventScroll: true });
    fitActive();
  }
  /** Live preview (§2.1, §2.3): compositor.compose on poseFor(sex, 'adult'); redraws only when the look changes. */
  async function poseAssets(pose) {
    if (preview.poses.has(pose)) return preview.poses.get(pose);
    const p = (async () => {
      const data = await api.portraits.load(pose);
      const imgs = {};
      // decode() up front (Tracker C3) so the first compose doesn't pay for image decoding
      await Promise.all(Object.entries(data.images).map(async ([f, url]) => { const i = new Image(); i.src = url; try { await i.decode(); imgs[f] = i; } catch { /* missing → skipped layer */ } }));
      return { pose: data.pose, manifest: data.manifest, imgs };
    })();
    preview.poses.set(pose, p); p.catch(() => preview.poses.delete(pose));
    return p;
  }
  const composeOpts = (a, canvas) => ({ canvas, lifeStage: 'adult', scars: [], tintCache: preview.tints, dir: a.pose, pixelScale: PREVIEW_SCALE,
    loadImage: (f) => { const k = f.slice(a.pose.length + 1); return a.imgs[k] ? Promise.resolve(a.imgs[k]) : Promise.reject(new Error(`missing ${k}`)); } });
  /**
   * Tracker C3: at app start, load + decode both adult poses and warm the tint cache with every common coat on each (the layers that depend
   * on the coat are the expensive tint misses), so the creator's first draw and first Sex swap hit the cache. Idle work; never blocks the menu.
   */
  let preloading = null;
  function preloadPortraits() {
    if (preloading) return preloading;
    preloading = (async () => {
      const t0 = performance.now();
      const look = (sex, coat, markings, eyes) => ({ sex, coat, markings, eyes, oddEyes: 'off', eyeRight: null, traits: { ...Creator.PRESETS.balanced } });
      const warm = async (a, s) => { await Compositor.compose(a.manifest, Creator.genesFor(s), composeOpts(a, document.createElement('canvas'))); await new Promise((r) => setTimeout(r, 0)); };
      const pose = PortraitView.sharedPose(portraitReg);
      const sheet = await poseAssets(pose);
      await warm(sheet, look('female', 'tan', 'spotted', 'amber'));
      for (const coat of Creator.COATS) for (const markings of Creator.MARKINGS) { if (state === 'creator') break; await warm(sheet, look('female', coat, markings, 'amber')); }
      for (const eyes of Creator.EYES) { if (state === 'creator') break; await warm(sheet, look('female', 'tan', 'none', eyes)); }
      preview.preloadMs = performance.now() - t0;
    })().catch((e) => console.warn('portrait preload failed', e));
    return preloading;
  }
  async function renderPreview() {
    const c = creator; const key = [c.sex, c.coat, c.markings, c.eyes, c.oddEyes, c.eyeRight, c.portraitId || ''].join('|');
    if (key === preview.key) return;
    preview.key = key; const token = ++preview.token; const t0 = performance.now();
    const cv = $('#creator-canvas');
    try {
      if (c.portraitId) {
        const painted = await paintPortrait({ portraitId: c.portraitId, sex: c.sex, name: c.name, look: c, genes: Creator.genesFor(c) }, cv, { mode: 'full', place: 'creator' });
        if (token !== preview.token) return;
        Object.assign(preview, { ms: performance.now() - t0, drawn: painted.runtime ? [] : [c.portraitId], skipped: painted.runtime ? ['file'] : [], pose: painted.runtime ? PortraitView.sharedPose(portraitReg) : c.portraitId, rendered: key });
        preview.log.push({ key, ms: preview.ms });
        return;
      }
      // A static picker with no selected id does not draw the placeholder layers.
      if (c.staticArt) {
        paintJobs.delete(cv);
        cv._full = null; cv._portraitId = null; cv.dataset.runtime = '1'; cv.dataset.portraitId = ''; cv.dataset.artGap = '1';
        const g = cv.getContext('2d'); if (g && cv.width && cv.height) g.clearRect(0, 0, cv.width, cv.height);
        Object.assign(preview, { ms: performance.now() - t0, drawn: [], skipped: ['art-gap'], pose: null, rendered: key });
        return;
      }
      // Gene-look mode only, when the static registry is not in use.
      paintJobs.set(cv, { spec: { portraitId: null, sex: c.sex, name: c.name, look: c, genes: Creator.genesFor(c) }, opts: { mode: 'full', place: 'creator', compose: true } });
      const a = await poseAssets(PortraitView.sharedPose(portraitReg));
      const genes = Creator.genesFor(c);
      const plateKey = [a.pose, c.sex, c.coat, c.markings, c.eyes, c.oddEyes, c.eyeRight || ''].join('|');
      let plate = preview.plates.get(plateKey);
      if (!plate) {
        const ordered = Compositor.stackOrder(a.manifest.layers || [], Compositor.genesToLayers(genes, { lifeStage: 'adult', scars: [] }));
        const eyeIds = new Set(['eye_left', 'eye_right']);
        let seenEye = false; const beforeIds = [], afterIds = [];
        for (const layer of ordered) {
          if (eyeIds.has(layer.id)) { seenEye = true; continue; }
          (seenEye ? afterIds : beforeIds).push(layer.id);
        }
        const bodyKey = [a.pose, c.sex, c.coat, c.markings].join('|');
        let body = preview.bodies.get(bodyKey);
        if (!body) {
          const before = document.createElement('canvas');
          const after = document.createElement('canvas');
          const bres = await Compositor.compose(a.manifest, genes, { ...composeOpts(a, before), onlyIds: beforeIds, skipLineart: true });
          const ares = await Compositor.compose(a.manifest, genes, { ...composeOpts(a, after), onlyIds: afterIds });
          body = { before, after, drawnBefore: bres.drawn, drawnAfter: ares.drawn, skipped: bres.skipped.concat(ares.skipped) };
          preview.bodies.set(bodyKey, body);
        }
        const eyes = document.createElement('canvas');
        const eres = await Compositor.compose(a.manifest, genes, { ...composeOpts(a, eyes), onlyIds: ['eye_left', 'eye_right'], skipLineart: true });
        const off = document.createElement('canvas');
        off.width = body.before.width || eyes.width; off.height = body.before.height || eyes.height;
        const g = off.getContext('2d');
        if (body.before.width) g.drawImage(body.before, 0, 0);
        if (eyes.width) g.drawImage(eyes, 0, 0);
        if (body.after.width) g.drawImage(body.after, 0, 0);
        plate = { canvas: off, drawn: body.drawnBefore.concat(eres.drawn, body.drawnAfter), skipped: body.skipped.concat(eres.skipped) };
        preview.plates.set(plateKey, plate);
      }
      if (token !== preview.token) return;
      cv.width = plate.canvas.width; cv.height = plate.canvas.height;
      cv.getContext('2d').drawImage(plate.canvas, 0, 0);
      cv.dataset.portraitMode = 'full';
      const res = plate;
      cv._full = plate.canvas; cv._portraitId = null; cv.dataset.runtime = '1'; cv.dataset.portraitId = ''; cv.dataset.artGap = '0';
      Object.assign(preview, { ms: performance.now() - t0, drawn: res.drawn, skipped: res.skipped, pose: a.pose, rendered: key });
      preview.log.push({ key, ms: preview.ms });
    } catch (e) {
      console.warn('creator preview failed', e);   // never blocks the creator
      if (token === preview.token) Object.assign(preview, { ms: null, drawn: [], skipped: ['*'], rendered: key });
    }
  }
  function creatorDispatch(action, arg) {
    if (!creator || starting) return;
    const { state: next, effect } = Creator.reduce(creator, action, arg, creatorEnv());
    creator = next;
    if (effect && effect.type === 'leave') { show('newGameSetup'); return; }   // §1.3: back to setup, its choices kept; no confirmation
    applyCreator(); renderPreview();
    if (effect && effect.type === 'start') {
      const panel = $('#creator-panel'); if (panel) panel.textContent = '';
      starting = true; startNewGame({ ...pendingSetup, mainCat: effect.mainCat }).finally(() => { starting = false; });
    }
  }
  // Mouse: arrows change a row, a value click cycles it, the track sets a slider, buttons act; hover moves focus only.
  $(CSCREEN).addEventListener('click', (ev) => {
    const level = ev.target.closest('[data-creator-level]');
    if (level && pendingSetup && !dialog) {
      pendingSetup.level = level.dataset.creatorLevel;
      if (pendingSetup.difficulty === 'sandbox' && api.achievements) { /* level is stored when the run is created */ }
      renderCreatorLevels();
      return;
    }
    if (dialog || state !== 'creator') return;
    const arrow = ev.target.closest('.arrow');
    if (arrow) return creatorDispatch('arrow', { id: arrow.closest('.crow').dataset.row, dir: Number(arrow.dataset.arrow) });
    const b = ev.target.closest('[data-cnav]');
    if (b) return creatorDispatch('click', b.dataset.cnav);
  });
  let dragTrack = null;
  const trackValue = (track, x) => { const r = track.getBoundingClientRect(); const f = Math.min(1, Math.max(0, (x - r.left) / r.width)); return creator.range.min + f * (creator.range.max - creator.range.min); };
  $(CSCREEN).addEventListener('mousedown', (ev) => {
    const tr = ev.target.closest('.track'); if (!tr || ev.button !== 0 || state !== 'creator') return;
    dragTrack = tr; creatorDispatch('setTrait', { trait: tr.dataset.trait, value: trackValue(tr, ev.clientX) });
  });
  addEventListener('mousemove', (ev) => { if (dragTrack && state === 'creator') creatorDispatch('setTrait', { trait: dragTrack.dataset.trait, value: trackValue(dragTrack, ev.clientX) }); });
  addEventListener('mouseup', () => { dragTrack = null; });
  // Hover follows actual pointer movement: a screen opening under a resting pointer fires mouseover, which must not steal focus.
  addEventListener('mousemove', (ev) => { if (!dialog && state === 'creator' && creator && !dragTrack && (ev.movementX || ev.movementY)) creatorHover(ev.target); });
  function creatorHover(target) {
    const row = target.closest('#creator-panel .crow'); const b = target.closest('#creator-actions [data-cnav]');
    const id = b ? b.dataset.cnav : row ? row.dataset.row : null;
    if (id && id !== creator.focus) creatorDispatch('hover', id);
  }

  function renderReplace() {
    const box = $('#replace-runs'); box.innerHTML = '';
    runs.forEach((r, i) => {
      const b = runCard(r, i);
      b.addEventListener('click', () => confirmDialog(t('replaceConfirm.body', { runLabel: runLabel(r) }), t('replaceConfirm.ok'), () => {
        replaceRunId = r.runId; openSetup();
      }));
      box.appendChild(b);
    });
  }

  // ---------- load ----------
  function renderLoad() {
    const box = $('#run-list'); box.innerHTML = '';
    runs.forEach((r, i) => {
      const card = runCard(r, i); box.appendChild(card);
      if (!r) return;
      card.addEventListener('click', () => { expandedRunId = expandedRunId === r.runId ? null : r.runId; state = expandedRunId ? 'loadRunExpanded' : 'load'; renderLoad(); focus($(`.run[data-run-id="${r.runId}"]`)); });
      if (expandedRunId !== r.runId) return;
      card.classList.add('expanded');
      const list = document.createElement('div'); list.className = 'saves';
      for (const sv of r.saves) {
        const b = document.createElement('button'); b.dataset.runId = r.runId; b.dataset.saveId = sv.saveId;
        // B8: saves of a damaged run are never loadable (still deletable via the run).
        if (sv.damaged || r.damaged) { b.textContent = t('load.damagedSave'); b.dataset.damaged = '1'; b.addEventListener('click', () => toast(t('toast.saveDamaged'))); }
        else {
          const d = sv.inGameDate || {};
          const seasonName = d.season ? t(`season.${d.season}`) : '';
          b.textContent = seasonName ? `A ${seasonName.toLowerCase()} save` : 'A saved day';
          b.addEventListener('click', () => loadSave(r.runId, sv.saveId));
        }
        list.appendChild(b);
      }
      if (!r.saves.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = t('load.noSaves'); list.appendChild(p); }
      const del = document.createElement('button'); del.className = 'danger'; del.textContent = t('load.deleteRun'); del.dataset.deleteRun = r.runId;
      del.addEventListener('click', () => askDeleteRun(r)); list.appendChild(del);
      box.appendChild(list);
    });
  }
  function askDeleteRun(r) {
    confirmDialog(t('deleteRunConfirm.body', { runLabel: runLabel(r) }), t('deleteRunConfirm.ok'), async () => {
      await api.menu.deleteRun(r.runId); expandedRunId = null; await refreshSlots();
      if (!hasRuns()) return show('root');          // B9: nothing left → root default focus, not disabled Load
      show('load');
    });
  }
  function askDeleteSave(runId, saveId) {
    confirmDialog(t('deleteSaveConfirm.body'), t('common.delete'), async () => {
      await api.menu.deleteSave(runId, saveId); await refreshSlots(); show('loadRunExpanded', `.run[data-run-id="${runId}"]`);
    });
  }

  // ---------- settings ----------
  const pct = (v) => `${Math.round(v * 100)}%`;
  const SETTINGS_UI = {
    audio: [['master', 'slider'], ['music', 'slider'], ['sfx', 'slider'], ['ambient', 'slider'], ['mute', 'toggle']],
    display: [['mode', ['fullscreen', 'borderless', 'windowed']], ['uiScale', [0.8, 0.9, 1.0, 1.1, 1.25]], ['reducedMotion', 'toggle'], ['vsync', 'toggle']],
    controls: [['controllerVibration', 'toggle'], ['invertY', 'toggle']]
  };
  function valueLabel(tab, key, kind, v) {
    if (kind === 'slider') return pct(v);
    if (kind === 'toggle') return t(v ? 'common.on' : 'common.off');
    if (tab === 'display' && key === 'mode') return t(`settings.display.mode.${v}`);
    if (key === 'uiScale') return pct(v);
    return String(v);
  }
  function renderSettings() {
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === settingsTab));
    const body = $('#tab-body'); body.innerHTML = '';
    if (settingsTab === 'storyteller') {
      for (const m of copy.storytellerModes) {
        const b = document.createElement('button'); b.className = 'setting option'; b.dataset.mode = m.id;
        b.innerHTML = '<span class="name"></span><span class="desc"></span>';
        b.querySelector('.name').textContent = m.name; b.querySelector('.desc').textContent = m.description;
        b.classList.toggle('selected', settings.storyteller.mode === m.id);
        b.addEventListener('click', () => selectStoryteller(m.id));
        body.appendChild(b);
      }
      return;
    }
    for (const [key, kind] of SETTINGS_UI[settingsTab]) {
      const b = document.createElement('button'); b.className = 'setting'; b.dataset.key = key;
      b.innerHTML = '<span></span><span class="val"></span>';
      b.children[0].textContent = t(`settings.${settingsTab}.${key}`);
      b.children[1].textContent = `◀ ${valueLabel(settingsTab, key, kind, settings[settingsTab][key])} ▶`;
      b.addEventListener('click', () => adjust(b, 1));
      body.appendChild(b);
    }
  }
  function changed() { settingsDirty = true; api.settings.stage(settings); applyLive(); }   // B11: main holds staged copy
  function adjust(btn, dir) {
    const key = btn.dataset.key; const [, kind] = SETTINGS_UI[settingsTab].find((r) => r[0] === key);
    let v = settings[settingsTab][key];
    if (kind === 'slider') v = Math.min(1, Math.max(0, Math.round((v + dir * 0.05) * 100) / 100));
    else if (kind === 'toggle') v = !v;
    else { const i = kind.indexOf(v); v = kind[((i < 0 ? 0 : i) + dir + kind.length) % kind.length]; }
    settings[settingsTab][key] = v; changed();
    renderSettings(); focus($(`#tab-body [data-key="${key}"]`));
  }
  const motionMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function motionReduced() { return !!(settings.display && settings.display.reducedMotion) || !!(motionMq && motionMq.matches); }
  function applyMotion() {
    document.body.classList.toggle('reduced-motion', motionReduced());
    document.body.classList.toggle('menu-hidden', state === 'game' || state === 'summary');
    if (motionReduced() || state !== 'credits') { clearInterval(creditsTimer); creditsTimer = null; }
  }
  function applyLive() { music.setAudio(settings.audio); applyMotion(); scale(); }
  if (motionMq && motionMq.addEventListener) motionMq.addEventListener('change', applyMotion);

  async function fallbackToast(mode, effective) {
    if (effective && effective !== mode) toast(t('toast.storytellerFallback', { fromShort: t(`storyteller.shortName.${mode}`), toShort: t(`storyteller.shortName.${effective}`) }));
  }
  async function selectStoryteller(mode) {
    settings.storyteller.mode = mode; changed();
    renderSettings(); focus($(`#tab-body [data-mode="${mode}"]`));
    fallbackToast(mode, (await api.storyteller.effective(mode)).mode);
  }
  function switchTab(delta) {
    const tabs = ['audio', 'display', 'controls', 'storyteller'];
    settingsTab = tabs[(tabs.indexOf(settingsTab) + delta + tabs.length) % tabs.length];
    renderSettings(); focus(focusables()[0]);
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => { settingsTab = b.dataset.tab; renderSettings(); focus(focusables()[0]); }));
  async function leaveSettings() {
    if (settingsDirty) { settings = await api.settings.set(settings); settingsDirty = false; }
    show('root', $('[data-action="settings"]'));
  }

  // ---------- credits ----------
  let creditsTimer = null, fastScroll = false;
  function startCredits() {
    const roll = $('#credits-roll'); roll.scrollTop = 0; clearInterval(creditsTimer);
    if (motionReduced()) return;
    creditsTimer = setInterval(() => { roll.scrollTop += fastScroll ? 6 : 1; }, 30);
  }
  addEventListener('keyup', (e) => { if (state === 'credits' && (e.key === 'ArrowDown' || e.key === 's')) fastScroll = false; });

  // ---------- dialogs ----------
  function confirmDialog(text, okLabel, onOk) {
    dialog = { onOk, prev: current(), prevState: state };
    $('#dialog-text').textContent = text; $('#dialog-ok').textContent = okLabel;
    $('#dialog').hidden = false; focus($('#dialog-cancel'));
    if (state === 'root') state = 'quitConfirm';
  }
  function closeDialog() {
    const d = dialog; dialog = null; $('#dialog').hidden = true;
    if (state === 'quitConfirm') state = 'root';
    if (state === 'newGameSetup') applySetup(); else focus(d && d.prev);
  }
  $('#dialog-ok').addEventListener('click', () => { const fn = dialog.onOk; closeDialog(); fn(); });
  $('#dialog-cancel').addEventListener('click', closeDialog);

  // ---------- slice 1 game (js/game-screen.js over js/slice.js) ----------
  /** NPC / player portrait: same compositor as the creator. spec = {genes, sex} (player) | {look, sex} (NPC: a common creator look). */
  const portraits = PortraitView.createSession(PortraitView.FALLBACK);
  let portraitReg = portraits.registry();
  const paintJobs = new Map();
  function repaintPortraits() {
    for (const [canvas, job] of paintJobs) {
      if (!canvas || !canvas.isConnected) continue;
      let spec = job.spec;
      if (canvas.id === 'creator-canvas' && creator) spec = { ...spec, portraitId: creator.portraitId || null, sex: creator.sex, name: creator.name, look: creator, genes: Creator.genesFor(creator) };
      paintPortrait(spec, canvas, job.opts);
    }
  }
  fetch('../../assets/portraits/registry.json').then((r) => r.ok ? r.json() : null).then((j) => {
    if (!j) return;
    const adopted = portraits.adopt(j);
    portraitReg = portraits.registry();
    const ids = portraitReg.portraits.map((p) => p.id);
    if (typeof Slice !== 'undefined' && Slice.setRegisteredPortraits) Slice.setRegisteredPortraits(ids);
    if (adopted.ok && creator && ids.length && !creator.staticArt) {
      creator = Creator.coerceLook({ ...creator, staticArt: true, portraitIds: ids, portraitId: ids.includes(creator.portraitId) ? creator.portraitId : ids[0] });
      preview.key = '';
      if (state === 'creator') applyCreator();
    }
    if (adopted.ok) repaintPortraits();
  }).catch(() => {});
  async function paintRuntime(spec, off) {
    const genes = spec.genes || Creator.genesFor({ oddEyes: 'off', eyeRight: null, traits: { ...Creator.PRESETS.balanced }, ...spec.look, sex: spec.sex || 'female' });
    const a = await poseAssets(PortraitView.sharedPose(portraitReg));
    await Compositor.compose(a.manifest, genes, composeOpts(a, off));
    return PortraitView.entryFor(portraitReg, null, spec && spec.sex);
  }
  function composeGenes(spec) {
    if (spec && spec.genes && spec.genes.loci) return spec.genes;
    const look = { ...((spec && spec.look) || {}), sex: (spec && spec.sex) || (spec && spec.look && spec.look.sex) || 'female' };
    if (!look.traits) look.traits = (spec && spec.personality) || { ...Creator.PRESETS.balanced };
    return Creator.genesFor(look);
  }
  async function paintPortrait(spec, canvas, opts = {}) {
    if (!canvas) return { ok: false, id: null, runtime: true, stale: false };
    paintJobs.set(canvas, { spec, opts });
    const job = portraits.begin(canvas);
    const entry = PortraitView.entryFor(job.registry, spec && spec.portraitId, spec && spec.sex);
    const still = () => portraits.current(canvas, job.token, job.generation);
    try {
      const off = document.createElement('canvas');
      const Modes = typeof PortraitModes !== 'undefined' ? PortraitModes : null;
      const art = Modes && Modes.resolveArt(spec);
      const cub = !!(art && art.stage === 'cub');
      const stage = art ? art.stage : (spec && (spec.lifeStage || spec.stage));
      if (cub) entry.file = null;
      const composed = cub || !!(opts.compose && (spec.genes || spec.look)) || (!entry.file && (spec.genes || spec.look));
      let head = cub ? art.crop : (Modes ? Modes.cropFor(spec) : entry.head);
      let shownId = entry.runtime ? null : entry.id;
      let runtime = entry.runtime;
      if (composed) {
        const pose = cub ? art.pose : (Modes ? Modes.poseFor(spec && spec.sex, stage) : PortraitView.sharedPose(job.registry));
        try {
          const a = await poseAssets(pose);
          if (!still()) return { ok: true, id: null, runtime: true, stale: true };
          await Compositor.compose(a.manifest, composeGenes(spec), Object.assign({}, composeOpts(a, off), { lifeStage: stage || 'adult' }));
          shownId = 'composed';
          runtime = true;
        } catch (err) {
          if (!cub) throw err;
          const img = new Image();
          img.src = new URL('../../assets/portraits/' + Modes.cubFallback(spec), window.location.href).href;
          await img.decode();
          off.width = img.naturalWidth; off.height = img.naturalHeight;
          off.getContext('2d').drawImage(img, 0, 0);
          shownId = 'cub-fallback';
          runtime = false;
        }
      } else if (entry.file) {
        try {
          const img = new Image();
          img.src = new URL('../../assets/portraits/' + entry.file, window.location.href).href;
          await img.decode();
          if (!still()) return { ok: true, id: null, runtime: false, stale: true };
          off.width = img.naturalWidth; off.height = img.naturalHeight;
          off.getContext('2d').drawImage(img, 0, 0);
        } catch (e) {
          if (!still()) return { ok: true, id: null, runtime: true, stale: true };
          console.warn('portrait file missing; placeholder layers are not used', entry.file, e);
          shownId = null; runtime = true;
        }
      } else {
        shownId = null; runtime = true;
      }
      if (!still()) return { ok: true, id: null, runtime, stale: true };
      if (!shownId || !off.width) {
        canvas._full = null;
        canvas._portraitId = null;
        canvas.dataset.portraitId = '';
        canvas.dataset.runtime = '1';
        canvas.dataset.artGap = '1';
        const g = canvas.getContext('2d');
        if (g && canvas.width && canvas.height) g.clearRect(0, 0, canvas.width, canvas.height);
        return { ok: true, id: null, runtime: true, artGap: true, stale: false };
      }
      canvas.dataset.artGap = '0';
      canvas._full = off;
      canvas._portraitId = shownId;
      canvas.dataset.portraitId = shownId && shownId !== 'composed' ? shownId : '';
      canvas.dataset.runtime = runtime ? '1' : '0';
      const placeMode = Modes && opts.place ? Modes.modeFor(opts.place) : null;
      const mode = placeMode === 'headshot' || opts.frame === 'head' || opts.mode === 'headshot' ? 'headshot' : 'full';
      canvas.dataset.portraitMode = mode;
      if (mode === 'headshot' && art) head = art.crop;
      if (mode === 'headshot') PortraitView.blitHead(off, canvas, head);
      else { canvas.width = off.width; canvas.height = off.height; canvas.getContext('2d').drawImage(off, 0, 0); }
      return { ok: true, id: shownId, runtime, stale: false };
    } catch (e) {
      if (!still()) return { ok: false, id: null, runtime: true, stale: true };
      console.warn('portrait paint failed', e);
      const g = canvas.getContext('2d');
      if (g && canvas.width && canvas.height) g.clearRect(0, 0, canvas.width, canvas.height);
      canvas._full = null; canvas._portraitId = null; canvas.dataset.runtime = '1'; canvas.dataset.portraitId = '';
      return { ok: false, id: null, runtime: true, stale: false };
    }
  }
  async function portrait(spec, canvas, opts = {}) {
    try { return await paintPortrait(spec, canvas, opts); }
    catch (e) { console.warn('portrait paint failed', e); return { ok: false, id: null, runtime: true, stale: false }; }
  }
  let viewerOpener = null;
  function openCatViewer(source, name, opener) {
    if (!source) return false;
    const dest = $('#cat-viewer-canvas');
    dest.width = source.width; dest.height = source.height;
    dest.getContext('2d').drawImage(source, 0, 0);
    $('#cat-viewer-name').textContent = name || '';
    $('#cat-viewer').hidden = false;
    viewerOpener = opener || null;
    syncInert();
    focus($('#cat-viewer-close'));
    return true;
  }
  function closeCatViewer() {
    const box = $('#cat-viewer');
    if (!box || box.hidden) return false;
    box.hidden = true;
    const opener = viewerOpener;
    viewerOpener = null;
    syncInert();
    if (opener && opener.isConnected && !opener.disabled) focus(opener);
    else if (state === 'game' && game) game.refocus();
    return true;
  }
  function cycleViewer(delta) {
    const f = viewerButtons(); if (!f.length) return;
    focus(f[Nav.step(f.length, f.indexOf(current()), delta)]);
  }
  /** Escape / Main menu: back to the root menu; the autosave after every action already holds the run (Flint call). */
  async function leaveGame() { await refreshSlots(); show('root', $('[data-action="continue"]')); }
  let seedOverride = null;
  const nextSeed = () => { const x = seedOverride; seedOverride = null; return x === null ? Rng.newSeed() : x; };
  const game = copy.gameData ? GameScreen.create({ api, t, $, show, focus, toast, portrait, leave: leaveGame,
    creatorLooks: { coats: Creator.COATS, markings: Creator.MARKINGS, eyes: Creator.EYES } }, copy.gameData, copy.nameData) : null;

  // ---------- actions ----------
  /** Creator Start (v1.4): menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, mainCat}. The replaced run is deleted only now (main). */
  function renderCreatorLevels() {
    const box = $('#creator-levels');
    if (!box || !window.Difficulty || !pendingSetup) return;
    box.replaceChildren(...window.Difficulty.LEVELS.map((id) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.creatorLevel = id;
      b.className = 'level-choice' + (pendingSetup.level === id ? ' is-on' : '');
      b.textContent = LEVEL_NAMES[id] || id;
      return b;
    }));
    const line = $('#creator-level-flavour');
    if (line) line.textContent = levelFlavour(pendingSetup.level || 'standard');
  }
  async function startNewGame({ style, difficulty, sandboxOptions, mainCat, tutorial, level }) {
    const res = await api.menu.newGame({ style, difficulty, level: level || 'standard', replaceRunId: replaceRunId || undefined, sandboxOptions, mainCat, tutorial: tutorial === true });
    if (!res.ok) { toast(t('toast.startFailed')); return; }   // B12: raw error is logged by main only
    fallbackToast(res.storyteller?.preferred, res.storyteller?.effective);
    replaceRunId = null; creator = null;
    if (game && res.mainCat) return game.start(res.run, res.mainCat, nextSeed());
    $('#placeholder-detail').textContent = t('placeholder.newRun', { styleName: styleName(style), deathRuleName: diffName(difficulty), slot: res.run.slotIndex + 1 });
    show('starting');
  }
  async function loadSave(runId, saveId) {
    const res = await api.menu.loadSave(runId, saveId);
    if (!res.ok) { toast(t('toast.saveLoadFailed')); return; }
    if (res.game && game) { try { return game.resume(res.run, res.game); } catch (e) { console.warn('slice save rejected', e); toast(t('toast.saveLoadFailed')); return; } }
    const r = runs.find((x) => x && x.runId === runId);
    $('#placeholder-detail').textContent = r ? t('placeholder.loading', { runLabel: runLabel(r) }) : t('placeholder.loadingFallback');
    show('loading');
  }
  function openSetup() {
    // Every New Game resets to the defaults: Standard, Heir, default Sandbox options (B7, spec v1.3).
    setup = Nav.setupInit(setupStyles().map((d) => d.id), setupDeaths().map((d) => d.id), optionDefs());
    setup.level = 'standard';
    show('newGameSetup');
  }
  const quit = () => confirmDialog(t('quitConfirm.body'), t('quitConfirm.ok'), () => api.app.quit());
  async function newGame() {
    await refreshSlots(); replaceRunId = null;
    if (runs.some((r) => r === null)) return openSetup();
    show('slotsFull');
  }
  function showLegacy(runId) { legacyRunId = runId; show('legacy'); }
  api.onLegacyEnd(({ runId }) => showLegacy(runId));
  const ACTIONS = {
    continue: () => { const s = latestValid(); if (s) loadSave(s.runId, s.saveId); },
    newGame,
    load: async () => { await refreshSlots(); expandedRunId = null; show('load'); },
    settings: () => show('settings'),
    credits: () => show('credits'),
    quit,
    newLineage: async () => { await api.menu.newLineage(legacyRunId); $('#placeholder-detail').textContent = t('placeholder.newLineage'); show('starting'); },
    resetTab: () => confirmDialog(t('settings.resetConfirm.body', { tabName: t(`settings.tab.${settingsTab}`) }), t('settings.resetConfirm.ok'), async () => {
      // B3: reset only this tab; keep unsaved edits on other tabs (local reset, persisted on leave).
      settings[settingsTab] = JSON.parse(JSON.stringify(copy.settingsDefaults[settingsTab])); changed();
      renderSettings(); focus(focusables()[0]);
    }),
    back: () => goBack()
  };
  async function goBack() {
    if (dialog) return closeDialog();
    if (state === 'settings') return leaveSettings();
    if (state === 'root') return quit();
    if (state === 'creator') return creatorDispatch('back');
    if (state === 'game' || state === 'summary') return leaveGame();
    if (state === 'loadRunExpanded') { const id = expandedRunId; expandedRunId = null; show('load', `.run[data-run-id="${id}"]`); return; }
    clearInterval(creditsTimer);
    if (state === 'newGameSetup') replaceRunId = null;
    const from = { newGameSetup: 'newGame', slotsFull: 'newGame', load: 'load', credits: 'credits' }[state];
    await refreshSlots();
    show('root', from ? $(`[data-action="${from}"]`) : null);
  }
  document.addEventListener('click', (ev) => {
    const g = ev.target.closest('[data-g]');
    if (g && g.dataset.g === 'closeViewer') { closeCatViewer(); return; }
    if (g && g.dataset.g === 'closeInspect') { closeInspect(); return; }
    if (g && g.dataset.g === 'expandCat') {
      const src = document.getElementById(g.dataset.source);
      openCatViewer(src && src._full, g.dataset.name || '', g);
      return;
    }
    if (g && game && !g.disabled) {
      if (modalOpen() && g.dataset.g !== 'closeInspect' && g.dataset.g !== 'closeViewer' && !g.closest('#cat-viewer') && !g.closest('#encounter-inspect')) return;
      game.onClick(g);
      syncInert();
      return;
    }
    const b = ev.target.closest('[data-action]'); if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action]();
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || !modalOpen()) return;
    ev.preventDefault();
    ev.stopPropagation();
    const delta = ev.shiftKey ? -1 : 1;
    if (inspectOpen()) {
      const f = inspectButtons();
      if (!f.length) return;
      const i = f.indexOf(current());
      focus(f[Nav.step(f.length, i, delta)]);
      return;
    }
    cycleViewer(delta);
  }, true);
  Input.on((a) => {
    if (inspectOpen()) {
      if (a === 'back') { closeInspect(); return; }
      if (a === 'confirm' || a === 'start') { const el = current(); if (el) el.click(); return; }
      return;
    }
    if (viewerOpen()) {
      if (a === 'back') { closeCatViewer(); return; }
      if (a === 'up' || a === 'left' || a === 'tabPrev') { cycleViewer(-1); return; }
      if (a === 'down' || a === 'right' || a === 'tabNext') { cycleViewer(1); return; }
      if (a === 'confirm' || a === 'start') { const el = current(); if (el && $('#cat-viewer').contains(el)) el.click(); return; }
      return;
    }
    const el = current();
    if (!dialog && state === 'newGameSetup') return setupDispatch(a === 'start' ? 'confirm' : a);
    if (!dialog && state === 'creator') {
      const live = document.activeElement;
      if ((a === 'confirm' || a === 'start') && live && live.dataset && live.dataset.g === 'expandCat') { live.click(); return; }
      return ['tabPrev', 'tabNext', 'delete'].includes(a) ? undefined : creatorDispatch(a);
    }
    if (['up', 'down', 'pageup', 'pagedown', 'home', 'end'].includes(a) && scrollProse(a)) return;
    if (a === 'up') return move(-1);
    if (a === 'down') { if (state === 'credits') fastScroll = true; return move(1); }
    if (a === 'left' || a === 'right') {
      const d = a === 'left' ? -1 : 1;
      if (!dialog && state === 'settings') return el && el.dataset.key ? adjust(el, d) : switchTab(d);   // B5
      return move(d);
    }
    if (a === 'tabPrev' || a === 'tabNext') { if (!dialog && state === 'settings') switchTab(a === 'tabPrev' ? -1 : 1); return; }
    if (a === 'confirm' || (a === 'start' && state === 'root')) { if (state === 'credits' && !dialog) return goBack(); if (el) el.click(); return; }
    if (a === 'back') return goBack();
    if (a === 'delete' && !dialog && (state === 'load' || state === 'loadRunExpanded') && el) {
      if (el.dataset.saveId) return askDeleteSave(el.dataset.runId, el.dataset.saveId);
      const id = el.dataset.deleteRun || el.dataset.runId; const r = id && runs.find((x) => x && x.runId === id);
      if (r) askDeleteRun(r);
    }
  });

  // Dev hook used by `--screenshots`; harmless in production.
  window.__menuDebug = {
    music: () => music.debug(),
    menuLock: () => copy.menuLock,
    state: () => ({ state, setup, creator, dialog: !!dialog, focused: current()?.dataset.nav || current()?.dataset.action || current()?.textContent }),
    /** Sets a look on the open creator and waits for its preview (e2e check 1: all 72 looks render with no missing layer). */
    creatorLook: async (look) => { creator = Creator.coerceLook({ ...creator, ...look }); applyCreator(); await renderPreview(); return { ms: preview.ms, drawn: preview.drawn, skipped: preview.skipped, pose: preview.pose, rendered: preview.rendered }; },
    creator: () => ({ model: creator, pending: pendingSetup, replaceRunId, preview: { ms: preview.ms, drawn: preview.drawn, skipped: preview.skipped, pose: preview.pose, rendered: preview.rendered, log: preview.log, preloadMs: preview.preloadMs } }),
    /** Resolves when the app-start portrait preload (C3) has finished. */
    portraitsReady: () => preloadPortraits().then(() => preview.preloadMs),
    setUiScale: (v) => { settings.display.uiScale = v; scale(); },
    /** Slice 1: seed for the next new run (deterministic e2e), current game state, and a test-only state patch (death path). */
    setGameSeed: (n) => { seedOverride = n >>> 0; },
    paintPortrait: (spec, canvas, opts) => paintPortrait(spec, canvas, opts),
    adoptRegistry: (raw) => { const r = portraits.adopt(raw); portraitReg = portraits.registry(); if (r.ok) repaintPortraits(); return { ok: r.ok, error: r.error, count: portraitReg.portraits.length }; },
    portraitOf: (id, sex) => PortraitView.entryFor(portraits.registry(), id, sex || 'female'),
    setPortraitId: async (id) => { if (!creator) return null; creator = { ...creator, portraitId: id }; preview.key = ''; await renderPreview(); return { portraitId: creator.portraitId, canvas: $('#creator-canvas')._portraitId || null, runtime: $('#creator-canvas').dataset.runtime }; },
    assignPortrait: (slot, id) => {
      if (!game || !game.state()) return null;
      const s = game.state();
      if (slot === 'player') s.cat.portraitId = id;
      else if (s.npcs[slot]) s.npcs[slot].portraitId = id;
      game.render();
      return slot === 'player' ? s.cat.portraitId : s.npcs[slot] && s.npcs[slot].portraitId;
    },
    forceMeeting: (slot) => {
      if (!game || !game.state()) return null;
      const s = game.state(); const n = s.npcs[slot]; if (!n) return null;
      n.met = true;
      s.phase = 'event';
      s.pending = { eventId: 'slice.meeting.highcrag', kind: 'first_meeting', catId: slot, catName: n.name, day: s.day, hostile: false, choiceId: null };
      game.render();
      return { day: s.day, seed: s.seed, affinity: n.affinity, name: n.name, choiceId: s.pending.choiceId, phase: s.phase };
    },
    reloadGame: (saved) => { if (game && game.run()) game.resume(game.run(), saved); },
    creditsRunning: () => !!creditsTimer,
    game: () => (game ? { state: game.state(), run: game.run(), available: game.state() ? game.E.available(game.state()) : null, summary: game.state() ? game.E.summary(game.state()) : null, busy: game.busy(), render: () => game.render() } : null),
    /** Direct slice handler. A refusal leaves the live state untouched. */
    gameAct: (action) => {
      if (!game || !game.state()) return { error: 'no-game' };
      const r = game.E.act(game.state(), action);
      if (!r.error) { game.setState(r.state); game.render(); }
      const s = game.state();
      const pending = s.conversation && s.conversation.pending;
      const cat = pending && s.conversation.cats && s.conversation.cats[pending.catId];
      return {
        error: r.error || null,
        energy: s.needs.energy, hunger: s.needs.hunger, thirst: s.needs.thirst,
        node: pending ? pending.nodeId : null,
        ledger: s.conversation ? s.conversation.ledger.length : 0,
        slot: s.conversation ? s.conversation.slotDay : null,
        cooldown: cat ? cat.cooldownUntilDay : null,
        phase: s.phase,
        costRows: s.conversation ? s.conversation.ledger.filter((row) => row.costApplied).length : 0
      };
    },
    gamePatch: (patch) => { const g = JSON.parse(JSON.stringify(game.state())); for (const [k, v] of Object.entries(patch)) g[k] = v && typeof v === 'object' && !Array.isArray(v) && g[k] && typeof g[k] === 'object' ? { ...g[k], ...v } : v; game.setState(g); game.render(); },
    show: async (s) => {
      if (dialog) closeDialog();
      await refreshSlots();
      if (s.startsWith('settings:')) { settingsTab = s.split(':')[1]; return show('settings'); }
      if (s === 'quitConfirm') { show('root'); return quit(); }
      if (s === 'starting') { $('#placeholder-detail').textContent = t('placeholder.newRun', { styleName: styleName('standard'), deathRuleName: diffName('permadeath'), slot: 1 }); return show('starting'); }
      if (s === 'root') return show('root');
      if (s === 'newGame') return openSetup();                                                             // defaults: Standard + Heir
      if (s === 'newGame:sim') { openSetup(); ['right', 'confirm', 'down', 'left', 'confirm'].forEach((a) => setupDispatch(a)); return; } // Sim + Permadeath
      if (s === 'newGame:sandbox') { openSetup(); ['left', 'confirm', 'down', 'right', 'confirm', 'right'].forEach((a) => setupDispatch(a)); return; } // Story + Sandbox, focus in panel
      if (s === 'creator') { openSetup(); return setupDispatch('click', 'begin'); }                                   // Standard + Heir, step 1
      if (s === 'creator:personality') { openSetup(); setupDispatch('click', 'begin'); return creatorDispatch('click', 'next'); }
      if (s === 'creator:sandbox') { openSetup(); setupDispatch('click', 'death:sandbox'); setupDispatch('click', 'begin'); return creatorDispatch('click', 'next'); } // Free Customization On → 0–100
      if (s === 'creator:sandbox-look') { openSetup(); setupDispatch('click', 'death:sandbox'); setupDispatch('click', 'begin');                 // §3c: ash + odd eyes
        creator = Creator.coerceLook({ ...creator, name: 'Larchwind', sex: 'female', coat: 'ash', markings: 'spotted', eyes: 'amber', oddEyes: 'on', eyeRight: 'green', focus: 'eyeRight' });
        applyCreator(); return renderPreview(); }
      if (s === 'slotsFull') return show('slotsFull');
      if (s === 'load') { expandedRunId = null; return show('load'); }
      if (s === 'load:expanded') { const r = runs.find((x) => x && !x.damaged); expandedRunId = r.runId; show('loadRunExpanded'); return focus($('.saves button')); }
      if (s === 'continue') { show('root'); return ACTIONS.continue(); }
      if (s === 'legacy') return showLegacy(runs.find(Boolean)?.runId);
      show(s);
    }
  };

  // ---------- boot ----------
  applyArt(); applyLive(); pickTagline();
  const info = await api.app.info(); $('#version').textContent = t('app.version', { version: info.version, build: info.build });
  await refreshSlots();
  show('root');
  setTimeout(preloadPortraits, 0);   // C3: decode both poses + warm tints while the player is on the root menu
  // B4: check the saved storyteller at boot; saved preference is never overwritten.
  fallbackToast(settings.storyteller.mode, (await api.storyteller.effective(settings.storyteller.mode)).mode);
})();
