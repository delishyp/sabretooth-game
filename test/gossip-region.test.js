// Region-moment gossip: newest unknown, the player's own label, and who learns it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Prompt = require('../src/renderer/js/storyteller-prompt');
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
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
function fresh() { return E.newRun({ mainCat: player, seed: 4, runId: 'gossip-region' }); }
function fact(s, path, day, extra) {
  const factId = `${s.runId}/${path}`;
  s.worldMemory.facts.push({ factId, kind: path.startsWith('region_moment/') ? 'region_moment' : 'note', region: 'split_rock', scope: 'private' });
  s.worldMemory.knowledge[factId] = Object.assign({
    scope: 'private', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: day
  }, extra || {});
  return factId;
}
function approach(s) {
  for (const npc of Object.values(s.npcs)) { npc.met = false; npc.affinity = 0; }
  const cat = s.npcs.ln05;
  cat.met = true;
  cat.affinity = 40;
  cat.stage = 'adult';
  cat.homeZones = [s.region];
  cat.dead = false;
  return E.lone.beginApproach(s, {
    lonerHomePct: 100,
    lonerAdjacentPct: 0,
    knowsFact: (id, factId) => E.world.knowsFact(s, id, factId),
    presentIds: ['ln05']
  });
}

test('pass on some news offers the newest fact this cat does not know', () => {
  const s = fresh();
  const older = fact(s, 'player-knows', 1);
  const newer = fact(s, 'region_moment/split_rock.hollow/lie_down', 4);
  const opened = approach(s);
  assert.strictEqual(opened.event.catId, 'ln05');
  assert.strictEqual(opened.event.rumorFactId, newer);
  assert.strictEqual(opened.event.choices.find((c) => c.id === 'rumor_spread').label, 'Tell them what you found');
  E.world.disclose(s, { factId: newer, toId: 'ln05', sourceEventId: 'test' });
  s.day += 1;
  const next = approach(s);
  assert.strictEqual(next.event.rumorFactId, older);
  assert.strictEqual(next.event.choices.find((c) => c.id === 'rumor_spread').label, 'Pass on some news you\'ve heard.');
  E.world.disclose(s, { factId: older, toId: 'ln05', sourceEventId: 'test' });
  s.day += 1;
  const none = approach(s);
  assert.strictEqual(none.event.rumorFactId, null);
  assert.ok(!none.event.choices.some((c) => c.id === 'rumor_spread'));
});

test('cats present for a region moment do not learn it', () => {
  const s = fresh();
  s.region = 'split_rock';
  for (const npc of Object.values(s.npcs)) {
    npc.homeZones = ['split_rock'];
    npc.lastRegion = 'split_rock';
  }
  s.phase = 'event';
  s.pending = { eventId: 'slice.region.split_rock.hollow', day: s.day, hostile: false, choiceId: null };
  const after = E.act(s, { type: 'choose', choiceId: 'lie_down' }).state;
  const factId = `${after.runId}/region_moment/split_rock.hollow/lie_down`;
  assert.deepStrictEqual(after.worldMemory.knowledge[factId].witnessIds, []);
  assert.deepStrictEqual(after.worldMemory.knowledge[factId].participantIds, ['player']);
  for (const npc of Object.values(after.npcs)) assert.strictEqual(E.world.knowsFact(after, npc.id, factId), false);
});

test('the mate learns region facts on a shared den day, and other members do not', () => {
  const s = fresh();
  s.region = 'tallgrass';
  const factId = fact(s, 'region_moment/split_rock.hollow/lie_down', 1);
  s.records.matePair = { mateId: 'ln05', playerId: s.cat.catId, bondedDay: 1, foundingDay: 1 };
  s.records.pride = { id: 'pride-test', name: 'Test', denRegionId: 'split_rock' };
  s.records.members = [
    { catId: s.cat.catId, role: 'founder' },
    { catId: 'ln05', role: 'founder' },
    { catId: 'ln01', role: 'member' }
  ];
  s.npcs.ln05.homeZones = ['split_rock'];
  s.npcs.ln01.homeZones = ['split_rock'];
  s.npcs.ln02.homeZones = ['split_rock'];
  const away = E.act(s, { type: 'rest' }).state;
  assert.strictEqual(E.world.knowsFact(away, 'ln05', factId), false);
  away.phase = 'day';
  away.pending = null;
  away.region = 'split_rock';
  away.usedEvents = j('events/slice-1.json').events.map((e) => e.id);
  const rested = E.act(away, { type: 'rest' });
  assert.ok(!rested.error, rested.error);
  const home = rested.state;
  assert.strictEqual(E.world.knowsFact(home, 'ln05', factId), true);
  assert.ok(home.worldMemory.knowledge[factId].disclosedTo.includes('ln05'));
  assert.strictEqual(E.world.knowsFact(home, 'ln01', factId), false);
  assert.strictEqual(E.world.knowsFact(home, 'ln02', factId), false);
});

test('storyteller context keeps the player\'s region facts off other cats', () => {
  const s = fresh();
  s.region = 'split_rock';
  const factId = fact(s, 'region_moment/split_rock.hollow/lie_down', 2);
  const npc = s.npcs.ln01;
  const prompt = Prompt.buildOnlinePrompt(npc, s.cat, s);
  assert.strictEqual(prompt.playerNarration.ownFacts[0].factId, factId);
  assert.strictEqual(prompt.playerNarration.ownFacts[0].callback, true);
  assert.ok(!prompt.cast[0].knownFactIds.includes(factId));
  assert.ok(!JSON.stringify(prompt.cast).includes(factId));
  const ctx = E.beatContext(s);
  assert.strictEqual(ctx.playerNarration.ownFacts[0].factId, factId);
  assert.ok(!ctx.knownFactIds.includes(factId));
  s.region = 'tallgrass';
  const away = Prompt.buildLocalPrompt(npc, s.cat, s);
  assert.strictEqual(away.playerNarration.ownFacts[0].callback, false);
  assert.ok(!away.cast[0].knownFactIds.includes(factId));
});

test('save and continue keeps region knowledge, and a v0.1.10 save still loads', () => {
  const s = fresh();
  const factId = fact(s, 'region_moment/wolf_run/continue', 3);
  s.worldMemory.knowledge[factId].disclosedTo.push('ln05');
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(loaded.worldMemory.knowledge[factId].disclosedTo.includes('ln05'));
  assert.strictEqual(E.world.knowsFact(loaded, 'ln05', factId), true);
  assert.strictEqual(E.world.knowsFact(loaded, 'ln01', factId), false);
  const old = fresh();
  const oldId = `${old.runId}/region_moment/south_range/continue`;
  old.worldMemory.facts.push({ factId: oldId, kind: 'region_moment', region: 'south_range', scope: 'private' });
  old.worldMemory.knowledge[oldId] = {
    scope: 'private', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 2
  };
  assert.ok(old.saveVersion <= rules.saveVersion);
  const resumed = E.migrate(JSON.parse(JSON.stringify(old)));
  assert.strictEqual(resumed.worldMemory.knowledge[oldId].learnedAbsDay, 2);
  assert.deepStrictEqual(resumed.worldMemory.knowledge[oldId].witnessIds, []);
  assert.strictEqual(E.world.knowsFact(resumed, 'player', oldId), true);
  for (const npc of Object.values(resumed.npcs)) assert.strictEqual(E.world.knowsFact(resumed, npc.id, oldId), false);
});
