// Make Your Sabrecat model (cat-creator-spec v0.3.1): mainCat construction, ranges, presets → custom, both Randomize scopes, navigation.
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
      intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: ['green', 'green'], saber: ['ivory', 'ivory'], het: ['Het', 'Het'] }, eyeRight: null, mutations: [],
      personality: { aggression: 75, sociability: 20, boldness: 80, loyalty: 35, curiosity: 55 } },
    scars: [], portraitId: null
  });
  assert.doesNotThrow(() => validateMainCat(m, { difficulty: 'heir' }));
});
test('static pictures: the picker lists every id for either sex, and coat controls stay off that screen', () => {
  const ids = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../assets/portraits/registry.json'), 'utf8')).portraits.map((p) => p.id);
  assert.strictEqual(ids.length, 40);
  let s = C.init({ names, rng: seeded(4), portraitIds: ids });
  assert.strictEqual(s.staticArt, true);
  assert.strictEqual(s.portraitId, ids[0]);
  assert.deepStrictEqual(C.ROWS(s), ['name', 'sex', 'portrait']);
  const seen = new Set([s.portraitId]);
  for (let i = 0; i < ids.length; i++) { s = C.reduce(s, 'arrow', { id: 'portrait', dir: 1 }).state; seen.add(s.portraitId); }
  assert.strictEqual(seen.size, 40);
  const name = s.name; const sex = s.sex; const coat = s.coat; const picture = s.portraitId;
  s = C.reduce(s, 'arrow', { id: 'sex', dir: 1 }).state;
  assert.notStrictEqual(s.sex, sex);
  assert.strictEqual(s.portraitId, picture);
  assert.strictEqual(s.coat, coat);
  const nameData = require('../src/renderer/data/names/names.json');
  s = C.reduce(s, 'rerollName', undefined, env({ nameData })).state;
  assert.notStrictEqual(s.name, name);
  assert.strictEqual(s.portraitId, picture);
  const before = s.portraitId; const keptName = s.name;
  s = C.reduce(s, 'click', 'randomize', { rng: seeded(11) }).state;
  assert.notStrictEqual(s.portraitId, before);
  assert.ok(ids.includes(s.portraitId));
  assert.strictEqual(s.name, keptName);
  const male = C.buildMainCat({ ...s, sex: 'male' }, { newId: () => 'cat_m' });
  const female = C.buildMainCat({ ...s, sex: 'female' }, { newId: () => 'cat_f' });
  assert.strictEqual(male.portraitId, female.portraitId);
  assert.strictEqual(male.portraitId, s.portraitId);
  assert.doesNotThrow(() => validateMainCat(male, { difficulty: 'permadeath' }));
});
test('portrait id is not a gene: coat changes keep it, randomize keeps it, a bad id becomes null', () => {
  const id = 'cat-6e2d788dd48ff440';
  let s = base({ portraitId: id, coat: 'tan', focus: 'coat' });
  s = C.reduce(s, 'arrow', { id: 'coat', dir: 1 }).state;
  assert.strictEqual(s.portraitId, id);
  assert.notStrictEqual(s.coat, 'tan');
  s = C.reduce(s, 'click', 'randomize', { rng: seeded(9) }).state;
  assert.strictEqual(s.portraitId, id);
  const built = C.buildMainCat(s, { newId: () => 'cat_p' });
  assert.strictEqual(built.portraitId, id);
  assert.strictEqual(C.buildMainCat(base({ portraitId: 'Nope' }), { newId: () => 'cat_q' }).portraitId, null);
  const male = C.buildMainCat(base({ portraitId: id, sex: 'male' }), { newId: () => 'cat_m' });
  const female = C.buildMainCat(base({ portraitId: id, sex: 'female' }), { newId: () => 'cat_f' });
  assert.strictEqual(male.portraitId, female.portraitId);
});
test('option → allele mapping covers all 90 common looks (5 coats in every Style); none = plain; rare pairs', () => {
  let n = 0;
  for (const sex of C.SEXES) for (const coat of C.COATS) for (const markings of C.MARKINGS) for (const eyes of C.EYES) {
    const g = C.genesFor(base({ sex, coat, markings, eyes })); n++;
    assert.deepStrictEqual([g.loci.coat, g.loci.marking[0], g.loci.eyes[0]], [C.COAT_GENES[coat], C.MARKING_ALLELE[markings], C.EYE_ALLELE[eyes]]);
    assert.deepStrictEqual([g.loci.het, g.eyeRight, 'hetero' in g], [['Het', 'Het'], null, false]);
  }
  assert.strictEqual(n, 90);
  assert.deepStrictEqual(C.COATS, ['tan', 'gray', 'brown', 'black', 'sandy']);
  assert.deepStrictEqual(C.RARE_COATS, ['pale', 'ash']);
  assert.deepStrictEqual(C.COAT_GENES, { tan: ['tawny', 'tawny'], gray: ['greydun', 'greydun'], brown: ['russet', 'russet'], black: ['melan', 'melan'],
    sandy: ['sandy', 'sandy'], pale: ['leuc', 'leuc'], ash: ['melan', 'leuc'] });
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
  assert.deepStrictEqual(seq, ['sex', 'coat', 'markings', 'eyes', 'next', 'name']);   // no oddEyes row outside §3c
  assert.strictEqual(run(s, ['up']).state.focus, 'next');
  assert.deepStrictEqual(['left', 'left', 'left'].reduce((a, k) => { a.push(run({ ...s, focus: a.length ? a[a.length - 1] : 'next' }, [k]).state.focus); return a; }, []), ['back', 'randomize', 'next']);
  assert.strictEqual(run({ ...s, focus: 'sex', sex: 'male' }, ['right']).state.sex, 'female');
  assert.strictEqual(run({ ...s, focus: 'sex', sex: 'male' }, ['confirm']).state.sex, 'female');   // Enter/Space/A cycles too
  assert.strictEqual(run({ ...s, focus: 'coat', coat: 'tan' }, ['left']).state.coat, 'sandy');
  assert.strictEqual(run({ ...s, focus: 'coat', coat: 'black' }, ['right']).state.coat, 'sandy');
  const name = run({ ...s, focus: 'name', name: 'Typed' }, ['left', 'right']).state; assert.deepStrictEqual([name.name, name.focus], ['Typed', 'name']);
  const s2 = run({ ...s, focus: 'next' }, ['confirm']).state;
  assert.deepStrictEqual([s2.step, s2.focus], [2, 'preset']);
  const seq2 = []; st = s2; for (let i = 0; i < 7; i++) { st = run(st, ['down']).state; seq2.push(st.focus); }
  assert.deepStrictEqual(seq2, ['trait:aggression', 'trait:sociability', 'trait:boldness', 'trait:loyalty', 'trait:curiosity', 'start', 'preset']);
});
test('Name: gamepad A rerolls from names.json (same as the dice); keyboard Enter moves on; sex change keeps the look', () => {
  const nameData = require('../src/renderer/data/names/names.json');
  const s = base({ name: 'Mine', focus: 'name' });
  for (const sex of C.SEXES) {
    const e = env({ device: 'controller', nameData, rng: seeded(3) });
    const pad = run({ ...s, sex }, ['confirm'], e).state;
    assert.strictEqual(pad.name, C.reduce({ ...s, sex }, 'rerollName', undefined, env({ nameData, rng: seeded(3) })).state.name, 'A on Name = dice');
    assert.ok(C.namePool(nameData, sex).includes(pad.name) && pad.name !== 'Mine'); assert.strictEqual(pad.focus, 'name');
  }
  assert.strictEqual(run(s, ['confirm'], env({ device: 'controller', nameData: null })).state.name, 'Mine');   // no names.json → no change, like the dice
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
  assert.strictEqual(run(s, [['arrow', { id: 'coat', dir: -1 }]]).state.coat, 'sandy');
  const h = run(s, [['hover', 'eyes']]).state; assert.deepStrictEqual([h.focus, h.eyes], ['eyes', s.eyes]);
  assert.strictEqual(run(s, [['hover', 'start']]).state.focus, 'name');            // not on step 1
  assert.strictEqual(run(s, [['click', 'next']]).state.step, 2);
});

test('main validates mainCat: rejects heterozygous/out-of-range/off-step/bad name; snapshot vs record', () => {
  const ok = C.buildMainCat(base({ traits: { aggression: 0, sociability: 100, boldness: 50, loyalty: 50, curiosity: 50 } }), { newId: () => 'cat_v' });
  assert.throws(() => validateMainCat(ok, { difficulty: 'heir' }), /personality.aggression/);
  const v = validateMainCat(ok, { difficulty: 'sandbox', sandboxOptions: { freeCustomization: true } });
  assert.deepStrictEqual(Object.keys(v.snapshot), ['catId', 'name', 'sex', 'lifeStage', 'genes', 'scars', 'portraitId']);
  assert.deepStrictEqual([v.record.ageSeasons, v.record.birthSeason, 'lifeStage' in v.record], [12, { year: -2, season: 'spring' }, false]);
  const good = C.buildMainCat(base(), { newId: () => 'cat_v' });
  const bad = (f) => { const m = JSON.parse(JSON.stringify(good)); f(m); return m; };
  for (const m of [bad((m) => { m.genes.loci.coat = ['tawny', 'melan']; }), bad((m) => { m.genes.hetero = false; }), bad((m) => { delete m.genes.loci.het; }),
    bad((m) => { m.genes.eyeRight = 'gold'; }), bad((m) => { m.genes.loci.het = ['Het', 'het']; }), bad((m) => { m.genes.personality.loyalty = 52; }), bad((m) => { m.name = 'A'.repeat(17); }),
    bad((m) => { m.name = ''; }), bad((m) => { m.ageSeasons = 16; }), bad((m) => { m.birthSeason = { year: -3, season: 'spring' }; }), bad((m) => { m.genes.loci.saber = ['creamy', 'creamy']; }),
    bad((m) => { m.scars = ['scar_1']; }), bad((m) => { m.sex = 'x'; })]) assert.throws(() => validateMainCat(m, { difficulty: 'heir' }));
});

// ---- v0.3.1 §3c: Sandbox-only rare looks ----
const SBX = { difficulty: 'sandbox', sandboxOptions: { freeCustomization: true } };
const rareBase = (o = {}) => ({ ...C.init({ names, rng: seeded(3), ...SBX }), ...o });
const OTHER = [['standard', undefined], ['heir', undefined], ['permadeath', undefined], ['sandbox', { freeCustomization: false }], ['sandbox', undefined]];

test('§3c.1: rare looks shown only for Sandbox + Free Customization On; coat rows and oddEyes row', () => {
  assert.strictEqual(C.rareAllowed('sandbox', { freeCustomization: true }), true);
  for (const [d, o] of OTHER) {
    const s = C.init({ names, difficulty: d, sandboxOptions: o });
    assert.strictEqual(s.rare, false); assert.deepStrictEqual(C.ROWS(s), ['name', 'sex', 'coat', 'markings', 'eyes']);
    assert.deepStrictEqual(C.optionsFor(s, 'coat'), C.COATS);
    let st = { ...s, focus: 'coat', coat: 'tan' }; const seen = new Set();
    for (let i = 0; i < 12; i++) { st = run(st, ['right']).state; seen.add(st.coat); }
    assert.deepStrictEqual([...seen].sort(), [...C.COATS].sort());
  }
  const r = rareBase();
  assert.strictEqual(r.rare, true); assert.deepStrictEqual([r.oddEyes, r.eyeRight], ['off', null]);
  assert.ok(C.COATS.includes(r.coat), 'opens on a common look');
  assert.deepStrictEqual(C.ROWS(r), ['name', 'sex', 'coat', 'markings', 'eyes', 'oddEyes']);
  assert.deepStrictEqual(C.optionsFor(r, 'coat'), ['tan', 'gray', 'brown', 'black', 'sandy', 'pale', 'ash']);
  assert.strictEqual(run({ ...r, focus: 'coat', coat: 'sandy' }, ['right']).state.coat, 'pale');
  assert.strictEqual(run({ ...r, focus: 'coat', coat: 'tan' }, ['left']).state.coat, 'ash');
});
test('§3c: rare looks never survive outside Sandbox + Free Customization (restored/loaded model is coerced)', () => {
  for (const [d, o] of OTHER) {
    const s = { ...C.init({ names, difficulty: d, sandboxOptions: o }), coat: 'ash', oddEyes: 'on', eyeRight: 'green', eyes: 'amber', focus: 'oddEyes' };
    const c = C.coerceLook(s, seeded(1));
    assert.ok(C.COATS.includes(c.coat)); assert.deepStrictEqual([c.oddEyes, c.eyeRight], ['off', null]); assert.ok(C.ROWS(c).includes(c.focus) || c.focus === 'name');
    const r = run(s, ['down']).state;
    assert.ok(C.COATS.includes(r.coat)); assert.strictEqual(r.oddEyes, 'off');
    const m = run({ ...s, step: 2, focus: 'start' }, ['confirm']).effect.mainCat;
    assert.ok(C.COATS.some((k) => JSON.stringify(C.COAT_GENES[k]) === JSON.stringify(m.genes.loci.coat)));
    assert.deepStrictEqual([m.genes.loci.het, m.genes.eyeRight], [['Het', 'Het'], null]);
    assert.doesNotThrow(() => validateMainCat(m, { difficulty: d, sandboxOptions: o }));
  }
});
test('§3c.3 odd eyes: rows split Left/Right, they always differ, genes het/het + eyeRight; Off → Het/Het, null', () => {
  let s = rareBase({ eyes: 'gold', focus: 'oddEyes' });
  s = run(s, ['right']).state;
  assert.deepStrictEqual([s.oddEyes, s.eyes, s.eyeRight, s.focus], ['on', 'gold', 'green', 'oddEyes']);
  assert.deepStrictEqual(C.ROWS(s), ['name', 'sex', 'coat', 'markings', 'eyeLeft', 'eyeRight', 'oddEyes']);
  assert.deepStrictEqual(C.optionsFor(s, 'eyeRight'), ['amber', 'green']);
  for (const [row, n] of [['eyeLeft', 9], ['eyeRight', 9]]) {
    let st = { ...s, focus: row };
    for (let i = 0; i < n; i++) { st = run(st, [i % 3 ? 'right' : 'left']).state; assert.notStrictEqual(st.eyes, st.eyeRight, JSON.stringify(st)); assert.ok(C.EYES.includes(st.eyeRight)); }
  }
  // Left landing on Right pushes Right on; Right skips the Left value
  assert.deepStrictEqual((({ eyes, eyeRight }) => [eyes, eyeRight])(run({ ...s, focus: 'eyeLeft', eyes: 'gold', eyeRight: 'green' }, ['right']).state), ['green', 'amber']);
  assert.strictEqual(run({ ...s, focus: 'eyeRight', eyes: 'gold', eyeRight: 'amber' }, ['right']).state.eyeRight, 'green');
  assert.strictEqual(run({ ...s, focus: 'eyeRight', eyes: 'gold', eyeRight: 'green' }, ['right']).state.eyeRight, 'amber');
  const g = C.genesFor({ ...s, eyes: 'amber', eyeRight: 'green' });
  assert.deepStrictEqual([g.loci.eyes, g.loci.het, g.eyeRight], [['amber', 'amber'], ['het', 'het'], 'green']);
  const off = run(s, ['right']).state;
  assert.deepStrictEqual([off.oddEyes, off.eyeRight], ['off', null]);
  assert.deepStrictEqual([C.genesFor(off).loci.het, C.genesFor(off).eyeRight], [['Het', 'Het'], null]);
  // focus on a split eye row falls back to Eyes when odd eyes go off (mouse click on Odd Eyes, etc.)
  assert.strictEqual(C.coerceLook({ ...off, focus: 'eyeRight' }).focus, 'eyes');
  // down from markings walks Left Eye, Right Eye, Odd Eyes, buttons
  const seq = []; let st = { ...s, focus: 'markings' }; for (let i = 0; i < 4; i++) { st = run(st, ['down']).state; seq.push(st.focus); }
  assert.deepStrictEqual(seq, ['eyeLeft', 'eyeRight', 'oddEyes', 'next']);
});
test('§3c.4 Randomize: Sandbox+FC ≈10% exactly one rare look, split evenly over pale/ash/odd eyes; other Styles never (injected rng)', () => {
  const N = 30000; const rng = seeded(2024); let s = rareBase({ name: 'Keep', sex: 'male' }); const tally = { pale: 0, ash: 0, oddEyes: 0 }; let rare = 0;
  for (let i = 0; i < N; i++) {
    const r = C.randomizeLook(s, rng);
    const kinds = [C.RARE_COATS.includes(r.coat) ? r.coat : null, r.oddEyes === 'on' ? 'oddEyes' : null].filter(Boolean);
    assert.ok(kinds.length <= 1, 'never two rare looks at once');
    if (kinds.length) { rare++; tally[kinds[0]]++; }
    if (r.oddEyes === 'on') assert.ok(C.EYES.includes(r.eyeRight) && r.eyeRight !== r.eyes); else assert.strictEqual(r.eyeRight, null);
    assert.deepStrictEqual([r.name, r.sex], ['Keep', 'male']);
    assert.ok(!(r.coat === s.coat && r.markings === s.markings && r.eyes === s.eyes && r.oddEyes === s.oddEyes && r.eyeRight === s.eyeRight));
    s = r;
  }
  const p = rare / N; assert.ok(Math.abs(p - 0.10) < 0.01, `rare rate ${p}`);
  for (const k of C.RARE_LOOKS) assert.ok(Math.abs(tally[k] / rare - 1 / 3) < 0.03, `${k} ${tally[k]}/${rare}`);
  // exact: a scripted rng picks the rare branch below 0.10 and the kind by thirds
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  assert.strictEqual(C.rollLook(true, seq(0, 0, 0, 0.099, 0.0)).coat, 'pale');
  assert.strictEqual(C.rollLook(true, seq(0, 0, 0, 0.099, 0.5)).coat, 'ash');
  const odd = C.rollLook(true, seq(0, 0, 0, 0.05, 0.9, 0.6)); assert.deepStrictEqual([odd.oddEyes, odd.eyes, odd.eyeRight], ['on', 'amber', 'green']);
  assert.deepStrictEqual(C.rollLook(true, seq(0, 0, 0, 0.1)), { coat: 'tan', markings: 'none', eyes: 'amber', oddEyes: 'off', eyeRight: null });
  for (const [d, o] of OTHER) {
    let t = C.init({ names, difficulty: d, sandboxOptions: o, rng: seeded(4) }); const r2 = seeded(5);
    for (let i = 0; i < 3000; i++) { t = C.randomizeLook(t, r2); assert.ok(C.COATS.includes(t.coat) && t.oddEyes === 'off' && t.eyeRight === null, d); }
  }
});
test('§3c validation on Start: rare looks only with Sandbox + FC; odd eyes need het/het and differing eyes', () => {
  const ash = C.buildMainCat(rareBase({ coat: 'ash', eyes: 'gold', oddEyes: 'on', eyeRight: 'green' }), { newId: () => 'cat_r' });
  assert.deepStrictEqual([ash.genes.loci.coat, ash.genes.loci.het, ash.genes.eyeRight], [['melan', 'leuc'], ['het', 'het'], 'green']);
  assert.doesNotThrow(() => validateMainCat(ash, SBX));
  const pale = C.buildMainCat(rareBase({ coat: 'pale' }), { newId: () => 'cat_p' });
  assert.deepStrictEqual(pale.genes.loci.coat, ['leuc', 'leuc']); assert.doesNotThrow(() => validateMainCat(pale, SBX));
  const black = C.buildMainCat(base({ coat: 'black' }), { newId: () => 'cat_b' });
  for (const [d, o] of OTHER) {
    assert.throws(() => validateMainCat(pale, { difficulty: d, sandboxOptions: o }), /coat/);
    const oddOnly = JSON.parse(JSON.stringify(ash)); oddOnly.genes.loci.coat = ['tawny', 'tawny'];
    assert.throws(() => validateMainCat(oddOnly, { difficulty: d, sandboxOptions: o }), /het/);
    assert.doesNotThrow(() => validateMainCat(black, { difficulty: d, sandboxOptions: o }), 'black is allowed in every Style');
  }
  const bad = (f) => { const m = JSON.parse(JSON.stringify(ash)); f(m); return m; };
  for (const [m, re] of [[bad((m) => { m.genes.eyeRight = 'gold'; }), /differ/], [bad((m) => { m.genes.eyeRight = null; }), /eyeRight/],
    [bad((m) => { m.genes.eyeRight = 'blue'; }), /eyeRight/], [bad((m) => { m.genes.loci.het = ['Het', 'het']; }), /het/],
    [bad((m) => { m.genes.loci.coat = ['leuc', 'melan']; }), /coat/], [bad((m) => { m.genes.loci.coat = ['melan', 'tawny']; }), /coat/]]) assert.throws(() => validateMainCat(m, SBX), re);
});

// ---- Anna bug 6: name dice ----
const nameData = require('../src/renderer/data/names/names.json');
test('name dice: rerolls only the name, from names.json (sex list + either, never reserved/blocklist)', () => {
  const lower = (a) => new Set(a.map((x) => x.toLowerCase()));
  const banned = lower([...nameData.reserved, ...nameData.blocklist]);
  for (const sex of C.SEXES) {
    const pool = new Set([...(sex === 'female' ? nameData.female : nameData.male), ...nameData.either]);
    let s = { ...base({ sex, name: 'Mine', coat: 'black', markings: 'spotted', eyes: 'green', focus: 'name' }), traits: { aggression: 25, sociability: 30, boldness: 35, loyalty: 40, curiosity: 45 }, preset: 'custom' };
    const e = env({ nameData, rng: seeded(sex === 'male' ? 1 : 2) });
    for (let i = 0; i < 200; i++) {
      const r = C.reduce(s, 'rerollName', undefined, e).state;
      assert.ok(pool.has(r.name), r.name); assert.ok(!banned.has(r.name.toLowerCase()), r.name); assert.notStrictEqual(r.name, s.name);
      assert.ok(r.name.length <= C.NAME_MAX && C.sanitizeName(r.name).error === null);
      const { name: _a, nameError: _b, ...rest } = r; const { name: _c, nameError: _d, ...before } = s;
      assert.deepStrictEqual(rest, before, 'nothing but the name changes');
      s = r;
    }
  }
  const step2 = { ...base({ name: 'Keep' }), step: 2, focus: 'trait:loyalty' };
  const r2 = C.reduce(step2, 'rerollName', undefined, env({ nameData })).state;
  assert.deepStrictEqual([r2.step, r2.focus], [2, 'trait:loyalty']);
  assert.strictEqual(C.reduce(base({ name: 'Keep' }), 'rerollName', undefined, env({ nameData: null })).state.name, 'Keep');   // no data → no change
});
