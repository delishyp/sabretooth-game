// The approved root-menu scene is the e67524c Milky Way file. The older illustration stays on disk.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

test('root menu jpg is the approved Milky Way scene and the old png is untouched', () => {
  assert.strictEqual(sha('assets/menu/background.jpg'), 'e6b3f85f5bfcdcb5c03e9358bf0f05c0ce55e2b88850d134684e93cb0eb5a9ad');
  assert.strictEqual(sha('assets/menu/background.png'), '615d44a0cee5993ffa486ddb48c63db8a967bf64a060bec624e2cef663025205');
  const art = fs.readFileSync(path.join(root, 'src/renderer/js/assets.js'), 'utf8');
  const jpg = art.indexOf('background.jpg');
  const png = art.indexOf('background.png');
  assert.ok(jpg !== -1 && png !== -1 && jpg < png);
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  assert.ok(html.includes('assets/menu/night/work/bg1920.png'));
  assert.ok(html.includes('assets/game/home-landscape.png'));
});
