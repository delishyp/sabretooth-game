// Approved main-menu plate: exact bytes, cover framing, cat on the right, no stretch.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const crypto = require('node:crypto');
const path = require('path');
const Frame = require('../src/renderer/js/menu-frame');

const root = path.join(__dirname, '..');
const HASH = 'e6b3f85f5bfcdcb5c03e9358bf0f05c0ce55e2b88850d134684e93cb0eb5a9ad';

test('the menu background is the approved file, byte for byte', () => {
  const file = path.join(root, 'assets/menu/background.jpg');
  const buf = fs.readFileSync(file);
  assert.strictEqual(crypto.createHash('sha256').update(buf).digest('hex'), HASH);
  assert.ok(!fs.existsSync(path.join(root, 'assets/menu/background.png')));
  const art = fs.readFileSync(path.join(root, 'src/renderer/js/assets.js'), 'utf8');
  assert.match(art, /MenuFrame\.place/);
});

test('16:9 windows cover the scene without stretching or black side bars', () => {
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const box = Frame.place(w, h, 1200, 630);
    assert.ok(Math.abs(box.dw / box.dh - box.sw / box.sh) < 1e-9, 'not stretched');
    assert.ok(box.dx <= 0.5 && box.dy <= 0.5, 'covers the top-left');
    assert.ok(box.dx + box.dw >= w - 0.5 && box.dy + box.dh >= h - 0.5, 'covers the view');
    // The cat sits in the right third of the scene. That third must stay on screen.
    const catX = box.sx + box.sw * 0.72;
    const viewX = box.dx + (catX - box.sx) * (box.dw / box.sw);
    assert.ok(viewX > w * 0.55 && viewX < w, `cat stays on the right at ${w}x${h}`);
    // The menu column is the left third. It must land on the open left of the scene, not the cat.
    const menuSrc = box.sx + ((w * 0.2 - box.dx) / box.dw) * box.sw;
    assert.ok((menuSrc - box.sx) / box.sw < 0.45, `menu stays in the open left at ${w}x${h}`);
  }
});
