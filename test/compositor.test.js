// Portrait compositor: tint math, blend choice, stack order, elder opacity, missing files, genesToLayers, poseFor.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/js/compositor');
const mf = require('../assets/portraits/portrait-male/manifest.json');

const g = (coat, marking, eyes) => ({ v: 1, loci: { coat: [coat, coat], dilute: ['D', 'D'], marking: [marking, marking], dorsal: ['ds', 'ds'],
  intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: [eyes, eyes], saber: ['ivory', 'ivory'] }, hetero: false, mutations: [] });

test('tint = color × shading, alpha kept', () => {
  const d = new Uint8ClampedArray([255, 255, 255, 200, 128, 128, 128, 17, 0, 0, 0, 255]);
  C.tintPixels(d, '#C8955A');
  assert.deepStrictEqual([...d], [200, 149, 90, 200, 100, 75, 45, 17, 0, 0, 0, 255]);
});
test('blend selection, default normal, unknown warns', () => {
  assert.strictEqual(C.blendFor({ id: 'a' }), 'source-over');
  assert.strictEqual(C.blendFor({ id: 'a', blend: 'normal' }), 'source-over');
  assert.strictEqual(C.blendFor({ id: 'shadow', blend: 'multiply' }), 'multiply');
  assert.strictEqual(C.blendFor({ id: 'rim', blend: 'screen' }), 'screen');
  const w = []; assert.strictEqual(C.blendFor({ id: 'x', blend: 'overlay' }, (m) => w.push(m)), 'source-over'); assert.strictEqual(w.length, 1);
  assert.strictEqual(mf.layers.find((l) => l.id === 'shadow').blend, 'multiply');
});
test('stack order is canonical regardless of manifest order', () => {
  const ids = ['age_elder', 'sabers', 'eye_right', 'eye_left', 'white_socks', 'markings_spotted', 'base_coat', 'shadow', 'scar_1'];
  const active = Object.fromEntries(ids.map((i) => [i, { tint: '#FFFFFF', opacity: 1 }]));
  const order = C.stackOrder(ids.map((id) => ({ id, file: id + '.png' })), active).map((l) => l.id);
  assert.deepStrictEqual(order, ['shadow', 'base_coat', 'markings_spotted', 'white_socks', 'eye_left', 'eye_right', 'sabers', 'scar_1', 'age_elder']);
});

function fakeCanvas(log) {
  const ctx = { globalCompositeOperation: 'source-over', globalAlpha: 1, clearRect() {},
    drawImage(img) { log.push({ src: img.src || 'off', op: this.globalCompositeOperation, alpha: this.globalAlpha }); },
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(4) }), putImageData() {} };
  return { width: 0, height: 0, getContext: () => ctx };
}
async function run(genes, opts = {}, missing = []) {
  const log = [], warns = [];
  const res = await C.compose({ ...mf, layers: [...mf.layers, { id: 'age_elder', file: 'age_elder.png', blend: 'normal' }] }, genes, {
    canvas: fakeCanvas(log), createCanvas: () => fakeCanvas([]), warn: (m) => warns.push(m),
    loadImage: async (p) => { if (missing.some((m) => p.endsWith(m))) throw new Error('404'); return { src: p }; }, ...opts });
  return { res, warns, main: log.filter((e) => e.src === 'off' || e.src === 'lineart.png') };
}
test('compose draws stack with blends, lineart last; elder opacity', async () => {
  const { res, main } = await run(g('tawny', 'spotted', 'amber'), { lifeStage: 'elder' });
  assert.deepStrictEqual(res.drawn, ['shadow', 'base_coat', 'markings_spotted', 'eye_left', 'eye_right', 'sabers', 'age_elder', 'lineart']);
  assert.strictEqual(main[0].op, 'multiply'); assert.strictEqual(main[1].op, 'source-over');
  assert.strictEqual(main[2].alpha, 0.6); assert.strictEqual(main[6].alpha, 0.5);
  const { res: r2 } = await run(g('tawny', 'plain', 'amber'), { lifeStage: 'adult' });
  assert.ok(!r2.drawn.includes('age_elder') && !r2.drawn.some((d) => d.startsWith('markings')));
  assert.strictEqual(C.genesToLayers(g('tawny', 'plain', 'amber'), { lifeStage: 'elder', elderOpacity: 0.8 }).age_elder.opacity, 0.8);
});
test('missing layer file is skipped with a warning, not a crash', async () => {
  const { res, warns } = await run(g('russet', 'faintstripe', 'gold'), {}, ['eye_left.png', 'lineart.png']);
  assert.deepStrictEqual(res.skipped, ['eye_left', 'lineart']);
  assert.ok(res.drawn.includes('eye_right')); assert.strictEqual(warns.length, 2);
});
test('genesToLayers covers every creator option (cat-creator-spec v0.1 §3)', () => {
  const coats = { tawny: '#C8955A', greydun: '#A39A88', russet: '#B0623A', melan: '#3A332E' };
  for (const [c, hex] of Object.entries(coats)) for (const m of ['plain', 'spotted', 'faintstripe']) for (const [e, eh] of [['amber', '#C98A1E'], ['gold', '#D9B43A'], ['green', '#8FA34A']]) {
    const L = C.genesToLayers(g(c, m, e));
    assert.strictEqual(L.base_coat.tint, hex); assert.strictEqual(L.eye_left.tint, eh); assert.strictEqual(L.eye_right.tint, eh);
    assert.strictEqual(L.sabers.tint, '#EFE7D2');
    const mk = Object.keys(L).filter((k) => k.startsWith('markings_'));
    if (m === 'plain') assert.deepStrictEqual(mk, []);
    else { assert.deepStrictEqual(mk, ['markings_' + m]); assert.strictEqual(L[mk[0]].opacity, 0.6);
      assert.strictEqual(L[mk[0]].tint, c === 'melan' ? '#1E1A17' : C.mix(hex, '#000000', 0.45)); }
    assert.ok(!Object.keys(L).some((k) => k.startsWith('white_') || k === 'age_elder'));
    for (const l of Object.keys(L)) if (l !== 'eye_right' || true) assert.ok(mf.layers.some((x) => x.id === l), `${l} in manifest`);
  }
});
test('poseFor + fallback to adult pose', async () => {
  assert.strictEqual(C.poseFor('male', 'adult'), 'portrait-male');
  assert.strictEqual(C.poseFor('female', 'elder'), 'portrait-female');
  assert.strictEqual(C.poseFor('female', 'cub'), 'portrait-female-cub');
  assert.strictEqual(C.poseFor('male', 'adolescent'), 'portrait-male-adolescent');
  const warns = [];
  const r = await C.loadPoseManifest('female', 'cub', { warn: (m) => warns.push(m),
    loadJson: async (p) => { if (p.includes('-cub')) throw new Error('404'); return { p }; } });
  assert.strictEqual(r.pose, 'portrait-female'); assert.strictEqual(warns.length, 1);
});
