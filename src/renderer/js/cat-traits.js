/**
 * Traits §3 and appearance §3b. Achievements and difficulty are not here.
 * Candidate numbers live in CANDIDATES. Fight-effect rows can be switched off.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CatTraits = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function load(file) {
    if (typeof require === 'function') {
      try { return require('../data/' + file); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/' + file, false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing */ }
    }
    return null;
  }
  const copy = load('traits-copy-v1.json') || { traits: {}, rumours: { trait: {}, general: {} }, appearance: { tags: {} } };
  const slots = load('bloodline-slots-v1.json') || { traits: {} };

  /** Listed candidate values. A null stays off. */
  const CANDIDATES = {
    huntBand: 1,
    litterStep: 1,
    elderSeason: 1,
    aggressionNudge: 15,
    inheritChance: 0.25,
    courtBand: 1,
    curiousFacts: 1,
    herbChance: null,
    strengthUp: 1.05,
    strengthDown: 0.95,
    strengthCapUp: 1.10,
    strengthCapDown: 0.95,
    pairShift: 10,
    greetLiked: 5
  };
  /** (f) effects. A sim that breaks a §4 band sets the id to false. */
  const FIGHT_EFFECTS = {
    giant: true, runt: true, thick_hide: true, thin_skinned: true,
    long_sabers: true, chipped_saber: true, fearless: true, cunning: true, battle_scarred: true
  };
  const INHERIT_ONLY = ['giant', 'long_sabers', 'frost_hardy', 'fertile', 'long_lived', 'tainted_blood'];
  const BLOOD = {
    bothShow: { show: 0.70, carry: 0.30 },
    showCarry: { show: 0.50, carry: 0.40 },
    oneShow: { show: 0.35, carry: 0.40 },
    bothCarry: { show: 0.25, carry: 0.50 },
    oneCarry: { show: 0.10, carry: 0.40 },
    neither: { show: 0.01, carry: 0 },
    founderCarry: 0.10
  };
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  const APPEARANCE_MAX = 280;
  const TAG_CAP = 4;
  const SIZE_TAGS = ['large', 'small', 'lean', 'heavy'];
  const COLOURS = {
    tan: ['tawny', 'tan coat', 'golden coat'],
    gray: ['greydun', 'grey dun', 'gray coat', 'grey coat'],
    brown: ['russet', 'brown coat'],
    black: ['black coat', 'melanistic'],
    sandy: ['sandy coat', 'sand coat'],
    pale: ['white coat', 'leucistic', 'pale coat'],
    ash: ['ash coat', 'ash fur']
  };

  function row(id, group, kind, points, opp, inheritable, fight, effect) {
    return { id, group, kind, points, opp, inheritable, inheritOnly: INHERIT_ONLY.includes(id), playOnly: kind === 'P', fight: !!fight, effect: effect || {} };
  }
  const ROWS = [
    row('iron_jaw', 'body', '+', 2, ['chipped_saber'], true, true, { strength: CANDIDATES.strengthUp }),
    row('broad_shoulders', 'body', '+', 2, ['runt'], true, true, { strength: CANDIDATES.strengthUp, tag: 'heavy' }),
    row('giant', 'body', '+', 2, ['runt'], true, true, { intimidate: 1, endurance: -1, tag: 'large' }),
    row('runt', 'body', '-', 1, ['giant', 'broad_shoulders'], true, true, { intimidate: -1, tag: 'small' }),
    row('swift', 'body', '+', 1, ['lame_paw'], true, false, { endurance: 1, tag: 'lean' }),
    row('lame_paw', 'body', '-', 2, ['swift'], false, false, { strength: CANDIDATES.strengthDown, endurance: -1, tag: 'limp' }),
    row('thick_hide', 'body', '+', 1, ['thin_skinned'], true, true, { guard: 1 }),
    row('thin_skinned', 'body', '-', 1, ['thick_hide'], true, true, { guard: -1 }),
    row('hardy', 'body', '+', 2, ['sickly'], true, false, { injury: -1 }),
    row('sickly', 'body', '-', 2, ['hardy'], true, false, { injury: 1, tag: 'lean' }),
    row('keen_nose', 'body', '+', 1, ['dull_nose'], true, false, { huntBand: -CANDIDATES.huntBand }),
    row('dull_nose', 'body', '-', 1, ['keen_nose'], true, false, { huntBand: CANDIDATES.huntBand }),
    row('sharp_eyes', 'body', '+', 1, ['one_eyed'], true, false, { vantage: 'neighbours' }),
    row('one_eyed', 'body', '-', 1, ['sharp_eyes'], false, false, { vantage: 'own', tag: 'clouded_eye' }),
    row('long_sabers', 'body', '+', 1, ['chipped_saber'], true, true, { intimidate: 1 }),
    row('chipped_saber', 'body', '-', 1, ['iron_jaw', 'long_sabers'], false, true, { intimidate: -1, tag: 'chipped_saber' }),
    row('frost_hardy', 'body', '+', 1, [], true, false, { winterImmune: true, tag: 'heavy' }),
    row('big_eater', 'body', '-', 1, [], true, false, { foodMembers: 2, tag: 'heavy' }),
    row('fertile', 'body', '+', 1, ['small_litters'], true, false, { litter: CANDIDATES.litterStep }),
    row('small_litters', 'body', '-', 1, ['fertile'], true, false, { litter: -CANDIDATES.litterStep }),
    row('long_lived', 'body', '+', 1, ['short_lived'], true, false, { elder: CANDIDATES.elderSeason }),
    row('short_lived', 'body', '-', 1, ['long_lived'], true, false, { elder: -CANDIDATES.elderSeason }),
    row('short_tempered', 'mind', '-', 1, ['even_tempered'], true, false, { aggression: CANDIDATES.aggressionNudge, snap: true }),
    row('even_tempered', 'mind', '+', 1, ['short_tempered'], true, false, { noScuffle: true }),
    row('craven', 'mind', '-', 1, ['fearless'], false, false, { fleeFirst: true }),
    row('fearless', 'mind', '+', 2, ['craven'], false, true, { noShaken: true, noFleeRound1: true }),
    row('reckless', 'mind', '-', 1, ['patient'], true, false, { noFleeAhead: true }),
    row('patient', 'mind', '+', 1, ['reckless', 'restless'], true, false, { huntWait: 1 }),
    row('restless', 'mind', '-', 1, ['patient'], true, false, { noRestStreak: true }),
    row('curious', 'mind', '+', 1, [], true, false, { facts: CANDIDATES.curiousFacts }),
    row('cunning', 'mind', '+', 2, ['gullible'], false, true, { feintFlag: true }),
    row('gullible', 'mind', '-', 1, ['cunning'], false, false, { noDoubt: true }),
    row('proud', 'mind', '-', 1, ['humble'], true, false, { noYield: true }),
    row('humble', 'mind', '+', 1, ['proud'], true, false, { yieldLiked: CANDIDATES.greetLiked }),
    row('vengeful', 'mind', '-', 1, ['forgiving'], true, false, { noGrudgeDecay: true }),
    row('forgiving', 'mind', '+', 1, ['vengeful'], true, false, { repairLiked: CANDIDATES.greetLiked }),
    row('loyal', 'mind', '+', 1, [], true, false, { honourDeed: true }),
    row('grieving', 'mind', 'P', 0, [], false, false, {}),
    row('silver_tongue', 'social', '+', 1, ['tongue_tied'], false, false, { greet: CANDIDATES.greetLiked }),
    row('tongue_tied', 'social', '-', 1, ['silver_tongue'], false, false, { greet: 0 }),
    row('beloved', 'social', '+', 2, ['outcast_scent'], false, false, { pair: CANDIDATES.pairShift }),
    row('outcast_scent', 'social', '-', 1, ['beloved'], false, false, { pairPride: -CANDIDATES.pairShift }),
    row('alluring', 'social', '+', 2, ['off_putting'], true, false, { courtBand: CANDIDATES.courtBand }),
    row('off_putting', 'social', '-', 1, ['alluring'], true, false, { courtBand: -CANDIDATES.courtBand }),
    row('gossip', 'social', '+', 1, [], false, false, { facts: 2 }),
    row('born_leader', 'social', '+', 2, ['lone_heart'], true, false, { councilUrgent: true }),
    row('lone_heart', 'social', '-', 1, ['born_leader'], true, false, { talkLimit: true }),
    row('pride_born', 'lineage', '+', 1, ['nameless_stray'], false, false, { birthPride: true }),
    row('nameless_stray', 'lineage', '-', 1, ['pride_born'], false, false, { colderApproval: true }),
    row('heir_of_legend', 'lineage', 'P', 0, [], false, false, { auto: true }),
    row('tainted_blood', 'lineage', '-', 1, [], true, false, {}),
    row('battle_scarred', 'lineage', 'P', 0, [], false, true, { intimidate: 1, tag: 'scarred_body' }),
    row('spear_marked', 'lineage', 'P', 0, [], false, false, { fleeFirstHumans: true, tag: 'scarred_body' }),
    row('torn_ear', 'lineage', 'P', 0, [], false, false, { tag: 'torn_ear' }),
    row('elder_wisdom', 'lineage', 'P', 0, [], false, false, { facts: 1, strength: CANDIDATES.strengthDown }),
    row('den_mother', 'lineage', 'P', 0, [], false, false, { pridePair: CANDIDATES.pairShift }),
    row('den_father', 'lineage', 'P', 0, [], false, false, { pridePair: CANDIDATES.pairShift })
  ];
  const BY = Object.fromEntries(ROWS.map((item) => [item.id, item]));
  const GROUPS = [
    { id: 'body', labelKey: 'creator.traits.group.body' },
    { id: 'mind', labelKey: 'creator.traits.group.mind' },
    { id: 'social', labelKey: 'creator.traits.group.social' },
    { id: 'lineage', labelKey: 'creator.traits.group.lineage' }
  ];

  function shownIds(cat) {
    if (!cat) return [];
    if (Array.isArray(cat)) return cat.slice();
    if (Array.isArray(cat.traits)) return cat.traits.slice();
    if (Array.isArray(cat.traitIds)) return cat.traitIds.slice();
    return [];
  }
  function has(cat, id) { return shownIds(cat).includes(id); }
  function effectOn(id) {
    const item = BY[id];
    if (!item) return false;
    if (item.fight && FIGHT_EFFECTS[id] === false) return false;
    return true;
  }
  function tally(picks) {
    const ids = picks || [];
    let give = 0, spend = 0, pos = 0, neg = 0, fight = 0;
    for (const id of ids) {
      const item = BY[id];
      if (!item || item.playOnly) continue;
      if (item.kind === '+') { spend += item.points; pos += 1; if (item.fight || item.effect.strength > 1) fight += 1; }
      else if (item.kind === '-') { give += item.points; neg += 1; }
    }
    return { give, spend, pos, neg, fight, covered: spend <= give, leftover: Math.max(0, give - spend) };
  }
  function toggle(picks, id, opts) {
    const item = BY[id];
    const have = (picks || []).slice();
    if (!item) return { picks: have, ok: false, reason: 'unknown' };
    if (have.includes(id)) return { picks: have.filter((x) => x !== id), ok: true, reason: null };
    if (item.playOnly) return { picks: have, ok: false, reason: 'play' };
    if (item.inheritOnly && !(opts && opts.freeBlood)) return { picks: have, ok: false, reason: 'blood' };
    if (item.opp.some((other) => have.includes(other))) return { picks: have, ok: false, reason: 'opposite' };
    const next = have.concat(id);
    const sum = tally(next);
    if (item.kind === '+' && sum.pos > 3) return { picks: have, ok: false, reason: 'positives' };
    if (item.kind === '-' && sum.neg > 3) return { picks: have, ok: false, reason: 'negatives' };
    if (item.kind === '+' && (item.fight || item.effect.strength > 1) && sum.fight > 2) return { picks: have, ok: false, reason: 'fight' };
    if (sum.spend > sum.give) return { picks: have, ok: false, reason: 'points' };
    return { picks: next, ok: true, reason: null };
  }
  function strengthMult(cat) {
    let mult = 1;
    for (const id of shownIds(cat)) {
      const item = BY[id];
      if (!item || !effectOn(id) || !item.effect.strength) continue;
      mult *= item.effect.strength;
    }
    return Math.max(CANDIDATES.strengthCapDown, Math.min(CANDIDATES.strengthCapUp, mult));
  }
  function modifiers(cat) {
    const out = { strength: strengthMult(cat), intimidate: 0, endurance: 0, guard: 0, injury: 0, huntBand: 0, courtBand: 0, aggression: 0, litter: 0, elder: 0, facts: 0, tags: [] };
    for (const id of shownIds(cat)) {
      if (!effectOn(id)) continue;
      const effect = (BY[id] && BY[id].effect) || {};
      out.intimidate += effect.intimidate || 0;
      out.endurance += effect.endurance || 0;
      out.guard += effect.guard || 0;
      out.injury += effect.injury || 0;
      out.huntBand += effect.huntBand || 0;
      out.courtBand += effect.courtBand || 0;
      out.aggression += effect.aggression || 0;
      out.litter += effect.litter || 0;
      out.elder += effect.elder || 0;
      out.facts += effect.facts || 0;
      if (effect.tag) out.tags.push(effect.tag);
      if (effect.noShaken) out.noShaken = true;
      if (effect.feintFlag) out.feintFlag = true;
      if (effect.fleeFirst) out.fleeFirst = true;
      if (effect.noFleeRound1) out.noFleeRound1 = true;
      if (effect.noYield) out.noYield = true;
      if (effect.winterImmune) out.winterImmune = true;
    }
    return out;
  }
  const TIERS = ['minor', 'serious', 'crippling'];
  function shiftTier(tier, cat) {
    const delta = modifiers(cat).injury;
    let index = TIERS.indexOf(tier);
    if (index < 0) return tier;
    index = Math.max(0, Math.min(TIERS.length - 1, index + delta));
    return TIERS[index];
  }

  function bloodState(cat, id) {
    const book = (cat && cat.bloodline) || {};
    if (book[id] === 'shows' || book[id] === 'carries') return book[id];
    if (has(cat, id)) return 'shows';
    return null;
  }
  function rollBlood(a, b, rng) {
    let band = BLOOD.neither;
    const show = (a === 'shows') + (b === 'shows');
    const carry = (a === 'carries') + (b === 'carries');
    if (show === 2) band = BLOOD.bothShow;
    else if (show === 1 && carry === 1) band = BLOOD.showCarry;
    else if (show === 1) band = BLOOD.oneShow;
    else if (carry === 2) band = BLOOD.bothCarry;
    else if (carry === 1) band = BLOOD.oneCarry;
    const roll = rng();
    if (roll < band.show) return 'shows';
    if (roll < band.show + band.carry) return 'carries';
    return null;
  }
  function founderBlood(rng) {
    const bloodline = {};
    const traits = [];
    for (const id of INHERIT_ONLY) {
      const roll = rng();
      if (roll < BLOOD.neither.show) { bloodline[id] = 'shows'; traits.push(id); }
      else if (roll < BLOOD.neither.show + BLOOD.founderCarry) bloodline[id] = 'carries';
    }
    return { bloodline, traits };
  }
  function inheritTraits(sire, dam, rng) {
    const traits = [];
    const bloodline = {};
    for (const item of ROWS) {
      if (item.inheritOnly) {
        const state = rollBlood(bloodState(sire, item.id), bloodState(dam, item.id), rng);
        if (state) bloodline[item.id] = state;
        if (state === 'shows') traits.push(item.id);
      } else if (item.inheritable && (has(sire, item.id) || has(dam, item.id)) && rng() < CANDIDATES.inheritChance) {
        traits.push(item.id);
      }
    }
    if (has(sire, 'tainted_blood') || has(dam, 'tainted_blood')) {
      if (!traits.includes('sickly') && rng() < CANDIDATES.inheritChance) traits.push('sickly');
    }
    return { traits, bloodline };
  }
  function aggressionFor(cat) {
    const base = cat && cat.genes && cat.genes.personality ? cat.genes.personality.aggression : (cat && cat.aggression) || 50;
    return base + (has(cat, 'short_tempered') && effectOn('short_tempered') ? CANDIDATES.aggressionNudge : 0);
  }
  function breedCub(sire, dam, rng) {
    const passed = inheritTraits(sire, dam, rng);
    const Breeding = typeof require === 'function' ? require('./breeding') : (typeof self !== 'undefined' ? self.Breeding : null);
    const personality = Breeding
      ? Breeding.inheritPersonality((sire.genes && sire.genes.personality) || {}, (dam.genes && dam.genes.personality) || {}, rng)
      : {};
    const loci = {};
    const leftL = (sire.genes && sire.genes.loci) || {};
    const rightL = (dam.genes && dam.genes.loci) || {};
    for (const key of new Set(Object.keys(leftL).concat(Object.keys(rightL)))) {
      const a = leftL[key] || rightL[key];
      const b = rightL[key] || leftL[key];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      loci[key] = [a[rng() < 0.5 ? 0 : Math.min(1, a.length - 1)], b[rng() < 0.5 ? 0 : Math.min(1, b.length - 1)]];
    }
    return { traits: passed.traits, bloodline: passed.bloodline, genes: { v: 2, loci, personality } };
  }
  function seedBloodlines(npcs) {
    const book = slots.traits || {};
    for (const id of Object.keys(book)) {
      const row = book[id];
      if (row.shows && npcs[row.shows] && !(npcs[row.shows].bloodline && npcs[row.shows].bloodline[id])) {
        const cat = npcs[row.shows];
        cat.bloodline = Object.assign({}, cat.bloodline, { [id]: 'shows' });
        cat.traits = Array.isArray(cat.traits) ? cat.traits : [];
        if (!cat.traits.includes(id)) cat.traits.push(id);
      }
      for (const slot of row.carries || []) {
        if (!npcs[slot] || (npcs[slot].bloodline && npcs[slot].bloodline[id])) continue;
        npcs[slot].bloodline = Object.assign({}, npcs[slot].bloodline, { [id]: 'carries' });
      }
    }
  }

  function playChange(cat, event) {
    const traits = shownIds(cat);
    const add = (id) => { if (!traits.includes(id)) traits.push(id); };
    const drop = (id) => { const i = traits.indexOf(id); if (i >= 0) traits.splice(i, 1); };
    if (event === 'serious-leg') add('lame_paw');
    if (event === 'serious-face') add('one_eyed');
    if (event === 'lost-fight-face') add('chipped_saber');
    if (event === 'year-unhurt') drop('sickly');
    if (event === 'season-no-fights') drop('short_tempered');
    if (event === 'three-courage') drop('craven');
    if (event === 'courage-title') add('fearless');
    if (event === 'kin-died') add('grieving');
    if (event === 'new-bond' || event === 'litter') drop('grieving');
    if (event === 'mercy-title') add('beloved');
    if (event === 'exile') add('outcast_scent');
    if (event === 'season-in-pride') drop('outcast_scent');
    if (event === 'pride-year') add('born_leader');
    if (event === 'break-agreement') drop('loyal');
    if (event === 'three-lethal') add('battle_scarred');
    if (event === 'human-flee-lived') add('spear_marked');
    if (event === 'pride-fight-wound') add('torn_ear');
    if (event === 'elder') add('elder_wisdom');
    if (event === 'three-litters') add('den_mother');
    if (event === 'parent-title') add('heir_of_legend');
    return traits;
  }

  function fill(text, vars) {
    return String(text || '').replace(/\{(name|subjectName|sourceName|catId)\}/g, (token, key) => (vars && vars[key] != null ? String(vars[key]) : token));
  }
  function rumour(traitId, subjectName, sourceName, lastId, rng) {
    const list = ((copy.rumours && copy.rumours.trait) || {})[traitId] || [];
    const pool = list.filter((item) => item.id !== lastId);
    const pick = (pool.length ? pool : list)[Math.floor((rng ? rng() : 0) * Math.max(1, (pool.length ? pool : list).length))] || null;
    if (!pick) return null;
    const subject = subjectName || '';
    return { id: pick.id, text: fill(pick.text, { name: subject, subjectName: subject, sourceName: sourceName || '' }) };
  }
  function wrongTrait(traitId, held) {
    const item = BY[traitId];
    const opp = item && item.opp.find((id) => !(held || []).includes(id));
    if (opp) return opp;
    return ROWS.map((row) => row.id).find((id) => id !== traitId && !(held || []).includes(id)) || null;
  }

  function fold(text) {
    return String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[‐-–—]/g, ' ').replace(/\bsabres\b|\bsabre\b|\bsabors\b|\bsabor\b/g, 'saber').replace(/\s+/g, ' ').trim();
  }
  function clausesOf(text) {
    const parts = [];
    let start = 0;
    const breaks = /\s+(?:but|though|except)\s+|[.,;:!?]/g;
    let match;
    while ((match = breaks.exec(text))) {
      parts.push({ start, end: match.index, text: text.slice(start, match.index) });
      start = match.index + match[0].length;
    }
    parts.push({ start, end: text.length, text: text.slice(start) });
    return parts;
  }
  function negated(clause, indexInClause) {
    const cues = (copy.appearance && copy.appearance._negationCues) || [];
    const before = clause.slice(0, indexInClause);
    return cues.some((cue) => new RegExp('(?:^|\\s)' + cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)').test(before));
  }
  function geneAllows(genes, tag) {
    const loci = (genes && genes.loci) || {};
    if (tag === 'odd_eyes') return Array.isArray(loci.het) && loci.het[0] === 'het' && loci.het[1] === 'het';
    if (tag === 'unusual_coat') {
      const coat = loci.coat || [];
      const white = loci.white || [];
      const ash = coat.includes('melan') && coat.includes('leuc');
      const leuc = coat[0] === 'leuc' && coat[1] === 'leuc';
      const piebald = white.includes('piebald');
      return ash || leuc || piebald;
    }
    return true;
  }
  function coatOf(genes) {
    const coat = (genes && genes.loci && genes.loci.coat) || [];
    if (coat.includes('leuc') && coat.includes('melan')) return 'ash';
    if (coat[0] === 'leuc') return 'pale';
    if (coat[0] === 'melan') return 'black';
    if (coat[0] === 'greydun') return 'gray';
    if (coat[0] === 'russet') return 'brown';
    if (coat[0] === 'sandy') return 'sandy';
    return 'tan';
  }
  function colourNote(text, genes) {
    const own = coatOf(genes);
    for (const [coat, words] of Object.entries(COLOURS)) {
      if (coat === own) continue;
      if (words.some((word) => text.includes(word))) return 'ui.traits.colourNote';
    }
    return null;
  }
  function extractTags(text, genes) {
    const folded = fold(text).slice(0, APPEARANCE_MAX);
    const tags = copy.appearance && copy.appearance.tags || {};
    const found = [];
    const clauses = clausesOf(folded);
    const faceWords = (copy.appearance && copy.appearance._faceRule && copy.appearance._faceRule.words) || [];
    for (const [id, spec] of Object.entries(tags)) {
      const phrases = (spec.phrases || []).slice().sort((a, b) => b.length - a.length);
      const keys = SIZE_TAGS.includes(id) ? [] : (spec.keywords || []);
      const hits = [];
      for (const phrase of phrases) {
        let from = 0;
        while (phrase && from < folded.length) {
          const at = folded.indexOf(phrase, from);
          if (at < 0) break;
          hits.push({ at, length: phrase.length, phrase: true });
          from = at + phrase.length;
        }
      }
      for (const key of keys) {
        const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        let match;
        while ((match = re.exec(folded))) hits.push({ at: match.index, length: key.length, phrase: false });
      }
      for (const hit of hits) {
        const clause = clauses.find((part) => hit.at >= part.start && hit.at < part.end) || clauses[clauses.length - 1];
        const local = hit.at - clause.start;
        const window = folded.slice(hit.at, hit.at + hit.length);
        const blocked = (spec.blockers || []).some((phrase) => folded.slice(Math.max(0, hit.at - phrase.length), hit.at + hit.length + phrase.length).includes(phrase) && phrase !== window);
        const selfNeg = (spec.negations || []).some((phrase) => clause.text.includes(phrase) && clause.text.indexOf(phrase) <= local);
        if (blocked || selfNeg || negated(clause.text, local)) continue;
        let tag = id;
        if (id === 'scarred_body' && !hit.phrase && faceWords.some((word) => new RegExp('\\b' + word + '\\b').test(clause.text))) tag = 'scarred_face';
        if ((tag === 'odd_eyes' || tag === 'unusual_coat') && !geneAllows(genes, tag)) {
          found.push({ tag, at: hit.at, blockedGene: true });
          continue;
        }
        found.push({ tag, at: hit.at, blockedGene: false });
      }
    }
    found.sort((a, b) => a.at - b.at || b.tag.length - a.tag.length);
    const kept = [];
    let geneNote = null;
    for (const hit of found) {
      if (hit.blockedGene) { geneNote = geneNote || 'ui.traits.geneNote'; continue; }
      if (kept.includes(hit.tag)) continue;
      if (kept.length >= TAG_CAP) break;
      kept.push(hit.tag);
    }
    return { tags: kept, colourNote: colourNote(folded, genes), geneNote };
  }
  function autoTags(traitIds) {
    const tags = [];
    for (const id of traitIds || []) {
      const tag = BY[id] && BY[id].effect.tag;
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
    return tags;
  }
  function appearanceOf(text, genes, traitIds, dropped) {
    const typed = extractTags(String(text || '').slice(0, APPEARANCE_MAX), genes);
    const autos = autoTags(traitIds);
    const droppedSet = new Set(dropped || []);
    const tags = typed.tags.concat(autos).filter((tag, index, all) => all.indexOf(tag) === index && !droppedSet.has(tag));
    return { text: String(text || '').slice(0, APPEARANCE_MAX), tags, colourNote: typed.colourNote, geneNote: typed.geneNote, auto: autos };
  }

  function bandOf(value) {
    if (value >= 70) return 'high';
    if (value <= 30) return 'low';
    return 'mid';
  }
  function blockText(block, name) {
    const parts = (block && block.parts) || [];
    return parts.map((part) => fill(part.say || part.beat || '', { name, subjectName: name, catId: name })).join(' ');
  }
  function pickLine(list, personality, name) {
    const rows = list || [];
    for (const item of rows) {
      if (!item.when) return blockText(item.block, name);
      const ok = Object.keys(item.when).every((key) => bandOf((personality && personality[key]) || 50) === item.when[key]);
      if (ok) return blockText(item.block, name);
    }
    return null;
  }
  function offerRemark(opts) {
    const row = opts || {};
    const budget = row.budget || { conversationUsed: false, seasonByCat: {} };
    if (budget.conversationUsed) return { line: null, budget, affinity: 0 };
    const seasonKey = row.catId + ':' + (row.season || '');
    if (row.scene !== 'first' && budget.seasonByCat[seasonKey]) return { line: null, budget, affinity: 0 };
    const name = row.speakerName || '';
    let line = null;
    // Trait reactions play in every storyteller mode, including offline.
    for (const id of row.knownTraits || []) {
      const spec = copy.traits[id];
      if (!spec) continue;
      const list = row.scene === 'repeat' ? spec.repeat_meeting : spec.reactions;
      line = pickLine(list, row.personality, name);
      if (line) break;
    }
    if (!line) {
      for (const tag of row.tags || []) {
        const spec = copy.appearance && copy.appearance.tags && copy.appearance.tags[tag];
        if (!spec) continue;
        const list = row.scene === 'courtship' ? spec.courtship : row.scene === 'taunt' ? spec.rival_taunt : row.scene === 'repeat' ? spec.repeat_meeting : spec.first_meeting;
        line = pickLine(list, row.personality, name);
        if (line) break;
      }
    }
    if (!line) return { line: null, budget, affinity: 0 };
    const next = { conversationUsed: true, seasonByCat: Object.assign({}, budget.seasonByCat) };
    if (row.scene !== 'first') next.seasonByCat[seasonKey] = true;
    return { line, budget: next, affinity: 0 };
  }

  function emptyCat() {
    return { traits: [], bloodline: {}, appearanceText: '', appearanceTags: [], birthPride: null };
  }
  function migrateCat(cat) {
    if (!cat || typeof cat !== 'object') return cat;
    if (!Array.isArray(cat.traits)) cat.traits = [];
    if (!cat.bloodline || typeof cat.bloodline !== 'object') cat.bloodline = {};
    if (typeof cat.appearanceText !== 'string') cat.appearanceText = '';
    if (!Array.isArray(cat.appearanceTags)) cat.appearanceTags = [];
    return cat;
  }

  return {
    CANDIDATES, FIGHT_EFFECTS, BLOOD, INHERIT_ONLY, ROWS, BY, GROUPS, PRIDES, copy, slots,
    APPEARANCE_MAX, TAG_CAP, tally, toggle, shownIds, has, strengthMult, modifiers, shiftTier,
    rollBlood, founderBlood, inheritTraits, breedCub, seedBloodlines, playChange,
    fill, rumour, wrongTrait, extractTags, autoTags, appearanceOf, offerRemark, emptyCat, migrateCat, geneAllows
  };
});
