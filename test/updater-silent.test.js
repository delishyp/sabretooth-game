const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const { nsisInstallerArgs, ciAutoInstallRequested, feedUrlFromAppUpdateYml } = require('../src/main/updater');

test('nsis one-click upgrade keeps the same per-user app id', () => {
  const nsis = pkg.build.nsis;
  assert.strictEqual(pkg.version, '0.1.13');
  assert.strictEqual(pkg.build.appId, 'com.annakremer.sabretooth');
  assert.strictEqual(pkg.build.productName, 'Sabretooth');
  assert.strictEqual(pkg.productName, 'Sabretooth');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(nsis, 'guid'), false);
  assert.strictEqual(nsis.oneClick, true);
  assert.strictEqual(nsis.perMachine, false);
  assert.strictEqual(nsis.runAfterFinish, true);
  assert.strictEqual(nsis.deleteAppDataOnUninstall, false);
  assert.strictEqual(nsis.allowToChangeInstallationDirectory, undefined);
});

test('quitAndInstall(true, true) is silent and relaunches; 0.1.8 was not silent', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/main/updater.js'), 'utf8');
  assert.match(src, /quitAndInstall\(true,\s*true\)/);
  assert.match(src, /autoInstallOnAppQuit\s*=\s*true/);
  assert.deepStrictEqual(nsisInstallerArgs(true, true), ['--updated', '/S', '--force-run']);
  // 0.1.8 called quitAndInstall() with no args: not silent, and force-run follows autoRunAppAfterInstall.
  assert.deepStrictEqual(nsisInstallerArgs(false, true), ['--updated', '--force-run']);
  assert.deepStrictEqual(nsisInstallerArgs(true, false), ['--updated', '/S']);
});

test('ci auto-install stays closed on a normal launch', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/main/updater.js'), 'utf8');
  const yml = 'provider: generic\nurl: http://127.0.0.1:8766\n';
  const feed = feedUrlFromAppUpdateYml(yml);
  const armed = { SABRETOOTH_CI_AUTOUPDATE: '1', SABRETOOTH_CI_UPDATE_URL: 'http://127.0.0.1:8766' };
  assert.strictEqual(feedUrlFromAppUpdateYml('provider: github\nowner: delishyp\nrepo: sabretooth-game\n'), '');
  assert.strictEqual(feed, 'http://127.0.0.1:8766');
  assert.strictEqual(ciAutoInstallRequested({}, feed), false);
  assert.strictEqual(ciAutoInstallRequested({ SABRETOOTH_CI_AUTOUPDATE: '1' }, feed), false);
  assert.strictEqual(ciAutoInstallRequested({ SABRETOOTH_CI_AUTOUPDATE: 'true', SABRETOOTH_CI_UPDATE_URL: 'http://127.0.0.1:8766' }, feed), false);
  assert.strictEqual(ciAutoInstallRequested(armed, ''), false);
  assert.strictEqual(ciAutoInstallRequested(armed, 'https://github.com/delishyp/sabretooth-game/releases/latest'), false);
  assert.strictEqual(ciAutoInstallRequested({ SABRETOOTH_CI_AUTOUPDATE: '1', SABRETOOTH_CI_UPDATE_URL: 'http://127.0.0.1:9' }, feed), false);
  assert.strictEqual(ciAutoInstallRequested(armed, feed), true);
  assert.strictEqual(ciAutoInstallRequested(armed, feed + '/'), true);
  const arm = src.indexOf('if (ci) {');
  const down = src.indexOf('allowDowngrade = true');
  assert.ok(arm !== -1 && down !== -1 && arm < down);
  assert.ok(down < src.indexOf("log('ci auto-install armed"));
  assert.strictEqual(src.split('allowDowngrade').length - 1, 1);
  assert.match(src, /if \(ci\) \{\s*log\('ci quitAndInstall/);
});
