// Auto-update via GitHub Releases (public repo, electron-updater).
const fs = require('fs');
const path = require('path');

/** Args NsisUpdater.doInstall builds. Silent adds /S; force-run relaunches the app. */
function nsisInstallerArgs(isSilent, isForceRunAfter) {
  const args = ['--updated'];
  if (isSilent) args.push('/S');
  if (isForceRunAfter) args.push('--force-run');
  return args;
}

/** Generic-provider url from a packaged app-update.yml, or '' when it is not a generic feed. */
function feedUrlFromAppUpdateYml(text) {
  const src = String(text || '');
  if (!/^provider:\s*generic\s*$/m.test(src)) return '';
  const m = src.match(/^url:\s*['"]?([^'"\s#]+)['"]?\s*$/m);
  return m ? m[1] : '';
}

/**
 * Unattended check-and-install. Closed unless this launch set SABRETOOTH_CI_AUTOUPDATE=1
 * and both that URL and the packaged app-update.yml point at the same loopback feed.
 * A normal install (no env, or a GitHub app-update.yml) cannot take this path.
 */
function ciAutoInstallRequested(env = process.env, feedUrl = '') {
  if (!env || env.SABRETOOTH_CI_AUTOUPDATE !== '1') return false;
  let feed;
  let want;
  try {
    feed = new URL(feedUrl);
    want = new URL(String(env.SABRETOOTH_CI_UPDATE_URL || ''));
  } catch (e) {
    return false;
  }
  const loopback = (host) => host === '127.0.0.1' || host === 'localhost';
  if (feed.protocol !== 'http:' && feed.protocol !== 'https:') return false;
  if (!loopback(feed.hostname) || !loopback(want.hostname)) return false;
  if (feed.protocol !== want.protocol || feed.hostname !== want.hostname || feed.port !== want.port) return false;
  const pathOf = (u) => u.pathname.replace(/\/+$/, '');
  return pathOf(feed) === pathOf(want);
}

function updaterLogger(log) {
  const write = (level) => (...args) => {
    try {
      log('updater ' + level + ' ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    } catch (e) { /* logging must not break the update */ }
  };
  return { info: write('info'), warn: write('warn'), error: write('error'), debug: write('debug') };
}

function initUpdater(log = console.log) {
  const { app, dialog } = require('electron');
  if (!app.isPackaged) return; // dev runs skip updates
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { log('updater unavailable: ' + e.message); return; }
  // Quit-without-pressing-Restart still installs. electron-updater's quit handler calls install(true, false), which is /S and does not relaunch.
  autoUpdater.autoInstallOnAppQuit = true;
  let feedUrl = '';
  try {
    feedUrl = feedUrlFromAppUpdateYml(fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8'));
  } catch (e) { feedUrl = ''; }
  const ci = ciAutoInstallRequested(process.env, feedUrl);
  if (ci) {
    // 0.1.9-test.1 sorts below 0.1.9. Only the loopback CI launch may take that build.
    autoUpdater.allowDowngrade = true;
    autoUpdater.allowPrerelease = true;
    autoUpdater.disableDifferentialDownload = true;
    autoUpdater.logger = updaterLogger(log);
    log('ci auto-install armed ' + feedUrl);
  }
  autoUpdater.on('error', (e) => log('update error: ' + (e && e.message)));
  autoUpdater.on('update-downloaded', async (info) => {
    if (ci) {
      log('ci quitAndInstall ' + (info && info.version));
      autoUpdater.quitAndInstall(true, true);
      return;
    }
    const r = await dialog.showMessageBox({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1,
      title: 'Update ready', message: `Sabretooth ${info.version} is ready to install.` });
    if (r.response === 0) autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.checkForUpdates().catch((e) => log('update check failed: ' + e.message));
}
module.exports = { initUpdater, nsisInstallerArgs, ciAutoInstallRequested, feedUrlFromAppUpdateYml };
