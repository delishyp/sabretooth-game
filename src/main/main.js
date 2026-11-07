/**
 * Electron main process: window, IPC (spec §5), settings/saves persistence.
 * Dev flag `--screenshots` captures menu screens to ./screenshots and exits.
 */
const { app, BrowserWindow, ipcMain, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { createSettingsStore } = require('./settings-store');
const { createSavesStore, SANDBOX_OPTIONS, visibleSandboxOptions } = require('./saves-store');
const { createMenuHandlers, menuLockFrom } = require('./menu-handlers');
const I18n = require('../renderer/js/i18n');
const { DEFAULTS: SETTINGS_DEFAULTS } = require('./settings-store');

app.setName('Sabretooth'); // => %APPDATA%/Sabretooth on Windows
// Dev/test only: point userData elsewhere (used for seeded screenshots).
if (process.env.SABRETOOTH_USERDATA) app.setPath('userData', process.env.SABRETOOTH_USERDATA);
const SHOTS = process.argv.includes('--screenshots');
// Window/taskbar icon (Anna-approved gold logo): ICO on Windows, PNG on Linux/dev. Both ship via build.files.
const APP_ICON = path.join(__dirname, '..', '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
let win, settings, saves, handlers, t, copy;
let stagedSettings = null;   // B11: live, unsaved settings from the renderer; flushed on close

function log(msg) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'menu.log'), `${new Date().toISOString()} ${msg}\n`);
  } catch { /* never crash on logging */ }
}

function createWindow() {
  const s = settings.get();
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1280, minHeight: 720,
    backgroundColor: '#0d1620', show: false, autoHideMenuBar: true,
    fullscreen: !SHOTS && s.display.mode === 'fullscreen',
    title: 'Sabretooth',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'   // menu music fades in on launch (spec §7 Menu music)
    }
  });
  if (SHOTS) win.setContentSize(1600, 900);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('close', () => flushStaged());
  win.once('ready-to-show', () => {
    win.show();
    if (settings.takeRecovered()) win.webContents.send('toast', { id: 'toast.settingsReset' });
    if (SHOTS) captureAll();
  });
}

async function captureAll() {
  const out = path.join(__dirname, '..', '..', 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (screen, file) => {
    await win.webContents.executeJavaScript(`window.__menuDebug.show(${JSON.stringify(screen)})`, true);
    await wait(700);
    fs.writeFileSync(path.join(out, file), (await win.webContents.capturePage()).toPNG());
  };
  await wait(800);
  const only = process.env.SABRETOOTH_SHOTS; // comma list of file prefixes, optional
  const list = [
    ['root', 'main-menu.png'], ['newGame', 'new-game-setup.png'], ['newGame:sim', 'new-game-setup-sim-permadeath.png'], ['newGame:sandbox', 'new-game-sandbox-options.png'],
    ['creator', 'creator-look.png'], ['creator:personality', 'creator-personality.png'], ['creator:sandbox', 'creator-personality-sandbox.png'], ['creator:sandbox-look', 'creator-look-sandbox-ash-oddeyes.png'],
    ['slotsFull', 'new-game-slots-full.png'], ['load', 'load-runs.png'], ['load:expanded', 'load-run-expanded.png'],
    ['continue', 'continue-loading.png'], ['legacy', 'legacy-hook.png'],
    ['settings:storyteller', 'settings-storyteller.png'], ['settings:audio', 'settings-audio.png'], ['settings:display', 'settings-display.png'],
    ['quitConfirm', 'quit-confirm.png'], ['starting', 'gameplay-coming-soon.png']
  ];
  for (const [screen, file] of list) if (!only || only.split(',').some((o) => file.startsWith(o))) await shot(screen, file);
  app.quit();
}

async function checkStoryteller(mode) {
  if (mode === 'offline') return { available: true };
  if (mode === 'online') {
    // Placeholder: real service endpoint TBD. Connectivity only.
    return net.isOnline() ? { available: true } : { available: false, reason: 'offline' };
  }
  if (mode === 'local') {
    const p = settings.get().storyteller.localModelPath;
    return p && fs.existsSync(p) ? { available: true } : { available: false, reason: 'no local model configured' };
  }
  return { available: false, reason: 'unknown mode' };
}

/**
 * B6: apply window mode live. fullscreen ↔ windowed work at runtime.
 * 'borderless' is saved but NOT applied yet (deferred; needs a frameless window recreate). It leaves the window as-is.
 */
function applyWindowMode(mode) {
  if (!win || SHOTS) return;
  if (mode === 'fullscreen' && !win.isFullScreen()) win.setFullScreen(true);
  if (mode === 'windowed' && win.isFullScreen()) win.setFullScreen(false);
}
function flushStaged() {
  if (!stagedSettings) return;
  try { settings.set(stagedSettings); } catch (e) { log(`settings flush failed: ${e.message}`); }
  stagedSettings = null;
}

function registerIpc() {
  const placeholder = (name, payload) => { log(`${name} ${JSON.stringify(payload)} (placeholder)`); return { ok: true, placeholder: true }; };
  ipcMain.handle('menu:newGame', (_e, p) => handlers.newGame(p));
  ipcMain.handle('menu:loadSave', (_e, p) => handlers.loadSave(p));
  ipcMain.handle('game:save', (_e, p) => handlers.saveGame(p));
  ipcMain.handle('menu:deleteSave', (_e, p = {}) => saves.deleteSave(p.runId, p.saveId));
  ipcMain.handle('menu:deleteRun', (_e, p = {}) => saves.deleteRun(p.runId));
  // Legacy hook (spec §7): game:legacyEnd {runId} -> Legacy screen (future) -> menu:newLineage {runId} | root.
  ipcMain.handle('game:legacyEnd', (_e, p = {}) => { log(`game:legacyEnd ${JSON.stringify(p)}`); win.webContents.send('legacyEnd', p); return { ok: true }; });
  ipcMain.handle('menu:newLineage', (_e, p = {}) => placeholder('menu:newLineage', p));
  ipcMain.handle('saves:list', () => saves.list());
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:set', (_e, { patch } = {}) => { stagedSettings = null; const s = settings.set(patch); applyWindowMode(s.display.mode); return s; });
  ipcMain.handle('settings:stage', (_e, { patch } = {}) => { stagedSettings = patch; if (patch && patch.display) applyWindowMode(patch.display.mode); return true; });
  ipcMain.handle('settings:reset', (_e, { section } = {}) => settings.reset(section));
  ipcMain.handle('storyteller:check', (_e, { mode } = {}) => checkStoryteller(mode));
  ipcMain.handle('storyteller:effective', async (_e, { mode } = {}) => ({ mode: await handlers.effectiveStoryteller(mode) }));
  ipcMain.handle('copy:get', () => copy);
  // M1: renderer console.warn/error, uncaught errors and rejections (js/log.js) → logs/menu.log
  ipcMain.on('log:renderer', (_e, { level, text } = {}) => log(`renderer ${level === 'error' ? 'error' : 'warn'}: ${String(text).slice(0, 4000)}`));
  ipcMain.handle('portraits:load', (_e, { pose } = {}) => loadPortrait(pose));
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), build: process.env.SABRETOOTH_BUILD || 'dev' }));
  ipcMain.handle('app:quit', () => { flushStaged(); app.quit(); });
}

/**
 * portraits:load {pose} → {pose, manifest, images: {file: dataURL}} for the creator preview (cat-creator-spec §2.1).
 * Images go over as data URLs so the renderer's canvas stays untainted (file:// images would block getImageData).
 * Only known pose ids are served; a missing cub/adolescent pose falls back to the adult pose (lifecycle-spec §6.2). Cached.
 */
const POSE_RE = /^portrait-(male|female)(-(cub|adolescent))?$/;
const portraitCache = new Map();
function loadPortrait(pose) {
  if (!POSE_RE.test(String(pose))) throw new Error(`unknown pose ${pose}`);
  if (portraitCache.has(pose)) return portraitCache.get(pose);
  const base = path.join(__dirname, '..', '..', 'assets', 'portraits');
  let use = pose;
  if (!fs.existsSync(path.join(base, use, 'manifest.json'))) { use = pose.replace(/-(cub|adolescent)$/, ''); log(`portraits: ${pose} missing, using ${use}`); }
  const dir = path.join(base, use);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const images = {};
  for (const f of [...(manifest.layers || []).map((l) => l.file), manifest.lineart].filter(Boolean)) {
    try { images[f] = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, path.basename(f))).toString('base64'); } catch (e) { log(`portraits: ${use}/${f} missing: ${e.message}`); }
  }
  const out = { pose: use, manifest, images };
  portraitCache.set(pose, out);
  return out;
}

/** Copy for renderer: Saga's generated JSON + option defaults from the store + settings defaults (for per-tab reset). */
function loadCopy() {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'data', 'menu-copy.json'), 'utf8'));
  c.sandboxPanel.options = visibleSandboxOptions(c.sandboxPanel.options).map((o) =>   // deferred toggles (freePerkRespec) don't render
    ({ ...o, default: SANDBOX_OPTIONS[o.id].default }));
  c.settingsDefaults = SETTINGS_DEFAULTS;
  // Creator name dice (Anna bug 6): Saga's names megafile, full-name lists + the never-generate lists only.
  try {
    const n = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'data', 'names', 'names.json'), 'utf8'));
    c.nameData = { male: n.male, female: n.female, either: n.either, reserved: n.reserved, blocklist: n.blocklist, maxLength: n.maxLength };
  } catch (e) { log(`names.json unavailable: ${e.message}`); c.nameData = null; }
  // Slice 1 (scope v1.0.1): map model, rules, Saga's offline event library, world slots.
  try {
    const d = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'data', f), 'utf8'));
    c.gameData = { map: d('map.json'), rules: d('slice-rules.json'), events: d('events/slice-1.json'), slots: d('world-slots.json'), conversation: d('events/recurring-conversation.json'), borderPolicy: d('events/faction-proof-reconciled.json'), encounters: d('events/encounters-v0.2.json') };
  } catch (e) { log(`slice data unavailable: ${e.message}`); c.gameData = null; }
  c.menuLock = menuLockFrom(c.gameData && c.gameData.rules, process.env);   // renderer shows only the locked cards
  return c;
}

app.whenReady().then(() => {
  const ud = app.getPath('userData');
  settings = createSettingsStore(ud);
  saves = createSavesStore(path.join(ud, 'saves'), { log, gameVersion: app.getVersion() });
  copy = loadCopy(); t = I18n.create(copy.strings);
  handlers = createMenuHandlers({ settings, saves, log, t, checkStoryteller, lock: copy.menuLock });
  if (!copy.menuLock) log('New Game menu lock OFF (SABRETOOTH_MENU_UNLOCK=1)');
  registerIpc();
  createWindow();
  require('./updater').initUpdater((m) => { try { log(m); } catch (_) {} });
});
app.on('window-all-closed', () => app.quit());
