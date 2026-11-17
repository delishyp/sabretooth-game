const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const { nsisInstallerArgs } = require('../src/main/updater');

test('nsis one-click upgrade keeps the same per-user app id', () => {
  const nsis = pkg.build.nsis;
  assert.strictEqual(pkg.version, '0.1.9');
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
