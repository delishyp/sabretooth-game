/**
 * Make Your Sabrecat: pure model (no DOM) for cat-creator-spec v0.2 (+ v0.1.1 §5.2) and lifecycle-spec §1.3/§2.6.
 * UMD: window.Creator / require(). Unit-tested in test/creator.test.js.
 *
 * Model: { step: 1|2, focus, name, sex, coat, markings, eyes, traits{5}, preset, range:{min,max}, nameError }
 *   Step 1 (Look) focus ids:        name, sex, coat, markings, eyes, then the button row randomize · back · next
 *   Step 2 (Personality) focus ids: preset, trait:<id> ×5, then the button row randomize · back · start
 *   Up/Down move between rows and the button row (wrap; entering the button row lands on Next/Start).
 *   Left/Right cycle an option row / move a slider ±5 / move along the button row. Enter/Space/A also cycles an option row.
 *   Name: typed by the keyboard (DOM); A (controller confirm) rerolls a default name; keyboard Enter on Name moves to Sex.
 *   Back: step 2 → step 1 (keeps everything); step 1 → effect 'leave' (New Game setup, no confirmation).
 *   Gamepad Start: Next on step 1, Start on step 2.
 * reduce(state, action, arg, env) → { state, effect }, effect ∈ null | {type:'leave'} | {type:'start', mainCat}.
 * env = { rng?: () => [0,1), names: string[], newId?: () => string, device?: 'keyboard'|'controller'|'mouse' }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Creator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---- lifecycle-spec §1.3, §2, §7 ----
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  /** Every run starts on day 1 of spring, Year 1 (lifecycle-spec §1.3, Tundra). The single run-start constant. */
  const RUN_START = Object.freeze({ year: 1, season: 'spring', day: 1 });
  const PLAYER_START_AGE = 12;                              // seasons; exactly 3 years (cat-creator-spec §5.2, lifecycle §2.6)
  const STAGE_START = Object.freeze({ cub: 0, adolescent: 4, adult: 12, elder: 40 });
  function lifeStageFor(ageSeasons) {
    if (ageSeasons >= STAGE_START.elder) return 'elder';
    if (ageSeasons >= STAGE_START.adult) return 'adult';
    if (ageSeasons >= STAGE_START.adolescent) return 'adolescent';
    return 'cub';
  }
  /** {year, season} that lies `ageSeasons` seasons before `date` (4 seasons a year). */
  function birthSeasonFor(ageSeasons, date = RUN_START) {
    const idx = date.year * 4 + SEASONS.indexOf(date.season) - ageSeasons;
    return { year: Math.floor(idx / 4), season: SEASONS[((idx % 4) + 4) % 4] };
  }

  // ---- cat-creator-spec §3 (option id → genetics allele) ----
  const SEXES = ['male', 'female'];
  const COATS = ['tan', 'gray', 'brown', 'black'];
  const COAT_ALLELE = Object.freeze({ tan: 'tawny', gray: 'greydun', brown: 'russet', black: 'melan' });
  const MARKINGS = ['none', 'spotted', 'faintstripe'];
  const MARKING_ALLELE = Object.freeze({ none: 'plain', spotted: 'spotted', faintstripe: 'faintstripe' });
  const EYES = ['amber', 'gold', 'green'];
  const EYE_ALLELE = Object.freeze({ amber: 'amber', gold: 'gold', green: 'green' });
  const OPTIONS = { sex: SEXES, coat: COATS, markings: MARKINGS, eyes: EYES };

  // ---- §3b personality ----
  const TRAITS = ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity'];
  const TRAIT_STEP = 5, TRAIT_DEFAULT = 50;
  const RANGE_NORMAL = Object.freeze({ min: 20, max: 80 });
  const RANGE_FULL = Object.freeze({ min: 0, max: 100 });
  const PRESETS = Object.freeze({
    balanced: { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 },
    fighter: { aggression: 75, sociability: 40, boldness: 70, loyalty: 50, curiosity: 40 },
    peacemaker: { aggression: 30, sociability: 75, boldness: 45, loyalty: 60, curiosity: 50 },
    wanderer: { aggression: 45, sociability: 35, boldness: 60, loyalty: 30, curiosity: 80 },
    guardian: { aggression: 55, sociability: 55, boldness: 50, loyalty: 80, curiosity: 35 }
  });
  const PRESET_IDS = Object.keys(PRESETS);
  const DEFAULT_PRESET = 'balanced';
  /** §3b.2: 0–100 only for Sandbox with Free Customization On; otherwise 20–80. */
  function rangeFor(difficulty, sandboxOptions) {
    return difficulty === 'sandbox' && sandboxOptions && sandboxOptions.freeCustomization === true ? { ...RANGE_FULL } : { ...RANGE_NORMAL };
  }
  const clampStep = (v, r) => Math.min(r.max, Math.max(r.min, Math.round(v / TRAIT_STEP) * TRAIT_STEP));

  // ---- §3.1 name ----
  const NAME_MAX = 16;
  const NAME_CHAR = /[\p{L}\p{M} '\-]/u;
  /** Live input filter: drops disallowed characters and anything past 16; reports why (copy ids). */
  function sanitizeName(raw) {
    const s = String(raw == null ? '' : raw);
    const kept = [...s].filter((c) => NAME_CHAR.test(c));
    let error = kept.length !== [...s].length ? 'creator.name.error.invalidChars' : null;
    if (kept.length > NAME_MAX) error = 'creator.name.error.tooLong';
    return { value: kept.slice(0, NAME_MAX).join(''), error };
  }
  /** Trimmed, double spaces collapsed (§3.1). */
  const normalizeName = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  function gauss(rng) { let u = 0; while (u === 0) u = rng(); const v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /** A default name from Saga's list, different from `avoid` when the list allows. */
  function randomName(names, rng, avoid) {
    if (!names || !names.length) return '';
    let n; let i = 0; do { n = pick(names, rng); } while (names.length > 1 && n === avoid && ++i < 50);
    return n;
  }

  /** Fresh model on opening the creator (§3 defaults: random name, sex 50/50, coat/markings/eyes uniform; traits 50, Balanced). */
  function init({ names, difficulty, sandboxOptions, rng = Math.random } = {}) {
    return {
      step: 1, focus: 'name', name: randomName(names, rng), sex: pick(SEXES, rng),
      coat: pick(COATS, rng), markings: pick(MARKINGS, rng), eyes: pick(EYES, rng),
      traits: { ...PRESETS[DEFAULT_PRESET] }, preset: DEFAULT_PRESET, range: rangeFor(difficulty, sandboxOptions), nameError: null
    };
  }

  /** §4.1: reroll Coat, Markings and Eyes (uniform); keeps Name, Sex and personality; never returns the same look. */
  function randomizeLook(s, rng = Math.random) {
    let look;
    do { look = { coat: pick(COATS, rng), markings: pick(MARKINGS, rng), eyes: pick(EYES, rng) }; }
    while (look.coat === s.coat && look.markings === s.markings && look.eyes === s.eyes);
    return { ...s, ...look };
  }
  /** §3b.5: reroll only the five traits from Normal(50, 15), nearest 5, clamped to the range; Preset shows custom. */
  function randomizeTraits(s, rng = Math.random) {
    const traits = Object.fromEntries(TRAITS.map((k) => [k, clampStep(50 + 15 * gauss(rng), s.range)]));
    return { ...s, traits, preset: 'custom' };
  }
  function applyPreset(s, id) { return { ...s, preset: id, traits: { ...PRESETS[id] } }; }
  /** Slider move by `dir` steps; any actual change shows the Preset row as custom (§3b.3). */
  function nudgeTrait(s, trait, dir) {
    const v = clampStep(s.traits[trait] + dir * TRAIT_STEP, s.range);
    if (v === s.traits[trait]) return s;
    return { ...s, traits: { ...s.traits, [trait]: v }, preset: 'custom' };
  }
  function setTrait(s, trait, value) {
    const v = clampStep(value, s.range);
    if (v === s.traits[trait]) return s;
    return { ...s, traits: { ...s.traits, [trait]: v }, preset: 'custom' };
  }
  function cycleOption(s, row, dir) {
    if (row === 'preset') {
      const i = PRESET_IDS.indexOf(s.preset);   // custom → right lands on the first preset, left on the last
      const j = i < 0 ? (dir > 0 ? 0 : PRESET_IDS.length - 1) : (i + dir + PRESET_IDS.length) % PRESET_IDS.length;
      return applyPreset(s, PRESET_IDS[j]);
    }
    const list = OPTIONS[row]; return { ...s, [row]: list[(list.indexOf(s[row]) + dir + list.length) % list.length] };
  }

  /** genes per cat-creator-spec §5.3 + genetics-spec §6: chosen loci homozygous, fixed defaults otherwise. */
  function genesFor(s) {
    const two = (a) => [a, a];
    return {
      v: 1,
      loci: {
        coat: two(COAT_ALLELE[s.coat]), dilute: ['D', 'D'], marking: two(MARKING_ALLELE[s.markings]), dorsal: ['ds', 'ds'],
        intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: two(EYE_ALLELE[s.eyes]), saber: ['ivory', 'ivory']
      },
      hetero: false, mutations: [],
      personality: Object.fromEntries(TRAITS.map((k) => [k, s.traits[k]]))
    };
  }
  const defaultId = () => 'cat_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  /** mainCat written on Start (§4.2, §5.2–5.4). Blank name → a random default name. */
  function buildMainCat(s, { names = [], rng = Math.random, newId = defaultId } = {}) {
    const name = normalizeName(s.name) || randomName(names, rng);
    return {
      catId: newId(), name, sex: s.sex,
      ageSeasons: PLAYER_START_AGE, birthSeason: birthSeasonFor(PLAYER_START_AGE, RUN_START), lifeStage: lifeStageFor(PLAYER_START_AGE),
      genes: genesFor(s), scars: []
    };
  }

  // ---- navigation ----
  const ROWS = { 1: ['name', 'sex', 'coat', 'markings', 'eyes'], 2: ['preset', ...TRAITS.map((k) => `trait:${k}`)] };
  const BUTTONS = { 1: ['randomize', 'back', 'next'], 2: ['randomize', 'back', 'start'] };
  const stops = (step) => [...ROWS[step].map((r) => [r]), BUTTONS[step]];
  const focusIds = (step) => [...ROWS[step], ...BUTTONS[step]];

  function reduce(s, action, arg, env = {}) {
    const rng = env.rng || Math.random;
    let st = s;
    const out = (effect = null) => ({ state: st, effect });
    const f = s.focus;
    const goStep = (step, focus) => { st = { ...st, step, focus }; return out(); };
    const confirmButton = (id) => {
      if (id === 'randomize') { st = s.step === 1 ? randomizeLook(s, rng) : randomizeTraits(s, rng); return out(); }
      if (id === 'back') return s.step === 2 ? goStep(1, 'next') : out({ type: 'leave' });
      if (id === 'next') return goStep(2, 'preset');
      if (id === 'start') return out({ type: 'start', mainCat: buildMainCat(s, { names: env.names, rng, newId: env.newId }) });
      return out();
    };

    if (action === 'hover') { if (focusIds(s.step).includes(arg)) st = { ...s, focus: arg }; return out(); }
    if (action === 'click') {                                   // a click on a row value or a button
      if (!focusIds(s.step).includes(arg)) return out();
      st = { ...s, focus: arg };
      if (arg === 'name') return out();
      if (BUTTONS[s.step].includes(arg)) return confirmButton(arg);
      if (arg.startsWith('trait:')) return out();
      st = cycleOption(st, arg, 1); return out();
    }
    if (action === 'arrow') {                                   // mouse on an option/slider arrow: arg = {id, dir}
      const { id, dir } = arg || {};
      if (!ROWS[s.step].includes(id) || id === 'name') return out();
      st = { ...s, focus: id };
      st = id.startsWith('trait:') ? nudgeTrait(st, id.slice(6), dir) : cycleOption(st, id, dir); return out();
    }
    if (action === 'setTrait') { const { trait, value } = arg || {}; if (!TRAITS.includes(trait) || s.step !== 2) return out(); st = { ...setTrait(s, trait, value), focus: `trait:${trait}` }; return out(); }
    if (action === 'nameInput') { const r = sanitizeName(arg); st = { ...s, name: r.value, nameError: r.error }; return out(); }

    if (action === 'back') return s.step === 2 ? goStep(1, 'next') : out({ type: 'leave' });
    if (action === 'start') return s.step === 1 ? goStep(2, 'preset') : confirmButton('start');

    const all = stops(s.step); let si = all.findIndex((x) => x.includes(f));
    if (si < 0) { st = { ...s, focus: ROWS[s.step][0] }; return out(); }
    if (action === 'up' || action === 'down') {
      si = (si + (action === 'up' ? -1 : 1) + all.length) % all.length;
      const stop = all[si]; st = { ...s, focus: stop.length > 1 ? stop[stop.length - 1] : stop[0] }; return out();
    }
    const btns = BUTTONS[s.step];
    if (action === 'left' || action === 'right') {
      const d = action === 'left' ? -1 : 1;
      if (btns.includes(f)) { st = { ...s, focus: btns[(btns.indexOf(f) + d + btns.length) % btns.length] }; return out(); }
      if (f === 'name') return out();                           // keyboard: text cursor (DOM); gamepad: nothing to cycle
      st = f.startsWith('trait:') ? nudgeTrait(s, f.slice(6), d) : cycleOption(s, f, d); return out();
    }
    if (action === 'confirm') {
      if (btns.includes(f)) return confirmButton(f);
      if (f === 'name') {
        if (env.device === 'controller') { st = { ...s, name: randomName(env.names, rng, s.name), nameError: null }; return out(); }
        st = { ...s, focus: 'sex' }; return out();              // keyboard Enter on Name: on to the next row
      }
      if (f.startsWith('trait:')) return out();
      st = cycleOption(s, f, 1); return out();
    }
    return out();
  }

  return {
    RUN_START, PLAYER_START_AGE, STAGE_START, SEASONS, lifeStageFor, birthSeasonFor,
    SEXES, COATS, MARKINGS, EYES, COAT_ALLELE, MARKING_ALLELE, EYE_ALLELE, OPTIONS,
    TRAITS, TRAIT_STEP, TRAIT_DEFAULT, RANGE_NORMAL, RANGE_FULL, PRESETS, PRESET_IDS, DEFAULT_PRESET, rangeFor,
    NAME_MAX, sanitizeName, normalizeName, randomName,
    init, randomizeLook, randomizeTraits, applyPreset, nudgeTrait, setTrait, genesFor, buildMainCat,
    ROWS, BUTTONS, focusIds, reduce
  };
});
