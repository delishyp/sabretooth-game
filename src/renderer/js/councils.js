/**
 * Season councils. Acceptance, keep and break use the councils spec's cited numbers.
 * Candidate ambition stays off. At most one council a season.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Councils = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  const TEMPER = { highcrag: -10, bonefield: -10, mistwood: 10 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function seasonOf(day) { return Math.floor(((day || 1) - 1) / 20); }
  function agreements(state) {
    if (!state.world) state.world = {};
    if (!Array.isArray(state.world.agreements)) state.world.agreements = [];
    return state.world.agreements;
  }
  const CANDIDATE = { truceAcceptBase: 50, honourPerLevel: 3, honourCap: 9 };
  function acceptChance(relation, ourStrength, theirStrength, pride, kind, opts) {
    opts = opts || {};
    const base = opts.afterBlood && kind === 'truce' ? CANDIDATE.truceAcceptBase : 30 + (relation || 0) / 2;
    const strength = ourStrength === theirStrength ? 0 : (theirStrength < ourStrength ? 1 : -1);
    let temper = TEMPER[pride] || 0;
    if (pride === 'bonefield' && kind === 'alliance') temper = 0;
    const honour = clamp((opts.honourLevel || 0) * CANDIDATE.honourPerLevel, -CANDIDATE.honourCap, CANDIDATE.honourCap);
    return clamp(base + 10 * strength + temper + honour, 5, 90);
  }
  function mayAttend(state) {
    return !!(state.records && state.records.pride && state.records.pride.name);
  }
  function open(state) {
    if (!mayAttend(state)) return { error: 'loner' };
    const season = seasonOf(state.day);
    if (state.records.lastCouncilSeason === season) return { error: 'already' };
    state.records.lastCouncilSeason = season;
    const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
    if (Deeds) Deeds.note(state, 'council.attended');
    const items = agenda(state);
    const LoreBook = typeof require === 'function' ? require('./lore-book') : (typeof self !== 'undefined' ? self.LoreBook : null);
    const line = LoreBook && LoreBook.copy && (LoreBook.copy.common_knowledge || []).find((row) => row.id === 'ck_custom_councils');
    state.pending = {
      eventId: 'council.season',
      title: (line && line.title) || 'Council',
      council: true,
      agenda: items,
      beats: [{ kind: 'narration', text: (line && line.text) || '' }],
      beatIndex: 0,
      choices: items.length ? items.map((item) => ({ id: item.id, label: item.label })) : [{ id: 'leave', label: '[PH] Leave the council' }]
    };
    state.phase = 'event';
    return { state, items };
  }
  function agenda(state) {
    const items = [];
    const names = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
    for (let i = 0; i < PRIDES.length; i++) {
      for (let j = i + 1; j < PRIDES.length; j++) {
        const a = PRIDES[i];
        const b = PRIDES[j];
        const value = Math.min(relation(state, a, b), relation(state, b, a));
        if (value <= -30) items.push({ id: 'feud-' + a + '-' + b, kind: 'truce', parties: [a, b], label: '[PH] A truce between ' + (names[a] || a) + ' and ' + (names[b] || b) });
      }
    }
    return items.slice(0, 3);
  }
  function strike(state, item, accepted) {
    if (!accepted) return { state, agreed: false };
    const row = {
      id: (state.runId || 'run') + '/council/' + item.id + '/' + seasonOf(state.day),
      kind: item.kind || 'truce',
      parties: item.parties || [],
      regionId: item.regionId || null,
      startSeason: seasonOf(state.day),
      endSeason: seasonOf(state.day) + (item.kind === 'border' ? 2 : 1),
      state: 'active'
    };
    agreements(state).push(row);
    if (item.parties && item.parties.length === 3) {
      const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
      if (Deeds) Deeds.note(state, 'council.grand');
    }
    return { state, agreed: true, agreement: row };
  }
  function relation(state, from, to) {
    state.world = state.world || {};
    state.world.relations = state.world.relations || {};
    return state.world.relations[from + '>' + to] || 0;
  }
  function shift(state, from, to, delta) {
    state.world = state.world || {};
    state.world.relations = state.world.relations || {};
    const key = from + '>' + to;
    state.world.relations[key] = (state.world.relations[key] || 0) + delta;
    const player = state.records && state.records.pride && state.records.pride.id;
    if (player && to === player) {
      state.prideRelation = state.prideRelation || {};
      state.prideRelation[from] = (state.prideRelation[from] || 0) + delta;
    }
  }
  function keep(state, id) {
    const row = agreements(state).find((item) => item.id === id && item.state === 'active');
    if (!row) return { error: 'missing' };
    row.state = 'kept';
    const parties = row.parties || [];
    for (let i = 0; i < parties.length; i++) {
      for (let j = i + 1; j < parties.length; j++) {
        shift(state, parties[i], parties[j], 5);
        shift(state, parties[j], parties[i], 5);
      }
    }
    const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
    if (Deeds) Deeds.note(state, 'agreement.kept', 1);
    const Reputation = typeof require === 'function' ? require('./reputation') : (typeof self !== 'undefined' ? self.Reputation : null);
    if (Reputation) Reputation.add(state, { axis: 'honour', sign: 1, deedId: 'agreement_kept', weightClass: 'medium', receiptKey: row.id + '/kept', day: state.day });
    return { state, agreement: row };
  }
  function breach(state, id, breaker) {
    const row = agreements(state).find((item) => item.id === id && item.state === 'active');
    if (!row) return { error: 'missing' };
    row.state = 'broken';
    const fact = 'broke_' + row.kind;
    if (!state.worldMemory) state.worldMemory = { facts: [] };
    if (!Array.isArray(state.worldMemory.facts)) state.worldMemory.facts = [];
    state.worldMemory.facts.push({ factId: fact + '/' + row.id, kind: fact });
    const who = breaker || (row.parties && row.parties[0]);
    for (const party of row.parties || []) {
      if (party === who) continue;
      shift(state, who, party, -15);
      shift(state, party, who, -10);
    }
    const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
    if (Deeds) Deeds.note(state, 'agreement.broken');
    const Reputation = typeof require === 'function' ? require('./reputation') : (typeof self !== 'undefined' ? self.Reputation : null);
    if (Reputation) Reputation.add(state, { axis: 'honour', sign: -1, deedId: 'agreement_broken', weightClass: 'big', receiptKey: row.id + '/broken', day: state.day, factId: fact });
    return { state, agreement: row, fact };
  }
  function resolve(state, choiceId) {
    const item = (state.pending && state.pending.agenda || []).find((row) => row.id === choiceId);
    if (item) strike(state, item, true);
    if (state.pending) state.pending = null;
    state.phase = 'day';
    return { state };
  }
  return { PRIDES, CANDIDATE, acceptChance, seasonOf, mayAttend, open, agenda, strike, keep, breach, resolve, agreements, relation, shift };
});
