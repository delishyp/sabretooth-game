// Choice payoffs v0.2. Saga's lines, once, with no new numbers.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Payoffs = require('../src/renderer/js/payoffs');
const Beats = require('../src/renderer/js/beats');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const copy = j('events/payoffs-v0.2.json');
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const TOKEN = /\{[a-zA-Z]+\}/;

function run() {
  return E.newRun({ mainCat: player, seed: 8, runId: 'payoff' });
}
function lineOf(rows, npc, vars) {
  const beats = (Array.isArray(rows) ? rows : []).map((row) => ({ kind: 'speech', text: row.text, when: row.when }));
  const shown = Beats.visible(beats, { npc, player: {} });
  assert.strictEqual(shown.length, 1);
  return shown[0].text.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}
function meet(s, npc) {
  const cat = s.npcs[npc.id];
  if (!cat.homeZones || !cat.homeZones.length) cat.homeZones = [s.region];
  s.region = cat.homeZones[0];
  cat.met = true;
  cat.lastRegion = s.region;
  s.records.presenceFirst = { day: s.day, catId: cat.id };
  s.phase = 'day';
  s.pending = null;
  s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/approach/'));
  return E.act(s, { type: 'approach' }).state;
}

test('payoff keys match Saga\'s file, and every band fills without a leftover token', () => {
  const keys = Object.keys(copy).filter((key) => !key.startsWith('_'));
  assert.deepStrictEqual(keys, Payoffs.keys());
  const npc = { id: 'hc02', name: 'Greyfall', sex: 'male', personality: { sociability: 50 } };
  const vars = { catName: 'Greyfall', playerName: 'Ravenmark', zoneName: 'The Ice Wall', sourceName: 'Ashmane' };
  for (const band of [20, 50, 80]) {
    npc.personality.sociability = band;
    for (const rows of [copy['1.3_knows_name_opener'], copy['1.4_pridemate_heard_opener'], copy['1.5_still_alone'].opener, copy['1.5_seeking_company_gossip_opener'], copy['2.2_you_came'], copy['2.3_i_waited'].opener, copy['3.3_ate_whole_thing'].opener, copy['2.1_rendezvous'].ask_meet.text]) {
      const text = lineOf(rows, npc, vars);
      assert.ok(!TOKEN.test(text), text);
      assert.ok(!/\d/.test(text), text);
    }
  }
  const gossip = copy['1.5_seeking_company_gossip_opener'];
  assert.strictEqual(lineOf(gossip, Object.assign({}, npc, { personality: { sociability: 80 } }), {}), gossip[0].text);
  assert.strictEqual(lineOf(gossip, Object.assign({}, npc, { personality: { sociability: 50 } }), {}), gossip[1].text);
  assert.strictEqual(lineOf(gossip, Object.assign({}, npc, { personality: { sociability: 20 } }), {}), gossip[2].text);
  assert.ok(gossip.every((row) => !TOKEN.test(row.text) && !/\d/.test(row.text)));
});

test('giving your name is remembered, and the next meeting uses that name once', () => {
  const s = run();
  const npc = s.npcs.hc01;
  const before = npc.affinity;
  if (npc.homeZones[0]) s.region = npc.homeZones[0];
  s.pending = { eventId: 'slice.meeting.highcrag', catId: npc.id, catName: npc.name, day: s.day, choiceId: null };
  s.phase = 'event';
  const told = E.act(s, { type: 'choose', choiceId: 'introduce' }).state;
  assert.strictEqual(told.npcs.hc01.affinity, before + 5);
  const factId = `${s.runId}/knows_player_name/${npc.id}`;
  assert.strictEqual(told.worldMemory.knowledge[factId].sourceId, npc.id);
  assert.strictEqual(told.worldMemory.knowledge[factId].rumorPride, 'highcrag');
  const again = meet(told, told.npcs.hc01);
  const text = again.pending.beats.map((beat) => beat.text).join('\n');
  assert.ok(text.includes('Ravenmark'), text);
  assert.ok(!TOKEN.test(text), text);
  assert.strictEqual(again.npcs.hc01.affinity, before + 5);
  const third = meet(again, again.npcs.hc01);
  assert.notStrictEqual(third.pending.eventId, 'payoff.1.3');
});

test('Just me asks once, and a pridemate can hear the name', () => {
  const s = run();
  const loner = s.npcs.ln02;
  s.region = loner.homeZones[0];
  s.pending = { eventId: 'slice.meeting.loner', catId: loner.id, catName: loner.name, day: s.day, choiceId: null };
  s.phase = 'event';
  const told = E.act(s, { type: 'choose', choiceId: 'greet' }).state;
  const again = meet(told, loner);
  assert.strictEqual(again.pending.payoffId, '1.5');
  assert.deepStrictEqual(again.pending.choices.map((row) => row.id), ['for_now', 'not_by_choice', 'leave']);
  const affinity = loner.affinity;
  const kept = E.act(again, { type: 'sceneChoose', choiceId: 'not_by_choice' }).state;
  assert.ok(Object.keys(kept.worldMemory.knowledge).some((id) => id.includes('/player_seeking_company/')));
  assert.strictEqual(loner.affinity, affinity);

  const named = run();
  const speaker = named.npcs.hc01;
  const mate = named.npcs.hc02;
  if (speaker.homeZones[0]) named.region = speaker.homeZones[0];
  named.pending = { eventId: 'slice.meeting.highcrag', catId: speaker.id, catName: speaker.name, day: named.day, choiceId: null };
  named.phase = 'event';
  let heard = E.act(named, { type: 'choose', choiceId: 'introduce' }).state;
  heard.day = heard.worldMemory.knowledge[`${heard.runId}/knows_player_name/${speaker.id}`].rumorDay;
  heard.phase = 'day';
  heard.pending = null;
  heard = E.act(heard, { type: 'rest' }).state;
  const spread = heard.worldMemory.knowledge[`${heard.runId}/knows_player_name/${speaker.id}`];
  assert.ok(spread.disclosedTo.includes(mate.id), JSON.stringify(spread.disclosedTo));
  const opener = meet(heard, heard.npcs[mate.id]);
  const text = opener.pending.beats.map((beat) => beat.text).join('\n');
  assert.ok(text.includes(speaker.name), text);
  assert.ok(!text.includes('{sourceName}'), text);
  assert.ok(!text.includes('{catName}'), text);
});

test('from day 10 a repeat meeting can set tomorrow, and missing it opens the wait', () => {
  const s = run();
  s.day = 10;
  const npc = s.npcs.ln01;
  const opened = meet(s, npc);
  assert.ok(opened.pending.choices.some((row) => row.id === 'ask_meet'));
  assert.ok(!TOKEN.test(opened.pending.choices.find((row) => row.id === 'ask_meet').label));
  const affinity = npc.affinity;
  const asked = E.act(opened, { type: 'choose', choiceId: 'ask_meet' }).state;
  assert.strictEqual(npc.affinity, affinity);
  assert.strictEqual(asked.records.rendezvous.day, 11);
  assert.ok(!TOKEN.test(asked.pending.summary), asked.pending.summary);
  asked.phase = 'day';
  asked.pending = null;
  const away = j('map.json').regions.map((row) => row.id).find((id) => id !== asked.records.rendezvous.zoneId);
  const unwind = (state) => {
    let guard = 0;
    while (state.phase !== 'day' && guard++ < 40) {
      if (state.phase === 'eventResult' || state.phase === 'encounter' || state.phase === 'ford' || state.phase === 'border') {
        const next = E.act(state, { type: 'continue' });
        if (next.error) break;
        state = next.state;
        continue;
      }
      if (state.phase !== 'event') break;
      const beats = E.sceneBeats(state);
      if (beats && (state.pending.beatIndex || 0) < beats.length - 1) {
        const next = E.act(state, { type: 'advanceBeat' });
        if (!next.error) { state = next.state; continue; }
      }
      const library = state.pending.eventId && E.eventById(state.pending.eventId);
      const choices = (state.pending.choices && state.pending.choices.length) ? state.pending.choices : ((library && library.choices) || []);
      if (!choices.length) break;
      const next = E.act(state, { type: state.pending.lone || state.pending.payoff ? 'sceneChoose' : 'choose', choiceId: choices[0].id });
      if (next.error) break;
      state = next.state;
    }
    return state;
  };
  let missed = asked;
  missed.region = away;
  missed = unwind(E.act(missed, { type: 'rest' }).state);
  missed.region = away;
  missed = unwind(E.act(missed, { type: 'rest' }).state);
  assert.ok(!missed.records.rendezvous);
  const later = meet(missed, npc);
  assert.strictEqual(later.pending.payoffId, '2.3');
  assert.deepStrictEqual(later.pending.choices.map((row) => row.id), ['explain', 'repair', 'leave']);
  const repaired = E.act(later, { type: 'sceneChoose', choiceId: 'repair' }).state;
  assert.strictEqual(npc.affinity, affinity);
  assert.ok(!TOKEN.test(repaired.pending.summary));
});

test('Let them watch is answered next time, and the promise does not move affinity', () => {
  const s = run();
  const npc = s.npcs.ln02;
  s.region = npc.homeZones[0];
  npc.met = true;
  E.lone.noteKill(s, null);
  s.pending = E.lone.killPresence(s, npc, { ownership: () => ({ state: 'wild' }) });
  s.phase = 'event';
  const affinity = npc.affinity;
  const watched = E.act(s, { type: 'sceneChoose', choiceId: 'let_watch' }).state;
  const next = meet(watched, npc);
  assert.strictEqual(next.pending.payoffId, '3.3');
  const text = next.pending.beats.map((beat) => beat.text).join('\n');
  assert.ok(text.includes('ate the whole thing'), text);
  assert.ok(!TOKEN.test(text), text);
  const promised = E.act(next, { type: 'sceneChoose', choiceId: 'promise_share' }).state;
  assert.ok(E.lone.bringPrey(promised, npc.id));
  assert.strictEqual(npc.affinity, affinity);
  const other = run();
  const cat = other.npcs.ln02;
  other.region = cat.homeZones[0];
  cat.met = true;
  E.lone.noteKill(other, null);
  other.pending = E.lone.killPresence(other, cat, { ownership: () => ({ state: 'wild' }) });
  other.phase = 'event';
  const ate = E.act(other, { type: 'sceneChoose', choiceId: 'let_watch' }).state;
  const follow = meet(ate, cat);
  const mine = E.act(follow, { type: 'sceneChoose', choiceId: 'my_kill' }).state;
  assert.ok(Object.keys(mine.worldMemory.knowledge).some((id) => id.includes('/refused_share/')));
  assert.strictEqual(cat.affinity, ate.npcs.ln02.affinity);
});

test('a seed-8 Ravenmark run reaches day 11 and shows the meeting payoff', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark-day11' });
  const step = (state) => {
    if (state.phase === 'day') return E.act(state, { type: 'rest' });
    if (state.phase === 'eventResult' || state.phase === 'encounter' || state.phase === 'ford' || state.phase === 'border') return E.act(state, { type: 'continue' });
    if (state.phase === 'conversation') {
      const view = E.talkView(state);
      if (view && view.terminal) return E.act(state, { type: 'continue' });
      const choice = view && (view.choices || []).find((row) => row.id === 'leave' && !row.disabled) || (view && (view.choices || []).find((row) => !row.disabled));
      if (!view || !choice) return { error: 'talk' };
      return E.act(state, { type: 'choose', choiceId: choice.id, nodeId: view.nodeId, instanceId: view.instanceId });
    }
    if (state.phase === 'event') {
      const pending = state.pending || {};
      const library = pending.eventId && E.eventById(pending.eventId);
      const choices = (pending.choices && pending.choices.length) ? pending.choices : ((library && library.choices) || []);
      if (state.day >= 10 && choices.some((row) => row.id === 'ask_meet')) return { state, hold: true };
      const beats = E.sceneBeats(state);
      const last = !beats || (pending.beatIndex || 0) >= beats.length - 1;
      if (!last) {
        const advanced = E.act(state, { type: 'advanceBeat' });
        if (!advanced.error) return advanced;
      }
      if (choices.length) {
        const id = choices.find((row) => row.id !== 'ask_meet' && row.id !== 'say_goodbye') || choices[0];
        const kind = pending.lone || pending.payoff ? 'sceneChoose' : 'choose';
        const picked = E.act(state, { type: kind, choiceId: id.id });
        if (!picked.error) return picked;
      }
      return E.act(state, { type: 'continue' });
    }
    return { error: state.phase || 'stuck' };
  };
  let guard = 0;
  while (s.day < 10 && guard++ < 600) {
    const next = step(s);
    if (next.error || next.hold) break;
    s = next.state;
  }
  assert.ok(s.day >= 10, `reached day ${s.day} in phase ${s.phase}`);
  const cat = Object.values(s.npcs).find((npc) => npc && !npc.dead && npc.homeZones && npc.homeZones.length && (npc.stage === 'adult' || npc.stage === 'elder'));
  assert.ok(cat, 'a cat to meet');
  if (!(s.pending && (s.pending.choices || []).some((row) => row.id === 'ask_meet'))) {
    while (s.phase !== 'day' && guard++ < 800) {
      const next = step(s);
      if (next.error || next.hold) break;
      s = next.state;
    }
    s = meet(s, cat);
  }
  assert.ok(s.pending.choices.some((row) => row.id === 'ask_meet'), (s.pending.choices || []).map((row) => row.id).join(','));
  const asked = E.act(s, { type: 'choose', choiceId: 'ask_meet' }).state;
  const zone = asked.records.rendezvous.zoneId;
  let day = asked;
  while (day.day < 11 && guard++ < 900) {
    const next = step(day);
    if (next.error) break;
    if (next.hold) break;
    day = next.state;
  }
  if (day.phase !== 'day') {
    day.phase = 'day';
    day.pending = null;
  }
  day.region = zone;
  day.records.receipts = (day.records.receipts || []).filter((key) => !key.endsWith(`/${day.day}`));
  const came = E.act(day, { type: 'approach' }).state;
  const text = (came.pending.beats || []).map((beat) => beat.text).join('\n') + (came.pending.summary || '');
  assert.ok(text.includes('You came'), text);
  assert.ok(!TOKEN.test(text), text);
  assert.ok(came.day >= 11, `day ${came.day}`);
});
