// Gameplay home: ledge placement for the live portrait, and which sidebar sections actually work.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('../src/renderer/js/home-scene');

const root = path.join(__dirname, '..');

test('portrait box keeps 1152:864, fills the ledge width, and puts the paw line on the rock', () => {
  const sceneW = 1920, sceneH = 1080;
  const box = H.catBox(sceneW, sceneH);
  assert.strictEqual(box.width / box.height, H.PORTRAIT.width / H.PORTRAIT.height);
  assert.strictEqual(box.left / sceneW, H.LEDGE.x0);
  assert.strictEqual((box.left + box.width) / sceneW, H.LEDGE.x1);
  const paw = box.top + box.height * H.PAW_FRAC;
  assert.ok(Math.abs(paw / sceneH - H.PAW_Y) < 1e-9);
  assert.ok(H.PAW_Y > H.LEDGE.y0 && H.PAW_Y < H.LEDGE.y1);
  assert.ok(box.top / sceneH < H.LEDGE.y0);
  assert.throws(() => H.catBox(0, 100), /positive/);
});

test('sidebar: home, pride, den, wilderness, and met cats are real; the rest stay unavailable', () => {
  assert.deepStrictEqual(H.NAV.filter((item) => item.implemented).map((item) => item.id), ['home', 'pride', 'den', 'wilderness', 'cats', 'map', 'lore', 'reputation']);
  assert.deepStrictEqual(H.NAV.filter((item) => !item.implemented).map((item) => item.id), ['breeding', 'market', 'inventory']);
  assert.deepStrictEqual(H.selectView('home', 'den'), { view: 'den', unavailable: null });
  assert.deepStrictEqual(H.selectView('den', 'wilderness'), { view: 'wilderness', unavailable: null });
  assert.deepStrictEqual(H.selectView('pride', 'market'), { view: 'pride', unavailable: 'market' });
  assert.throws(() => H.selectView('home', 'currency'), /unknown home view/);
});

function webpSize(buf) {
  assert.strictEqual(buf.subarray(0, 4).toString(), 'RIFF');
  assert.strictEqual(buf.subarray(8, 12).toString(), 'WEBP');
  assert.strictEqual(buf.subarray(12, 16).toString(), 'VP8 ');
  const w = buf.readUInt16LE(12 + 8 + 6) & 0x3fff;
  const h = buf.readUInt16LE(12 + 8 + 8) & 0x3fff;
  return { w, h };
}

test('home landscape masters are the 1440 and 3840 WebP files, and the game screen does not use the appearance master', () => {
  const small = webpSize(fs.readFileSync(path.join(root, 'assets/game/home-landscape-1440.webp')));
  const large = webpSize(fs.readFileSync(path.join(root, 'assets/game/home-landscape.webp')));
  assert.deepStrictEqual(small, { w: 2560, h: 1440 });
  assert.deepStrictEqual(large, { w: 3840, h: 2160 });
  assert.ok(!fs.existsSync(path.join(root, 'assets/game/home-landscape.png')));
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  const screen = fs.readFileSync(path.join(root, 'src/renderer/js/game-screen.js'), 'utf8');
  assert.ok(html.includes('assets/game/home-landscape-1440.webp'));
  assert.ok(html.includes('min-height: 1441px'));
  assert.ok(html.includes('id="home-cat"'));
  assert.ok(html.includes('data-g="den"') && html.includes('data-g="wild"'));
  assert.ok(screen.includes('ctx.portrait'));
  assert.ok(!screen.includes('appearance-render') && !screen.includes('master.png'));
  assert.ok(!html.includes('qa/gameplay-scene'));
});
