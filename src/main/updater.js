// Auto-update via GitHub Releases (public repo, electron-updater).
const { app, dialog } = require('electron');

/** Args NsisUpdater.doInstall builds. Silent adds /S; force-run relaunches the app. */
function nsisInstallerArgs(isSilent, isForceRunAfter) {
  const args = ['--updated'];
  if (isSilent) args.push('/S');
  if (isForceRunAfter) args.push('--force-run');
  return args;
}

function initUpdater(log = console.log) {
  if (!app.isPackaged) return; // dev runs skip updates
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { log('updater unavailable: ' + e.message); return; }
  // Quit-without-pressing-Restart still installs. electron-updater's quit handler calls install(true, false), which is /S and does not relaunch.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (e) => log('update error: ' + (e && e.message)));
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
      title: 'Update ready', message: `Sabretooth ${info.version} is ready to install.` });
    if (r.response === 0) autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.checkForUpdates().catch((e) => log('update check failed: ' + e.message));
}
module.exports = { initUpdater, nsisInstallerArgs };
