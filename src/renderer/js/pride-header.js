/**
 * My-pride header words. Data only: no screen, no role buttons, no feeding rules.
 * One member eats 12 store units in a day. The label is the day band, never the count.
 * Threat words use only facts the player already knows.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrideHeader = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function loadConfig() {
    if (typeof require === 'function') {
      try { return require('../data/pride-rules.json'); } catch (e) { /* browser */ }
    }
    return { pride: { foodMembers: 'adults+cubs' }, claim: { strongAt: 80, heldAt: 50 } };
  }
  const rules = loadConfig();
  const UNITS_PER_DAY = 12;

  function countsAsMouth(member) {
    if (rules.pride.foodMembers === 'adults') return !member || member.stage !== 'cub';
    return true;
  }
  function memberCount(pride) {
    if (!pride) return 0;
    if (Number.isInteger(pride.members) && pride.members > 0) return pride.members;
    if (Array.isArray(pride.members)) return pride.members.filter(countsAsMouth).length;
    if (Number.isInteger(pride.memberCount) && pride.memberCount > 0) return pride.memberCount;
    return 0;
  }
  function storeOf(pride) {
    const food = pride && pride.food;
    if (typeof food !== 'number' || !Number.isFinite(food) || food < 0) return 0;
    return food;
  }
  /** Days the store lasts. Zero when the pride has no members. */
  function foodDays(pride) {
    const members = memberCount(pride);
    if (members < 1) return 0;
    return storeOf(pride) / (UNITS_PER_DAY * members);
  }
  function headerFood(pride) {
    const days = foodDays(pride);
    if (days < 1) return 'Nothing left';
    if (days < 3) return 'Running low';
    if (days < 6) return 'Enough for now';
    return 'Plenty';
  }
  /**
   * Contested wins over the strength word. Otherwise Strong, Held, or Slipping
   * from the holder's claim.
   */
  function claimWord(ownership) {
    if (!ownership) return null;
    if (ownership.state === 'contested' || ownership.disputedBy) return 'Contested';
    const claim = Number.isFinite(ownership.claim) ? ownership.claim
      : (ownership.claims && ownership.holder ? ownership.claims[ownership.holder] : 0) || 0;
    if (claim >= rules.claim.strongAt) return 'Strong';
    if (claim >= rules.claim.heldAt) return 'Held';
    return 'Slipping';
  }

  function bagFacts(state) {
    if (!state) return [];
    if (Array.isArray(state.facts)) return state.facts;
    const memory = state.worldMemory;
    if (!memory || !Array.isArray(memory.facts)) return [];
    return memory.facts.map((fact) => Object.assign({}, fact, {
      id: fact.factId || fact.id,
      knowledge: memory.knowledge && memory.knowledge[fact.factId || fact.id]
    }));
  }
  function playerKnows(fact) {
    if (!fact) return false;
    if (fact.known === false) return false;
    if (fact.known === true) return true;
    const row = fact.knowledge;
    if (!row) return false;
    if (row.scope === 'world_known') return true;
    return (row.participantIds || []).includes('player')
      || (row.disclosedTo || []).includes('player')
      || (row.witnessIds || []).includes('player');
  }
  function kindOf(fact) {
    return String(fact.kind || fact.type || '');
  }
  function isBand(fact) {
    const kind = kindOf(fact);
    return kind === 'band_warning' || kind === 'bandWarning';
  }
  function isScent(fact) {
    const kind = kindOf(fact);
    return kind === 'scent_sign' || kind === 'scentSign';
  }
  function isScout(fact) {
    const kind = kindOf(fact);
    return kind === 'scout' || kind === 'scout_report';
  }
  function heldSet(state) {
    const list = (state && (state.held || state.heldRegions)) || [];
    return new Set(list);
  }
  function besideHeld(fact, state) {
    const held = heldSet(state);
    if (!held.size) return false;
    const region = fact.region || fact.zoneId;
    if (!region || held.has(region)) return false;
    const neighbours = (state && state.neighbours) || {};
    const next = neighbours[region] || fact.adjacent || [];
    return next.some((id) => held.has(id));
  }
  /**
   * One header word. A known band warning comes first, then a known scout report
   * whose region sits beside held land, then a known scent sign. Anything else is Quiet.
   */
  function headerThreat(state) {
    const known = bagFacts(state).filter(playerKnows);
    if (known.some(isBand)) return 'Band warning';
    if (known.some((fact) => isScout(fact) && besideHeld(fact, state))) return 'Scout report';
    if (known.some(isScent)) return 'Scent sign';
    return 'Quiet';
  }

  /** Old saves gain pride.food 0. A number already stored on the pride record is kept. */
  function migrateFood(s) {
    if (!s) return null;
    const prior = s.pride && typeof s.pride === 'object' && !Array.isArray(s.pride) ? s.pride : {};
    let food = prior.food;
    const nested = s.records && s.records.pride && s.records.pride.food;
    if (!Number.isFinite(food) && Number.isFinite(nested)) food = nested;
    if (typeof food !== 'number' || !Number.isFinite(food) || food < 0) food = 0;
    s.pride = Object.assign({}, prior, { food });
    return s.pride;
  }

  return { UNITS_PER_DAY, memberCount, foodDays, headerFood, headerThreat, claimWord, migrateFood };
});
