/**
 * Main menu controller (spec v1.3). State machine (§5):
 *   boot → root; root → newGameSetup (slot free) | slotsFull (both full) | load | settings | credits | quitConfirm | loading (continue)
 *   slotsFull → replaceConfirm → newGameSetup (replaceRunId set) | root;  newGameSetup → starting → root (placeholder)
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
  let legacyRunId = null;
  let settingsTab = 'audio';
  let settingsDirty = false;

  // ---------- static text ----------
  document.title = t('app.windowTitle');
  $$('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  $('#logo').alt = t('app.titleLogo');

  // ---------- scaling: min(w/1920, h/1080) × settings uiScale, applied live (B6) ----------
  function scale() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080) * (Number(settings.display.uiScale) || 1);
    $('#stage').style.transform = `translate(-50%, -50%) scale(${s})`;
  }
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
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (!dialog && state === 'newGameSetup' && b.dataset.nav) return setupDispatch('hover', b.dataset.nav);
    if (focusables().includes(b)) focus(b);
  });

  // ---------- screens ----------
  function show(screen, focusTarget) {
    state = screen;
    const el = ['starting', 'loading'].includes(screen) ? 'placeholder' : screen === 'loadRunExpanded' ? 'load' : screen;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === el));
    if (screen === 'root') renderRoot();
    if (screen === 'newGameSetup') return renderSetup();
    if (screen === 'settings') renderSettings();
    if (screen === 'load' || screen === 'loadRunExpanded') renderLoad();
    if (screen === 'slotsFull') renderReplace();
    if (screen === 'credits') startCredits();
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
  function renderSandboxRows() {
    const box = $('#sandbox-rows'); box.innerHTML = '';
    for (const o of optionDefs()) {
      const vi = o.values.indexOf(setup.opts[o.id]);
      const b = document.createElement('button'); b.className = 'setting opt'; b.dataset.opt = o.id; b.dataset.nav = `opt:${o.id}`;
      b.innerHTML = '<span class="top"><span></span><span class="val"></span></span><span class="desc"></span>';
      b.querySelector('.top').children[0].textContent = o.name; b.querySelector('.val').textContent = `◀ ${o.labels[vi]} ▶`;
      b.querySelector('.desc').textContent = (o.descriptions && o.descriptions[vi]) || o.description || '';
      box.appendChild(b);
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
    focus($(`${SCREEN} [data-nav="${setup.focus}"]`));
  }
  function setupDispatch(action, arg) {
    const { state: next, effect } = Nav.setupReduce(setup, action, arg);
    setup = next; applySetup();
    if (effect && effect.type === 'start') startNewGame(effect);
    if (effect && effect.type === 'leave') goBack();
  }
  $(SCREEN).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-nav]'); if (b && !dialog) setupDispatch('click', b.dataset.nav);
  });

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
  function applyLive() { document.body.classList.toggle('reduced-motion', !!settings.display.reducedMotion); scale(); }

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
  async function startNewGame({ style, difficulty, sandboxOptions }) {
    const res = await api.menu.newGame({ style, difficulty, replaceRunId: replaceRunId || undefined, sandboxOptions });
    if (!res.ok) { toast(t('toast.startFailed')); return; }   // B12: raw error is logged by main only
    fallbackToast(res.storyteller?.preferred, res.storyteller?.effective);
    replaceRunId = null;
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
    state: () => ({ state, setup, dialog: !!dialog, focused: current()?.dataset.nav || current()?.dataset.action || current()?.textContent }),
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
  // B4: check the saved storyteller at boot; saved preference is never overwritten.
  fallbackToast(settings.storyteller.mode, (await api.storyteller.effective(settings.storyteller.mode)).mode);
})();
