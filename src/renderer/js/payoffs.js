/**
 * Choice payoffs v0.2. Saga's lines, once each, at the next meeting.
 * Bands use Beats.visible, the same low / baseline / high helper as scene beats.
 * No affinity changes. {sourceName} is the cat who passed the fact on.
 */
(function (root, factory) {
  const api = factory(load(), beats());
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Payoffs = api;
  function load() {
    if (typeof require === 'function') {
      try { return require('../data/events/payoffs-v0.2.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/payoffs-v0.2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy */ }
    }
    return {};
  }
  function beats() {
    if (typeof require === 'function') {
      try { return require('./beats'); } catch (e) { /* browser */ }
    }
    return typeof self !== 'undefined' ? self.Beats : null;
  }
})(typeof self !== 'undefined' ? self : this, function (data, Beats) {
  const KEYS = [
    '1.3_knows_name_opener',
    '1.4_pridemate_heard_opener',
    '1.5_still_alone',
    '1.5_seeking_company_gossip_opener',
    '2.1_rendezvous',
    '2.2_you_came',
    '2.3_i_waited',
    '3.3_ate_whole_thing'
  ];
  const PRIDES = { highcrag: true, bonefield: true, mistwood: true };

  function fill(text, vars) {
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : m));
  }
  function varsFor(s, npc, extra) {
    return Object.assign({
      catName: npc && npc.name || '',
      playerName: s && s.cat && s.cat.name || '',
      zoneName: '',
      sourceName: ''
    }, extra || {});
  }
  function oneLine(rows, npc, vars) {
    const beats = (Array.isArray(rows) ? rows : []).map((row) => ({ kind: 'speech', text: row.text, when: row.when }));
    const shown = Beats && Beats.visible ? Beats.visible(beats, { npc, player: {} }) : [];
    if (shown.length !== 1) return '';
    return fill(shown[0].text, vars);
  }
  function queue(s) {
    if (!s.records) s.records = {};
    if (!Array.isArray(s.records.payoffQueue)) s.records.payoffQueue = [];
    return s.records.payoffQueue;
  }
  function knowledge(s) { return (s.worldMemory && s.worldMemory.knowledge) || {}; }
  function remember(s, factId, npc, kind) {
    if (!s.worldMemory || !factId || !npc) return;
    if (!Array.isArray(s.worldMemory.facts)) s.worldMemory.facts = [];
    if (!s.worldMemory.knowledge) s.worldMemory.knowledge = {};
    if (s.worldMemory.facts.some((row) => row.factId === factId)) return;
    s.worldMemory.facts.push({ factId, kind: kind || 'payoff', participants: ['player', npc.id] });
    const pride = PRIDES[npc.faction] ? npc.faction : null;
    s.worldMemory.knowledge[factId] = {
      scope: 'witnessed', participantIds: ['player', npc.id], witnessIds: [npc.id],
      disclosedTo: [], prideIds: [], learnedAbsDay: s.day, sourceId: npc.id,
      rumorPride: pride, rumorDay: pride ? s.day + 3 : null
    };
  }
  function push(s, row) {
    const rows = queue(s);
    if (rows.some((item) => item.id === row.id && item.catId === row.catId && !item.fired)) return;
    rows.push(Object.assign({ fired: false }, row));
  }
  function scene(s, npc, id, line, choices, extra) {
    return {
      payoff: true, lone: true, eventId: `payoff.${id}`, title: npc.name,
      catId: npc.id, catName: npc.name, payoffId: id,
      beats: [{ kind: 'speech', speaker: npc.name, text: line }],
      beatIndex: 0, choices: choices || [], summary: choices && choices.length ? '' : line,
      day: s.day
    };
  }
  function choiceRows(block, npc, vars) {
    return Object.keys(block || {}).map((id) => ({
      id,
      label: fill(block[id].label, vars),
      text: fill(block[id].text, vars)
    }));
  }
  function seekingFact(s) {
    return Object.keys(knowledge(s)).find((id) => id.includes('/player_seeking_company/'));
  }
  function knows(s, npc, factId) {
    const row = knowledge(s)[factId];
    if (!row || !npc) return false;
    return (row.participantIds || []).includes(npc.id) || (row.witnessIds || []).includes(npc.id)
      || (row.disclosedTo || []).includes(npc.id) || (row.prideIds || []).includes(npc.id);
  }
  function sourceName(s, factId, npc) {
    const row = knowledge(s)[factId];
    const id = row && row.sourceId;
    const source = id && s.npcs && s.npcs[id];
    if (!source || !source.name || (npc && source.id === npc.id)) return '';
    return source.name;
  }

  function noteReply(s, npc, choiceId) {
    if (!npc) return;
    if (choiceId === 'introduce') {
      const factId = `${s.runId || ''}/knows_player_name/${npc.id}`;
      remember(s, factId, npc, 'knows_player_name');
      push(s, { id: '1.3', catId: npc.id, factId });
    } else if (choiceId === 'greet') {
      const factId = `${s.runId || ''}/player_said_alone/${npc.id}`;
      remember(s, factId, npc, 'player_said_alone');
      push(s, { id: '1.5', catId: npc.id, factId });
    }
  }
  function noteLetWatch(s, npc) {
    if (!npc) return;
    const factId = `${s.runId || ''}/watched_player_eat/${npc.id}`;
    remember(s, factId, npc, 'watched_player_eat');
    push(s, { id: '3.3', catId: npc.id, factId });
  }
  function attachRendezvous(s, zoneName) {
    if (!s || !s.pending || s.day < 10) return false;
    if (s.records && s.records.rendezvousOffered) return false;
    if (!s.records) s.records = {};
    const block = data['2.1_rendezvous'];
    if (!block) return false;
    s.records.rendezvousOffered = true;
    const vars = { zoneName: zoneName || '', catName: s.pending.catName || '' };
    const base = Array.isArray(s.pending.choices) ? s.pending.choices.slice() : [];
    s.pending.choices = base.concat([
      { id: 'ask_meet', label: fill(block.ask_meet.label, vars) },
      { id: 'say_goodbye', label: block.say_goodbye.label }
    ]);
    s.pending.rendezvousZone = { id: s.region, name: zoneName || '' };
    s.pending.rendezvousCat = s.pending.catId;
    return true;
  }
  function answerRendezvous(s, choiceId) {
    const p = s.pending;
    const npc = p && s.npcs[p.catId];
    const block = data['2.1_rendezvous'];
    const zone = p && p.rendezvousZone || { id: s.region, name: '' };
    const vars = varsFor(s, npc, { zoneName: zone.name });
    if (choiceId === 'ask_meet' && npc) {
      const before = npc.lastRegion;
      npc.lastRegion = zone.id;
      if (!s.records) s.records = {};
      s.records.rendezvous = { catId: npc.id, zoneId: zone.id, zoneName: zone.name, day: s.day + 1, met: false, prevRegion: before };
      p.summary = oneLine(block.ask_meet.text, npc, vars);
    } else if (choiceId === 'say_goodbye') {
      p.summary = fill(block.say_goodbye.text, vars);
    }
    p.choices = [];
    p.resultLine = '';
    s.phase = 'eventResult';
    return { state: s };
  }
  function rendezvousHere(s) {
    const row = s.records && s.records.rendezvous;
    if (!row || row.met || row.day !== s.day || s.region !== row.zoneId) return null;
    const npc = s.npcs && s.npcs[row.catId];
    if (!npc || npc.dead || npc.lastRegion !== s.region) return null;
    return npc;
  }
  function youCame(s, npc) {
    const row = s.records && s.records.rendezvous || {};
    const line = oneLine(data['2.2_you_came'], npc, varsFor(s, npc, { zoneName: row.zoneName || '' }));
    return scene(s, npc, '2.2', line, []);
  }
  function settleRendezvous(s) {
    const row = s.records && s.records.rendezvous;
    if (!row || row.day !== s.day) return;
    const npc = s.npcs && s.npcs[row.catId];
    if (npc && Object.prototype.hasOwnProperty.call(row, 'prevRegion')) npc.lastRegion = row.prevRegion;
    if (!row.met && npc && !npc.dead) push(s, { id: '2.3', catId: npc.id, zoneName: row.zoneName || '' });
    delete s.records.rendezvous;
  }
  function markMet(s) {
    if (s.records && s.records.rendezvous) s.records.rendezvous.met = true;
  }
  function due(s, npc) {
    if (!npc || npc.dead) return null;
    const row = queue(s).find((item) => !item.fired && item.catId === npc.id);
    if (row) return openQueued(s, npc, row);
    if (!(s.records && s.records.payoffHeard)) {
      const factId = Object.keys(knowledge(s)).find((id) => id.includes('/knows_player_name/') && knows(s, npc, id) && knowledge(s)[id].sourceId !== npc.id);
      const source = factId && sourceName(s, factId, npc);
      if (factId && source) return openHeard(s, npc, factId, source);
    }
    if (!(s.records && s.records.payoffSeekingHeard)) {
      const factId = seekingFact(s);
      if (factId && knows(s, npc, factId) && knowledge(s)[factId].sourceId !== npc.id) return openSeeking(s, npc);
    }
    return null;
  }
  function openQueued(s, npc, row) {
    const vars = varsFor(s, npc, { zoneName: row.zoneName || '' });
    let built = null;
    if (row.id === '1.3') {
      const line = oneLine(data['1.3_knows_name_opener'], npc, vars);
      built = line ? scene(s, npc, '1.3', line, []) : null;
    } else if (row.id === '1.5') {
      const line = oneLine(data['1.5_still_alone'].opener, npc, vars);
      built = line ? scene(s, npc, '1.5', line, choiceRows(data['1.5_still_alone'].choices, npc, vars)) : null;
    } else if (row.id === '2.3') {
      const line = oneLine(data['2.3_i_waited'].opener, npc, vars);
      built = line ? scene(s, npc, '2.3', line, choiceRows(data['2.3_i_waited'].choices, npc, vars)) : null;
    } else if (row.id === '3.3') {
      const line = oneLine(data['3.3_ate_whole_thing'].opener, npc, vars);
      built = line ? scene(s, npc, '3.3', line, choiceRows(data['3.3_ate_whole_thing'].choices, npc, vars)) : null;
    }
    if (built) row.fired = true;
    return built;
  }
  function openHeard(s, npc, factId, source) {
    const line = oneLine(data['1.4_pridemate_heard_opener'], npc, varsFor(s, npc, { sourceName: source }));
    if (!line) return null;
    if (!s.records) s.records = {};
    s.records.payoffHeard = true;
    return scene(s, npc, '1.4', line, []);
  }
  function openSeeking(s, npc) {
    const line = oneLine(data['1.5_seeking_company_gossip_opener'], npc, varsFor(s, npc));
    if (!line) return null;
    if (!s.records) s.records = {};
    s.records.payoffSeekingHeard = true;
    return scene(s, npc, '1.5b', line, []);
  }
  function priorityIds(s) {
    const ids = queue(s).filter((row) => !row.fired && row.catId).map((row) => row.catId);
    if (!(s.records && s.records.payoffHeard)) {
      Object.keys(s.npcs || {}).forEach((id) => {
        const npc = s.npcs[id];
        const factId = Object.keys(knowledge(s)).find((key) => key.includes('/knows_player_name/') && knows(s, npc, key) && knowledge(s)[key].sourceId !== id);
        if (factId && sourceName(s, factId, npc)) ids.push(id);
      });
    }
    return ids;
  }
  function apply(s, choiceId, hooks) {
    const p = s.pending;
    if (!p || !p.payoff) return { error: 'phase' };
    const npc = s.npcs[p.catId];
    const picked = (p.choices || []).find((row) => row.id === choiceId) || (choiceId === 'continue' || choiceId === 'leave' ? { text: p.summary || '' } : null);
    if (!picked) return { error: 'choice' };
    hooks = hooks || {};
    if (p.payoffId === '1.5' && choiceId === 'not_by_choice' && npc) {
      remember(s, `${s.runId || ''}/player_seeking_company/${npc.id}`, npc, 'player_seeking_company');
    }
    if (p.payoffId === '3.3' && choiceId === 'promise_share' && npc && hooks.promiseShare) hooks.promiseShare(s, npc.id);
    if (p.payoffId === '3.3' && choiceId === 'my_kill' && npc && hooks.refuseShare) hooks.refuseShare(s, npc);
    p.summary = (picked && picked.text) || p.summary || '';
    p.resultLine = '';
    p.choices = [];
    s.phase = 'eventResult';
    return { state: s };
  }
  function lines() { return data; }
  function keys() { return KEYS.slice(); }

  return {
    keys, lines, noteReply, noteLetWatch, attachRendezvous, answerRendezvous,
    rendezvousHere, youCame, settleRendezvous, markMet, due, priorityIds, apply, oneLine, fill
  };
});
