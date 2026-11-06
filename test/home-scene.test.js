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
  assert.deepStrictEqual(H.NAV.filter((item) => item.implemented).map((item) => item.id), ['home', 'pride', 'den', 'wilderness', 'cats']);
  assert.deepStrictEqual(H.NAV.filter((item) => !item.implemented).map((item) => item.id), ['breeding', 'market', 'inventory', 'lore']);
  assert.deepStrictEqual(H.selectView('home', 'den'), { view: 'den', unavailable: null });
  assert.deepStrictEqual(H.selectView('den', 'wilderness'), { view: 'wilderness', unavailable: null });
  assert.deepStrictEqual(H.selectView('pride', 'market'), { view: 'pride', unavailable: 'market' });
  assert.throws(() => H.selectView('home', 'currency'), /unknown home view/);
});

test('home landscape is the clean 1280x720 RGB asset, and the game screen does not use the appearance master', () => {
  const file = path.join(root, 'assets/game/home-landscape.png');
  const buf = fs.readFileSync(file);
  assert.strictEqual(buf.length, 1739209);
  assert.strictEqual(buf.readUInt32BE(16), 1280);
  assert.strictEqual(buf.readUInt32BE(20), 720);
  assert.strictEqual(buf[24], 8);
  assert.strictEqual(buf[25], 2);
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  const screen = fs.readFileSync(path.join(root, 'src/renderer/js/game-screen.js'), 'utf8');
  assert.ok(html.includes('assets/game/home-landscape.png'));
  assert.ok(html.includes('id="home-cat"'));
  assert.ok(html.includes('data-g="den"') && html.includes('data-g="wild"'));
  assert.ok(screen.includes('ctx.portrait'));
  assert.ok(!screen.includes('appearance-render') && !screen.includes('master.png'));
  assert.ok(!html.includes('qa/gameplay-scene'));
});
