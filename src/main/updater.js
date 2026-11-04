// Auto-update via GitHub Releases (public repo, electron-updater).
const { app, dialog } = require('electron');
function initUpdater(log = console.log) {
  if (!app.isPackaged) return; // dev runs skip updates
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { log('updater unavailable: ' + e.message); return; }
  autoUpdater.on('error', (e) => log('update error: ' + (e && e.message)));
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
      title: 'Update ready', message: `Sabretooth ${info.version} is ready to install.` });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.checkForUpdates().catch((e) => log('update check failed: ' + e.message));
}
module.exports = { initUpdater };
