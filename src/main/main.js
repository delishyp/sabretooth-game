/**
 * Electron main process: window, IPC (spec §5), settings/saves persistence.
 * Dev flag `--screenshots` captures menu screens to ./screenshots and exits.
 */
const { app, BrowserWindow, ipcMain, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { createSettingsStore } = require('./settings-store');
const { createSavesStore, SANDBOX_OPTIONS } = require('./saves-store');
const { createMenuHandlers } = require('./menu-handlers');
const I18n = require('../renderer/js/i18n');
const { DEFAULTS: SETTINGS_DEFAULTS } = require('./settings-store');

app.setName('Sabretooth'); // => %APPDATA%/Sabretooth on Windows
// Dev/test only: point userData elsewhere (used for seeded screenshots).
if (process.env.SABRETOOTH_USERDATA) app.setPath('userData', process.env.SABRETOOTH_USERDATA);
const SHOTS = process.argv.includes('--screenshots');
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
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
    ['root', 'main-menu.png'], ['difficulty', 'new-game-difficulty.png'], ['difficulty:sandbox', 'new-game-sandbox-options.png'],
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
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), build: process.env.SABRETOOTH_BUILD || 'dev' }));
  ipcMain.handle('app:quit', () => { flushStaged(); app.quit(); });
}

/** Copy for renderer: Saga's generated JSON + option defaults from the store + settings defaults (for per-tab reset). */
function loadCopy() {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'data', 'menu-copy.json'), 'utf8'));
  c.sandboxPanel.options = c.sandboxPanel.options.map((o) => ({ ...o, default: SANDBOX_OPTIONS[o.id].default }));
  c.settingsDefaults = SETTINGS_DEFAULTS;
  return c;
}

app.whenReady().then(() => {
  const ud = app.getPath('userData');
  settings = createSettingsStore(ud);
  saves = createSavesStore(path.join(ud, 'saves'), { log, gameVersion: app.getVersion() });
  copy = loadCopy(); t = I18n.create(copy.strings);
  handlers = createMenuHandlers({ settings, saves, log, t, checkStoryteller });
  registerIpc();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
