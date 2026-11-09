// Choice follow-ups v0.1. Existing deltas only. Placeholder lines until Saga's prose.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Followups = require('../src/renderer/js/followups');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const rules = j('slice-rules.json');
const E = Slice.create({
  map: j('map.json'), rules, events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const F = Followups.create(rules);

function quiet(seed) {
  const s = E.newRun({ mainCat: player, seed, runId: 'follow' });
  Object.values(s.npcs).forEach((n) => { n.homeZones = []; });
  s.map.claims = Object.fromEntries(Object.keys(s.map.claims).map((id) => [id, {}]));
  s.usedEvents = j('events/slice-1.json').events.map((e) => e.id).filter((id) => id !== 'slice.region.horse_meadows');
  return s;
}
function fact(s, factId, extra) {
  s.worldMemory.facts.push({ factId, kind: 'test' });
  s.worldMemory.knowledge[factId] = Object.assign({
    scope: 'witnessed', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: s.day
  }, extra || {});
}
function arm(s, row) {
  fact(s, row.factId);
  s.followups.push(Object.assign({ fired: false, notBefore: null, expiresDay: null }, row));
}

test('a follow-up fires once, only from a recorded fact, and not for a dead or absent cat', () => {
  const s = quiet(4);
  const cat = s.npcs.ln01;
  cat.met = true; cat.affinity = 0; cat.homeZones = [s.region];
  arm(s, { sourceEventId: 'm2.ford_prey_dispute', choiceId: 'help_bonefield_cat', catId: 'ln01', kind: 'ford_cold', factId: 'aided' });
  let opened = E.act(s, { type: 'talk', catId: 'ln01' }).state;
  assert.strictEqual(opened.pending.eventId, 'followup.m2.ford_prey_dispute.help_bonefield_cat');
  assert.match(opened.pending.beats.map((b) => b.text).join(' '), /The ford/);
  const before = opened.npcs.ln01.affinity;
  opened = E.act(opened, { type: 'choose', choiceId: 'repair' }).state;
  assert.strictEqual(opened.npcs.ln01.affinity, before + 5);
  assert.ok(opened.worldMemory.ledger.some((row) => row.receiptKey === 'follow/followup/m2.ford_prey_dispute/help_bonefield_cat'));
  const again = E.act(opened, { type: 'choose', choiceId: 'repair' });
  assert.strictEqual(again.error, 'duplicate');
  assert.strictEqual(again.state.npcs.ln01.affinity, before + 5);
  const loaded = E.migrate(JSON.parse(JSON.stringify(opened)));
  const replay = E.act(loaded, { type: 'choose', choiceId: 'repair' });
  assert.strictEqual(replay.error, 'duplicate');
  assert.strictEqual(replay.state.npcs.ln01.affinity, before + 5);

  const fresh = quiet(4);
  fresh.npcs.ln01.met = true; fresh.npcs.ln01.homeZones = [fresh.region];
  fresh.followups.push({ sourceEventId: 'm2.ford_prey_dispute', choiceId: 'help_bonefield_cat', catId: 'ln01', kind: 'ford_cold', factId: 'missing', fired: false });
  assert.notStrictEqual(E.act(fresh, { type: 'talk', catId: 'ln01' }).state.pending && E.act(fresh, { type: 'talk', catId: 'ln01' }).state.pending.eventId, 'followup.m2.ford_prey_dispute.help_bonefield_cat');

  const dead = quiet(4);
  dead.npcs.ln01.met = true; dead.npcs.ln01.dead = true; dead.npcs.ln01.homeZones = [dead.region];
  arm(dead, { sourceEventId: 'm2.ford_prey_dispute', choiceId: 'help_bonefield_cat', catId: 'ln01', kind: 'ford_cold', factId: 'aided' });
  assert.strictEqual(F.scene(dead, 'ln01', { present: () => true }), null);

  const gone = quiet(4);
  gone.npcs.ln01.met = true; gone.npcs.ln01.homeZones = [];
  arm(gone, { sourceEventId: 'm2.ford_prey_dispute', choiceId: 'help_bonefield_cat', catId: 'ln01', kind: 'ford_cold', factId: 'aided' });
  assert.strictEqual(F.scene(gone, 'ln01', { present: (npc) => (npc.homeZones || []).includes(gone.region) }), null);
});

test('action 8 tries a cat with an unfired follow-up first, and the approach roll still applies', () => {
  const certain = JSON.parse(JSON.stringify(rules));
  certain.meetings = Object.assign({}, certain.meetings, { lonerHomePct: 100, lonerAdjacentPct: 100 });
  const E100 = Slice.create({
    map: j('map.json'), rules: certain, events: j('events/slice-1.json'),
    slots: j('world-slots.json'), nameData: j('names/names.json'),
    looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
    conversation: j('events/recurring-conversation.json'),
    encounters: j('events/encounters-v0.2.json'),
    borderPolicy: j('events/faction-proof-reconciled.json'),
    firstSeason: j('events/first-season-v0.6.2.json'),
    sampleBeats: j('events/sample-beats.json')
  });
  function open(seed) {
    const s = E100.newRun({ mainCat: player, seed, runId: 'follow' });
    Object.values(s.npcs).forEach((n) => { n.homeZones = []; });
    s.region = 'split_rock';
    return s;
  }
  const s = open(2);
  s.region = 'split_rock';
  for (const id of ['ln01', 'ln02']) {
    const n = s.npcs[id];
    n.met = true; n.affinity = 25; n.stage = 'adult'; n.homeZones = ['split_rock']; n.faction = 'loner';
  }
  const plain = E100.act(s, { type: 'approach' }).state;
  assert.strictEqual(plain.pending.catId, 'ln01');
  const next = open(2);
  next.region = 'split_rock';
  for (const id of ['ln01', 'ln02']) {
    const n = next.npcs[id];
    n.met = true; n.affinity = 25; n.stage = 'adult'; n.homeZones = ['split_rock']; n.faction = 'loner';
  }
  arm(next, { sourceEventId: 'slice.region.horse_meadows', choiceId: 'stalk_foal', catId: 'ln02', kind: 'foal_hit', factId: 'hunted_at_meadows' });
  const picked = E100.act(next, { type: 'approach' }).state;
  assert.strictEqual(picked.pending.catId, 'ln02');
  assert.match(picked.pending.beats[0].text, /foal/);
});

test('sharing the foal needs today\'s kill and pays the existing +10 once', () => {
  const s = quiet(6);
  s.npcs.ln01.met = true; s.npcs.ln01.affinity = 0; s.npcs.ln01.homeZones = [s.region];
  arm(s, { sourceEventId: 'slice.region.horse_meadows', choiceId: 'stalk_foal', catId: 'ln01', kind: 'foal_hit', factId: 'hunted_at_meadows' });
  const closed = E.act(s, { type: 'talk', catId: 'ln01' }).state;
  const refused = E.act(closed, { type: 'choose', choiceId: 'share' });
  assert.strictEqual(refused.error, 'kill');
  assert.strictEqual(refused.state.npcs.ln01.affinity, 0);
  s.records._huntOk = true;
  const ready = E.act(s, { type: 'talk', catId: 'ln01' }).state;
  assert.strictEqual(ready.pending.huntReady, true);
  const shared = E.act(ready, { type: 'choose', choiceId: 'share' }).state;
  assert.strictEqual(shared.npcs.ln01.affinity, 10);
  assert.strictEqual(shared.pending.resultLine, 'Affinity +10');
  const loaded = E.migrate(JSON.parse(JSON.stringify(shared)));
  assert.strictEqual(loaded.npcs.ln01.affinity, 10);
  assert.strictEqual(E.act(loaded, { type: 'choose', choiceId: 'share' }).error, 'duplicate');
});

test('the meadow watch is a half rest and does not grant a new skill number', () => {
  let s = quiet(9);
  s.region = 'horse_meadows';
  s.npcs.ln01.homeZones = ['horse_meadows'];
  s.npcs.ln01.stage = 'adult';
  const xp = JSON.parse(JSON.stringify(s.records.playerSkills.xp));
  s = E.act(s, { type: 'rest' }).state;
  assert.strictEqual(s.pending && s.pending.meadow, true);
  s.needs.energy = 10;
  s = E.act(s, { type: 'choose', choiceId: 'watch_herd' }).state;
  assert.strictEqual(s.needs.energy, 10 + 20 + 25);
  assert.strictEqual(s.records.lastPrimary, 'trailReading');
  assert.deepStrictEqual(s.records.playerSkills.xp, xp);
  assert.ok((s.report.lines.find((l) => l.k === 'watch').cats || []).some((c) => c.id === 'ln01'));
});
