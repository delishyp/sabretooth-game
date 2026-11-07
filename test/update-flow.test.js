// Update state machine and the installer identity it must not change.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { initialState, reduce, restartPlan, createController } = require('../src/main/update-flow');

const root = path.join(__dirname, '..');

test('installer identity, install scope, and save folder stay as they are', () => {
  const pkg = require(path.join(root, 'package.json'));
  assert.strictEqual(pkg.build.appId, 'com.annakremer.sabretooth');
  assert.strictEqual(pkg.build.productName, 'Sabretooth');
  assert.strictEqual(pkg.build.nsis.oneClick, false);
  assert.strictEqual(pkg.build.nsis.allowToChangeInstallationDirectory, true);
  assert.deepStrictEqual(pkg.build.publish[0], { provider: 'github', owner: 'delishyp', repo: 'sabretooth-game', private: false });
  const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
  assert.match(main, /app\.setName\('Sabretooth'\)/);
  const settings = fs.readFileSync(path.join(root, 'src/main/settings-store.js'), 'utf8');
  assert.match(settings, /%APPDATA%\/Sabretooth\/settings\.json/);
  const updater = fs.readFileSync(path.join(root, 'src/main/updater.js'), 'utf8');
  assert.match(updater, /quitAndInstall\(silent, forceRun\)/);
  assert.match(updater, /autoInstallOnAppQuit = true/);
});

test('check, progress, ready, and a silent relaunch', () => {
  let s = reduce(initialState(), { type: 'check' });
  assert.strictEqual(s.phase, 'checking');
  s = reduce(s, { type: 'available', version: '0.1.5' });
  assert.strictEqual(s.phase, 'downloading');
  s = reduce(s, { type: 'progress', percent: 140, transferred: 10, total: 20 });
  assert.strictEqual(s.percent, 100);
  s = reduce(s, { type: 'progress', percent: -5, transferred: 1, total: 20 });
  assert.strictEqual(s.percent, 0);
  s = reduce(s, { type: 'downloaded', version: '0.1.5' });
  assert.deepStrictEqual(restartPlan(s), { install: true, silent: true, forceRunAfter: true });
  const calls = [];
  const ctl = createController({ quitAndInstall: (...a) => calls.push(a) });
  ctl.onDownloaded({ version: '0.1.5' });
  ctl.restart();
  ctl.restart();
  assert.deepStrictEqual(calls, [[true, true]]);
  assert.strictEqual(ctl.getState().phase, 'restarting');
});

test('Later does not relaunch immediately, and Restart after Later is still silent', () => {
  const calls = [];
  const ctl = createController({ quitAndInstall: (...a) => calls.push(a) });
  ctl.onDownloaded({ version: '0.1.5' });
  ctl.later();
  assert.strictEqual(ctl.getState().phase, 'later');
  assert.deepStrictEqual(calls, []);
  ctl.restart();
  assert.deepStrictEqual(calls, [[true, true]]);
});

test('a failed or cancelled download does not relaunch, and retry checks again', () => {
  let s = reduce(initialState(), { type: 'check' });
  s = reduce(s, { type: 'available', version: '0.1.5' });
  s = reduce(s, { type: 'progress', percent: 40, transferred: 4, total: 10 });
  s = reduce(s, { type: 'error', message: 'socket hang up\nstack' });
  assert.strictEqual(s.phase, 'error');
  assert.strictEqual(s.message, 'socket hang up');
  assert.strictEqual(restartPlan(s).install, false);
  const checks = [];
  const ctl = createController({ check: () => checks.push('check'), quitAndInstall: () => checks.push('install') });
  ctl.onChecking();
  ctl.onAvailable({ version: '0.1.5' });
  ctl.onProgress({ percent: 10, transferred: 1, total: 8 });
  ctl.onError(new Error('interrupted'));
  ctl.restart();
  assert.deepStrictEqual(checks, []);
  ctl.retry();
  assert.strictEqual(ctl.getState().phase, 'checking');
  assert.deepStrictEqual(checks, ['check']);
  ctl.onAvailable({ version: '0.1.5' });
  const cancelled = [];
  ctl.noteToken({ cancel: () => cancelled.push(1) });
  ctl.cancel();
  assert.strictEqual(ctl.getState().phase, 'cancelled');
  assert.deepStrictEqual(cancelled, [1]);
  ctl.onError(new Error('cancelled by user'));
  assert.strictEqual(ctl.getState().phase, 'cancelled');
  assert.strictEqual(restartPlan(ctl.getState()).install, false);
});

test('a second check does not throw away a download that is already ready', () => {
  let s = reduce(initialState(), { type: 'downloaded', version: '0.1.5' });
  s = reduce(s, { type: 'check' });
  assert.strictEqual(s.phase, 'ready');
  s = reduce(s, { type: 'not-available', version: '0.1.4' });
  assert.strictEqual(s.phase, 'ready');
  assert.strictEqual(s.version, '0.1.5');
});
