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
const E = Slice.create({
  map: j('map.json'), rules, events: j('events/slice-1.json'), slots: j('world-slots.json'),
  nameData: j('names/names.json'), looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: graph
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
  assert.strictEqual(s.npcs.hc01.portraitId, null);
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
  assert.strictEqual(E.world.borderGate(s, { guardId: 'hc07' }).branch, 'unknown_policy');
  s.worldMemory.policy['highcrag->bonefield'] = { status: 'defers', permits: null, defers: true };
  assert.strictEqual(E.world.borderGate(s, { guardId: 'hc07' }).branch, 'deferred_no_knowledge');
  s.worldMemory.policy['highcrag->bonefield'] = { status: 'permits' };
  assert.strictEqual(E.world.borderGate(s, { guardId: 'hc07' }).branch, 'permitted');
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
  assert.strictEqual(keptNull.npcs.ln05.portraitId, null);
  assert.strictEqual(keptNull.npcs.ln05.portraitAssignment, 'legacy-null');
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
  assert.deepStrictEqual(ids, ['leave_request', 'withdraw']);
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

test('an engine-supplied deferral changes the border replies only with the guard knowledge, not a private fact', () => {
  let s = E.newRun({ mainCat: cat, seed: 4, runId: 'border-defer' });
  s.worldMemory.policy['highcrag->bonefield'] = { status: 'defers' };
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  assert.deepStrictEqual(E.world.borderView(s).choices.map((c) => c.id), ['ask_reason', 'accept_defer']);
  const factId = 'aid-1';
  s.worldMemory.facts.push({ factId, kind: 'aid' });
  s.worldMemory.knowledge[factId] = { scope: 'private', participantIds: ['player', 'ln05'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  assert.deepStrictEqual(E.world.borderView(s).choices.map((c) => c.id), ['ask_reason', 'accept_defer']);
  E.world.disclose(s, { factId, toId: 'hc07', sourceEventId: 'told-the-guard' });
  assert.strictEqual(E.world.knowsFact(s, 'highcrag', factId), false);
  assert.ok(E.world.borderView(s).choices.some((c) => c.id === 'explain_known_aid'));
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
});

test('trait profiles change the authored line, not the choices, and a missing personality is not a silent baseline', () => {
  const open = (traits) => Speech.resolve(coverage, '/nodes/opening', traits, { catName: 'Coppergale' });
  const high = open({ aggression: 10, sociability: 80, boldness: 50, loyalty: 50, curiosity: 50 });
  const low = open({ aggression: 10, sociability: 20, boldness: 50, loyalty: 50, curiosity: 50 });
  const mid = open({ aggression: 90, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 });
  assert.notStrictEqual(high.text, low.text);
  assert.ok(high.text.includes('Would you walk with me'));
  assert.strictEqual(mid.text, coverage.speechLocations['/nodes/opening'].base);
  assert.ok(mid.action.includes('holds their place'));
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
