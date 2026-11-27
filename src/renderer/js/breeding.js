/**
 * Breeding, cubs, and overcrowding. Rules live in docs/design/breeding-cubs-v0.1.md.
 * The portrait compositor is not used here.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Breeding = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const RULES = {
    yearLengthDays: 80, daysPerSeason: 20,
    stageStart: { cub: 0, adolescent: 4, adult: 8, elder: 40 },
    fertileUntil: { female: 44, male: 48 },
    pregnancyDays: 20,
    litterWeights: [8, 18, 26, 22, 14, 8, 4],
    capacityPerRegion: 4,
    contentmentStep: 5,
    contentmentMax: 20,
    crossPrideChance: 0.5,
    personalitySd: 8,
    aptitudeSd: 5
  };
  const TRAITS = ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity'];
  const BRANCHES = ['hunting', 'tracking', 'fighting', 'survival', 'social'];
  const NEED_ORDER = [
    ['health', 'worn'],
    ['thirst', 'thirsty'],
    ['hunger', 'hungry'],
    ['energy', 'tired'],
    ['warmth', 'cold']
  ];
  const MARKINGS = [
    { id: 'plain', layer: null, fallback: null, label: 'Plain' },
    { id: 'barred', layer: 'tiger', fallback: 'tiger', label: 'Tiger' },
    { id: 'faintstripe', layer: 'tiger', fallback: 'tiger', label: 'Tiger' },
    { id: 'spotted', layer: 'spotted', fallback: 'tiger', label: 'Spotted', fallbackLabel: 'Tiger' },
    { id: 'rosette', layer: 'rosette', fallback: 'tiger', label: 'Rosette', fallbackLabel: 'Tiger' }
  ];
  let linesCache = null;

  function lines() {
    if (linesCache) return linesCache;
    if (typeof require === 'function') {
      try { linesCache = require('../data/events/breeding-lines-v0.1b.json'); return linesCache; } catch (e) { /* browser */ }
    }
    linesCache = { moments: {}, litterWordBySize: {} };
    return linesCache;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function roundHalfUp(n) { return Math.floor(n + 0.5); }
  function gaussian(rng) {
    let u = 0; let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function lifeStage(ageSeasons) {
    const age = Number(ageSeasons) || 0;
    const start = RULES.stageStart;
    if (age >= start.elder) return 'elder';
    if (age >= start.adult) return 'adult';
    if (age >= start.adolescent) return 'adolescent';
    return 'cub';
  }
  function seasonStart(absDay) {
    const day = Math.max(1, Number(absDay) || 1);
    return day - ((day - 1) % RULES.daysPerSeason);
  }
  function yearDay(absDay) {
    const day = Math.max(1, Number(absDay) || 1);
    return ((day - 1) % RULES.yearLengthDays) + 1;
  }
  function seasonName(absDay) {
    const names = ['spring', 'summer', 'autumn', 'winter'];
    return names[Math.floor((yearDay(absDay) - 1) / RULES.daysPerSeason)];
  }
  function inSpring(absDay) {
    const d = yearDay(absDay);
    return d >= 1 && d <= RULES.daysPerSeason;
  }
  function fertile(cat) {
    const age = Number(cat && cat.ageSeasons);
    if (!Number.isFinite(age)) return false;
    const sex = String(cat.sex || '').toLowerCase();
    const female = sex === 'female' || sex === 'f';
    if (lifeStage(age) !== 'adult' && lifeStage(age) !== 'elder') return false;
    return age <= (female ? RULES.fertileUntil.female : RULES.fertileUntil.male);
  }
  function litterSize(rng) {
    const weights = RULES.litterWeights;
    const total = weights.reduce((sum, n) => sum + n, 0);
    let roll = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return i + 1;
    }
    return weights.length;
  }
  function litterWord(size) {
    const table = lines().litterWordBySize || {};
    return table[String(size)] || table[size] || 'a cub';
  }
  function dueAbsDay(conceivedAbsDay) {
    return (Number(conceivedAbsDay) || 1) + RULES.pregnancyDays;
  }
  function capacity(regionsHeld) {
    return RULES.capacityPerRegion * Math.max(0, Number(regionsHeld) || 0);
  }
  function contentmentPenalty(seasonsOver) {
    const over = Math.max(0, Number(seasonsOver) || 0);
    if (!over) return 0;
    return -Math.min(RULES.contentmentStep * over, RULES.contentmentMax);
  }
  function bumpOvercrowding(record, members, regionsHeld) {
    const row = record || { seasonsOver: 0, lastCheck: null };
    const over = members > capacity(regionsHeld);
    const seasonsOver = over ? row.seasonsOver + 1 : 0;
    return {
      seasonsOver,
      lastCheck: row.lastCheck,
      penalty: contentmentPenalty(seasonsOver),
      over
    };
  }
  function playerMayConceive(members, regionsHeld) {
    return members <= capacity(regionsHeld);
  }
  function aiLitterFits(members, alreadyConceived, litter, regionsHeld) {
    return members + alreadyConceived + litter <= capacity(regionsHeld);
  }
  function needsWord(needs) {
    const bag = needs || {};
    for (const [key, word] of NEED_ORDER) {
      const value = bag[key];
      if (value === 'critical' || value === 'empty') return word;
      if (typeof value === 'number' && value <= 0) return word;
    }
    return 'well enough';
  }
  function markingEntry(id) {
    return MARKINGS.find((row) => row.id === id) || null;
  }
  function markingDrawn(id, artHas) {
    const entry = markingEntry(id);
    if (!entry) return { layer: null, label: 'Plain' };
    const has = typeof artHas === 'function' ? artHas : () => false;
    if (!entry.layer) return { layer: null, label: entry.label };
    if (has(entry.layer)) return { layer: entry.layer, label: entry.label };
    return { layer: entry.fallback, label: entry.fallbackLabel || entry.label };
  }
  function inheritPersonality(a, b, rng) {
    const out = {};
    for (const trait of TRAITS) {
      const mean = ((Number(a && a[trait]) || 0) + (Number(b && b[trait]) || 0)) / 2;
      out[trait] = clamp(roundHalfUp(mean + gaussian(rng) * RULES.personalitySd), 0, 100);
    }
    return out;
  }
  function inheritAptitude(a, b, rng) {
    const out = {};
    for (const branch of BRANCHES) {
      const mean = ((Number(a && a[branch]) || 100) + (Number(b && b[branch]) || 100)) / 2;
      out[branch] = clamp(roundHalfUp(mean + gaussian(rng) * RULES.aptitudeSd), 80, 120);
    }
    return out;
  }
  function hashSeed(text) {
    let n = 2166136261;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
    return n >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rollAptitude(catId, kind) {
    const rng = mulberry32(hashSeed(String(catId) + '/' + kind));
    const sd = kind === 'player' ? 5 : 8;
    const out = {};
    for (const branch of BRANCHES) out[branch] = clamp(roundHalfUp(100 + gaussian(rng) * sd), 80, 120);
    return out;
  }
  function emptyTaught() {
    const out = {};
    for (const branch of BRANCHES) out[branch] = 0;
    return out;
  }
  function migrateCat(cat, absDay, kind) {
    if (!cat || typeof cat !== 'object') return cat;
    const age = Number.isInteger(cat.ageSeasons) ? cat.ageSeasons : (kind === 'player' ? 12 : 0);
    cat.ageSeasons = age;
    if (kind === 'player' && !cat.lifeStage) cat.lifeStage = lifeStage(age);
    if (cat.birthAbsDay == null) cat.birthAbsDay = seasonStart(absDay) - age * RULES.daysPerSeason;
    cat.genes = cat.genes && typeof cat.genes === 'object' ? cat.genes : { loci: {} };
    cat.genes.v = 2;
    if (!cat.aptitude) {
      cat.aptitude = kind === 'premade'
        ? Object.fromEntries(BRANCHES.map((branch) => [branch, 100]))
        : rollAptitude(cat.catId || cat.id, kind === 'player' ? 'player' : 'other');
    }
    if (!cat.aptitudeTaught) cat.aptitudeTaught = emptyTaught();
    if (!cat.inheritOnly || typeof cat.inheritOnly !== 'object') cat.inheritOnly = {};
    if (typeof cat.frail !== 'boolean') cat.frail = false;
    if (cat.litterId === undefined) cat.litterId = null;
    if (cat.pregnancy === undefined) cat.pregnancy = null;
    if (cat.generation == null) cat.generation = 1;
    if (!Array.isArray(cat.history)) cat.history = [];
    return cat;
  }
  function ensure(state) {
    if (!state || typeof state !== 'object') return state;
    if (!state.records) state.records = {};
    if (!state.records.overcrowding) state.records.overcrowding = { seasonsOver: 0, lastCheck: null };
    if (state.cat && state.cat.ageSeasons == null) state.cat.ageSeasons = 12;
    if (state.cat && !state.cat.lifeStage) state.cat.lifeStage = 'adult';
    return state;
  }
  function migrateSave(state) {
    ensure(state);
    const abs = state.absDay || state.day || 1;
    if (state.cat) migrateCat(state.cat, abs, 'player');
    for (const npc of Object.values(state.npcs || {})) migrateCat(npc, abs, 'premade');
    if (!state.records.pregnancies) state.records.pregnancies = [];
    if (!state.records.litters) state.records.litters = [];
    return state;
  }
  function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (token, key) => (
      vars && vars[key] != null && vars[key] !== '' ? String(vars[key]) : token
    ));
  }
  function pickNarration(node, index) {
    if (Array.isArray(node)) return node[index % node.length];
    return node;
  }
  function momentLines(momentId, path, vars, index) {
    const book = lines();
    let node = (book.moments && book.moments[momentId]) || book[momentId];
    if (!node) return [];
    if (momentId === 'litter_born' && vars && vars.litterWord === 'a cub' && node.size1) node = node.size1;
    for (const key of path || []) node = node && node[key];
    if (!node) return [];
    if (typeof node === 'string') return [fill(node, vars)];
    const narration = pickNarration(node.narration || node, index || 0);
    const texts = [];
    if (typeof narration === 'string') texts.push(fill(narration, vars));
    if (node && typeof node.outcome === 'string') texts.push(fill(node.outcome, vars));
    if (node && typeof node.mateSay === 'string') texts.push(fill(node.mateSay, vars));
    return texts;
  }
  function openToken(text) {
    return /(?:^|[.!?]\s+)\{[A-Za-z]/.test(String(text || ''));
  }
  function rawToken(text) {
    return /\{[A-Za-z][^}]*\}/.test(String(text || ''));
  }

  return {
    RULES, TRAITS, BRANCHES, MARKINGS, NEED_ORDER,
    lifeStage, seasonStart, yearDay, seasonName, inSpring, fertile,
    litterSize, litterWord, dueAbsDay, capacity, contentmentPenalty, bumpOvercrowding,
    playerMayConceive, aiLitterFits, needsWord, markingEntry, markingDrawn,
    inheritPersonality, inheritAptitude, rollAptitude, migrateCat, ensure, migrateSave,
    fill, momentLines, openToken, rawToken, lines, gaussian, roundHalfUp
  };
});
