// Recurring authored-choice proof: ln05, three meetings, save/continue, exactly-once effects.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const map = j('map.json'); const rules = j('slice-rules.json'); const slots = j('world-slots.json');
const nameData = j('names/names.json'); const events = j('events/slice-1.json');
const graph = j('events/recurring-conversation.json');
const looks = { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] };
const mk = (over = {}) => Slice.create({
  map, rules: over.rules || rules, events, slots, nameData, looks,
  conversation: over.conversation === undefined ? graph : over.conversation
});
const cat = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: { coat: 'D/D' }, portraitId: 'cat-6e2d788dd48ff440' };
const E = mk();

function fresh(seed = 4) {
  const s = E.newRun({ mainCat: cat, seed, runId: 'run-proof' });
  s.npcs.ln05.personality = { aggression: 40, sociability: 55, boldness: 50, loyalty: 50, curiosity: 48 };
  s.npcs.ln05.portraitId = 'cat-stable-ln05';
  return s;
}
const ident = (n) => ({ name: n.name, sex: n.sex, stage: n.stage, look: n.look, portraitId: n.portraitId, personality: n.personality, homeZones: n.homeZones });
function meet(s, catId = 'ln05') {
  s.npcs[catId].met = true;
  s.phase = 'event';
  s.pending = { eventId: 'slice.meeting.loner', kind: 'first_meeting', catId, catName: s.npcs[catId].name, day: s.day, hostile: false, choiceId: null };
  return s;
}
function pick(s, id) {
  assert.strictEqual(s.phase, 'conversation', `expected a talk, phase ${s.phase}`);
  const v = E.talkView(s);
  const choice = v.choices.find((c) => c.id === id);
  assert.ok(choice, `missing choice ${id} at ${v.nodeId}: ${v.choices.map((c) => c.id).join(',')}`);
  const r = E.act(s, { type: 'choose', choiceId: id, nodeId: v.nodeId, instanceId: v.instanceId });
  assert.ok(!r.error, r.error);
  return r.state;
}
function finish(s) {
  if (s.phase === 'conversation' && s.conversation.pending && s.conversation.pending.showingTerminal) {
    const r = E.act(s, { type: 'continue' });
    assert.ok(!r.error, r.error);
    return r.state;
  }
  return s;
}
function talk(s) {
  const r = E.act(s, { type: 'talk', catId: 'ln05' });
  assert.ok(!r.error, `${r.error} on day ${s.day}`);
  return r.state;
}
function roundTrip(s) { return E.migrate(JSON.parse(JSON.stringify(s))); }

test('graph revision 6 is the authored source the engine loads', () => {
  assert.strictEqual(graph.revision, 6);
  assert.strictEqual(Object.keys(graph.personalityCoverage.speechLocations).length, 76);
  assert.strictEqual(graph.id, 'm2.repeat_meeting.conversation');
  assert.ok(graph.nodes.quiet_walk.choices.some((c) => c.id === 'return_quiet' && c.outcome === 'quiet_company'));
  assert.ok(graph.resolvedReceiptCases.length >= 2);
});

test('tunables are the provisional §11.3a defaults and unlisted outcomes are not given a hidden reward', () => {
  assert.deepStrictEqual(
    [rules.conversation.energyCost, rules.conversation.hungerCost, rules.conversation.thirstCost, rules.conversation.catCooldownDays, rules.conversation.absDeltaCap, rules.conversation.promiseKeptDelta],
    [3, 2, 1, 2, 10, 5]
  );
  assert.strictEqual(rules.conversation.outcomeDelta.quiet_company, 5);
  assert.strictEqual(rules.conversation.outcomeDelta.dismissed_boundary, -5);
  assert.strictEqual(rules.conversation.outcomeDelta.third_confide_listen, 0);
  assert.strictEqual(rules.saveVersion, 1);
  assert.strictEqual(rules.seasonDays, 20);
});

test('greet on ln05 enters the arc and does not stack the slice +5; pass and drive stay on the slice', () => {
  const base = fresh();
  const greeted = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  assert.strictEqual(greeted.phase, 'conversation');
  assert.strictEqual(greeted.npcs.ln05.affinity, 0);
  assert.strictEqual(greeted.conversation.pending.greetFolded, true);
  assert.strictEqual(greeted.conversation.pending.nodeId, 'opening');
  assert.deepStrictEqual(ident(greeted.npcs.ln05), ident(base.npcs.ln05));

  const passed = E.act(meet(fresh()), { type: 'choose', choiceId: 'pass' }).state;
  assert.strictEqual(passed.phase, 'eventResult');
  assert.strictEqual(passed.npcs.ln05.affinity, 0);
  assert.strictEqual(passed.conversation.pending, null);

  const driven = E.act(meet(fresh()), { type: 'choose', choiceId: 'drive' }).state;
  assert.strictEqual(driven.npcs.ln05.affinity, -5);
  assert.strictEqual(driven.conversation.pending, null);

  const other = fresh(); other.npcs.ln04.met = true;
  other.phase = 'event';
  other.pending = { eventId: 'slice.meeting.loner', kind: 'first_meeting', catId: 'ln04', catName: other.npcs.ln04.name, day: 1, hostile: false, choiceId: null };
  const otherGreet = E.act(other, { type: 'choose', choiceId: 'greet' }).state;
  assert.strictEqual(otherGreet.phase, 'eventResult');
  assert.strictEqual(otherGreet.npcs.ln04.affinity, 5);
  assert.strictEqual(otherGreet.conversation.pending, null);
});

test('quiet company without a promise and a boundary dismissal are different later talks and third meetings', () => {
  function first(path) {
    let s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
    for (const id of path) s = pick(s, id);
    assert.strictEqual(s.conversation.pending.showingTerminal, true);
    s = finish(s);
    return s;
  }
  const quiet = first(['company', 'quiet', 'no_promise']);
  const pressed = first(['company', 'press', 'dismiss']);
  assert.strictEqual(quiet.conversation.cats.ln05.initialOutcome, 'quiet_no_promise');
  assert.strictEqual(pressed.conversation.cats.ln05.initialOutcome, 'dismissed_boundary');
  assert.strictEqual(quiet.npcs.ln05.affinity, 0);
  assert.strictEqual(pressed.npcs.ln05.affinity, -5);
  assert.ok(!(quiet.conversation.cats.ln05.facts || []).some((f) => f.promise === 'pending'));
  assert.strictEqual(pressed.conversation.cats.ln05.facts.find((f) => f.stanceId === 'dismissed_boundary').insult, true);

  quiet.day = 3; pressed.day = 3;
  let q2 = talk(quiet); let p2 = talk(pressed);
  assert.ok(q2.conversation.pending.nodeId.endsWith('quiet_no_promise'));
  assert.ok(p2.conversation.pending.nodeId.endsWith('dismissed_boundary'));
  const qText = E.talkView(q2).lines.map((l) => l.text).join('\n');
  const pText = E.talkView(p2).lines.map((l) => l.text).join('\n');
  assert.ok(qText.includes('A few more steps together?'));
  assert.ok(pText.includes('Are we going to argue about quiet again?'));
  assert.notStrictEqual(qText, pText);
  assert.ok(E.talkView(q2).choices.some((c) => c.id === 'quiet_again'));
  assert.ok(E.talkView(p2).choices.some((c) => c.id === 'need_words'));
  assert.ok(!E.talkView(q2).choices.some((c) => c.id === 'need_words'));

  q2 = finish(pick(q2, 'talk_today'));
  p2 = finish(pick(p2, 'need_words'));
  assert.strictEqual(q2.conversation.cats.ln05.initialOutcome, 'quiet_no_promise');
  assert.strictEqual(q2.conversation.cats.ln05.followupOutcome, 'quiet_to_talk');
  assert.strictEqual(p2.conversation.cats.ln05.initialOutcome, 'dismissed_boundary');
  assert.strictEqual(p2.conversation.cats.ln05.followupOutcome, 'boundary_difference');
  assert.strictEqual(q2.npcs.ln05.affinity, 0);
  assert.strictEqual(p2.npcs.ln05.affinity, -10);
  const boundary = p2.conversation.cats.ln05.facts.filter((f) => f.topicId === 'boundary');
  assert.strictEqual(boundary.length, 2);
  assert.strictEqual(boundary.find((f) => f.stanceId === 'dismissed_boundary').status, 'superseded');
  assert.strictEqual(boundary.find((f) => f.stanceId === 'boundary_difference').status, 'active');

  q2.day = 5; p2.day = 5;
  const q3 = talk(q2); const p3 = talk(p2);
  assert.strictEqual(q3.conversation.pending.nodeId, 'third:neutral');
  assert.strictEqual(p3.conversation.pending.nodeId, 'third:repair');
  assert.ok(E.talkView(p3).lines.some((l) => l.text.includes('Are you going to listen if I ask for space?')));
  assert.ok(!E.talkView(q3).lines.some((l) => l.text.includes('Are you going to listen if I ask for space?')));
  const qDone = finish(pick(q3, 'stay'));
  const pDone = finish(pick(p3, 'repair'));
  assert.strictEqual(qDone.conversation.cats.ln05.thirdOutcome, 'third_neutral_stay');
  assert.strictEqual(pDone.conversation.cats.ln05.thirdOutcome, 'third_repair_offer');
  assert.strictEqual(qDone.npcs.ln05.affinity, 0);
  assert.strictEqual(pDone.npcs.ln05.affinity, -10);
  assert.deepStrictEqual(ident(qDone.npcs.ln05), ident(fresh().npcs.ln05));
  assert.deepStrictEqual(ident(pDone.npcs.ln05), ident(fresh().npcs.ln05));
  assert.strictEqual(qDone.cat.portraitId, 'cat-6e2d788dd48ff440');
  assert.deepStrictEqual(qDone.cat.genes, { coat: 'D/D' });
});

test('return_quiet is the only quiet promise; a free Leave keeps it pending; a later non-leave keeps it once inside the cap', () => {
  let s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  s = pick(s, 'company'); s = pick(s, 'ask_first'); s = pick(s, 'respect');
  s = finish(s);
  assert.strictEqual(s.conversation.cats.ln05.initialOutcome, 'quiet_company');
  assert.ok(!(s.conversation.cats.ln05.facts.some((f) => f.promise === 'pending')));
  assert.strictEqual(s.npcs.ln05.affinity, 5);

  s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  const beforeNeeds = { ...s.needs };
  s = pick(s, 'company');
  assert.deepStrictEqual(
    [s.needs.energy, s.needs.hunger, s.needs.thirst],
    [beforeNeeds.energy - 3, beforeNeeds.hunger - 2, beforeNeeds.thirst - 1]
  );
  assert.strictEqual(s.conversation.slotDay, s.day);
  s = pick(s, 'quiet');
  assert.strictEqual(s.needs.energy, beforeNeeds.energy - 3);
  s = finish(pick(s, 'return_quiet'));
  const fact = s.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet');
  assert.ok(fact); assert.strictEqual(fact.promise, 'pending');
  assert.strictEqual(fact.sourceChoiceKey, 'quiet_walk/return_quiet');
  assert.strictEqual(s.npcs.ln05.affinity, 5);
  const intro = s.conversation.ledger.find((r) => r.outcome === 'quiet_company');
  assert.strictEqual(intro.greetFolded, true);
  assert.strictEqual(intro.greetDeltaApplied, 0);
  assert.strictEqual(intro.affinityApplied, 5);
  assert.strictEqual(intro.promiseApplied, 0);

  const charged = { ...s.needs };
  const cooldown = s.conversation.cats.ln05.cooldownUntilDay;
  const slot = s.conversation.slotDay;
  s.day = cooldown;
  s = talk(s);
  assert.ok(E.talkView(s).lines.some((l) => l.text.includes('Another quiet walk?')));
  s = finish(pick(s, 'leave'));
  assert.strictEqual(s.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'pending');
  assert.strictEqual(s.npcs.ln05.affinity, 5);
  assert.deepStrictEqual(s.needs, charged);
  assert.strictEqual(s.conversation.slotDay, slot);
  assert.strictEqual(s.conversation.cats.ln05.cooldownUntilDay, cooldown);
  assert.strictEqual(s.conversation.cats.ln05.followupOutcome, null);
  assert.strictEqual(s.day, cooldown);

  s.day = cooldown + 4;
  assert.strictEqual(s.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'pending');
  s = talk(s);
  const needs2 = { ...s.needs };
  s = pick(s, 'quiet_again');
  assert.strictEqual(s.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'kept');
  assert.strictEqual(s.npcs.ln05.affinity, 15);
  assert.strictEqual(s.needs.energy, needs2.energy - 3);
  const row = s.conversation.ledger.find((r) => r.outcome === 'quiet_renewed');
  assert.strictEqual(row.promiseApplied, 5);
  assert.strictEqual(row.affinityApplied, 5);
  assert.strictEqual(row.greetDeltaApplied, 0);
  assert.ok(row.promiseKey.includes(fact.factId));
  const affinityNow = s.npcs.ln05.affinity;
  s = finish(s);
  s = roundTrip(s);
  assert.strictEqual(s.npcs.ln05.affinity, affinityNow);
  const replay = E.act(s, { type: 'continue' });
  assert.ok(replay.error);
  assert.strictEqual(replay.state.npcs.ln05.affinity, affinityNow);
  s.day += 2;
  const third = talk(s);
  assert.strictEqual(third.conversation.pending.nodeId, 'third:confiding');
  assert.ok(E.talkView(third).lines.some((l) => l.text.includes('You came back, and you let the quiet stay quiet')));
  const done = finish(pick(third, 'listen'));
  assert.strictEqual(done.conversation.cats.ln05.thirdOutcome, 'third_confide_listen');
  assert.strictEqual(done.npcs.ln05.affinity, 15);
  assert.strictEqual(done.conversation.cats.ln05.initialOutcome, 'quiet_company');
});

test('the absolute cap clamps promise plus terminal, and a repeated instance can still record its own effect', () => {
  const tight = mk({ rules: { ...rules, conversation: { ...rules.conversation, absDeltaCap: 6 } } });
  let s = tight.newRun({ mainCat: cat, seed: 4, runId: 'cap' });
  s = tight.act(meet(s), { type: 'choose', choiceId: 'greet' }).state;
  s = pickOn(tight, s, 'company'); s = pickOn(tight, s, 'quiet'); s = finishOn(tight, pickOn(tight, s, 'return_quiet'));
  assert.strictEqual(s.npcs.ln05.affinity, 5);
  s.day = 3;
  s = tight.act(s, { type: 'talk', catId: 'ln05' }).state;
  s = pickOn(tight, s, 'quiet_again');
  assert.strictEqual(s.npcs.ln05.affinity, 11);
  const row = s.conversation.ledger.find((r) => r.outcome === 'quiet_renewed');
  assert.strictEqual(row.promiseApplied + row.affinityApplied, 6);
  assert.strictEqual(row.absDelta, 6);
});

function pickOn(engine, s, id) {
  const v = engine.talkView(s);
  const r = engine.act(s, { type: 'choose', choiceId: id, nodeId: v.nodeId, instanceId: v.instanceId });
  assert.ok(!r.error, r.error);
  return r.state;
}
function finishOn(engine, s) { return engine.act(s, { type: 'continue' }).state; }

test('save before a choice keeps it pending; save after keeps one set of consequences', () => {
  let s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  const waiting = roundTrip(s);
  assert.strictEqual(waiting.conversation.pending.nodeId, 'opening');
  assert.strictEqual(waiting.conversation.ledger.length, 0);
  assert.strictEqual(waiting.npcs.ln05.affinity, 0);
  assert.deepStrictEqual(waiting.needs, s.needs);
  s = pick(waiting, 'company');
  const mid = roundTrip(s);
  assert.strictEqual(mid.conversation.pending.nodeId, 'company');
  assert.strictEqual(mid.conversation.pending.slotCharged, true);
  assert.strictEqual(mid.npcs.ln05.affinity, 0);
  const needs = { ...mid.needs };
  s = pick(mid, 'quiet');
  assert.deepStrictEqual(s.needs, needs);
  s = finish(pick(s, 'no_promise'));
  const done = roundTrip(roundTrip(s));
  assert.strictEqual(done.conversation.pending, null);
  assert.strictEqual(done.npcs.ln05.affinity, 0);
  assert.strictEqual(done.conversation.cats.ln05.initialOutcome, 'quiet_no_promise');
  assert.strictEqual(done.conversation.ledger.length, 3);
});

test('double submit, stale choice, reload and a second continue do not repeat cost or affinity', () => {
  let s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  const view = E.talkView(s);
  const action = { type: 'choose', choiceId: 'company', nodeId: view.nodeId, instanceId: view.instanceId };
  const first = E.act(s, action);
  assert.ok(!first.error);
  const second = E.act(first.state, action);
  assert.strictEqual(second.error, 'stale');
  assert.strictEqual(second.state.needs.energy, first.state.needs.energy);
  assert.strictEqual(second.state.npcs.ln05.affinity, 0);
  const rewound = roundTrip(first.state);
  rewound.conversation.pending.nodeId = 'opening';
  rewound.conversation.pending.choicePath = [];
  rewound.phase = 'conversation';
  const dup = E.act(rewound, action);
  assert.strictEqual(dup.error, 'duplicate');
  assert.strictEqual(dup.state.needs.energy, rewound.needs.energy);
  assert.strictEqual(dup.state.conversation.ledger.length, rewound.conversation.ledger.length);
  const stale = E.act(first.state, { type: 'choose', choiceId: 'press', nodeId: 'opening', instanceId: view.instanceId });
  assert.strictEqual(stale.error, 'stale');
  assert.strictEqual(stale.state.conversation.pending.nodeId, 'company');
});

test('pause keeps the node and does not charge again; the main action is still there afterwards', () => {
  let s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  assert.strictEqual(s.conversation.pending.dayResolved, true);
  s = pick(s, 'company');
  const needs = { ...s.needs };
  const day = s.day;
  s = pick(s, 'pause');
  assert.strictEqual(s.phase, 'day');
  assert.strictEqual(s.conversation.pending.nodeId, 'company');
  assert.deepStrictEqual(s.needs, needs);
  assert.strictEqual(E.available(s).talkOnly, true);
  assert.strictEqual(E.act(s, { type: 'hunt', size: 'small' }).error, 'talk');
  s = talk(s);
  assert.strictEqual(s.conversation.pending.nodeId, 'company');
  s = pick(s, 'quiet');
  assert.strictEqual(s.needs.energy, needs.energy);
  s = finish(pick(s, 'no_promise'));
  assert.strictEqual(s.phase, 'day');
  assert.strictEqual(s.day, day);
  assert.strictEqual(E.available(s).hunt.allowed, true);
  const hunted = E.act(s, { type: 'hunt', size: 'small' }).state;
  assert.ok(hunted.day === day || hunted.day === day + 1);
  assert.notStrictEqual(hunted.phase, 'conversation');
});

test('side-slot talk does not spend the day, and cooldown blocks a new talk until D+2', () => {
  let s = fresh(); s.npcs.ln05.met = true; s.npcs.ln05.name = s.npcs.ln05.name;
  assert.ok(E.available(s).talk.some((t) => t.catId === 'ln05' && t.allowed));
  s.region = 'highcrag';
  assert.strictEqual(E.available(s).talk.find((t) => t.catId === 'ln05').reason, 'away');
  assert.strictEqual(E.act(s, { type: 'talk', catId: 'ln05' }).error, 'away');
  s.region = 'split_rock';
  s = talk(s);
  const day = s.day;
  s = pick(s, 'curious'); s = pick(s, 'hunt'); s = finish(pick(s, 'alone'));
  assert.strictEqual(s.day, day);
  assert.strictEqual(s.conversation.cats.ln05.initialOutcome, 'prefers_solo_hunts');
  assert.ok(!s.conversation.cats.ln05.facts.some((f) => f.help || f.topicId === 'share_next_kill'));
  assert.strictEqual(s.conversation.slotDay, day);
  assert.strictEqual(s.conversation.cats.ln05.cooldownUntilDay, day + 2);
  assert.strictEqual(E.available(s).talk.find((t) => t.catId === 'ln05').reason, 'cooldown');
  s.conversation.cats.ln05.cooldownUntilDay = day;
  assert.strictEqual(E.available(s).talk.find((t) => t.catId === 'ln05').reason, 'slot');
  s.conversation.cats.ln05.cooldownUntilDay = day + 2;
  s.day = day + 1;
  assert.strictEqual(E.available(s).talk.find((t) => t.catId === 'ln05').reason, 'cooldown');
  s.day = day + 2;
  assert.strictEqual(E.available(s).talk.find((t) => t.catId === 'ln05').allowed, true);
  const later = talk(s);
  assert.ok(E.talkView(later).lines.some((l) => l.text.includes('Still keeping your hunts to yourself?')));
  assert.ok(!E.talkView(later).lines.some((l) => /share a kill|mate|pride/i.test(l.text)));
});

test('memory does not leak across cats, and a bad or finished history falls back instead of replaying the intro', () => {
  let s = E.act(meet(fresh()), { type: 'choose', choiceId: 'greet' }).state;
  s = finish(pick(pick(pick(s, 'company'), 'press'), 'repair'));
  s.npcs.ln04.met = true; s.npcs.ln04.affinity = 4;
  assert.strictEqual(E.act(s, { type: 'talk', catId: 'ln04' }).error, 'cat');
  assert.strictEqual(s.npcs.ln04.affinity, 4);
  assert.ok(!s.conversation.cats.ln04);
  s.day = 4;
  let thirdReady = talk(s);
  thirdReady = finish(pick(thirdReady, 'respect_no'));
  thirdReady.day = 6;
  const third = finish(pick(talk(thirdReady), 'stay'));
  assert.strictEqual(third.conversation.cats.ln05.thirdOutcome, 'third_neutral_stay');
  third.day = 8;
  const again = talk(third);
  const text = E.talkView(again).lines.map((l) => l.text).join('\n');
  assert.ok(text.includes('Did you want to stop here?') || text.includes(graph.personalityCoverage.speechLocations['/laterMeeting/fallback'].base.replace(/[“”]/g, '')));
  assert.ok(!text.includes('Are you passing through'));
  again.conversation.cats.ln05.revision = 1;
  again.conversation.pending = null; again.phase = 'day';
  const bad = talk(again);
  assert.strictEqual(bad.conversation.pending.nodeId, 'repeat_fallback');
  assert.strictEqual(bad.npcs.ln05.affinity, third.npcs.ln05.affinity);
  const other = fresh();
  assert.ok(!E.talkView(other));
  assert.notStrictEqual(other.npcs.ln04.name, s.npcs.ln05.name);
});

test('a high-aggression saved personality changes only the voice line and survives continue', () => {
  const mid = fresh();
  mid.npcs.ln05.personality = { aggression: 40, sociability: 55, boldness: 50, loyalty: 50, curiosity: 48 };
  const s = E.act(meet(mid), { type: 'choose', choiceId: 'greet' }).state;
  assert.ok(E.talkView(s).lines.some((l) => l.text.includes('Are you passing through')));
  const warm = fresh();
  warm.npcs.ln05.personality = { aggression: 80, sociability: 90, boldness: 10, loyalty: 10, curiosity: 10 };
  const spoken = E.act(meet(warm), { type: 'choose', choiceId: 'greet' }).state;
  const sharp = E.talkView(spoken).lines.map((l) => l.text).join('\n');
  assert.ok(sharp.includes('Would you walk with me'));
  assert.deepStrictEqual(E.talkView(spoken).choices.map((c) => c.id), E.talkView(s).choices.map((c) => c.id));
  spoken.npcs.ln05.affinity = 80;
  const kept = roundTrip(spoken);
  assert.strictEqual(kept.npcs.ln05.personality.sociability, 90);
  assert.ok(E.talkView(kept).lines.some((l) => l.text.includes('Would you walk with me')));
  assert.strictEqual(kept.conversation.pending.presentation.variantIds[0], spoken.conversation.pending.presentation.variantIds[0]);
});

test('old saves gain an empty conversation and still end on day 20; a newer conversation schema is rejected', () => {
  const legacy = E.newRun({ mainCat: cat, seed: 2 });
  delete legacy.conversation;
  const m = E.migrate(legacy);
  assert.strictEqual(m.conversation.schema, 1);
  assert.strictEqual(m.conversation.pending, null);
  assert.strictEqual(m.saveVersion, 1);
  assert.strictEqual(m.day, 1);
  const newer = E.newRun({ mainCat: cat, seed: 2 });
  newer.conversation.schema = 99;
  assert.throws(() => E.migrate(newer), /conversation schema/);
});

test('a full season with the arc loaded still ends at day 20 and does not invent a longer year', () => {
  let s = E.newRun({ mainCat: cat, seed: 9 });
  for (let i = 0; i < 80 && !s.over; i++) {
    let action;
    if (s.phase === 'conversation') {
      const v = E.talkView(s);
      if (v.terminal) action = { type: 'continue' };
      else {
        const leave = v.choices.find((c) => c.id === 'leave' || c.id === 'pause') || v.choices[0];
        action = { type: 'choose', choiceId: leave.id, nodeId: v.nodeId, instanceId: v.instanceId };
      }
    } else if (s.phase === 'event') action = { type: 'choose', choiceId: E.eventById(s.pending.eventId).choices[0].id };
    else if (s.phase === 'eventResult') action = { type: 'continue' };
    else {
      const av = E.available(s);
      action = av.forced ? { type: 'forced' } : { type: 'rest' };
    }
    const r = E.act(s, action);
    assert.ok(!r.error, r.error);
    s = r.state;
  }
  assert.strictEqual(s.over, true);
  assert.ok(s.day <= 20);
  assert.strictEqual(E.summary(s).seasonDays, 20);
  assert.strictEqual(s.saveVersion, 1);
});
