/**
 * Deeds (§1). Triggers read facts already on the save, plus two counters the spec allows.
 * A deed whose system is not built yet still has a fact id and stays locked until that fact is set.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Deeds = factory();
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
    return { deeds: {}, screen: {} };
  }
  const copy = load('deeds-copy-v1.json');
  const HARSH = ['standard', 'harsh', 'ice_age'];
  /**
   * fact: the id a later system should set.
   * live: true when this build can see the fact from existing state.
   */
  const RULES = [
    { id: 'first_kill', fact: 'hunt.success', live: true },
    { id: 'big_game', fact: 'hunt.large', live: true },
    { id: 'feast', fact: 'food.plenty', live: true },
    { id: 'lean_season', fact: 'season.lean', live: true },
    { id: 'first_blood', fact: 'fight.win', live: true },
    { id: 'hyena_bane', fact: 'hyena.clan', live: true },
    { id: 'lion_slayer', fact: 'lion.adult', live: false },
    { id: 'read_you', fact: 'fight.defend_pounce', live: false, count: 3 },
    { id: 'bloodless', fact: 'intimidate.alone', live: false },
    { id: 'spear_dancer', fact: 'human.escape_unhurt', live: false },
    { id: 'first_friend', fact: 'standing.warming', live: true },
    { id: 'mated', fact: 'mate.bond', live: true },
    { id: 'heartbreaker', fact: 'court.refused', live: true, count: 2, also: 'mate.bond' },
    { id: 'across_lines', fact: 'mate.hostile', live: true },
    { id: 'founder', fact: 'pride.founded', live: true },
    { id: 'loner_king', fact: 'pride.founded_clean', live: true },
    { id: 'three_banners', fact: 'borders.three', live: false },
    { id: 'holdfast', fact: 'den.held_year', live: false },
    { id: 'expansion', fact: 'regions.six', live: false },
    { id: 'first_council', fact: 'council.attended', live: false },
    { id: 'peacemaker', fact: 'agreement.kept', live: false, count: 3 },
    { id: 'grand_council', fact: 'council.grand', live: false },
    { id: 'oathbreaker', fact: 'agreement.broken', live: false },
    { id: 'titled', fact: 'reputation.title', live: false },
    { id: 'legend', fact: 'reputation.legend', live: false },
    { id: 'two_faces', fact: 'reputation.two_faces', live: false },
    { id: 'first_litter', fact: 'litter.born', live: false },
    { id: 'full_den', fact: 'litter.five_adult', live: false },
    { id: 'grandsire', fact: 'grandcub', live: false },
    { id: 'dynasty', fact: 'heir.generation4', live: false },
    { id: 'rare_coat', fact: 'cub.rare', live: false },
    { id: 'errand_cat', fact: 'quest.done', live: true, count: 5 },
    { id: 'storyteller', fact: 'quest.lines', live: true, count: 3 },
    { id: 'gift_gone_wrong', fact: 'gift.backfire', live: true }
  ];
  const BY = Object.fromEntries(RULES.map((row) => [row.id, row]));

  function signalsOf(state) {
    const s = state || {};
    const bag = Object.assign({}, (s.records && s.records.deedFacts) || {});
    const npcs = s.npcs || {};
    if (Object.values(npcs).some((npc) => npc && (npc.affinity || 0) >= 60)) bag['standing.warming'] = true;
    if (s.records && s.records.matePair && s.records.matePair.mateId) bag['mate.bond'] = true;
    if (s.records && s.records.pride && s.records.pride.name) bag['pride.founded'] = true;
    const food = s.pride && s.pride.foodWord;
    if (food === 'Plenty') bag['food.plenty'] = true;
    if ((s.records && s.records.fights || []).some((row) => row && row.won)) bag['fight.win'] = true;
    const enc = (s.encounters && s.encounters.log) || [];
    if (enc.some((row) => row && (row.outcomeId === 'hyena_driven' || row.outcomeId === 'player_takes_kill'))) bag['hyena.clan'] = true;
    const gifts = (s.world && s.world.gifts) || [];
    if (gifts.some((row) => row && row.feel === 'disliked')) bag['gift.backfire'] = true;
    const facts = (s.worldMemory && s.worldMemory.facts) || [];
    const lines = new Set(Array.isArray(s.questsDone) ? s.questsDone : []);
    for (const fact of facts) {
      const id = fact && fact.factId;
      if (typeof id === 'string' && id.indexOf('quest_done_') === 0) lines.add(id.slice('quest_done_'.length));
      if (id && bag[id] == null) bag[id] = true;
    }
    if (lines.size) {
      bag['quest.done'] = lines.size;
      bag['quest.lines'] = lines.size;
    }
    const Header = typeof require === 'function' ? require('./pride-header') : (typeof self !== 'undefined' ? self.PrideHeader : null);
    if (Header && s.pride && Header.headerFood(s.pride) === 'Plenty') bag['food.plenty'] = true;
    return bag;
  }
  function met(rule, bag) {
    const value = bag[rule.fact];
    const have = rule.count ? Number(value || 0) >= rule.count : !!value;
    if (!have) return false;
    if (rule.also && !bag[rule.also]) return false;
    return true;
  }
  function allowed(id, death, level) {
    const spec = copy.deeds[id] || {};
    if (death === 'sandbox') return false;
    if (spec.kind === 'hard') return (death === 'permadeath' || death === 'heir') && HARSH.includes(level || 'standard');
    return true;
  }
  function scan(state) {
    const s = state || {};
    const death = s.deathRule || s.difficulty || 'permadeath';
    const level = s.level || 'standard';
    const bag = signalsOf(s);
    const earned = new Set(s.earnedDeeds || []);
    const fresh = [];
    for (const rule of RULES) {
      if (earned.has(rule.id) || !met(rule, bag)) continue;
      if (!allowed(rule.id, death, level)) continue;
      fresh.push(rule.id);
    }
    return fresh;
  }
  function note(state, fact, amount) {
    const s = state || {};
    s.records = s.records || {};
    s.records.deedFacts = s.records.deedFacts || {};
    if (amount == null) s.records.deedFacts[fact] = true;
    else s.records.deedFacts[fact] = (Number(s.records.deedFacts[fact]) || 0) + amount;
    return s.records.deedFacts[fact];
  }
  function tile(id, earned) {
    const spec = copy.deeds[id];
    if (!spec) return null;
    const have = !!earned;
    if (spec.kind === 'hidden' && !have) {
      return { id, kind: spec.kind, earned: false, name: spec.lockedName, hint: spec.lockedHint, flavour: '' };
    }
    return {
      id, kind: spec.kind, earned: have,
      name: have ? spec.name : spec.lockedName,
      hint: have ? '' : spec.lockedHint,
      flavour: have ? spec.flavour : '',
      challenge: spec.kind === 'hard'
    };
  }
  function grid(earnedIds, filter) {
    const earned = new Set(earnedIds || []);
    let rows = RULES.map((rule) => tile(rule.id, earned.has(rule.id)));
    if (filter === 'earned') rows = rows.filter((row) => row.earned);
    else if (filter === 'locked') rows = rows.filter((row) => !row.earned && row.kind !== 'hidden');
    else if (filter === 'hidden') rows = rows.filter((row) => row.kind === 'hidden');
    else if (filter === 'challenge') rows = rows.filter((row) => row.kind === 'hard');
    return rows;
  }
  function counter(earnedIds) {
    const earned = (earnedIds || []).length;
    const total = RULES.length;
    return String(copy.screen.counter || '').replace('{earned}', String(earned)).replace('{total}', String(total));
  }
  return { copy, RULES, BY, HARSH, signalsOf, scan, note, tile, grid, counter, allowed };
});
