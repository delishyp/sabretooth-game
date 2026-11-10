// AUTHOR PROOF, not a Tracker pass. Seed 3 is an ordinary new game.
// The player chooses the talk. The meeting, traits, needs and consent are not written in.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const PATHS = {
  promise: ['company', 'quiet', 'return_quiet', 'quiet_again', 'listen'],
  nopromise: ['company', 'ask_first', 'respect', 'quiet_again', 'stay'],
  disagree: ['company', 'press', 'dismiss', 'need_words', 'repair']
};
const water = (id, season) => E.W.hasWater(id, season);
function eventChoice(s) {
  if (s.pending.bond && s.pending.choices && s.pending.choices.length) {
    const row = s.pending.choices.find((c) => !c.disabled) || s.pending.choices[0];
    return { type: 'choose', choiceId: row.id };
  }
  if (s.pending.eventId === 'slice.meeting.loner' && s.pending.catId === 'ln05') return { type: 'choose', choiceId: 'greet' };
  const e = E.eventById(s.pending.eventId);
  const choices = (e && e.choices) || [];
  const pass = choices.find((c) => ['pass', 'withdraw', 'leave', 'acknowledge'].includes(c.id)) || choices[0];
  return pass ? { type: 'choose', choiceId: pass.id } : { type: 'continue' };
}
function stepEvent(s, route, cursor) {
  if (s.phase === 'conversation') {
    const v = E.talkView(s);
    if (!v || v.terminal) return { type: 'continue' };
    const want = route[cursor];
    if (want && v.choices.some((c) => c.id === want && !c.disabled)) return { type: 'choose', choiceId: want, nodeId: v.nodeId, instanceId: v.instanceId, advance: true };
    const leave = v.choices.find((c) => (c.id === 'leave' || c.pause) && !c.disabled);
    return leave ? { type: 'choose', choiceId: leave.id, nodeId: v.nodeId, instanceId: v.instanceId } : { type: 'continue' };
  }
  if (s.phase === 'encounter') {
    const v = E.encounterView(s);
    if (!v || v.terminal || !v.choices) return { type: 'continue' };
    const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
    const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
    return c ? { type: 'encounterChoose', choiceId: c.id } : { type: 'continue' };
  }
  if (s.phase === 'ford') return s.ford && s.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' };
  if (s.phase === 'border') {
    const v = E.world.borderView(s);
    const c = v && v.choices && (v.choices.find((x) => x.id === 'withdraw' || x.id === 'leave_request') || v.choices[0]);
    return c ? { type: 'borderChoose', choiceId: c.id } : { type: 'continue' };
  }
  if (s.phase === 'eventResult') return { type: 'continue' };
  if (s.phase === 'event' && s.pending) return eventChoice(s);
  return null;
}
function dayAction(s) {
  const av = E.available(s);
  if (!av || av.phase) return null;
  if (av.forced) return { type: 'forced' };
  const talk = (av.talk || []).find((t) => t.catId === 'ln05' && t.allowed);
  if (talk) return { type: 'talk', catId: 'ln05' };
  if (s.needs.thirst < 45 && !water(s.region, s.season)) {
    const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && water(t.to, s.season));
    if (to) return { type: 'travel', to: to.to };
  }
  if (s.region !== 'split_rock' && s.needs.thirst >= 50 && s.needs.energy >= 15) {
    const back = (av.travel || []).find((t) => t.allowed && t.to === 'split_rock');
    if (back) return { type: 'travel', to: 'split_rock' };
  }
  if (s.needs.hunger < 50 && av.hunt && av.hunt.allowed && s.needs.energy >= 30) return { type: 'hunt', size: 'small' };
  if (s.needs.energy < 35) return { type: 'rest' };
  if (s.needs.hunger < 75 && av.hunt && av.hunt.allowed) return { type: 'hunt', size: 'small' };
  return { type: 'rest' };
}
function play(key) {
  const route = PATHS[key];
  let s = E.newRun({ mainCat: player, seed: 3, runId: `author-${key}` });
  const traits = JSON.parse(JSON.stringify(s.npcs.ln05.personality));
  let cursor = 0;
  const choices = [];
  const days = [];
  for (let i = 0; i < 500 && !s.over && !s.dead && cursor < route.length && s.day < 45; i++) {
    let action = stepEvent(s, route, cursor);
    if (!action) action = dayAction(s);
    const r = E.act(s, action);
    assert.ok(!r.error, r.error);
    s = r.state;
    if (action.advance) {
      cursor += 1;
      choices.push({ id: action.choiceId, day: s.day, affinity: s.npcs.ln05.affinity });
      const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
      assert.strictEqual(loaded.npcs.ln05.affinity, s.npcs.ln05.affinity);
      assert.strictEqual(loaded.conversation.ledger.length, s.conversation.ledger.length);
      s = loaded;
    }
  }
  const keys = s.conversation.ledger.map((row) => row.key);
  assert.strictEqual(new Set(keys).size, keys.length);
  return { s, traits, choices, days: choices.map((c) => c.day) };
}

test('AUTHOR PROOF ordinary seed 3: return_quiet keeps one promise and reaches confiding', () => {
  const { s, traits, choices } = play('promise');
  assert.strictEqual(s.npcs.ln05.name, 'Foglight');
  assert.deepStrictEqual(s.npcs.ln05.personality, traits);
  assert.deepStrictEqual(choices.map((c) => c.id), PATHS.promise);
  assert.deepStrictEqual(choices.map((c) => c.day), [6, 6, 6, 8, 11]);
  assert.strictEqual(s.conversation.cats.ln05.initialOutcome, 'quiet_company');
  assert.strictEqual(s.conversation.cats.ln05.followupOutcome, 'quiet_renewed');
  assert.strictEqual(s.conversation.cats.ln05.thirdOutcome, 'third_confide_listen');
  const held = s.conversation.cats.ln05.facts.filter((f) => f.promiseId === 'return_quiet');
  assert.strictEqual(held.length, 1);
  assert.strictEqual(held[0].promise, 'kept');
  assert.strictEqual(held[0].sourceChoiceKey, 'quiet_walk/return_quiet');
  assert.strictEqual(s.npcs.ln05.affinity, 15);
  assert.strictEqual(s.conversation.ledger.filter((row) => row.promiseApplied).length, 1);
});

test('AUTHOR PROOF ordinary seed 3: space then respect is quiet company without a promise or confiding', () => {
  const { s, choices } = play('nopromise');
  assert.deepStrictEqual(choices.map((c) => c.id), PATHS.nopromise);
  assert.strictEqual(s.conversation.cats.ln05.initialOutcome, 'quiet_company');
  assert.strictEqual(s.conversation.cats.ln05.thirdOutcome, 'third_neutral_stay');
  assert.ok(!(s.conversation.cats.ln05.facts || []).some((f) => f.promiseId === 'return_quiet'));
  assert.strictEqual(s.conversation.ledger.filter((row) => row.promiseApplied).length, 0);
  assert.strictEqual(s.npcs.ln05.affinity, 10);
  assert.notStrictEqual(s.conversation.cats.ln05.thirdOutcome, 'third_confide_listen');
});

test('AUTHOR PROOF ordinary seed 3: the boundary path reaches repair and does not keep a promise', () => {
  const { s, choices } = play('disagree');
  assert.deepStrictEqual(choices.map((c) => c.id), PATHS.disagree);
  assert.strictEqual(s.conversation.cats.ln05.initialOutcome, 'dismissed_boundary');
  assert.strictEqual(s.conversation.cats.ln05.followupOutcome, 'boundary_difference');
  assert.strictEqual(s.conversation.cats.ln05.thirdOutcome, 'third_repair_offer');
  assert.ok(!(s.conversation.cats.ln05.facts || []).some((f) => f.promise === 'kept'));
  assert.strictEqual(s.npcs.ln05.affinity, -10);
});
