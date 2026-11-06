/**
 * Main menu controller (spec v1.3). State machine (§5):
 *   boot → root; root → newGameSetup (slot free) | slotsFull (both full) | load | settings | credits | quitConfirm | loading (continue)
 *   slotsFull → replaceConfirm → newGameSetup (replaceRunId set) | root;  newGameSetup → creator (Begin) → starting (Start) → root (placeholder)
 *   creator: step 1 Look ⇄ step 2 Personality; Back on step 1 → newGameSetup (choices kept, replaceRunId kept, nothing deleted)
 *   load → loadRunExpanded → loading | deleteSaveConfirm → loadRunExpanded | deleteRunConfirm → load; back → load
 *   legacy (game:legacyEnd hook) → menu:newLineage | root
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
    const w = 1920 / u, h = 1080 / u;
    const s = Math.min(innerWidth / w, innerHeight / h);
    const stage = $('#stage');
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    fitActive();
  }
  /** N1 safety net: if a screen's content is still larger than the (scaled) stage, shrink just that screen to fit. */
  function fitActive() {
    const sc = document.querySelector('.screen.active'); if (!sc) return;
    sc.style.zoom = '';
    const R = $('#stage').getBoundingClientRect(), k = R.height / $('#stage').offsetHeight;  // screen px per logical px
    const margin = 24 * k;
    const extent = () => {
      let right = 0, bottom = 0;
      for (const el of sc.querySelectorAll('*')) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        right = Math.max(right, r.right - R.left); bottom = Math.max(bottom, r.bottom - R.top);
      }
      return Math.max((right + margin) / R.width, (bottom + margin) / R.height);
    };
    // Zoomed text doesn't always shrink exactly in proportion (font hinting, min sizes, wraps), so re-measure and tighten a few times.
    let zoom = 1;
    for (let i = 0; i < 4; i++) {
      const need = extent(); if (need <= 1.001) break;
      zoom /= need; sc.style.zoom = String(zoom);
    }
  }
  if (document.fonts) document.fonts.ready.then(() => fitActive());
  addEventListener('resize', scale);

  // ---------- toast ----------
  function toast(text) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 5000);
  }
  api.onToast(({ id, vars, text }) => toast(id ? t(id, vars) : text));

  // ---------- generic focus (all screens except difficulty) ----------
  function focusables() {
    const scope = dialog ? $('#dialog') : $('.screen.active');
    return scope ? $$('button', scope).filter((b) => !b.disabled && b.offsetParent !== null && !b.closest('.tabs')) : [];
  }
  function focus(el) {
    $$('button.focused').forEach((b) => b.classList.remove('focused'));
    if (el) { el.classList.add('focused'); el.focus({ preventScroll: true }); }
  }
  const current = () => $('button.focused') || null;
  function move(delta) {
    const f = focusables(); if (!f.length) return;
    const j = Nav.step(f.length, f.indexOf(current()), delta);
    focus(f[j]);
  }
  document.addEventListener('mouseover', (ev) => {
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
    if (screen === 'root') { renderRoot(); music.play(); }
    if (screen === 'starting' || screen === 'loading') music.fadeOutAndStop();   // §7.5 v1.4.4: creator Start / Continue / Load (keeps playing through the creator)
    if (screen === 'newGameSetup') return renderSetup();
    if (screen === 'creator') return renderCreator();
    if (screen === 'settings') renderSettings();
    if (screen === 'load' || screen === 'loadRunExpanded') renderLoad();
    if (screen === 'slotsFull') renderReplace();
    if (screen === 'credits') startCredits();
    fitActive();
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
  const styleName = (id) => copy.playStyles.find((d) => d.id === id)?.name || id;
  const when = (iso) => new Date(iso).toLocaleString();
  const runLabel = (r) => (r.damaged ? t('run.damagedName') : t('run.label', { catName: r.catName, prideName: r.prideName }));
  function runCard(r, i) {
    const b = document.createElement('button'); b.className = 'run'; b.dataset.slotIndex = i;
    const name = document.createElement('span'); name.className = 'rname';
    const meta = document.createElement('span'); meta.className = 'rmeta';
    if (!r) { name.textContent = t('run.emptyName'); meta.textContent = t('run.emptyMeta', { slot: i + 1 }); b.disabled = true; }
    else if (r.damaged) { name.textContent = t('run.damagedName'); meta.textContent = t('run.damagedMeta', { slot: i + 1 }); b.dataset.runId = r.runId; }
    else {
      b.dataset.runId = r.runId;
      name.textContent = runLabel(r);
      // run.modes on its own line, run.sandboxTag after it for Sandbox runs (copy §6 notes). Pre-v1.3 runs = Standard (store).
      const modes = document.createElement('span'); modes.className = 'rmodes';
      modes.textContent = t('run.modes', { styleName: styleName(r.style), deathRuleName: diffName(r.difficulty) }) + (r.difficulty === 'sandbox' ? ` · ${t('run.sandboxTag')}` : '');
      meta.textContent = t('run.meta', { generation: r.generation, lastPlayed: when(r.lastPlayedAt), saveCount: r.saves.length });
      b.append(name, modes, meta); return b;
    }
    b.append(name, meta); return b;
  }

  // ---------- New Game setup (spec v1.3; B1/B2 focus ≠ selection, via Nav.setupReduce) ----------
  const optionDefs = () => copy.sandboxPanel.options;
  const SCREEN = '.screen[data-screen="newGameSetup"]';
  function cardButton(kind, d) {
    const b = document.createElement('button'); b.className = 'card'; b.dataset.nav = `${kind}:${d.id}`;
    b.innerHTML = '<span class="name"></span><span class="desc"></span>';
    b.querySelector('.name').textContent = d.name; b.querySelector('.desc').textContent = d.description;
    return b;
  }
  function renderSetup() {
    $('#style-cards').replaceChildren(...copy.playStyles.map((d) => cardButton('style', d)));
    $('#death-cards').replaceChildren(...copy.difficulties.map((d) => cardButton('death', d)));
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
  /** Render the Nav model: selected cards, panel only when Sandbox is SELECTED, summary line, focus ring. */
  function applySetup() {
    $$('#style-cards .card').forEach((c) => c.classList.toggle('selected', c.dataset.nav === `style:${setup.style}`));
    $$('#death-cards .card').forEach((c) => c.classList.toggle('selected', c.dataset.nav === `death:${setup.death}`));
    const sandbox = setup.death === 'sandbox';
    $('#sandbox-panel').hidden = !sandbox;
    if (sandbox) { renderSandboxRows(); fitSandboxDescs(); }
    const target = replaceRunId && runs.find((r) => r && r.runId === replaceRunId);
    const vars = { styleName: styleName(setup.style), deathRuleName: diffName(setup.death) };
    $('#setup-summary').textContent = target ? t('newGame.summaryReplacing', { ...vars, runLabel: runLabel(target) }) : t('newGame.summary', vars);
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
    const b = ev.target.closest('[data-nav]'); if (b && !dialog) setupDispatch('click', b.dataset.nav);
  });

  // ---------- Make Your Sabrecat (cat-creator-spec v0.3.1; model = pure js/creator.js) ----------
  const CSCREEN = '.screen[data-screen="creator"]';
  let creator = null;               // Creator model
  let pendingSetup = null;          // {style, difficulty, sandboxOptions?} from Begin
  let starting = false;             // guards a double Start
  const preview = { token: 0, key: null, ms: null, drawn: [], skipped: [], pose: null, poses: new Map(), tints: new Map(), log: [], preloadMs: null };
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
    pendingSetup = { style: effect.style, difficulty: effect.difficulty, ...(effect.sandboxOptions ? { sandboxOptions: effect.sandboxOptions } : {}) };
    creator = Creator.init({ names: creatorNames(), difficulty: effect.difficulty, sandboxOptions: effect.sandboxOptions });
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
    // Anna bug 6: dice rerolls only the name (names.json). Saga has no label copy yet, so the aria-label/tooltip is a code-only string.
    const dice = el('button', 'name-dice', '⚄'); dice.type = 'button'; dice.id = 'creator-name-dice';
    dice.setAttribute('aria-label', 'Reroll name'); dice.title = 'Reroll name';
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
  const panelKey = (c) => `${c.step}:${Creator.ROWS(c).join(',')}`;
  function buildCreatorPanel() {
    const panel = $('#creator-panel');
    if (creator.step === 1) panel.replaceChildren(nameRow(), ...Creator.ROWS(creator).slice(1).map(optionRow));
    else panel.replaceChildren(optionRow('preset'), ...Creator.TRAITS.map(sliderRow));
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
    $('#creator-step').textContent = t('creator.step.indicator', { n: c.step, total: 2, stepName: t(c.step === 1 ? 'creator.step.look' : 'creator.step.personality') });
    for (const row of $$('#creator-panel .crow')) {
      const id = row.dataset.row; const help = row.querySelector('.crow-help');
      row.classList.toggle('focused', c.focus === id);
      if (id === 'name') {
        const inp = row.querySelector('input'); if (inp.value !== c.name) inp.value = c.name;
        const h = nameHelp(); help.textContent = h.text; help.classList.toggle('error', !!h.error);
      } else if (id === 'preset') {
        row.querySelector('.crow-val').textContent = t(`creator.preset.${c.preset}`);
        help.textContent = t(`creator.preset.${c.preset}.desc`);
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
    $('#creator-actions [data-cnav="next"]').hidden = c.step !== 1;
    $('#creator-actions [data-cnav="start"]').hidden = c.step !== 2;
    $$('#creator-actions button').forEach((b) => b.classList.toggle('focused', b.dataset.cnav === c.focus));
    $('#creator-rand-help').textContent = t(c.step === 1 ? 'creator.help.randomize' : 'creator.help.randomizePersonality');
    const hintKey = { keyboard: 'creator.hint.keyboard', controller: 'creator.hint.gamepad', mouse: c.step === 2 ? 'creator.hint.mousePersonality' : 'creator.hint.mouse' }[device()] || 'creator.hint.keyboard';
    $('#creator-hint').textContent = t(hintKey);
    const nm = Creator.normalizeName(c.name) || t('run.defaultCatName');
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
  const composeOpts = (a, canvas) => ({ canvas, lifeStage: 'adult', scars: [], tintCache: preview.tints, dir: a.pose,
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
      const poses = await Promise.all(Creator.SEXES.map((sex) => poseAssets(Compositor.poseFor(sex, 'adult'))));   // 1: load + decode both poses
      for (let i = 0; i < poses.length; i++) await warm(poses[i], look(Creator.SEXES[i], 'tan', 'spotted', 'amber'));   // 2: fixed layers of each pose
      for (let i = 0; i < poses.length; i++) {                                                                       // 3: every coat × marking, every eye
        for (const coat of Creator.COATS) for (const markings of Creator.MARKINGS) { if (state === 'creator') break; await warm(poses[i], look(Creator.SEXES[i], coat, markings, 'amber')); }
        for (const eyes of Creator.EYES) { if (state === 'creator') break; await warm(poses[i], look(Creator.SEXES[i], 'tan', 'none', eyes)); }
      }
      preview.preloadMs = performance.now() - t0;
    })().catch((e) => console.warn('portrait preload failed', e));
    return preloading;
  }
  async function renderPreview() {
    const c = creator; const key = [c.sex, c.coat, c.markings, c.eyes, c.oddEyes, c.eyeRight].join('|');
    if (key === preview.key) return;
    preview.key = key; const token = ++preview.token; const t0 = performance.now();
    try {
      const a = await poseAssets(Compositor.poseFor(c.sex, 'adult'));
      const off = document.createElement('canvas');
      const res = await Compositor.compose(a.manifest, Creator.genesFor(c), composeOpts(a, off));
      if (token !== preview.token) return;
      const cv = $('#creator-canvas'); cv.width = off.width; cv.height = off.height;
      cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv.getContext('2d').drawImage(off, 0, 0);
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
    if (effect && effect.type === 'start') { starting = true; startNewGame({ ...pendingSetup, mainCat: effect.mainCat }).finally(() => { starting = false; }); }
  }
  // Mouse: arrows change a row, a value click cycles it, the track sets a slider, buttons act; hover moves focus only.
  $(CSCREEN).addEventListener('click', (ev) => {
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
          b.textContent = t('load.saveEntry', { writtenAt: when(sv.writtenAt), year: d.year, season: t(`season.${d.season}`), day: d.day });
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
  function applyLive() { music.setAudio(settings.audio); document.body.classList.toggle('reduced-motion', !!settings.display.reducedMotion); scale(); }

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
    if (settings.display.reducedMotion) return;
    creditsTimer = setInterval(() => { roll.scrollTop += fastScroll ? 6 : 1; }, 30);
  }
  addEventListener('keyup', (e) => { if (e.key === 'ArrowDown' || e.key === 's') fastScroll = false; });

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

  // ---------- actions ----------
  /** Creator Start (v1.4): menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, mainCat}. The replaced run is deleted only now (main). */
  async function startNewGame({ style, difficulty, sandboxOptions, mainCat }) {
    const res = await api.menu.newGame({ style, difficulty, replaceRunId: replaceRunId || undefined, sandboxOptions, mainCat });
    if (!res.ok) { toast(t('toast.startFailed')); return; }   // B12: raw error is logged by main only
    fallbackToast(res.storyteller?.preferred, res.storyteller?.effective);
    replaceRunId = null; creator = null;
    $('#placeholder-detail').textContent = t('placeholder.newRun', { styleName: styleName(style), deathRuleName: diffName(difficulty), slot: res.run.slotIndex + 1 });
    show('starting');
  }
  async function loadSave(runId, saveId) {
    const res = await api.menu.loadSave(runId, saveId);
    if (!res.ok) { toast(t('toast.saveLoadFailed')); return; }
    const r = runs.find((x) => x && x.runId === runId);
    $('#placeholder-detail').textContent = r ? t('placeholder.loading', { runLabel: runLabel(r) }) : t('placeholder.loadingFallback');
    show('loading');
  }
  function openSetup() {
    // Every New Game resets to the defaults: Standard, Heir, default Sandbox options (B7, spec v1.3).
    setup = Nav.setupInit(copy.playStyles.map((d) => d.id), copy.difficulties.map((d) => d.id), optionDefs());
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
    if (state === 'loadRunExpanded') { const id = expandedRunId; expandedRunId = null; show('load', `.run[data-run-id="${id}"]`); return; }
    clearInterval(creditsTimer);
    if (state === 'newGameSetup') replaceRunId = null;
    const from = { newGameSetup: 'newGame', slotsFull: 'newGame', load: 'load', credits: 'credits' }[state];
    await refreshSlots();
    show('root', from ? $(`[data-action="${from}"]`) : null);
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]'); if (b && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action]();
  });

  Input.on((a) => {
    const el = current();
    if (!dialog && state === 'newGameSetup') return setupDispatch(a === 'start' ? 'confirm' : a);
    if (!dialog && state === 'creator') return ['tabPrev', 'tabNext', 'delete'].includes(a) ? undefined : creatorDispatch(a);
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
    state: () => ({ state, setup, creator, dialog: !!dialog, focused: current()?.dataset.nav || current()?.dataset.action || current()?.textContent }),
    /** Sets a look on the open creator and waits for its preview (e2e check 1: all 72 looks render with no missing layer). */
    creatorLook: async (look) => { creator = Creator.coerceLook({ ...creator, ...look }); applyCreator(); await renderPreview(); return { ms: preview.ms, drawn: preview.drawn, skipped: preview.skipped, pose: preview.pose, rendered: preview.rendered }; },
    creator: () => ({ model: creator, pending: pendingSetup, replaceRunId, preview: { ms: preview.ms, drawn: preview.drawn, skipped: preview.skipped, pose: preview.pose, rendered: preview.rendered, log: preview.log, preloadMs: preview.preloadMs } }),
    /** Resolves when the app-start portrait preload (C3) has finished. */
    portraitsReady: () => preloadPortraits().then(() => preview.preloadMs),
    setUiScale: (v) => { settings.display.uiScale = v; scale(); },
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
