// Modular appearance preview: locked master bytes, native canvas, straight alpha, slot selection.
// Synthetic fixtures stay in memory. They are not sample artwork.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minimatch } = require('minimatch');
const A = require('../src/renderer/js/appearance-render');
const P = require('../src/renderer/js/png-decode');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'assets/appearance');
const lock = JSON.parse(fs.readFileSync(path.join(dir, 'ASSET-LOCK.json'), 'utf8'));
const registry = A.parseRegistry(JSON.parse(fs.readFileSync(path.join(dir, 'registry.json'), 'utf8')));

function solid(w, h, rgba) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data };
}
function at(data, i) { return [...data.slice(i * 4, i * 4 + 4)]; }

async function loadLocked(rel) {
  const bytes = fs.readFileSync(path.join(dir, rel));
  const decoded = await P.decode(bytes);
  return { bytes, decoded, image: P.toRgbaImage(decoded) };
}

test('locked files are the imported bytes, native 1448x1086, RGBA master and L masks', async () => {
  assert.deepStrictEqual(lock.canvas, { width: 1448, height: 1086 });
  assert.deepStrictEqual(registry.canvas, lock.canvas);
  assert.strictEqual(1448 * 1086, 1572528);
  for (const [rel, expect] of Object.entries(lock.files)) {
    const abs = path.join(dir, rel);
    const bytes = fs.readFileSync(abs);
    assert.strictEqual(bytes.length, expect.bytes, rel);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), expect.sha256, rel);
    if (!expect.png) continue;
    const decoded = await P.decode(bytes);
    assert.strictEqual(decoded.width, 1448, rel);
    assert.strictEqual(decoded.height, 1086, rel);
    assert.strictEqual(decoded.bitDepth, 8, rel);
    assert.strictEqual(decoded.colorType, expect.png.colorType, rel);
    assert.strictEqual(decoded.mode, expect.png.mode, rel);
  }
});

test('body luminance equals master alpha; eye/nose luminance marks cutouts; decoded mask alpha is ignored', async () => {
  const master = (await loadLocked('master/master.png')).image;
  const body = (await loadLocked('master/body-mask.png')).image;
  const eyes = (await loadLocked('master/eye-nose-mask.png')).image;
  let alphaDiff = 0, transparent = 0, partial = 0, opaque = 0, eyeHard = 0, eyeInHole = 0, eyeOnBody = 0;
  for (let i = 0, p = 0; i < master.data.length; i += 4, p += 4) {
    const a = master.data[i + 3];
    const b = body.data[p];
    const e = eyes.data[p];
    if (b !== a) alphaDiff++;
    if (body.data[p + 3] !== 255 || eyes.data[p + 3] !== 255) throw new Error('mask decoded with an alpha channel that is not opaque');
    if (a === 0) transparent++; else if (a === 255) opaque++; else partial++;
    if (e >= 128) {
      eyeHard++;
      if (a === 0) eyeInHole++;
      if (b >= 128) eyeOnBody++;
    }
  }
  assert.strictEqual(alphaDiff, 0);
  assert.deepStrictEqual({ transparent, partial, opaque }, { transparent: 760110, partial: 10301, opaque: 802117 });
  assert.strictEqual(eyeHard, 2006);
  assert.strictEqual(eyeInHole, 1934);
  assert.strictEqual(eyeOnBody, 0);
  assert.strictEqual(lock.relationships.bodyMaskEqualsMasterAlpha, true);
  assert.strictEqual(lock.relationships.bodyMaskIsFurTintSafe, false);
});

test('default selection renders the master unchanged and does not paint either mask', async () => {
  const master = (await loadLocked('master/master.png')).image;
  const images = { 'master/master.png': master };
  const sel = A.defaultSelection(registry);
  assert.deepStrictEqual(sel, { coat: 'master', pattern: 'none', eyes: null, nose: null });
  assert.deepStrictEqual(A.masksUsed(sel), []);
  const out = A.renderSelection(registry, sel, images);
  assert.strictEqual(out.length, master.data.length);
  assert.ok(A.pixelsEqual(out, master.data));
  assert.deepStrictEqual(A.slotPresentation(registry, 'coat').options.map((o) => o.id), ['master']);
  assert.deepStrictEqual(A.slotPresentation(registry, 'pattern').options.map((o) => o.id), ['none']);
  for (const slot of ['eyes', 'nose']) {
    const pres = A.slotPresentation(registry, slot);
    assert.strictEqual(pres.enabled, false);
    assert.match(pres.note, /No artwork registered/);
    assert.throws(() => A.selectSlot(registry, sel, slot, 'amber'), /unavailable: no artwork registered/);
  }
});

test('shipped registry rejects a coat that is not master and a pattern that is not none', () => {
  const sel = A.defaultSelection(registry);
  assert.throws(() => A.selectSlot(registry, sel, 'coat', 'sandy'), /not a registered option/);
  assert.throws(() => A.selectSlot(registry, sel, 'pattern', 'stripes'), /not a registered option/);
  const again = A.selectSlot(registry, sel, 'pattern', 'none');
  assert.strictEqual(again.coat, 'master');
  assert.strictEqual(again.pattern, 'none');
  assert.notStrictEqual(again, sel);
});

test('exact canvas is required; a different size is rejected and not resampled', () => {
  const canvas = { width: 2, height: 2 };
  assert.throws(() => A.composite(canvas, { coat: solid(2, 1, [1, 2, 3, 255]) }, {}), /required 2x2/);
  assert.throws(() => A.composite(canvas, { coat: { width: 2, height: 2, data: new Uint8ClampedArray(4) } }, {}), /required 2x2/);
  assert.throws(() => A.assertNative(solid(1448, 1085, [0, 0, 0, 255]), registry.canvas, 'master/master.png'), /1448x1085/);
  assert.throws(() => A.displayFit(0, 1086, 100, 100), /positive/);
});

test('display scaling is one proportional factor and does not crop', () => {
  const fit = A.displayFit(1448, 1086, 700, 600);
  assert.ok(fit.scale < 1);
  assert.ok(fit.cssWidth <= 700 && fit.cssHeight <= 600);
  assert.strictEqual(fit.cssWidth / fit.cssHeight, 1448 / 1086);
  const wide = A.displayFit(1448, 1086, 2000, 500);
  assert.ok(wide.cssWidth <= 2000 && wide.cssHeight <= 500);
  assert.ok(Math.abs(wide.cssWidth / wide.cssHeight - 1448 / 1086) < 0.01);
});

test('straight alpha keeps a partial coat over transparency, including RGB', () => {
  const coat = solid(1, 1, [200, 180, 160, 128]);
  const out = A.composite({ width: 1, height: 1 }, { coat }, {});
  assert.deepStrictEqual([...out], [200, 180, 160, 128]);
  const doubled = Math.round(128 * 128 / 255);
  assert.notStrictEqual(doubled, 128);
});

test('partial coat over an opaque fill uses one source-over, not a darkened premultiply', () => {
  const canvas = { width: 1, height: 1 };
  const eye = solid(1, 1, [10, 20, 30, 255]);
  const mask = solid(1, 1, [255, 0, 0, 0]);
  const coat = solid(1, 1, [200, 180, 160, 128]);
  const out = A.composite(canvas, { eyes: eye, coat }, { eyeNose: mask });
  assert.deepStrictEqual([...out], [105, 100, 95, 255]);
});

test('eye and nose masks use luminance, so an opaque-black decode hides and a transparent-white decode keeps', () => {
  const canvas = { width: 1, height: 1 };
  const eye = solid(1, 1, [9, 8, 7, 255]);
  const hidden = A.composite(canvas, { eyes: eye }, { eyeNose: solid(1, 1, [0, 0, 0, 255]) });
  assert.deepStrictEqual([...hidden], [0, 0, 0, 0]);
  const kept = A.composite(canvas, { eyes: eye }, { eyeNose: solid(1, 1, [255, 255, 255, 0]) });
  assert.deepStrictEqual([...kept], [9, 8, 7, 255]);
});

test('layer order: eyes then nose behind the coat, pattern above the coat, cutouts not body-clipped', () => {
  const canvas = { width: 4, height: 1 };
  const px = (rows) => {
    const data = new Uint8ClampedArray(16);
    rows.forEach((rgba, i) => data.set(rgba, i * 4));
    return { width: 4, height: 1, data };
  };
  const eyes = px([[10, 0, 0, 255], [10, 0, 0, 255], [10, 0, 0, 255], [10, 0, 0, 255]]);
  const nose = px([[0, 0, 40, 255], [0, 0, 0, 0], [0, 0, 40, 255], [0, 0, 0, 0]]);
  const coat = px([[0, 0, 0, 0], [0, 0, 0, 0], [0, 80, 0, 255], [0, 80, 0, 255]]);
  const pattern = px([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [90, 0, 0, 255]]);
  const eyeNose = px([[255, 255, 255, 255], [255, 0, 0, 0], [0, 0, 0, 255], [0, 0, 0, 255]]);
  const out = A.composite(canvas, { eyes, nose, coat, pattern }, { eyeNose });
  assert.deepStrictEqual(at(out, 0), [0, 0, 40, 255]);
  assert.deepStrictEqual(at(out, 1), [10, 0, 0, 255]);
  assert.deepStrictEqual(at(out, 2), [0, 80, 0, 255]);
  assert.deepStrictEqual(at(out, 3), [90, 0, 0, 255]);
  assert.deepStrictEqual(A.STACK, ['eyes', 'nose', 'coat', 'pattern']);
});

test('coat and pattern selections are independent; empty eye and nose slots draw nothing', () => {
  const reg = A.parseRegistry({
    id: 'synthetic', version: 1, canvas: { width: 2, height: 1 },
    masks: {
      body: { file: 'masks/body.png', encoding: 'luminance', applied: false },
      eyeNose: { file: 'masks/eye-nose.png', encoding: 'luminance' },
    },
    slots: {
      coat: { default: 'red', options: [
        { id: 'red', label: 'Red', file: 'coats/red.png', available: true },
        { id: 'blue', label: 'Blue', file: 'coats/blue.png', available: true },
      ] },
      pattern: { default: 'none', options: [
        { id: 'none', label: 'No pattern', file: null, available: true },
        { id: 'dot', label: 'Dot', file: 'patterns/dot.png', available: true },
      ] },
      eyes: { default: null, options: [] },
      nose: { default: null, options: [] },
    },
  });
  const images = {
    'coats/red.png': solid(2, 1, [200, 0, 0, 255]),
    'coats/blue.png': solid(2, 1, [0, 0, 180, 255]),
    'patterns/dot.png': (() => {
      const image = solid(2, 1, [0, 0, 0, 0]);
      image.data.set([0, 160, 0, 255], 0);
      return image;
    })(),
  };
  const none = { coat: 'red', pattern: 'none', eyes: null, nose: null };
  const dotted = A.selectSlot(reg, none, 'pattern', 'dot');
  assert.strictEqual(dotted.coat, 'red');
  const blueDot = A.selectSlot(reg, dotted, 'coat', 'blue');
  assert.strictEqual(blueDot.pattern, 'dot');
  assert.deepStrictEqual(at(A.renderSelection(reg, none, images), 0), [200, 0, 0, 255]);
  assert.deepStrictEqual(at(A.renderSelection(reg, none, images), 1), [200, 0, 0, 255]);
  assert.deepStrictEqual(at(A.renderSelection(reg, dotted, images), 0), [0, 160, 0, 255]);
  assert.deepStrictEqual(at(A.renderSelection(reg, dotted, images), 1), [200, 0, 0, 255]);
  assert.deepStrictEqual(at(A.renderSelection(reg, blueDot, images), 0), [0, 160, 0, 255]);
  assert.deepStrictEqual(at(A.renderSelection(reg, blueDot, images), 1), [0, 0, 180, 255]);
  assert.deepStrictEqual(A.masksUsed(blueDot), []);
  assert.throws(() => A.renderSelection(reg, blueDot, {}), /missing pixels for coat/);
});

test('registry refuses body-mask application, escaped paths, and a non-native story', () => {
  const base = JSON.parse(fs.readFileSync(path.join(dir, 'registry.json'), 'utf8'));
  const bodyOn = JSON.parse(JSON.stringify(base));
  bodyOn.masks.body.applied = true;
  assert.throws(() => A.parseRegistry(bodyOn), /cannot be applied/);
  const escaped = JSON.parse(JSON.stringify(base));
  escaped.slots.coat.options.push({ id: 'outside', label: 'Outside', file: '../secret.png', available: true });
  assert.throws(() => A.parseRegistry(escaped), /inside assets\/appearance/);
  assert.strictEqual(registry.masks.body.applied, false);
  assert.strictEqual(registry.masks.eyeNose.applied, 'eyes-and-nose-only');
});

test('appearance code stays out of the game shell and out of the package', () => {
  const files = require('../package.json').build.files;
  const ships = (rel) => files.reduce((inc, p) => (p.startsWith('!') ? (minimatch(rel, p.slice(1), { dot: true }) ? false : inc) : (inc || minimatch(rel, p, { dot: true }))), false);
  for (const rel of ['assets/appearance/master/master.png', 'assets/appearance/registry.json', 'assets/appearance/ASSET-LOCK.json',
    'src/renderer/appearance-preview.html', 'src/renderer/js/appearance-render.js', 'src/renderer/js/appearance-preview.js', 'src/renderer/js/png-decode.js']) {
    assert.strictEqual(ships(rel), false, rel);
  }
  const index = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  const menu = fs.readFileSync(path.join(root, 'src/renderer/js/menu.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'src/main/preload.js'), 'utf8');
  const compositor = fs.readFileSync(path.join(root, 'src/renderer/js/compositor.js'), 'utf8');
  for (const src of [index, menu, main, preload, compositor]) assert.ok(!src.includes('appearance-render') && !src.includes('assets/appearance'));
  for (const rel of ['src/renderer/js/appearance-render.js', 'src/renderer/js/appearance-preview.js', 'src/renderer/js/png-decode.js']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(!/genesToLayers|tintPixels|loci|Creator/.test(src), rel);
  }
});
