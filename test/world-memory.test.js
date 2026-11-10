const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Speech = require('../src/renderer/js/speech');
const Personality = require('../src/renderer/js/personality');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const rules = j('slice-rules.json');
const graph = j('events/recurring-conversation.json');
const producer = j('events/faction-proof-reconciled.json');
const E = Slice.create({
  map: j('map.json'), rules, events: j('events/slice-1.json'), slots: j('world-slots.json'),
  nameData: j('names/names.json'), looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: graph, borderPolicy: producer, encounters: j('events/encounters-v0.2.json')
});
const cat = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: { coat: 'D/D' }, portraitId: 'cat-6e2d788dd48ff440' };
const coverage = graph.personalityCoverage;

test('new-game personalities use kin order and do not store the ln05 lean', () => {
  const a = Personality.roll(4); const b = Personality.roll(4);
  assert.deepStrictEqual(a.byId.ln05.personality, b.byId.ln05.personality);
  assert.strictEqual(a.byId.ln05.source.method, 'world-gen-5.2-kin');
  assert.strictEqual(a.byId.ln05.source.sire, 'off_bf_sire');
  assert.ok(a.order.indexOf('off_bf_sire') < a.order.indexOf('ln05'));
  assert.ok(a.order.indexOf('hc01') < a.order.indexOf('off_bf_sire'));
  assert.notDeepStrictEqual(a.byId.ln05.personality, { aggression: 30, sociability: 75, boldness: 55, loyalty: 35, curiosity: 75 });
  assert.notDeepStrictEqual(a.byId.ln05.personality, a.byId.hc01.personality);
  const s = E.newRun({ mainCat: cat, seed: 4 });
  assert.deepStrictEqual(s.npcs.ln05.personality, a.byId.ln05.personality);
  assert.strictEqual(s.npcs.ln05.name, 'Bitterwatch');
  assert.strictEqual(s.npcs.ln05.portraitId, 'cat-6e2d788dd48ff440');
  assert.strictEqual(s.npcs.ln05.portraitAssignment, 'presentation-proof-v1');
  assert.strictEqual(s.npcs.hc01.portraitId, 'cat-3f9fb78fb1697a76');
  assert.notStrictEqual(s.npcs.hc01.name, 'Ashmane');
  assert.strictEqual(s.npcs.ln05.affinity, 0);
});

test('old saves do not receive a new personality, and affinity stays 1:1', () => {
  const s = E.newRun({ mainCat: cat, seed: 4 });
  delete s.npcs.ln05.personality; delete s.npcs.hc01.personality;
  s.npcs.ln04.personality = { aggression: 10, sociability: 20, boldness: 30, loyalty: 40, curiosity: 50 };
  s.npcs.ln05.portraitId = 'cat-6e2d788dd48ff440';
  s.npcs.ln05.affinity = 0; s.npcs.hc01.affinity = 40; s.npcs.bf01.affinity = -100; s.npcs.mw01.affinity = 100;
  s.prideRelation.highcrag = -5;
  delete s.worldMemory;
  const once = E.migrate(s);
  assert.strictEqual(once.npcs.ln05.personality, null);
  assert.strictEqual(once.npcs.ln05.personalityGap.status, 'unresolved');
  assert.strictEqual(once.npcs.ln05.personalityGap.recoverable, false);
  assert.deepStrictEqual(once.npcs.ln04.personality, s.npcs.ln04.personality);
  assert.strictEqual(once.npcs.ln05.portraitId, 'cat-6e2d788dd48ff440');
  assert.strictEqual(once.npcs.ln05.affinity, 0);
  assert.strictEqual(once.npcs.hc01.affinity, 40);
  assert.strictEqual(once.worldMemory.catToPlayer['ln05->player'].value, 0);
  assert.strictEqual(once.worldMemory.catToPlayer['hc01->player'].value, 40);
  assert.strictEqual(once.worldMemory.catToPlayer['bf01->player'].value, -100);
  assert.strictEqual(once.worldMemory.catToPlayer['mw01->player'].value, 100);
  assert.strictEqual(once.worldMemory.prideToPlayer['highcrag->player'].value, -5);
  assert.strictEqual(once.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
  assert.strictEqual(once.worldMemory.prideToPride['bonefield->highcrag'].value, 0);
  assert.notStrictEqual(once.worldMemory.catToPlayer['hc01->player'], once.worldMemory.prideToPlayer['highcrag->player']);
  const twice = E.migrate(JSON.parse(JSON.stringify(once)));
  assert.strictEqual(twice.worldMemory.ledger.filter((e) => e.sourceType === 'migration').length, once.worldMemory.ledger.filter((e) => e.sourceType === 'migration').length);
  assert.strictEqual(twice.npcs.hc01.affinity, 40);
});

test('personal bands use the Director edges and do not lock rivalry', () => {
  const band = (n) => E.personalBand({ npcs: { a: { affinity: n } } }, 'a').id;
  assert.strictEqual(band(-100), 'permanent_rival');
  assert.strictEqual(band(-80), 'hated');
  assert.strictEqual(band(-79), 'despised');
  assert.strictEqual(band(-60), 'despised');
  assert.strictEqual(band(-30), 'disliked');
  assert.strictEqual(band(-15), 'eyesore');
  assert.strictEqual(band(-14), 'neutral');
  assert.strictEqual(band(0), 'neutral');
  assert.strictEqual(band(14), 'neutral');
  assert.strictEqual(band(15), 'welcome');
  assert.strictEqual(band(50), 'liked');
  assert.strictEqual(band(60), 'close_friend');
  assert.strictEqual(band(100), 'unbreakable');
  assert.strictEqual(E.personalBand({ npcs: { a: { affinity: -100 } } }, 'a').locksMechanics, false);
});

test('spillover needs provenance, rounds half away from zero, and writes one capped row', () => {
  assert.strictEqual(E.world.roundHalfAway(2.5), 3);
  assert.strictEqual(E.world.roundHalfAway(-2.5), -3);
  assert.strictEqual(E.world.roundHalfAway(-1.4), -1);
  const s = E.newRun({ mainCat: cat, seed: 3, runId: 'run' });
  s.npcs.hc01.affinity = 0;
  const factId = 'fact-aid';
  s.worldMemory.facts.push({ factId, kind: 'aid' });
  s.worldMemory.knowledge[factId] = { scope: 'private', participantIds: ['player', 'ln05'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  const priv = E.world.spillover(s, { catId: 'hc01', personalDelta: 10, sourceReceipt: 'src', factId });
  assert.strictEqual(priv.applied, false);
  assert.strictEqual(priv.reason, 'no-provenance');
  assert.strictEqual(s.prideRelation.highcrag, 0);
  E.world.witness(s, { factId, witnessIds: ['hc07', 'hc02'] });
  const once = E.world.spillover(s, { catId: 'hc01', personalDelta: 10, sourceReceipt: 'src', factId });
  assert.strictEqual(once.applied, true);
  assert.strictEqual(once.delta, 5);
  const again = E.world.spillover(s, { catId: 'hc01', personalDelta: 10, sourceReceipt: 'src', factId });
  assert.strictEqual(again.reason, 'duplicate');
  assert.strictEqual(s.worldMemory.ledger.filter((e) => e.sourceType === 'spillover').length, 1);
  assert.strictEqual(s.prideRelation.highcrag, 5);
  const zero = E.newRun({ mainCat: cat, seed: 3, runId: 'run2' });
  zero.worldMemory.knowledge.f = { scope: 'witnessed', participantIds: [], witnessIds: ['hc07'], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  zero.worldMemory.facts.push({ factId: 'f' });
  const none = E.world.spillover(zero, { catId: 'hc07', personalDelta: 1, sourceReceipt: 'tiny', factId: 'f' });
  assert.strictEqual(none.applied, false);
  assert.strictEqual(zero.worldMemory.ledger.some((e) => e.sourceType === 'spillover'), false);
});

test('private ln05 talk is unknown to other cats and prides, and the border gate ignores warmth and the reverse edge', () => {
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'border' });
  s.npcs.ln05.met = true;
  s.phase = 'event';
  s.pending = { eventId: 'slice.meeting.loner', kind: 'first_meeting', catId: 'ln05', catName: s.npcs.ln05.name, day: s.day, hostile: false, choiceId: null };
  s = E.act(s, { type: 'choose', choiceId: 'greet' }).state;
  const view = E.talkView(s);
  s = E.act(s, { type: 'choose', choiceId: 'company', nodeId: view.nodeId, instanceId: view.instanceId }).state;
  assert.strictEqual(s.prideRelation.bonefield, 0);
  const fact = s.conversation.cats.ln05.facts[0];
  if (fact) {
    assert.strictEqual(E.world.knowsFact(s, 'bonefield', fact.factId), false);
    assert.strictEqual(E.world.knowsFact(s, 'ln04', fact.factId), false);
    assert.strictEqual(E.world.knowsFact(s, 'ln05', fact.factId), true);
  }
  s.npcs.hc07.affinity = 80;
  s.worldMemory.prideToPride['bonefield->highcrag'].value = -80;
  s.worldMemory.prideToPride['highcrag->bonefield'].value = -20;
  s.worldMemory.prideToPlayer['highcrag->player'].value = -15;
  s.worldMemory.policy['highcrag->bonefield'] = { status: 'defers', source: 'tundra-12.6.6' };
  assert.strictEqual(E.world.borderGate(s, { guardId: 'hc07' }).branch, 'unknown_policy');
  s.worldMemory.policy['highcrag->bonefield'] = { status: 'permits', source: 'saga-curiosity' };
  assert.strictEqual(E.world.borderGate(s, { guardId: 'hc07' }).branch, 'unknown_policy');
  assert.strictEqual(typeof s.npcs.hc01.personality.curiosity, 'number');
  assert.deepStrictEqual(E.world.councilStatus(s).councils, []);
  assert.strictEqual(E.world.councilStatus(s).leaders.find((l) => l.catId === 'hc01').name, s.npcs.hc01.name);
});

test('a cleared or stored-null ln05 portrait stays empty, and a missing field is filled once', () => {
  const cleared = E.newRun({ mainCat: cat, seed: 2 });
  cleared.npcs.ln05.portraitId = null;
  cleared.npcs.ln05.portraitAssignment = 'cleared';
  assert.strictEqual(E.migrate(JSON.parse(JSON.stringify(cleared))).npcs.ln05.portraitId, null);
  const legacy = E.newRun({ mainCat: cat, seed: 2 });
  legacy.npcs.ln05.portraitId = null;
  delete legacy.npcs.ln05.portraitAssignment;
  delete legacy.npcs.ln05.portraitGap;
  const keptNull = E.migrate(JSON.parse(JSON.stringify(legacy)));
  assert.strictEqual(keptNull.npcs.ln05.portraitId, 'cat-6e2d788dd48ff440');
  assert.strictEqual(keptNull.npcs.ln05.name, legacy.npcs.ln05.name);
  const other = E.newRun({ mainCat: cat, seed: 2 });
  other.npcs.ln05.portraitId = 'cat-6477d01534355420';
  other.npcs.ln05.portraitAssignment = 'stored';
  assert.strictEqual(E.migrate(JSON.parse(JSON.stringify(other))).npcs.ln05.portraitId, 'cat-6477d01534355420');
  const missing = E.newRun({ mainCat: cat, seed: 2 });
  delete missing.npcs.ln05.portraitId;
  delete missing.npcs.ln05.portraitAssignment;
  assert.strictEqual(E.migrate(missing).npcs.ln05.portraitId, 'cat-6e2d788dd48ff440');
  assert.strictEqual(E.migrate(JSON.parse(JSON.stringify(missing))).npcs.ln05.portraitId, 'cat-6e2d788dd48ff440');
});

test('two runtime cats keep their own saved traits; the border scene does not borrow ln05 lines', () => {
  let found = null;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const s = E.newRun({ mainCat: cat, seed });
    const ln = Speech.resolve(coverage, '/nodes/opening', s.npcs.ln05.personality, { catName: s.npcs.ln05.name });
    const guard = Speech.resolve(coverage, '/nodes/opening', s.npcs.hc07.personality, { catName: s.npcs.hc07.name });
    if (ln.text !== guard.text) found = { seed, ln, guard };
  }
  assert.ok(found, 'two rolled cats should differ on the authored opening line');
  const s = E.newRun({ mainCat: cat, seed: found.seed });
  assert.notDeepStrictEqual(s.npcs.ln05.personality, s.npcs.hc07.personality);
  assert.strictEqual(coverage.id, 'ln05.personality_coverage.v1');
  s.npcs.ln05.met = true;
  const talked = E.act(s, { type: 'talk', catId: 'ln05' }).state;
  const say = E.talkView(talked).lines.find((l) => l.kind === 'say');
  assert.strictEqual(say.text, found.ln.text);
  const refused = E.act(E.newRun({ mainCat: cat, seed: found.seed }), { type: 'talk', catId: 'hc07' });
  assert.strictEqual(refused.error, 'cat');
  let border = E.newRun({ mainCat: cat, seed: found.seed });
  border = E.act(border, { type: 'border' }).state;
  const view = E.world.borderView(border);
  assert.strictEqual(view.traitSpeech, 'unauthored');
  assert.strictEqual(view.title, graph.factionStoryConsumer.opening.B);
  assert.notStrictEqual(view.title, found.guard.text);
  assert.deepStrictEqual(border.border.guardPersonality, border.npcs.hc07.personality);
});

test('border introduction is reachable at Split Rock, stays unknown without a feud, and reloads the same choices', () => {
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'border-play' });
  assert.strictEqual(s.region, 'split_rock');
  assert.strictEqual(E.available(s).border.guardId, 'hc07');
  s = E.act(s, { type: 'border' }).state;
  assert.ok(E.world.borderView(s).choices.some((c) => c.id === 'request_introduction'));
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  const ids = E.world.borderView(s).choices.map((c) => c.id);
  assert.deepStrictEqual(ids, ['leave_request', 'withdraw', 'ask_unrelated', 'request_policy_review']);
  const spoken = E.world.borderView(s).lines.find((l) => l.kind === 'say');
  assert.strictEqual(spoken.text, Speech.resolve({ speechLocations: producer.policy.personalityCoverage.speechLocations, contextActions: graph.personalityCoverage.contextActions }, 'guard_unknown', s.npcs.hc07.personality, { catName: s.npcs.hc07.name }).text);
  s.npcs.hc07.affinity = 90;
  s.worldMemory.prideToPride['bonefield->highcrag'].value = -80;
  assert.deepStrictEqual(E.world.borderView(s).choices.map((c) => c.id), ids);
  const reloaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(E.world.borderView(reloaded).choices.map((c) => c.id), ids);
  const done = E.act(reloaded, { type: 'borderChoose', choiceId: 'leave_request' }).state;
  assert.strictEqual(E.act(done, { type: 'borderChoose', choiceId: 'leave_request' }).error, 'duplicate');
  assert.strictEqual(done.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
  assert.strictEqual(done.worldMemory.prideToPride['bonefield->highcrag'].value, -80);
  assert.strictEqual(done.worldMemory.ledger.filter((e) => String(e.receiptKey).includes('/border/')).length, 2);
});

test('a review request does not write policy or teach the leader; only an actual relay does', () => {
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'border-review' });
  const privateFact = 'ln05-private';
  s.worldMemory.facts.push({ factId: privateFact, kind: 'talk' });
  s.worldMemory.knowledge[privateFact] = { scope: 'private', participantIds: ['player', 'ln05'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  const gate = JSON.parse(JSON.stringify(s));
  const variant = s.border.presentation.variantId;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_policy_review' }).state;
  assert.strictEqual(s.border.outcome, 'review_requested');
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].source, 'unreconciled');
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
  assert.strictEqual(s.worldMemory.prideToPride['bonefield->highcrag'].value, 0);
  const petition = s.worldMemory.reviews[0].factId;
  assert.strictEqual(E.world.knowsFact(s, 'hc01', petition), false);
  assert.strictEqual(E.world.knowsFact(s, 'hc07', petition), true);
  assert.strictEqual(E.world.knowsFact(s, 'hc01', privateFact), false);
  let rested = E.act(s, { type: 'continue' }).state;
  assert.strictEqual(rested.worldMemory.reviews[0].status, 'pending');
  for (let i = 0; i < 8 && rested.worldMemory.reviews[0].status === 'pending'; i++) {
    if (rested.phase === 'event') rested = E.act(rested, { type: 'choose', choiceId: E.eventById(rested.pending.eventId).choices[0].id }).state;
    else if (rested.phase === 'eventResult') rested = E.act(rested, { type: 'continue' }).state;
    else rested = E.act(rested, { type: 'rest' }).state;
  }
  assert.strictEqual(rested.worldMemory.reviews[0].status, 'relayed');
  assert.strictEqual(E.world.knowsFact(rested, 'hc01', petition), true);
  assert.strictEqual(E.world.knowsFact(rested, 'hc01', privateFact), false);
  assert.strictEqual(E.world.knowsFact(rested, 'highcrag', petition), false);
  assert.strictEqual(E.world.relayPetition(rested).reason, 'duplicate');
  assert.strictEqual(rested.worldMemory.policy['highcrag->bonefield'].source, 'unreconciled');
  assert.strictEqual(rested.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
  const reloaded = E.migrate(gate);
  assert.strictEqual(reloaded.border.presentation.variantId, variant);
  assert.deepStrictEqual(E.world.borderView(reloaded).choices.map((c) => c.id), ['leave_request', 'withdraw', 'ask_unrelated', 'request_policy_review']);
});

function toDay(s) {
  let cur = s;
  for (let i = 0; i < 12 && cur.phase !== 'day' && cur.phase !== 'ford' && !cur.over; i++) {
    if (cur.phase === 'encounter') {
      const v = E.encounterView(cur);
      if (!v || v.terminal) cur = E.act(cur, { type: 'continue' }).state;
      else {
        const ids = ['give_ground', 'leave', 'break_off', 'retreat', 'yield_kill', 'finish', 'withdraw'];
        const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
        cur = E.act(cur, { type: 'encounterChoose', choiceId: c.id }).state;
      }
    } else if (cur.phase === 'event') {
      const ev = E.eventById(cur.pending.eventId);
      const pass = ev && (ev.choices || []).find((c) => c.id === 'pass');
      cur = E.act(cur, { type: 'choose', choiceId: cur.pending.hostile ? 'flee' : (pass || ev.choices[0]).id }).state;
    } else if (cur.phase === 'conversation') {
      const view = E.talkView(cur);
      const leave = (view.choices || []).find((c) => c.id === 'leave' || c.id === 'pause') || (view.choices || [])[0];
      if (!leave) break;
      cur = E.act(cur, { type: 'choose', choiceId: leave.id, nodeId: view.nodeId, instanceId: view.instanceId }).state;
    } else cur = E.act(cur, { type: 'continue' }).state;
  }
  return cur;
}
function restUntil(s, pred) {
  let cur = s;
  for (let i = 0; i < 10 && !pred(cur); i++) {
    if (cur.phase === 'day') cur = E.act(cur, { type: 'rest' }).state;
    cur = toDay(cur);
  }
  return cur;
}

test('rendered ford opener and the high-aggression Highcrag line match Saga\'s file', () => {
  const voice = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/ford-voice-v1.json'), 'utf8'));
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'ford-voice' });
  s.npcs.hc07.personality = { aggression: 80, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 };
  s = toDay(E.act(s, { type: 'travel', to: 'greywater_ford' }).state);
  assert.strictEqual(s.phase, 'ford');
  assert.strictEqual(s.ford.hcId, 'hc07');
  const hc = s.npcs[s.ford.hcId];
  const bf = s.npcs[s.ford.bfId];
  const narration = s.ford.lines.find((l) => l.kind === 'narration').text;
  const expected = voice.openingNarration.replaceAll('{highcragCatName}', hc.name).replaceAll('{bonefieldCatName}', bf.name);
  assert.strictEqual(narration, expected);
  assert.strictEqual(narration.includes('{'), false);
  const spoken = s.ford.lines.find((l) => l.kind === 'say' && l.speaker === hc.name);
  assert.strictEqual(spoken.variantId, 'highcrag_open#high');
  assert.strictEqual(spoken.text, voice.speechLocations.highcrag_open.high);
});

test('ordinary play records both ford edges once, then a witnessed relay makes the leader defer', () => {
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'defer-play' });
  const portrait = s.npcs.ln05.portraitId;
  s = toDay(E.act(s, { type: 'travel', to: 'greywater_ford' }).state);
  assert.strictEqual(s.phase, 'ford');
  assert.strictEqual(s.ford.hcId, 'hc07');
  assert.strictEqual(s.ford.bfId, 'bf01');
  assert.notDeepStrictEqual(s.npcs.hc07.personality, s.npcs.bf01.personality);
  const hcSpoken = s.ford.lines.find((l) => l.kind === 'say' && l.speaker === s.npcs.hc07.name);
  const bfSpoken = s.ford.lines.find((l) => l.kind === 'say' && l.speaker === s.npcs.bf01.name);
  const locs = producer.fordStory.speechLocations;
  const actions = graph.personalityCoverage.contextActions;
  assert.strictEqual(hcSpoken.text, Speech.resolve({ speechLocations: locs, contextActions: actions }, 'highcrag_open', s.npcs.hc07.personality, { catName: s.npcs.hc07.name }).text);
  assert.strictEqual(bfSpoken.text, Speech.resolve({ speechLocations: locs, contextActions: actions }, 'bonefield_answer', s.npcs.bf01.personality, { catName: s.npcs.bf01.name }).text);
  const feud = `${s.runId}/ford_dispute/highcrag/bonefield`;
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, -20);
  assert.strictEqual(s.worldMemory.prideToPride['bonefield->highcrag'].value, -10);
  assert.strictEqual(E.world.knowsFact(s, 'hc01', feud), false);
  assert.strictEqual(E.world.knowsFact(s, 'hc07', feud), true);
  s = E.act(s, { type: 'fordChoose', choiceId: 'stay_out' }).state;
  assert.strictEqual(E.act(s, { type: 'fordChoose', choiceId: 'stay_out' }).error, 'duplicate');
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, -20);
  assert.strictEqual(s.worldMemory.prideToPride['bonefield->highcrag'].value, -10);
  s = toDay(E.act(E.act(s, { type: 'continue' }).state, { type: 'travel', to: 'split_rock' }).state);
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_policy_review' }).state;
  const petition = s.worldMemory.reviews[0].factId;
  assert.strictEqual(E.world.knowsFact(s, 'hc01', petition), false);
  s = restUntil(E.act(s, { type: 'continue' }).state, (st) => st.worldMemory.reviews[0].status === 'relayed');
  assert.strictEqual(s.worldMemory.reviews[0].status, 'relayed');
  assert.strictEqual(E.world.knowsFact(s, 'hc01', petition), true);
  assert.strictEqual(E.world.knowsFact(s, 'hc01', feud), true);
  s = E.act(s, { type: 'border' }).state;
  assert.strictEqual(s.border.node, 'review');
  assert.strictEqual(s.border.pendingRuling.decision, 'defer_relay');
  assert.strictEqual(s.border.pendingRuling.cause, 'feud');
  const leaderLines = s.border.presentation.lines.filter((l) => l.kind === 'say' && l.speaker === s.npcs.hc01.name);
  assert.strictEqual(leaderLines[leaderLines.length - 1].text, Speech.resolve({ speechLocations: producer.policy.personalityCoverage.speechLocations, contextActions: actions }, 'leader_defer_cause', s.npcs.hc01.personality, { catName: s.npcs.hc01.name }).text);
  const frozen = JSON.parse(JSON.stringify(s.border.pendingRuling));
  s.worldMemory.prideToPride['bonefield->highcrag'].value = -80;
  assert.deepStrictEqual(s.border.pendingRuling, frozen);
  s = E.act(s, { type: 'borderChoose', choiceId: 'accept_ruling' }).state;
  assert.strictEqual(E.act(s, { type: 'borderChoose', choiceId: 'accept_ruling' }).error, 'duplicate');
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].source, 'leader-ruling');
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].decision, 'defer_relay');
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].version, 1);
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, -20);
  assert.strictEqual(s.worldMemory.prideToPlayer['highcrag->player'].value, 0);
  assert.strictEqual(s.npcs.ln05.portraitId, portrait);
  s = E.act(s, { type: 'continue' }).state;
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  assert.deepStrictEqual(E.world.borderView(s).choices.map((c) => c.id).filter((id) => id !== 'ask_unrelated' && id !== 'request_policy_review'), ['ask_reason', 'accept_defer']);
  const unrelated = E.act(s, { type: 'borderChoose', choiceId: 'ask_unrelated' }).state;
  assert.strictEqual(unrelated.border.outcome, 'unrelated_ignored');
  assert.strictEqual(unrelated.worldMemory.policy['highcrag->bonefield'].decision, 'defer_relay');
});

test('a curious leader permits before any feud, and plus-fifteen standing is not reachable from one improve each', () => {
  let permitSeed = null;
  for (let seed = 1; seed <= 60 && permitSeed == null; seed++) {
    const sample = E.newRun({ mainCat: cat, seed, runId: 'scan-' + seed });
    if (sample.npcs.hc01.personality.curiosity >= 50) permitSeed = seed;
  }
  assert.ok(permitSeed, 'no generated leader reached curiosity 50');
  let s = E.newRun({ mainCat: cat, seed: permitSeed, runId: 'permit-play' });
  assert.ok(s.npcs.hc01.personality.curiosity >= 50);
  assert.strictEqual(s.worldMemory.prideToPlayer['highcrag->player'].value, 0);
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_policy_review' }).state;
  s = restUntil(E.act(s, { type: 'continue' }).state, (st) => st.worldMemory.reviews[0].status === 'relayed');
  s = E.act(s, { type: 'border' }).state;
  assert.strictEqual(s.border.pendingRuling.cause, 'curiosity');
  s = E.act(s, { type: 'borderChoose', choiceId: 'accept_ruling' }).state;
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].decision, 'permit_relay');
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
  assert.strictEqual(s.worldMemory.prideToPride['bonefield->highcrag'].value, 0);
  const ceiling = E.newRun({ mainCat: cat, seed: permitSeed, runId: 'ceiling' });
  let total = 0;
  for (const n of Object.values(ceiling.npcs)) {
    if (n.faction !== 'highcrag' || (n.stage !== 'adult' && n.stage !== 'elder')) continue;
    const factId = 'intro-' + n.id;
    ceiling.worldMemory.facts.push({ factId, kind: 'meeting' });
    ceiling.worldMemory.knowledge[factId] = { scope: 'witnessed', participantIds: ['player', n.id], witnessIds: [n.id], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
    const spilled = E.world.spillover(ceiling, { catId: n.id, personalDelta: 5, sourceReceipt: factId, factId });
    if (spilled.applied) total += spilled.delta;
  }
  assert.ok(total < 15, `existing once-each improve spillover tops out at ${total}`);
});

test('trait profiles change the authored line, not the choices, and a missing personality is not a silent baseline', () => {
  const open = (traits) => Speech.resolve(coverage, '/nodes/opening', traits, { catName: 'Coppergale' });
  const high = open({ aggression: 10, sociability: 80, boldness: 50, loyalty: 50, curiosity: 50 });
  const low = open({ aggression: 10, sociability: 20, boldness: 50, loyalty: 50, curiosity: 50 });
  const mid = open({ aggression: 90, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 });
  assert.notStrictEqual(high.text, low.text);
  assert.ok(high.text.includes('Would you walk with me'));
  assert.strictEqual(mid.text, coverage.speechLocations['/nodes/opening'].base);
  assert.ok(mid.action.includes('plants {his} paws') || mid.action.includes('plants her paws') || mid.action.includes('plants his paws'));
  const same = open({ aggression: 90, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 });
  assert.strictEqual(same.variantId, mid.variantId);
  const gap = Speech.resolve(coverage, '/nodes/opening', null, { catName: 'Coppergale' });
  assert.strictEqual(gap.characterization, 'unresolved');
  assert.ok(gap.gap.includes('not on this save'));
  let covered = 0;
  for (const [path, row] of Object.entries(coverage.speechLocations)) {
    const traits = { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50, [row.focusTrait]: 80 };
    const line = Speech.resolve(coverage, path, traits, { catName: 'C' });
    assert.strictEqual(line.text, row.high, path);
    assert.ok(line.action, path);
    covered += 1;
  }
  assert.strictEqual(covered, 76);
});

test('ask_unrelated keeps Bonefield policy and Continue leaves without a second cost', () => {
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'unrelated-exit' });
  const needs = { ...s.needs };
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  const policy = JSON.parse(JSON.stringify(s.worldMemory.policy));
  const edges = {
    hc: s.worldMemory.prideToPride['highcrag->bonefield'].value,
    bf: s.worldMemory.prideToPride['bonefield->highcrag'].value
  };
  const standing = s.worldMemory.prideToPlayer['highcrag->player'].value;
  const slot = s.conversation.slotDay;
  const borderReceipts = s.worldMemory.ledger.filter((row) => String(row.receiptKey).includes('/border/')).length;
  const parkedGate = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(E.world.borderView(parkedGate).choices.some((c) => c.id === 'ask_unrelated'));
  s = E.act(s, { type: 'borderChoose', choiceId: 'ask_unrelated' }).state;
  assert.strictEqual(s.border.node, 'unrelated');
  assert.strictEqual(s.border.outcome, 'unrelated_ignored');
  assert.deepStrictEqual(E.world.borderView(s).choices, []);
  assert.deepStrictEqual(s.worldMemory.policy, policy);
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, edges.hc);
  assert.strictEqual(s.worldMemory.prideToPride['bonefield->highcrag'].value, edges.bf);
  assert.strictEqual(s.worldMemory.prideToPlayer['highcrag->player'].value, standing);
  assert.deepStrictEqual(s.needs, needs);
  assert.strictEqual(s.conversation.slotDay, slot);
  assert.strictEqual(s.worldMemory.ledger.filter((row) => String(row.receiptKey).includes('/border/')).length, borderReceipts + 1);
  assert.strictEqual(E.act(s, { type: 'borderChoose', choiceId: 'ask_unrelated' }).error, 'duplicate');
  const kept = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(kept.border.node, 'unrelated');
  assert.deepStrictEqual(kept.worldMemory.policy, policy);
  assert.strictEqual(kept.worldMemory.ledger.filter((row) => String(row.receiptKey).includes('/border/')).length, borderReceipts + 1);
  const left = E.act(kept, { type: 'continue' }).state;
  assert.strictEqual(left.phase, 'day');
  assert.deepStrictEqual(left.needs, needs);
  assert.strictEqual(left.conversation.slotDay, slot);
  assert.deepStrictEqual(left.worldMemory.policy, policy);
  assert.strictEqual(left.worldMemory.ledger.filter((row) => String(row.receiptKey).includes('/border/')).length, borderReceipts + 1);
  assert.strictEqual(E.act(left, { type: 'continue' }).error, 'action');
});
