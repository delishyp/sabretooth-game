// Make Your Sabrecat model (cat-creator-spec v0.2): mainCat construction, ranges, presets → custom, both Randomize scopes, navigation.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/js/creator');
const { validateMainCat } = require('../src/main/main-cat');
const copy = require('../src/renderer/data/menu-copy.json');
const names = copy.creator.defaultNames;

function seeded(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const env = (o = {}) => ({ names, rng: seeded(7), newId: () => 'cat_test', device: 'keyboard', ...o });
const run = (s, actions, e = env()) => { let st = s, eff = null; for (const a of actions) { const r = Array.isArray(a) ? C.reduce(st, a[0], a[1], e) : C.reduce(st, a, undefined, e); st = r.state; eff = r.effect || eff; } return { state: st, effect: eff }; };
const base = (o = {}) => ({ ...C.init({ names, rng: seeded(3) }), ...o });

test('run start constant and birthSeason: Year 1 spring, born {year:-2, season:"spring"} at 12 seasons, adult', () => {
  assert.deepStrictEqual({ ...C.RUN_START }, { year: 1, season: 'spring', day: 1 });
  assert.strictEqual(C.PLAYER_START_AGE, 12);
  assert.deepStrictEqual(C.birthSeasonFor(12), { year: -2, season: 'spring' });
  assert.deepStrictEqual(C.birthSeasonFor(1), { year: 0, season: 'winter' });
  assert.deepStrictEqual(['cub', 'cub', 'adolescent', 'adolescent', 'adult', 'adult', 'elder'], [0, 3, 4, 11, 12, 39, 40].map(C.lifeStageFor));
});

test('mainCat: spec §5.2–5.4 shape, homozygous chosen loci, fixed defaults, personality = sliders', () => {
  const s = base({ name: '  Ash   Tail ', sex: 'female', coat: 'gray', markings: 'faintstripe', eyes: 'green', traits: { aggression: 75, sociability: 20, boldness: 80, loyalty: 35, curiosity: 55 } });
  const m = C.buildMainCat(s, { names, newId: () => 'cat_x' });
  assert.deepStrictEqual(m, {
    catId: 'cat_x', name: 'Ash Tail', sex: 'female', ageSeasons: 12, birthSeason: { year: -2, season: 'spring' }, lifeStage: 'adult',
    genes: { v: 1, loci: { coat: ['greydun', 'greydun'], dilute: ['D', 'D'], marking: ['faintstripe', 'faintstripe'], dorsal: ['ds', 'ds'],
      intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: ['green', 'green'], saber: ['ivory', 'ivory'] }, hetero: false, mutations: [],
      personality: { aggression: 75, sociability: 20, boldness: 80, loyalty: 35, curiosity: 55 } },
    scars: []
  });
  assert.doesNotThrow(() => validateMainCat(m, { difficulty: 'heir' }));
});
test('option → allele mapping covers all 72 looks; none = plain', () => {
  let n = 0;
  for (const sex of C.SEXES) for (const coat of C.COATS) for (const markings of C.MARKINGS) for (const eyes of C.EYES) {
    const g = C.genesFor(base({ sex, coat, markings, eyes })); n++;
    assert.deepStrictEqual([g.loci.coat[0], g.loci.marking[0], g.loci.eyes[0]], [C.COAT_ALLELE[coat], C.MARKING_ALLELE[markings], C.EYE_ALLELE[eyes]]);
  }
  assert.strictEqual(n, 72);
  assert.deepStrictEqual(C.COAT_ALLELE, { tan: 'tawny', gray: 'greydun', brown: 'russet', black: 'melan' });
  assert.strictEqual(C.MARKING_ALLELE.none, 'plain');
});
test('blank / whitespace name → random default name on Start (§4.2), never an error', () => {
  for (const nm of ['', '   ']) {
    const { effect } = run(base({ name: nm, step: 2, focus: 'start' }), ['confirm']);
    assert.strictEqual(effect.type, 'start'); assert.ok(names.includes(effect.mainCat.name), effect.mainCat.name);
  }
});
test('name filter: 16 max (17th rejected with tooLong), invalid chars dropped, letters/space/hyphen/apostrophe kept', () => {
  assert.deepStrictEqual(C.sanitizeName('A'.repeat(16)), { value: 'A'.repeat(16), error: null });
  assert.deepStrictEqual(C.sanitizeName('A'.repeat(17)), { value: 'A'.repeat(16), error: 'creator.name.error.tooLong' });
  assert.deepStrictEqual(C.sanitizeName("Ash-tail O'Rook"), { value: "Ash-tail O'Rook", error: null });
  assert.deepStrictEqual(C.sanitizeName('Ash7!'), { value: 'Ash', error: 'creator.name.error.invalidChars' });
  assert.strictEqual(C.sanitizeName('Élan').value, 'Élan');
  const { state } = run(base(), [['nameInput', 'x'.repeat(20)]]);
  assert.strictEqual(state.name.length, 16); assert.strictEqual(state.nameError, 'creator.name.error.tooLong');
});

test('ranges: 20–80 normally, 0–100 only for Sandbox + Free Customization On; steps of 5; default 50', () => {
  assert.deepStrictEqual(C.rangeFor('heir'), { min: 20, max: 80 });
  assert.deepStrictEqual(C.rangeFor('permadeath', { freeCustomization: true }), { min: 20, max: 80 });
  assert.deepStrictEqual(C.rangeFor('sandbox', { freeCustomization: false }), { min: 20, max: 80 });
  assert.deepStrictEqual(C.rangeFor('sandbox', { freeCustomization: true }), { min: 0, max: 100 });
  const s0 = C.init({ names, difficulty: 'heir' });
  assert.deepStrictEqual(Object.values(s0.traits), [50, 50, 50, 50, 50]); assert.strictEqual(s0.preset, 'balanced');
  for (const [d, o, lo, hi] of [['heir', undefined, 20, 80], ['sandbox', { freeCustomization: true }, 0, 100]]) {
    const s = { ...C.init({ names, difficulty: d, sandboxOptions: o }), step: 2, focus: 'trait:boldness' };
    assert.strictEqual(run(s, Array(30).fill('right')).state.traits.boldness, hi);
    assert.strictEqual(run(s, Array(30).fill('left')).state.traits.boldness, lo);
    assert.strictEqual(run(s, ['right']).state.traits.boldness, 55);
    assert.strictEqual(C.setTrait(s, 'loyalty', 62.4).traits.loyalty, 60);
    assert.strictEqual(C.setTrait(s, 'loyalty', -40).traits.loyalty, lo);
  }
});
test('presets set exactly §3b.3; moving any slider switches to custom; cycling never lands on custom', () => {
  const want = { balanced: [50, 50, 50, 50, 50], fighter: [75, 40, 70, 50, 40], peacemaker: [30, 75, 45, 60, 50], wanderer: [45, 35, 60, 30, 80], guardian: [55, 55, 50, 80, 35] };
  assert.deepStrictEqual(C.TRAITS, ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity']);
  let s = { ...base(), step: 2, focus: 'preset' };
  const seen = [];
  for (let i = 0; i < 5; i++) { s = run(s, ['right']).state; seen.push(s.preset); assert.deepStrictEqual(C.TRAITS.map((k) => s.traits[k]), want[s.preset]); }
  assert.deepStrictEqual(seen, ['fighter', 'peacemaker', 'wanderer', 'guardian', 'balanced']);
  for (const t of C.TRAITS) {
    const r = run({ ...s, focus: `trait:${t}` }, ['left']).state;
    assert.strictEqual(r.preset, 'custom'); assert.strictEqual(r.traits[t], 45);
  }
  const custom = run({ ...s, focus: 'trait:loyalty' }, ['right', 'up']).state;
  assert.strictEqual(custom.preset, 'custom');
  assert.strictEqual(run({ ...custom, focus: 'preset' }, ['right']).state.preset, 'balanced');
  assert.strictEqual(run({ ...custom, focus: 'preset' }, ['left']).state.preset, 'guardian');
  // a move that hits the clamp changes nothing and keeps the preset
  const atMax = { ...C.applyPreset({ ...base(), step: 2 }, 'wanderer'), focus: 'trait:curiosity' };
  assert.strictEqual(run(atMax, ['right']).state.preset, 'wanderer');
  // mouse arrows on a slider row
  assert.strictEqual(run({ ...s, focus: 'preset' }, [['arrow', { id: 'trait:aggression', dir: 1 }]]).state.preset, 'custom');
});

test('Randomize on step 1: only coat/markings/eyes change, look always differs; name, sex and personality kept', () => {
  let s = { ...base({ name: 'Keep', sex: 'female' }), traits: { aggression: 25, sociability: 30, boldness: 35, loyalty: 40, curiosity: 45 }, preset: 'custom' };
  const rng = seeded(11);
  for (let i = 0; i < 500; i++) {
    const r = C.randomizeLook(s, rng);
    assert.ok(r.coat !== s.coat || r.markings !== s.markings || r.eyes !== s.eyes);
    assert.deepStrictEqual([r.name, r.sex, r.traits, r.preset, r.step], [s.name, s.sex, s.traits, s.preset, s.step]);
    assert.ok(C.COATS.includes(r.coat) && C.MARKINGS.includes(r.markings) && C.EYES.includes(r.eyes));
    s = r;
  }
  const btn = run({ ...s, focus: 'randomize' }, ['confirm']).state;
  assert.deepStrictEqual([btn.name, btn.sex, btn.traits], [s.name, s.sex, s.traits]);
  assert.ok(btn.coat !== s.coat || btn.markings !== s.markings || btn.eyes !== s.eyes);
});
test('Randomize on step 2: only traits change, Normal(50,15) on steps of 5 inside the range, preset custom', () => {
  for (const [d, o, lo, hi] of [['standard', undefined, 20, 80], ['sandbox', { freeCustomization: true }, 0, 100]]) {
    const s0 = { ...C.init({ names, difficulty: d, sandboxOptions: o, rng: seeded(5) }), step: 2, focus: 'randomize' };
    const rng = seeded(9); const vals = [];
    for (let i = 0; i < 2000; i++) {
      const r = C.randomizeTraits(s0, rng);
      assert.deepStrictEqual([r.name, r.sex, r.coat, r.markings, r.eyes], [s0.name, s0.sex, s0.coat, s0.markings, s0.eyes]);
      assert.strictEqual(r.preset, 'custom');
      for (const v of Object.values(r.traits)) { assert.ok(Number.isInteger(v) && v % 5 === 0 && v >= lo && v <= hi, String(v)); vals.push(v); }
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length; assert.ok(Math.abs(mean - 50) < 1.5, String(mean));
    const r = run(s0, ['confirm']).state; assert.deepStrictEqual([r.coat, r.markings, r.eyes, r.step], [s0.coat, s0.markings, s0.eyes, 2]);
  }
});

test('navigation: focus starts on Name; Up/Down wrap; button row enters on Next/Start; Left/Right in rows and buttons', () => {
  const s = base();
  assert.strictEqual(s.focus, 'name'); assert.strictEqual(s.step, 1);
  const seq = []; let st = s; for (let i = 0; i < 6; i++) { st = run(st, ['down']).state; seq.push(st.focus); }
  assert.deepStrictEqual(seq, ['sex', 'coat', 'markings', 'eyes', 'next', 'name']);
  assert.strictEqual(run(s, ['up']).state.focus, 'next');
  assert.deepStrictEqual(['left', 'left', 'left'].reduce((a, k) => { a.push(run({ ...s, focus: a.length ? a[a.length - 1] : 'next' }, [k]).state.focus); return a; }, []), ['back', 'randomize', 'next']);
  assert.strictEqual(run({ ...s, focus: 'sex', sex: 'male' }, ['right']).state.sex, 'female');
  assert.strictEqual(run({ ...s, focus: 'sex', sex: 'male' }, ['confirm']).state.sex, 'female');   // Enter/Space/A cycles too
  assert.strictEqual(run({ ...s, focus: 'coat', coat: 'tan' }, ['left']).state.coat, 'black');
  const name = run({ ...s, focus: 'name', name: 'Typed' }, ['left', 'right']).state; assert.deepStrictEqual([name.name, name.focus], ['Typed', 'name']);
  const s2 = run({ ...s, focus: 'next' }, ['confirm']).state;
  assert.deepStrictEqual([s2.step, s2.focus], [2, 'preset']);
  const seq2 = []; st = s2; for (let i = 0; i < 7; i++) { st = run(st, ['down']).state; seq2.push(st.focus); }
  assert.deepStrictEqual(seq2, ['trait:aggression', 'trait:sociability', 'trait:boldness', 'trait:loyalty', 'trait:curiosity', 'start', 'preset']);
});
test('Name: gamepad A rerolls a default name; keyboard Enter moves on; sex change keeps the look', () => {
  const s = base({ name: 'Mine', focus: 'name' });
  const pad = run(s, ['confirm'], env({ device: 'controller' })).state;
  assert.ok(names.includes(pad.name) && pad.name !== 'Mine'); assert.strictEqual(pad.focus, 'name');
  const kb = run(s, ['confirm']).state; assert.deepStrictEqual([kb.name, kb.focus], ['Mine', 'sex']);
  const sx = run({ ...s, focus: 'sex' }, ['right']).state;
  assert.deepStrictEqual([sx.coat, sx.markings, sx.eyes], [s.coat, s.markings, s.eyes]); assert.notStrictEqual(sx.sex, s.sex);
});
test('Back: step 2 → step 1 keeps look and personality (check 10); step 1 → leave; Esc/B = back; gamepad Start = Next / Start', () => {
  const s = base({ name: 'Rook' });
  const p = run({ ...s, focus: 'next' }, ['confirm', ['arrow', { id: 'trait:loyalty', dir: 1 }], 'right']).state;
  const back = run(p, ['back']).state;
  assert.deepStrictEqual([back.step, back.focus], [1, 'next']);
  const again = run(back, ['confirm']).state;
  assert.deepStrictEqual([again.traits, again.preset, again.coat, again.markings, again.eyes, again.sex, again.name], [p.traits, 'custom', s.coat, s.markings, s.eyes, s.sex, 'Rook']);
  assert.deepStrictEqual(run(s, ['back']).effect, { type: 'leave' });
  assert.deepStrictEqual(run({ ...s, focus: 'back' }, ['confirm']).effect, { type: 'leave' });
  assert.strictEqual(run({ ...p, focus: 'back' }, ['confirm']).state.step, 1);
  assert.strictEqual(run(s, ['start']).state.step, 2);
  const st = run({ ...p, focus: 'preset' }, ['start']).effect;
  assert.strictEqual(st.type, 'start'); assert.deepStrictEqual(st.mainCat.genes.personality, p.traits);   // check 11
});
test('mouse: click cycles a value, arrows change rows, hover moves focus only', () => {
  const s = base({ coat: 'tan' });
  assert.strictEqual(run(s, [['click', 'coat']]).state.coat, 'gray');
  assert.strictEqual(run(s, [['arrow', { id: 'coat', dir: -1 }]]).state.coat, 'black');
  const h = run(s, [['hover', 'eyes']]).state; assert.deepStrictEqual([h.focus, h.eyes], ['eyes', s.eyes]);
  assert.strictEqual(run(s, [['hover', 'start']]).state.focus, 'name');            // not on step 1
  assert.strictEqual(run(s, [['click', 'next']]).state.step, 2);
});

test('main validates mainCat: rejects heterozygous/out-of-range/off-step/bad name; snapshot vs record', () => {
  const ok = C.buildMainCat(base({ traits: { aggression: 0, sociability: 100, boldness: 50, loyalty: 50, curiosity: 50 } }), { newId: () => 'cat_v' });
  assert.throws(() => validateMainCat(ok, { difficulty: 'heir' }), /personality.aggression/);
  const v = validateMainCat(ok, { difficulty: 'sandbox', sandboxOptions: { freeCustomization: true } });
  assert.deepStrictEqual(Object.keys(v.snapshot), ['catId', 'name', 'sex', 'lifeStage', 'genes', 'scars']);
  assert.deepStrictEqual([v.record.ageSeasons, v.record.birthSeason, 'lifeStage' in v.record], [12, { year: -2, season: 'spring' }, false]);
  const good = C.buildMainCat(base(), { newId: () => 'cat_v' });
  const bad = (f) => { const m = JSON.parse(JSON.stringify(good)); f(m); return m; };
  for (const m of [bad((m) => { m.genes.loci.coat = ['tawny', 'melan']; }), bad((m) => { m.genes.personality.loyalty = 52; }), bad((m) => { m.name = 'A'.repeat(17); }),
    bad((m) => { m.name = ''; }), bad((m) => { m.ageSeasons = 16; }), bad((m) => { m.birthSeason = { year: -3, season: 'spring' }; }), bad((m) => { m.genes.loci.saber = ['creamy', 'creamy']; }),
    bad((m) => { m.scars = ['scar_1']; }), bad((m) => { m.sex = 'x'; })]) assert.throws(() => validateMainCat(m, { difficulty: 'heir' }));
});
