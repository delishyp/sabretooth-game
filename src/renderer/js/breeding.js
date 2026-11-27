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
    { id: 'tiger', layer: 'tiger', fallback: 'tiger', label: 'Tiger' },
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
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/breeding-lines-v0.1b.json', false);
        xhr.send(null);
        if (xhr.status === 200 || xhr.status === 0) {
          linesCache = JSON.parse(xhr.responseText);
          return linesCache;
        }
      } catch (e) { /* file page */ }
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
    const slot = cat.id || cat.catId || cat.slot;
    if ((slot === 'hc09' || slot === 'mw08') && (cat.ageSeasons === 8 || cat.birthAbsDay === seasonStart(absDay) - 8 * RULES.daysPerSeason)) {
      cat.ageSeasons = 7;
      cat.birthAbsDay = seasonStart(absDay) - 7 * RULES.daysPerSeason;
      if (cat.stage === 'adult') cat.stage = 'adolescent';
      if (cat.lifeStage === 'adult') cat.lifeStage = 'adolescent';
    }
    if (cat.birthAbsDay == null) cat.birthAbsDay = seasonStart(absDay) - cat.ageSeasons * RULES.daysPerSeason;
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
  function deathP(age, cubMult) {
    const years = Number(age) || 0;
    const mult = cubMult == null ? 1 : cubMult;
    if (years < 4) return 0.04 * mult;
    if (years < 40) return 0.005;
    return Math.min(0.40, 0.02 + 0.02 * Math.floor((years - 40) / 4));
  }
  function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }
  function yearOf(day) { return Math.floor((Math.max(1, day) - 1) / RULES.yearLengthDays); }
  function eventCard(id, title, texts) {
    return {
      eventId: id,
      title: title,
      beats: texts.filter(Boolean).map((text) => ({ kind: 'narration', text })),
      choices: [],
      breeding: true
    };
  }
  function offlineLines(momentId, path, vars) {
    const texts = momentLines(momentId, ['offlineFallback'].concat(path || []), vars, 0);
    if (texts.length) return texts;
    return momentLines(momentId, path || [], vars, 0);
  }
  function prideIdOf(state) {
    return state && state.records && state.records.pride && state.records.pride.id;
  }
  function heldCount(state) {
    const id = prideIdOf(state);
    const claims = state && state.map && state.map.claims;
    if (!id || !claims) return state && state.records && state.records.pride ? 1 : 0;
    let n = 0;
    for (const bag of Object.values(claims)) {
      let best = null;
      let score = -1;
      for (const [who, value] of Object.entries(bag || {})) {
        if (value > score) { score = value; best = who; }
      }
      if (best === id) n += 1;
    }
    return n || 1;
  }
  function livingMembers(state) {
    const id = prideIdOf(state);
    const cats = [];
    if (state.cat && !state.dead) cats.push(state.cat);
    for (const npc of Object.values(state.npcs || {})) {
      if (!npc || npc.dead) continue;
      if (id && (npc.faction === id || (state.records.members || []).some((row) => row.catId === npc.id))) cats.push(npc);
    }
    return cats;
  }
  function mateOf(state) {
    const id = state.records && state.records.matePair && state.records.matePair.mateId;
    return id && state.npcs ? state.npcs[id] : null;
  }
  function damOf(state) {
    const mate = mateOf(state);
    if (!state.cat || !mate) return null;
    if (state.cat.pregnancy) return state.cat;
    if (mate.pregnancy) return mate;
    const female = String(state.cat.sex || '').toLowerCase() === 'female' ? state.cat : mate;
    return female;
  }
  function bookOf(state) {
    if (!state.records.breeding) state.records.breeding = { shown: {}, agedDay: 0, year: -1 };
    return state.records.breeding;
  }
  function varsFor(state, extra) {
    const mate = mateOf(state);
    const dam = damOf(state);
    const sire = dam === state.cat ? mate : state.cat;
    return Object.assign({
      playerName: state.cat && state.cat.name,
      mateName: mate && mate.name,
      damName: dam && (dam.name || (dam === state.cat ? state.cat.name : mate && mate.name)),
      sireName: sire && (sire.name || state.cat.name),
      needsWord: needsWord(state.needs),
      litterWord: dam && dam.pregnancy && dam.pregnancy.litterWord
    }, extra || {});
  }
  function growCat(cat) {
    if (!cat || cat.dead) return;
    cat.ageSeasons = (Number(cat.ageSeasons) || 0) + 1;
    const stage = lifeStage(cat.ageSeasons);
    cat.lifeStage = stage;
    if (cat.stage && cat.stage !== 'elder') cat.stage = stage;
  }
  function conceivePair(state, rng) {
    if (!state.records || !state.records.pride || !state.records.matePair) return null;
    const mate = mateOf(state);
    if (!mate || mate.dead || state.dead) return null;
    const book = bookOf(state);
    const year = yearOf(state.day || 1);
    if (book.year === year) return null;
    if (!inSpring(state.day || 1)) return null;
    const bonded = state.records.matePair.bondedDay || 1;
    const start = year * RULES.yearLengthDays + 1;
    const dueDay = inSpring(bonded) && yearOf(bonded) === year ? bonded : start;
    if ((state.day || 1) < dueDay) return null;
    const dam = String(state.cat.sex || '').toLowerCase() === 'female' ? state.cat : mate;
    const sire = dam === state.cat ? mate : state.cat;
    if (dam.pregnancy) return null;
    if (!fertile(dam) || !fertile(sire)) return null;
    const members = livingMembers(state).length;
    const regions = heldCount(state);
    if (!playerMayConceive(members, regions)) {
      book.year = year;
      book.blocked = true;
      return null;
    }
    const size = litterSize(rng);
    dam.pregnancy = {
      conceivedAbsDay: state.day,
      dueAbsDay: dueAbsDay(state.day),
      sireId: sire.catId || sire.id,
      litterSize: size,
      litterWord: litterWord(size)
    };
    book.year = year;
    book.blocked = false;
    const role = dam === state.cat ? 'playerDam' : 'playerSire';
    return eventCard('breeding.pregnancy_known', 'Cubs are coming', offlineLines('pregnancy_known', [role], varsFor(state)));
  }
  function bearLitter(state, rng) {
    const dam = damOf(state);
    if (!dam || !dam.pregnancy) return null;
    if ((state.day || 1) < dam.pregnancy.dueAbsDay) return null;
    const book = bookOf(state);
    const key = 'born-' + dam.pregnancy.conceivedAbsDay;
    if (book.shown[key]) return null;
    const preg = dam.pregnancy;
    const sire = mateOf(state) && (dam === state.cat ? mateOf(state) : state.cat);
    const litterId = 'litter-' + preg.conceivedAbsDay;
    const cubs = [];
    const femaleNames = ['Pebble', 'Fern', 'Mist', 'Wren', 'Lark'];
    const maleNames = ['Flint', 'Reed', 'Ash', 'Bram', 'Tor'];
    for (let i = 0; i < preg.litterSize; i++) {
      const sex = rng() < 0.5 ? 'female' : 'male';
      const names = sex === 'female' ? femaleNames : maleNames;
      const id = litterId + '-' + i;
      const cub = {
        id, name: names[i % names.length], sex, stage: 'cub', lifeStage: 'cub', ageSeasons: 0,
        birthAbsDay: state.day, faction: prideIdOf(state), met: true, dead: false,
        litterId, parents: { damId: dam.catId || dam.id, sireId: preg.sireId },
        genes: { v: 2, loci: {}, personality: inheritPersonality(
          (dam.genes && dam.genes.personality) || {},
          (sire && sire.genes && sire.genes.personality) || {},
          rng
        ) },
        aptitude: rollAptitude(id, 'other'),
        aptitudeTaught: emptyTaught()
      };
      state.npcs[id] = cub;
      cubs.push(cub);
    }
    if (!Array.isArray(state.records.litters)) state.records.litters = [];
    state.records.litters.push({ id: litterId, day: state.day, size: preg.litterSize, cubIds: cubs.map((cub) => cub.id) });
    dam.pregnancy = null;
    book.shown[key] = true;
    const role = dam === state.cat ? 'playerDam' : 'playerSire';
    const path = preg.litterWord === 'a cub' ? [role] : [role];
    const moment = 'litter_born';
    const texts = offlineLines(moment, path, varsFor(state, { litterWord: preg.litterWord, cubName: cubs[0] && cubs[0].name }));
    return eventCard('breeding.litter_born', 'The cubs arrive', texts);
  }
  function seasonTick(state, rng) {
    const day = state.day || 1;
    if (day <= 1 || (day - 1) % RULES.daysPerSeason !== 0) return null;
    const book = bookOf(state);
    if (book.agedDay === day) return null;
    book.agedDay = day;
    growCat(state.cat);
    for (const npc of Object.values(state.npcs || {})) {
      if (npc && (npc.faction === prideIdOf(state) || npc.litterId)) growCat(npc);
    }
    const members = livingMembers(state).length;
    const regions = heldCount(state);
    const next = bumpOvercrowding(state.records.overcrowding, members, regions);
    next.lastCheck = day;
    const wasOver = state.records.overcrowding && state.records.overcrowding.seasonsOver > 0;
    state.records.overcrowding = next;
    if (next.over && !wasOver) return eventCard('breeding.overcrowded', 'The pride is pressed', offlineLines('overcrowded', [], varsFor(state)));
    if (!next.over && wasOver) return eventCard('breeding.eased', 'The press eases', offlineLines('overcrowding_eased', [], varsFor(state)));
    return null;
  }
  function tickAi(state, slots, rng) {
    const day = state.day || 1;
    if (day <= 1 || (day - 1) % RULES.daysPerSeason !== 0) return;
    const book = bookOf(state);
    if (book.aiDay === day) return;
    book.aiDay = day;
    if (!book.ai) book.ai = createAiWorld(slots || [], rng);
    stepAi(book.ai, ((day - 1) / RULES.daysPerSeason) % 4, rng);
  }
  function breedingActive(state) {
    return !!(state && state.records && (state.records.pride || state.records.matePair || (state.cat && state.cat.pregnancy)));
  }
  function onDay(state, opts) {
    if (!breedingActive(state)) return null;
    ensure(state);
    const rng = makeRng((state.seed || 1) + (state.day || 1) * 97);
    const optsSlots = opts && opts.slots;
    tickAi(state, optsSlots, rng);
    const season = seasonTick(state, rng);
    const born = bearLitter(state, rng);
    const conceived = conceivePair(state, rng);
    return born || conceived || season;
  }
  function litterLostEvent(state) {
    const dam = damOf(state);
    if (!dam || !dam.pregnancy) return null;
    const playerIsDam = dam === state.cat;
    if (playerIsDam && !state.dead) return null;
    if (!playerIsDam && !dam.dead) return null;
    const role = playerIsDam ? 'playerDam' : 'playerSire';
    dam.pregnancy = null;
    return eventCard('breeding.litter_lost', 'The litter is lost', offlineLines('litter_lost', [role], varsFor(state)));
  }
  function noHeirEvent(state) {
    return eventCard('breeding.player_no_heir', 'The pride\'s story ends', offlineLines('natural_death', ['player_no_heir'], varsFor(state)));
  }
  function retireEvent(state, heirName) {
    return eventCard('breeding.story_retire', 'You step back', offlineLines('story_retire', [], varsFor(state, { heirName: heirName || '' })));
  }
  function cubsOf(state) {
    return Object.values(state.npcs || {}).filter((npc) => npc && !npc.dead && npc.litterId);
  }
  function view(state) {
    const dam = state && damOf(state);
    const crowd = state && state.records && state.records.overcrowding;
    return {
      pregnant: !!(dam && dam.pregnancy),
      pregnancy: dam && dam.pregnancy,
      cubs: state ? cubsOf(state) : [],
      warning: !!(crowd && crowd.over),
      seasonsOver: crowd ? crowd.seasonsOver : 0,
      capacity: state ? capacity(heldCount(state)) : 0,
      members: state ? livingMembers(state).length : 0,
      lines: {
        pregnancy: dam && dam.pregnancy ? offlineLines('pregnancy_known', [dam === state.cat ? 'playerDam' : 'playerSire'], varsFor(state)) : [],
        warning: crowd && crowd.over ? offlineLines('overcrowded', [], varsFor(state)) : []
      }
    };
  }

  function createKin(rng) {
    const par = {};
    const kin = {};
    let nid = 0;
    function f(a, b) {
      if (a == null || b == null) return 0;
      if (a === b) {
        const row = par[a] || [null, null];
        return 0.5 * (1 + f(row[0], row[1]));
      }
      if (a < b) { const t = a; a = b; b = t; }
      const key = a + ':' + b;
      if (key in kin) return kin[key];
      const row = par[a] || [null, null];
      const value = row[0] == null && row[1] == null ? 0 : 0.5 * (f(row[0], b) + f(row[1], b));
      kin[key] = value;
      return value;
    }
    return {
      rng,
      add(sire, dam) { nid += 1; par[nid] = [sire, dam]; return nid; },
      related(a, b) { return 2 * f(a, b); }
    };
  }
  function simCat(world, sex, age, sire, dam, born, contentment) {
    const rng = world.rng;
    const closeP = born ? 0.3 : 0.15;
    let close = 0;
    let hostile = 0;
    for (let i = 0; i < 3; i++) if (rng() < closeP) close += 1;
    for (let i = 0; i < 3; i++) if (rng() < 0.1) hostile += 1;
    return {
      id: world.add(sire, dam), sex, age, mate: null, preg: 0, born: !!born,
      close, hostile, role: rng() < 0.5 ? 5 : 0, loy: born ? 4 : 0,
      c: contentment == null ? 60 : contentment, low: 0, alive: true, player: false, warned: 0
    };
  }
  function simFertile(cat) { return cat.age >= 8 && cat.age <= (cat.sex === 'F' ? 44 : 48); }
  function pairUp(world, cats) {
    const by = {};
    for (const cat of cats) by[cat.id] = cat;
    for (const cat of cats) if (cat.mate != null && !by[cat.mate]) cat.mate = null;
    const fem = shuffle(cats.filter((cat) => cat.sex === 'F' && cat.mate == null && simFertile(cat)), world.rng);
    const mal = shuffle(cats.filter((cat) => cat.sex === 'M' && cat.mate == null && simFertile(cat)), world.rng);
    for (const female of fem) {
      for (const male of mal) {
        if (male.mate == null && world.related(female.id, male.id) < 0.125) {
          female.mate = male.id;
          male.mate = female.id;
          break;
        }
      }
    }
  }
  function conceiveList(cats) {
    const by = {};
    for (const cat of cats) by[cat.id] = cat;
    const out = [];
    for (const cat of cats) {
      if (cat.sex === 'F' && cat.preg === 0 && by[cat.mate] && simFertile(cat) && simFertile(by[cat.mate])) out.push([cat, by[cat.mate]]);
    }
    return out;
  }
  function simPenalty(mode, k, cap, seasons) {
    if (seasons <= 0) return 0;
    if (mode === 'flat') return -k;
    return -Math.min(k * seasons, cap);
  }
  function loadSlots() {
    if (typeof require !== 'function') return [];
    try { return require('../data/world-slots.json').slots; } catch (e) { return []; }
  }
  const START_MATES = [['hc01', 'hc03'], ['hc02', 'hc06'], ['bf01', 'bf04'], ['mw02', 'mw04']];
  const START_REGIONS = { highcrag: 4, bonefield: 3, mistwood: 3 };
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  function createAiWorld(slots, rng) {
    const world = createKin(rng);
    world.rng = rng;
    const prides = { highcrag: [], bonefield: [], mistwood: [] };
    const pool = [];
    const sid = {};
    for (const sl of slots || []) {
      let age = sl.ageSeasons;
      if (sl.slot === 'hc09' || sl.slot === 'mw08') age = 7;
      const cat = simCat(world, String(sl.sex || 'f')[0].toUpperCase() === 'M' ? 'M' : 'F', age, null, null, true, 60);
      sid[sl.slot] = cat;
      if (sl.faction === 'loner') pool.push(cat);
      else if (prides[sl.faction]) prides[sl.faction].push(cat);
    }
    for (const pair of START_MATES) {
      if (sid[pair[0]] && sid[pair[1]]) {
        sid[pair[0]].mate = sid[pair[1]].id;
        sid[pair[1]].mate = sid[pair[0]].id;
      }
    }
    return { world, prides, pool, regs: Object.assign({}, START_REGIONS) };
  }
  function crossPair(box, px) {
    const { world, prides, pool } = box;
    const rng = world.rng;
    for (const pride of PRIDES) {
      const females = shuffle(prides[pride].filter((cat) => cat.sex === 'F' && cat.mate == null && simFertile(cat)), rng);
      for (const female of females) {
        if (rng() >= px) continue;
        const src = [];
        for (const other of PRIDES) if (other !== pride) for (const male of prides[other]) src.push([other, male]);
        for (const male of pool) src.push([null, male]);
        const open = src.filter((row) => row[1].sex === 'M' && row[1].mate == null && simFertile(row[1]) && world.related(female.id, row[1].id) < 0.125);
        if (!open.length) continue;
        const pick = open[Math.floor(rng() * open.length)];
        if (pick[0] == null) pool.splice(pool.indexOf(pick[1]), 1);
        else prides[pick[0]].splice(prides[pick[0]].indexOf(pick[1]), 1);
        prides[pride].push(pick[1]);
        pick[1].mate = female.id;
        female.mate = pick[1].id;
      }
    }
  }
  function stepAi(box, season, rng) {
    box.world.rng = rng;
    if (season === 0) {
      for (const pride of PRIDES) pairUp(box.world, box.prides[pride]);
      crossPair(box, RULES.crossPrideChance);
    }
    for (const pride of PRIDES) {
      let cats = box.prides[pride];
      const capn = RULES.capacityPerRegion * box.regs[pride];
      if (season === 0) {
        const pairs = shuffle(conceiveList(cats), rng);
        let room = capn - cats.length;
        for (const pair of pairs) {
          if (cats.length > 1500) break;
          const size = litterSize(rng);
          if (size <= room) { pair[0].preg = size; room -= size; }
        }
      }
      if (season === 1) {
        const born = [];
        for (const cat of cats) {
          if (!cat.preg) continue;
          for (let i = 0; i < cat.preg; i++) born.push(simCat(box.world, rng() < 0.5 ? 'M' : 'F', 0, cat.mate, cat.id, true, 60));
          cat.preg = 0;
        }
        cats = cats.concat(born);
      }
      cats = cats.filter((cat) => rng() >= deathP(cat.age));
      const alive = {};
      for (const cat of cats) alive[cat.id] = true;
      for (const cat of cats) if (cat.mate != null && !alive[cat.mate]) cat.mate = null;
      const elders = cats.filter((cat) => cat.age >= 4);
      if (elders.length && rng() < 0.05) {
        const gone = elders[Math.floor(rng() * elders.length)];
        cats = cats.filter((cat) => cat !== gone);
        gone.mate = null;
        box.pool.push(gone);
        for (const cat of cats) if (cat.mate === gone.id) cat.mate = null;
      }
      box.prides[pride] = cats;
    }
    box.pool = box.pool.filter((cat) => rng() >= deathP(cat.age));
    const stay = [];
    for (const cat of box.pool) {
      if (rng() < 0.08) {
        const back = PRIDES[Math.floor(rng() * PRIDES.length)];
        cat.mate = null;
        box.prides[back].push(cat);
      } else stay.push(cat);
    }
    box.pool = stay;
  }
  function runPlayer(cfg, seed) {
    const rng = makeRng(20261127 * 1000 + seed);
    const world = createKin(rng);
    world.rng = rng;
    let regions = cfg.regions;
    const cpr = cfg.cpr;
    const pen = cfg.pen;
    let seasonsOver = 0;
    const female = simCat(world, 'F', 12, null, null, false, 60);
    const male = simCat(world, 'M', 12, null, null, false, 60);
    female.player = true;
    female.mate = male.id;
    male.mate = female.id;
    female.loy = male.loy = 4;
    let cats = [female, male];
    const sizes = [];
    let firstWarn = null;
    for (let y = 0; y < 20; y++) {
      for (let s = 0; s < 4; s++) {
        const t = y * 4 + s;
        if (t > 0) for (const cat of cats) cat.age += 1;
        if (s === 0) {
          pairUp(world, cats);
          const left = cats.filter((cat) => cat.mate == null && simFertile(cat));
          const playerLeft = left.filter((cat) => cat.player);
          let pick = null;
          if (playerLeft.length && rng() < 0.5) pick = playerLeft[0];
          else {
            const rest = left.filter((cat) => !cat.player);
            if (rest.length && rng() < (cfg.p_out == null ? 0.5 : cfg.p_out)) pick = rest[Math.floor(rng() * rest.length)];
          }
          if (pick) {
            const outsider = simCat(world, pick.sex === 'F' ? 'M' : 'F', 12 + Math.floor(rng() * 9), null, null, false, 50);
            outsider.mate = pick.id;
            pick.mate = outsider.id;
            cats.push(outsider);
          }
          const pairs = shuffle(conceiveList(cats), rng);
          let room = cpr * regions - cats.length;
          for (const pair of pairs) {
            const size = litterSize(rng);
            if (cfg.pgate === 'proposed' && room < 0) continue;
            if (cfg.pgate === 'room' && size > room) continue;
            if (cfg.pgate === 'room') room -= size;
            pair[0].preg = size;
          }
        }
        if (s === 1) {
          const born = [];
          for (const cat of cats) {
            if (!cat.preg) continue;
            for (let i = 0; i < cat.preg; i++) born.push(simCat(world, rng() < 0.5 ? 'M' : 'F', 0, cat.mate, cat.id, true, 60));
            cat.preg = 0;
          }
          cats = cats.concat(born);
        }
        cats = cats.filter((cat) => rng() >= deathP(cat.age));
        const by = {};
        for (const cat of cats) by[cat.id] = cat;
        for (const cat of cats) if (cat.mate != null && !by[cat.mate]) cat.mate = null;
        if (!cats.some((cat) => cat.player)) {
          const next = cats.filter((cat) => cat.age >= 4).sort((a, b) => b.age - a.age)[0];
          if (next) next.player = true;
        }
        const player = cats.find((cat) => cat.player);
        const n = cats.length;
        const capn = cpr * regions;
        if (n > capn) seasonsOver += 1;
        else seasonsOver = 0;
        const penN = simPenalty(pen[0], pen[1], pen[2], seasonsOver);
        const warned = [];
        for (const cat of cats) {
          let inp = 10 + cat.loy + cat.role + Math.min(9, 3 * cat.close) - Math.min(12, 4 * cat.hostile);
          if (by[cat.mate]) inp += 10;
          if (cat.age >= 8) inp += penN;
          cat.c = Math.max(0, Math.min(100, cat.c + inp));
          if (cat.age < 8 || cat.player) continue;
          if (cat.c < 25) cat.low += 1;
          else { cat.low = 0; cat.warned = 0; }
          if (cat.low === 2) {
            warned.push(cat);
            if (firstWarn == null) firstWarn = t;
          }
        }
        const leavers = [];
        for (const cat of cats) {
          if (cat.age < 8 || cat.player || cat.low <= 2) continue;
          if (player && (cat.id === player.mate)) continue;
          let mult = (1 + 0.15 * cat.hostile) * (1 - 0.2 * cat.close);
          mult = Math.max(0.4, Math.min(1.6, mult));
          if (by[cat.mate] || (cat.born && cat.close > 0)) mult *= 0.7;
          if (rng() < 0.30 * mult) leavers.push(cat);
        }
        if (leavers.length) {
          const gone = {};
          for (const cat of leavers) gone[cat.id] = true;
          cats = cats.filter((cat) => !gone[cat.id]);
          for (const cat of cats) if (gone[cat.mate]) cat.mate = null;
        }
        if (cfg.expand && seasonsOver >= 2 && regions < 7 && cats.filter((cat) => cat.age >= 8).length >= regions + 1 && rng() < 0.5) {
          regions += 1;
          seasonsOver = 0;
        }
      }
      sizes.push(cats.length);
    }
    return { sizes, firstWarn };
  }
  function runWorld(seed) {
    const rng = makeRng(20261127 * 7919 + seed);
    const box = createAiWorld(loadSlots(), rng);
    const sizes = { highcrag: [], bonefield: [], mistwood: [] };
    const peak = { highcrag: 0, bonefield: 0, mistwood: 0 };
    for (let y = 0; y < 20; y++) {
      for (let s = 0; s < 4; s++) {
        if (y + s > 0) {
          for (const pride of PRIDES) for (const cat of box.prides[pride]) cat.age += 1;
          for (const cat of box.pool) cat.age += 1;
        }
        stepAi(box, s, rng);
        for (const pride of PRIDES) peak[pride] = Math.max(peak[pride], box.prides[pride].length);
      }
      for (const pride of PRIDES) sizes[pride].push(box.prides[pride].length);
    }
    return { sizes, peak };
  }
  function median(values) {
    const v = values.slice().sort((a, b) => a - b);
    return v[Math.min(v.length - 1, Math.floor(0.5 * v.length))];
  }
  function simulate(seeds) {
    const n = seeds || 200;
    const founding = [];
    const player = [];
    const warned = [];
    const ai = { highcrag: [], bonefield: [], mistwood: [] };
    const extinct = { bonefield: 0, mistwood: 0 };
    let maxHc = 0;
    for (let i = 0; i < n; i++) {
      founding.push(runPlayer({ regions: 99, cpr: 4, pen: ['flat', 0, 0], expand: false, p_out: 0, pgate: 'none' }, i).sizes[9]);
      const held = runPlayer({ regions: 2, cpr: 4, pen: ['esc', 5, 20], expand: false, p_out: 0.5, pgate: 'proposed' }, i);
      player.push(held.sizes[9]);
      if (held.firstWarn != null && held.firstWarn < 40) warned.push(1);
      const world = runWorld(i);
      for (const pride of PRIDES) ai[pride].push(world.sizes[pride][9]);
      maxHc = Math.max(maxHc, world.peak.highcrag);
      if (world.sizes.bonefield[19] === 0) extinct.bonefield += 1;
      if (world.sizes.mistwood[19] === 0) extinct.mistwood += 1;
    }
    const figures = {
      seeds: n,
      foundingY10: median(founding),
      playerY10: median(player),
      warnByY10: Math.round(100 * warned.length / n),
      aiY10: { highcrag: median(ai.highcrag), bonefield: median(ai.bonefield), mistwood: median(ai.mistwood) },
      aiMax: maxHc,
      extinctY20: {
        bonefield: Math.round(100 * extinct.bonefield / n),
        mistwood: Math.round(100 * extinct.mistwood / n)
      }
    };
    return figures;
  }

  return {
    RULES, TRAITS, BRANCHES, MARKINGS, NEED_ORDER,
    lifeStage, seasonStart, yearDay, seasonName, inSpring, fertile,
    litterSize, litterWord, dueAbsDay, capacity, contentmentPenalty, bumpOvercrowding,
    playerMayConceive, aiLitterFits, needsWord, markingEntry, markingDrawn,
    inheritPersonality, inheritAptitude, rollAptitude, migrateCat, ensure, migrateSave,
    fill, momentLines, openToken, rawToken, lines, gaussian, roundHalfUp,
    onDay, view, litterLostEvent, noHeirEvent, retireEvent, deathP, simulate, heldCount, livingMembers
  };
});
