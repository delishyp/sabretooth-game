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
  let hintCache = null;
  function hints() {
    if (hintCache) return hintCache;
    if (typeof require === 'function') {
      try { hintCache = require('../data/events/first-season-v0.6.2.json').uiHints || {}; return hintCache; } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/first-season-v0.6.2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) { hintCache = JSON.parse(xhr.responseText).uiHints || {}; return hintCache; }
      } catch (e) { /* missing copy */ }
    }
    hintCache = {};
    return hintCache;
  }
  function hint(id, vars) {
    return String(hints()[id] || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
  }
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
  const HOSTILE = -50;
  const RECOGNISE_ABOVE = -15;
  const RECOGNISE_COUNT = 2;
  function mayAttend(state) {
    return !!(state.records && state.records.pride && state.records.pride.name);
  }
  function prideToPlayer(state, id) {
    const bag = state.worldMemory && state.worldMemory.prideToPlayer;
    const rec = bag && bag[id + '->player'];
    if (rec && typeof rec.value === 'number') return rec.value;
    return (state.prideRelation && state.prideRelation[id]) || 0;
  }
  function recognised(state) {
    let above = 0;
    for (const id of PRIDES) if (prideToPlayer(state, id) > RECOGNISE_ABOVE) above += 1;
    return above >= RECOGNISE_COUNT;
  }
  function playerParty(state, parties) {
    const id = state.records && state.records.pride && state.records.pride.id;
    return (parties || []).some((party) => party === 'player' || (id && party === id));
  }
  function open(state) {
    if (!mayAttend(state)) return { error: 'loner' };
    const season = seasonOf(state.day);
    if (state.records.lastCouncilSeason === season) return { error: 'already' };
    state.records.lastCouncilSeason = season;
    const heldLatch = state.records.councilLatch || null;
    state.records.councilLatch = null;
    const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
    if (Deeds) Deeds.note(state, 'council.attended');
    const items = agenda(state, heldLatch);
    const LoreBook = typeof require === 'function' ? require('./lore-book') : (typeof self !== 'undefined' ? self.LoreBook : null);
    const line = LoreBook && LoreBook.copy && (LoreBook.copy.common_knowledge || []).find((row) => row.id === 'ck_custom_councils');
    state.pending = {
      eventId: 'council.season',
      title: (line && line.title) || 'Council',
      council: true,
      agenda: items,
      beats: [{ kind: 'narration', text: (line && line.text) || '' }],
      beatIndex: 0,
      choices: items.length ? items.map((item) => ({ id: item.id, label: item.label })) : [{ id: 'leave', label: hint('ui.council.leave') }]
    };
    state.phase = 'event';
    return { state, items };
  }
  function agenda(state, latch) {
    const items = [];
    const names = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
    const truce = (a, b) => hint('ui.council.agenda.truce', { prideA: names[a] || a, prideB: names[b] || b });
    const held = latch || (state.records && state.records.councilLatch);
    const fight = held && held.reason === 'fight' && held.pair;
    if (fight) {
      const pair = held.pair;
      items.push({ id: 'fight-' + pair[0] + '-' + pair[1], kind: 'truce', parties: pair, afterBlood: true, label: truce(pair[0], pair[1]) });
    }
    for (let i = 0; i < PRIDES.length; i++) {
      for (let j = i + 1; j < PRIDES.length; j++) {
        const a = PRIDES[i];
        const b = PRIDES[j];
        const value = Math.min(relation(state, a, b), relation(state, b, a));
        if (value <= -30) items.push({ id: 'feud-' + a + '-' + b, kind: 'truce', parties: [a, b], label: truce(a, b) });
      }
    }
    return items.slice(0, 3);
  }
  function strike(state, item, accepted) {
    if (!accepted) return { state, agreed: false };
    if (playerParty(state, item.parties) && !recognised(state)) return { state, agreed: false, reason: 'unrecognised' };
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
    latch(state, { reason: 'breach' });
    const Reputation = typeof require === 'function' ? require('./reputation') : (typeof self !== 'undefined' ? self.Reputation : null);
    if (Reputation) Reputation.add(state, { axis: 'honour', sign: -1, deedId: 'agreement_broken', weightClass: 'big', receiptKey: row.id + '/broken', day: state.day, factId: fact });
    return { state, agreement: row, fact };
  }
  function resolve(state, choiceId) {
    if (state.pending && state.pending.leaderCouncil) return finishLeader(state, choiceId);
    const item = (state.pending && state.pending.agenda || []).find((row) => row.id === choiceId);
    let result = { state, agreed: false };
    if (item && !recognised(state)) result = { state, agreed: false, reason: 'unrecognised' };
    else if (item) result = strike(state, item, true);
    if (state.pending) state.pending = null;
    state.phase = 'day';
    return result;
  }
  const PER_COUNCIL = 2;
  const LIFETIME = 10;
  const WALK = 2;
  const PRIDE_NAME = { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' };
  let bookCache = null;
  function scenes() {
    if (bookCache) return bookCache;
    if (typeof require === 'function') {
      try { bookCache = require('../data/events/council-scenes-v2.json'); return bookCache; } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/council-scenes-v2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) { bookCache = JSON.parse(xhr.responseText); return bookCache; }
      } catch (e) { /* missing copy */ }
    }
    bookCache = {};
    return bookCache;
  }
  function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
  }
  function speechApi() {
    return typeof require === 'function' ? require('./speech') : (typeof self !== 'undefined' ? self.Speech : null);
  }
  function ensure(state) {
    if (!state.councils || typeof state.councils !== 'object' || Array.isArray(state.councils)) state.councils = {};
    for (const id of PRIDES) {
      const n = state.councils[id] && state.councils[id].lifetimeDelta;
      state.councils[id] = { lifetimeDelta: Number.isFinite(n) ? n : 0 };
    }
    if (!Array.isArray(state.councils.lore)) state.councils.lore = [];
    if (!Array.isArray(state.councils.applied)) state.councils.applied = [];
    return state.councils;
  }
  function ledger(state) {
    if (!state.worldMemory) state.worldMemory = {};
    if (!Array.isArray(state.worldMemory.ledger)) state.worldMemory.ledger = [];
    if (!Array.isArray(state.worldMemory.facts)) state.worldMemory.facts = [];
    return state.worldMemory.ledger;
  }
  function addStanding(state, prideId, delta) {
    if (!delta) return;
    state.prideRelation = state.prideRelation || {};
    state.prideRelation[prideId] = clamp((state.prideRelation[prideId] || 0) + delta, -100, 100);
    const bag = state.worldMemory && state.worldMemory.prideToPlayer;
    const rec = bag && bag[prideId + '->player'];
    if (rec) rec.value = state.prideRelation[prideId];
  }
  function noteLore(state, id, body) {
    ensure(state);
    if (!state.councils.lore.some((row) => row.id === id)) state.councils.lore.push({ id, body });
  }
  /**
   * Stance and walk-out share one ±10 pool per pride.
   * A shift that would cross the cap is cut to the remaining room.
   * At the cap the change is 0 and no receipt is written.
   */
  function applyPooled(state, prideId, requested, receiptKey, sourceType) {
    ensure(state);
    if (state.councils.applied.indexOf(receiptKey) >= 0 || ledger(state).some((row) => row.receiptKey === receiptKey)) {
      return { applied: 0, duplicate: true, receipt: false, lifetimeDelta: state.councils[prideId].lifetimeDelta };
    }
    state.councils.applied.push(receiptKey);
    const asked = clamp(Number(requested) || 0, -PER_COUNCIL, PER_COUNCIL);
    const before = state.councils[prideId].lifetimeDelta;
    const next = clamp(before + asked, -LIFETIME, LIFETIME);
    const applied = next - before;
    const name = PRIDE_NAME[prideId] || prideId;
    const outcomes = scenes().standingOutcomes || {};
    const zone = (state.region && PRIDE_NAME[state.region]) || 'the Split Rock';
    if (applied === 0) {
      const capped = asked !== 0;
      const line = fill((capped ? outcomes.capped : outcomes.unchanged).narration, { pride: name, zoneName: zone });
      if (capped) noteLore(state, receiptKey + '/capped', line);
      return { applied: 0, receipt: false, capped, lifetimeDelta: before, line, delta: 0 };
    }
    state.councils[prideId].lifetimeDelta = next;
    addStanding(state, prideId, applied);
    ledger(state).push({
      receiptKey, sourceType: sourceType || 'council_stance', recordKind: 'prideToPlayer',
      actor: prideId, target: 'player', delta: applied, absDay: state.day || 1
    });
    const which = applied > 0 ? outcomes.warmer : outcomes.cooler;
    const line = fill(which.narration, { pride: name });
    noteLore(state, receiptKey + '/lore', fill(which.lore, { pride: name, zoneName: zone }));
    return { applied, receipt: true, capped: false, lifetimeDelta: next, line, delta: applied };
  }
  function stanceAsked(choiceId, prideA, prideB) {
    const asked = {};
    for (const id of PRIDES) asked[id] = 0;
    if (choiceId === 'speak_for_a') { asked[prideA] = PER_COUNCIL; asked[prideB] = -PER_COUNCIL; }
    else if (choiceId === 'speak_for_b') { asked[prideB] = PER_COUNCIL; asked[prideA] = -PER_COUNCIL; }
    return asked;
  }
  function applyChoice(state, choiceId, opts) {
    opts = opts || {};
    const seated = (opts.seated || PRIDES).slice();
    const prideA = opts.prideA || 'highcrag';
    const prideB = opts.prideB || 'bonefield';
    const councilId = opts.councilId || ((state.runId || 'run') + '/council/' + seasonOf(state.day));
    const results = {};
    if (choiceId === 'leave') {
      for (const id of seated) results[id] = applyPooled(state, id, -WALK, councilId + '/walk/' + id, 'council_walk_out');
      return { results, seated, walked: true };
    }
    const asked = stanceAsked(choiceId, prideA, prideB);
    for (const id of seated) results[id] = applyPooled(state, id, asked[id] || 0, councilId + '/stance/' + id, 'council_stance');
    return { results, seated, walked: false };
  }
  function spoken(state, path, slot) {
    const data = scenes();
    const Speech = speechApi();
    const row = data.speechLocations && data.speechLocations[path];
    const npc = state.npcs && state.npcs[slot];
    const vars = { name: npc && npc.name || '', catName: npc && npc.name || '', playerName: state.cat && state.cat.name || '' };
    if (!row) return { text: '', beat: '' };
    const resolved = Speech ? Speech.resolve(data, path, npc && npc.personality, vars, null) : { text: row.base };
    const focus = row.focusTrait;
    const band = Speech && npc && npc.personality ? Speech.band(npc.personality[focus]) : null;
    const key = band === 'high' || band === 'low' ? band : 'base';
    const beat = row.beat && (row.beat[key] || row.beat.base) || '';
    return { text: resolved.text || row.base || '', beat: fill(beat, vars), band: key };
  }
  function bindings(state) {
    return {
      zoneName: 'the Split Rock',
      prideA: 'Highcrag', prideB: 'Bonefield', thirdPride: 'Mistwood',
      leaderA: state.npcs && state.npcs.hc01 && state.npcs.hc01.name || 'Highcrag',
      leaderB: state.npcs && state.npcs.bf01 && state.npcs.bf01.name || 'Bonefield',
      name: state.cat && state.cat.name || '',
      playerName: state.cat && state.cat.name || '',
      kindLabel: 'a border deal',
      stanceWord: 'neutral',
      seasonName: state.season || 'spring'
    };
  }
  function openScene(state) {
    if (!mayAttend(state)) return { error: 'loner' };
    ensure(state);
    const data = scenes();
    const off = data.offlineFallback || {};
    const vars = bindings(state);
    const beats = [];
    for (const step of off.start || []) {
      if (step.kind === 'narration' && step.text) beats.push({ kind: 'narration', text: fill(step.text, vars) });
      else if (step.speechPath) {
        const line = spoken(state, step.speechPath, step.slot);
        if (line.beat) beats.push({ kind: 'narration', text: line.beat });
        if (line.text) beats.push({ kind: 'speech', speakerId: step.slot, speaker: (state.npcs[step.slot] && state.npcs[step.slot].name) || '', text: line.text });
      }
    }
    if (!beats.length) beats.push({ kind: 'narration', text: fill((off.start && off.start[0] && off.start[0].text) || 'The leaders are seated.', vars) });
    const set = data.choiceSets && data.choiceSets.ai_ai_recognised;
    const choices = ((set && set.options) || []).map((opt) => ({ id: opt.id, label: fill(opt.label, vars) }));
    state.pending = {
      eventId: off.id || 'council.offline.complete',
      title: 'Council',
      council: true,
      leaderCouncil: true,
      beats, beatIndex: 0, choices,
      seated: PRIDES.slice(),
      prideA: 'highcrag',
      prideB: 'bonefield'
    };
    state.phase = 'event';
    return { state };
  }
  function finishLeader(state, choiceId) {
    const pending = state.pending;
    if (!pending) return { state };
    if (pending.resolved || choiceId === 'continue' || choiceId == null) {
      state.pending = null;
      state.phase = 'day';
      return { state, closed: true };
    }
    const outcome = applyChoice(state, choiceId, {
      seated: pending.seated,
      prideA: pending.prideA,
      prideB: pending.prideB,
      councilId: (state.runId || 'run') + '/council/' + seasonOf(state.day)
    });
    const vars = bindings(state);
    const lines = [];
    if (outcome.walked) lines.push(fill((scenes().standingOutcomes.walkOut || {}).narration, vars));
    for (const id of outcome.seated) if (outcome.results[id] && outcome.results[id].line) lines.push(outcome.results[id].line);
    pending.beats = lines.map((text) => ({ kind: 'narration', text }));
    pending.beatIndex = 0;
    pending.choices = [];
    pending.summary = '';
    pending.choiceId = choiceId;
    pending.resolved = true;
    state.phase = 'eventResult';
    return { state, outcome };
  }
  function latch(state, spec) {
    if (!state.records) state.records = {};
    if (state.records.lastCouncilSeason === seasonOf(state.day)) return null;
    state.records.councilLatch = { reason: spec.reason, pair: spec.pair || null, day: state.day || 1 };
    return state.records.councilLatch;
  }
  function relationsNow(state) {
    const now = {};
    const world = (state.world && state.world.relations) || {};
    for (const [key, value] of Object.entries(world)) now['world:' + key] = value;
    for (const id of PRIDES) now['player:' + id] = (state.prideRelation && state.prideRelation[id]) || 0;
    const between = (state.worldMemory && state.worldMemory.prideToPride) || {};
    for (const [key, rec] of Object.entries(between)) now['pride:' + key] = (rec && rec.value) || 0;
    return now;
  }
  function scan(state) {
    if (!state.records) state.records = {};
    const now = relationsNow(state);
    if (!state.records.councilRelations) {
      state.records.councilRelations = now;
      return [];
    }
    const prev = state.records.councilRelations;
    const crossed = [];
    const keys = new Set(Object.keys(prev).concat(Object.keys(now)));
    for (const key of keys) {
      const before = prev[key] == null ? 0 : prev[key];
      const after = now[key] == null ? 0 : now[key];
      if (before > HOSTILE && after <= HOSTILE) crossed.push(key);
    }
    state.records.councilRelations = now;
    if (crossed.length) latch(state, { reason: 'hostile', pair: pairFromKey(crossed[0]) });
    return crossed;
  }
  function pairFromKey(key) {
    const raw = String(key).split(':').pop();
    const parts = raw.split('>');
    if (parts.length === 2 && PRIDES.indexOf(parts[0]) >= 0 && PRIDES.indexOf(parts[1]) >= 0) return parts;
    return null;
  }
  function noteFight(state, a, b) {
    const row = latch(state, { reason: 'fight', pair: [a, b] });
    return row;
  }
  function offerEarly(state) {
    scan(state);
    if (!state.records || !state.records.councilLatch) return null;
    if (state.pendingArc) return null;
    if (state.records.lastCouncilSeason === seasonOf(state.day)) return null;
    if (!mayAttend(state)) {
      state.records.lastCouncilSeason = seasonOf(state.day);
      state.records.councilLatch = null;
      return { seated: false, state };
    }
    return open(state);
  }
  return {
    PRIDES, CANDIDATE, HOSTILE, RECOGNISE_ABOVE, acceptChance, seasonOf, mayAttend, recognised,
    open, agenda, strike, keep, breach, resolve, agreements, relation, shift,
    scan, noteFight, offerEarly, latch,
    PER_COUNCIL, LIFETIME, WALK, scenes, ensure, applyPooled, applyChoice, spoken, openScene, bindings
  };
});
