// Portrait compositor: tint math, blend choice, stack order, elder opacity, missing files, genesToLayers, poseFor.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/js/compositor');
const mf = require('../assets/portraits/portrait-male/manifest.json');

const g = (coat, marking, eyes) => ({ v: 1, loci: { coat: [coat, coat], dilute: ['D', 'D'], marking: [marking, marking], dorsal: ['ds', 'ds'],
  intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: [eyes, eyes], saber: ['ivory', 'ivory'], het: ['Het', 'Het'] }, eyeRight: null, mutations: [] });

// portrait-layers v2: markings are multiplied; default tint = scale(mix(white, coat, 0.6), 0.62)
const multTint = (hex) => { const c = C.hexToRgb(C.mix('#FFFFFF', hex, 0.6)); return '#' + c.map((v) => Math.round(v * 0.62).toString(16).padStart(2, '0')).join('').toUpperCase(); };

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
  assert.deepStrictEqual(order, ['base_coat', 'markings_spotted', 'shadow', 'white_socks', 'eye_left', 'eye_right', 'sabers', 'scar_1', 'age_elder']);
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
  assert.deepStrictEqual(res.drawn, ['base_coat', 'undercoat', 'markings_spotted', 'shadow', 'nose', 'eye_left', 'eye_right', 'sabers', 'claws', 'age_elder', 'lineart']);
  assert.strictEqual(main[0].op, 'source-over'); assert.strictEqual(main[1].alpha, 0.85);
  assert.strictEqual(main[2].op, 'multiply'); assert.strictEqual(main[2].alpha, 0.6); assert.strictEqual(main[3].op, 'multiply');
  assert.strictEqual(main[9].alpha, 0.5);
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
  const coats = { tawny: '#C8955A', greydun: '#A39A88', russet: '#B0623A', melan: '#141416', sandy: '#D9BC8A', leuc: '#EDE6DA' };
  for (const [c, hex] of Object.entries(coats)) for (const m of ['plain', 'spotted', 'faintstripe']) for (const [e, eh] of [['amber', '#C98A1E'], ['gold', '#D9B43A'], ['green', '#8FA34A']]) {
    const L = C.genesToLayers(g(c, m, e));
    assert.strictEqual(L.base_coat.tint, hex); assert.strictEqual(L.eye_left.tint, eh); assert.strictEqual(L.eye_right.tint, eh);
    assert.strictEqual(L.sabers.tint, '#EFE7D2');
    const mk = Object.keys(L).filter((k) => k.startsWith('markings_'));
    if (m === 'plain') assert.deepStrictEqual(mk, []);
    else { assert.deepStrictEqual(mk, ['markings_' + m]); assert.strictEqual(L[mk[0]].opacity, c === 'melan' && m === 'faintstripe' ? 0.24 : 0.6);
      assert.strictEqual(L[mk[0]].tint, c === 'melan' ? '#3A3836' : c === 'leuc' ? '#E6DED2' : multTint(hex)); }
    assert.ok(!Object.keys(L).some((k) => k.startsWith('white_') || k === 'age_elder'));
    for (const l of Object.keys(L)) if (l !== 'eye_right' || true) assert.ok(mf.layers.some((x) => x.id === l), `${l} in manifest`);
  }
});
test('genetics §2: ash = melan/leuc codominant (#8A95A3, Ochre palette v1), coat-derived markings; Co order does not matter', () => {
  for (const pair of [['melan', 'leuc'], ['leuc', 'melan']]) {
    const L = C.genesToLayers({ ...g('tawny', 'spotted', 'amber'), loci: { ...g('tawny', 'spotted', 'amber').loci, coat: pair } });
    assert.strictEqual(L.base_coat.tint, '#8A95A3'); assert.strictEqual(L.markings_spotted.tint, multTint('#8A95A3'));
  }
  assert.strictEqual(C.genesToLayers({ ...g('melan', 'plain', 'amber'), loci: { ...g('melan', 'plain', 'amber').loci, coat: ['tawny', 'melan'] } }).base_coat.tint, '#C8955A');
  assert.deepStrictEqual([C.TINTS.coat.sandy, C.TINTS.coat.ash, C.TINTS.coat.leuc, C.TINTS.coat.melan], ['#D9BC8A', '#8A95A3', '#EDE6DA', '#141416']);
});
test('genetics §2.5 odd eyes: eye_left/eye_right tinted separately only for het/het; back-compatible', () => {
  const odd = (het, right) => ({ ...g('tawny', 'plain', 'amber'), loci: { ...g('tawny', 'plain', 'amber').loci, het }, eyeRight: right });
  let L = C.genesToLayers(odd(['het', 'het'], 'green'));
  assert.deepStrictEqual([L.eye_left.tint, L.eye_right.tint], ['#C98A1E', '#8FA34A']);
  assert.deepStrictEqual(C.resolveEyes(odd(['het', 'het'], 'green')), { left: 'amber', right: 'green' });
  for (const [het, right] of [[['Het', 'het'], 'green'], [['Het', 'Het'], 'green'], [['het', 'het'], null], [['het', 'het'], 'amber']]) {
    L = C.genesToLayers(odd(het, right)); assert.strictEqual(L.eye_right.tint, L.eye_left.tint, JSON.stringify([het, right]));
  }
  const old = { ...g('gold', 'plain', 'gold') }; delete old.loci.het; delete old.eyeRight; old.hetero = true;   // pre-v0.3 genome: no het locus; hetero ignored
  assert.deepStrictEqual(C.resolveEyes(old), { left: 'gold', right: 'gold' });
  L = C.genesToLayers(g('tawny', 'plain', 'amber'), { eyes: { left: 'gold', right: 'green' } });
  assert.deepStrictEqual([L.eye_left.tint, L.eye_right.tint], ['#D9B43A', '#8FA34A']);
  L = C.genesToLayers(g('tawny', 'plain', 'amber'), { eyes: { left: 'gold' } });
  assert.deepStrictEqual([L.eye_left.tint, L.eye_right.tint], ['#D9B43A', '#D9B43A']);
});
test('portrait-layers v2: undercoat/rim/sheen/nose/claws, barred order, dorsal above the body pattern, lighting above markings', () => {
  const m = C.genesToLayers(g('melan', 'rosette', 'gold'));
  assert.strictEqual(m.rim.tint, '#4A5868'); assert.strictEqual(m.sheen.tint, '#38424E'); assert.strictEqual(m.sheen.opacity, 0.9);
  assert.strictEqual(m.markings_rosette.tint, '#3A3836');
  const ash = C.genesToLayers({ v: 1, loci: { coat: ['melan', 'leuc'] } });
  assert.strictEqual(ash.sheen.opacity, 0.25); assert.ok(!ash.rim); assert.strictEqual(ash.undercoat.tint, '#BAC3CD');
  const t = C.genesToLayers(g('tawny', 'plain', 'amber')); assert.ok(!t.rim && !t.sheen); assert.strictEqual(t.nose.tint, '#4A3C38');
  assert.deepStrictEqual(t.undercoat, { tint: '#E6CFA6', opacity: 0.85 });
  const und = (under, underInt) => C.genesToLayers({ v: 1, loci: { coat: ['tawny', 'tawny'], under, underInt } });
  assert.ok(!und(['off', 'off']).undercoat);
  assert.strictEqual(und(['pale', 'off']).undercoat.tint, C.mix('#E6CFA6', '#C8955A', 0.5));
  assert.deepStrictEqual([0, 1, 2].map((n) => und(['cream', 'cream'], ['U+', 'U+', 'U-', 'U-'].slice(2 - n, 4 - n)).undercoat.opacity), [0.35, 0.6, 0.85]);
  assert.strictEqual(C.genesToLayers({ v: 1, loci: { coat: ['leuc', 'leuc'] } }).nose.tint, '#B89A9C');
  assert.ok(C.genesToLayers({ v: 1, loci: { marking: ['barred', 'faintstripe'] } }).markings_barred);
  assert.ok(C.genesToLayers({ v: 1, loci: { marking: ['rosette', 'barred'] } }).markings_rosette);
  for (const id of ['rim', 'sheen']) assert.strictEqual(mf.layers.find((l) => l.id === id).blend, 'screen');
  for (const l of mf.layers.filter((x) => x.id.startsWith('markings_'))) assert.strictEqual(l.blend, 'multiply');
  const all = [...mf.layers, { id: 'markings_dorsal', file: 'markings_dorsal.png' }];
  const order = C.stackOrder(all, Object.fromEntries(all.map((l) => [l.id, { tint: '#FFFFFF', opacity: 1 }]))).map((l) => l.id);
  const at = (id) => order.indexOf(id);
  assert.ok(at('undercoat') < at('markings_spotted') && at('markings_faintstripe') < at('markings_dorsal') && at('markings_dorsal') < at('shadow'));
  assert.ok(at('shadow') < at('rim') && at('sheen') < at('nose') && at('sabers') < at('claws'));
});
test('Ochre item 7: black (melan) markings draw after sheen with tint #3A3836, still multiply; tan order/tint unchanged', () => {
  const ids = ['shadow', 'base_coat', 'undercoat', 'rim', 'sheen', 'markings_spotted', 'markings_faintstripe', 'markings_dorsal', 'white_chest', 'nose', 'eye_left', 'eye_right', 'sabers', 'claws', 'lineart'];
  const man = ids.map((id) => ({ id, file: id + '.png', blend: id.startsWith('markings_') ? 'multiply' : id === 'rim' || id === 'sheen' ? 'screen' : 'normal' }));
  const withDorsal = (coat, mk) => { const x = g(coat, mk, 'amber'); x.loci.dorsal = ['Ds', 'Ds']; return x; };
  for (const mk of ['spotted', 'faintstripe']) {
    const black = C.stackOrder(man, C.genesToLayers(withDorsal('melan', mk)));
    assert.deepStrictEqual(black.map((l) => l.id), ['base_coat', 'undercoat', 'shadow', 'rim', 'sheen', `markings_${mk}`, 'markings_dorsal', 'nose', 'eye_left', 'eye_right', 'sabers', 'claws']);
    for (const l of black.filter((x) => x.id.startsWith('markings_'))) { assert.strictEqual(l.tint, '#3A3836'); assert.strictEqual(C.blendFor(l), 'multiply'); }
    const tan = C.stackOrder(man, C.genesToLayers(withDorsal('tawny', mk)));
    assert.deepStrictEqual(tan.map((l) => l.id), ['base_coat', 'undercoat', `markings_${mk}`, 'markings_dorsal', 'shadow', 'nose', 'eye_left', 'eye_right', 'sabers', 'claws']);
    const tl = tan.find((l) => l.id === `markings_${mk}`); assert.strictEqual(tl.after, undefined); assert.notStrictEqual(tl.tint, '#3A3836');
  }
  for (const c of ['tawny', 'sandy', 'russet', 'greydun', 'leuc']) assert.strictEqual(C.genesToLayers(g(c, 'spotted', 'amber')).markings_spotted.after, undefined);
  assert.strictEqual(C.genesToLayers({ v: 1, loci: { coat: ['melan', 'leuc'], marking: ['spotted', 'spotted'] } }).markings_spotted.after, undefined);   // ash unchanged
  assert.strictEqual(C.TINTS.markingsMelan, '#3A3836');
});
test('Ochre item 7: black + faintstripe opacity × 0.4 = 0.14/0.24/0.34; black spots/dorsal and other coats unchanged', () => {
  const gi = (coat, mk, n) => { const x = g(coat, mk, 'amber'); x.loci.intensity = Array.from({ length: 2 }, (_, i) => (i < n ? 'I+' : 'i')); x.loci.dorsal = ['Ds', 'Ds']; return x; };
  const base = [0.35, 0.60, 0.85];
  assert.deepStrictEqual([0, 1, 2].map((n) => C.genesToLayers(gi('melan', 'faintstripe', n)).markings_faintstripe.opacity), [0.14, 0.24, 0.34]);
  assert.deepStrictEqual([0, 1, 2].map((n) => C.genesToLayers(gi('melan', 'faintstripe', n)).markings_dorsal.opacity), base);
  assert.deepStrictEqual([0, 1, 2].map((n) => C.genesToLayers(gi('melan', 'spotted', n)).markings_spotted.opacity), base);
  assert.deepStrictEqual([0, 1, 2].map((n) => C.genesToLayers(gi('melan', 'spotted', n)).markings_dorsal.opacity), base);
  assert.strictEqual(C.genesToLayers(gi('melan', 'faintstripe', 1)).markings_dorsal.after, 'sheen');
  for (const c of ['tawny', 'sandy', 'russet', 'greydun', 'leuc']) for (const mk of ['faintstripe', 'spotted'])
    assert.deepStrictEqual([0, 1, 2].map((n) => C.genesToLayers(gi(c, mk, n))['markings_' + mk].opacity), base, `${c} ${mk}`);
  const ash = (n) => ({ v: 1, loci: { coat: ['melan', 'leuc'], marking: ['faintstripe', 'faintstripe'], intensity: Array.from({ length: 2 }, (_, i) => (i < n ? 'I+' : 'i')) } });
  assert.deepStrictEqual([0, 1, 2].map((n) => C.genesToLayers(ash(n)).markings_faintstripe.opacity), base, 'ash unchanged');
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
