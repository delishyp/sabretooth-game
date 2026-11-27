// The approved root-menu scene is the e67524c Milky Way file. The older illustration stays on disk.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

test('root menu webp is the approved Milky Way scene and the old png is untouched', () => {
  assert.strictEqual(sha('assets/menu/background.webp'), '201a889c29a7a24c4b28074fff99c5f9a16ab03e633ed9d8978274d7bc4e415f');
  assert.strictEqual(sha('assets/menu/background.png'), '615d44a0cee5993ffa486ddb48c63db8a967bf64a060bec624e2cef663025205');
  assert.ok(!fs.existsSync(path.join(root, 'assets/menu/background.jpg')));
  const art = fs.readFileSync(path.join(root, 'src/renderer/js/assets.js'), 'utf8');
  const webp = art.indexOf('background.webp');
  const png = art.indexOf('background.png');
  assert.ok(webp !== -1 && png !== -1 && webp < png);
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  assert.ok(html.includes('assets/menu/background.webp'));
  assert.ok(!html.includes('assets/menu/background.jpg'));
  assert.ok(!html.includes('assets/menu/night/work/bg1920.png'));
  assert.ok(html.includes('assets/game/home-landscape-1440.webp'));
  assert.ok(html.includes('assets/game/home-landscape.webp'));
  assert.ok(html.includes('max-height: 1440px'));
});
