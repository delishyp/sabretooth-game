// Auto-update via GitHub Releases (public repo, electron-updater).
// Restart now runs the downloaded NSIS setup silently (/S --updated --force-run)
// so it replaces this installation instead of opening the folder wizard.
// Saves stay in %APPDATA%/Sabretooth. The app id and install scope are not changed here.
const { createController } = require('./update-flow');

function initUpdater(log = console.log) {
  const { app, BrowserWindow, ipcMain } = require('electron');
  let autoUpdater = null;
  const ctl = createController({
    log: (s) => log(`update ${s.phase}${s.version ? ' ' + s.version : ''}${s.percent != null ? ' ' + Math.round(s.percent) + '%' : ''}${s.message ? ' ' + s.message : ''}`),
    send: (s) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send('update:state', s);
      }
    },
    check: () => check(),
    quitAndInstall: (silent, forceRun) => autoUpdater.quitAndInstall(silent, forceRun)
  });

  ipcMain.handle('update:get', () => ctl.getState());
  ipcMain.handle('update:retry', () => ctl.retry());
  ipcMain.handle('update:cancel', () => ctl.cancel());
  ipcMain.handle('update:restart', () => ctl.restart());
  ipcMain.handle('update:later', () => ctl.later());

  function check() {
    if (!autoUpdater) return;
    const result = autoUpdater.checkForUpdates();
    if (result && typeof result.then === 'function') {
      result.then((r) => ctl.noteToken(r && r.cancellationToken)).catch((e) => ctl.onError(e));
    }
  }

  if (!app.isPackaged) {
    log('update check skipped (not packaged)');
    return ctl;
  }
  try { ({ autoUpdater } = require('electron-updater')); }
  catch (e) { ctl.onError(e); return ctl; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => ctl.onChecking());
  autoUpdater.on('update-available', (info) => ctl.onAvailable(info));
  autoUpdater.on('update-not-available', (info) => ctl.onNotAvailable(info));
  autoUpdater.on('download-progress', (p) => ctl.onProgress(p));
  autoUpdater.on('update-downloaded', (info) => ctl.onDownloaded(info));
  autoUpdater.on('error', (e) => ctl.onError(e));
  check();
  return ctl;
}

module.exports = { initUpdater };
