// Tracker-confirmed dialogue bugs, plus the keep-the-secret promise.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pass2 = require('../src/renderer/js/pass2');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(require('fs').readFileSync(path.join(D, f), 'utf8'));
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

function fresh(seed) {
  const s = E.newRun({ mainCat: player, seed: seed || 2, runId: `gate-${seed || 2}` });
  const cat = s.npcs.ln05;
  cat.met = true;
  cat.affinity = 20;
  cat.personality = { aggression: 40, sociability: 40, boldness: 40, loyalty: 90, curiosity: 40 };
  s.region = cat.homeZones[0];
  return s;
}
function approach(s) {
  return E.lone.beginApproach(s, {
    neighbours: E.W.neighbours(s.region),
    lonerHomePct: 100,
    lonerAdjacentPct: 0,
    knowsFact: (id, factId) => E.world.knowsFact(s, id, factId),
    ownership: (id) => E.W.ownership(s.map.claims, id),
    scene: j('events/sample-beats.json')['npc_initiative.mistwood.request_help.v1']
  });
}

test('a cat who took part in a fact never gossips it and is never told it', () => {
  const s = fresh(3);
  const factId = `${s.runId}/player_stayed_out_ford`;
  s.worldMemory.facts.push({ factId, kind: 'note' });
  s.worldMemory.knowledge[factId] = {
    scope: 'witnessed', participantIds: ['player', 'ln05'], witnessIds: ['ln02'], disclosedTo: [], prideIds: [], learnedAbsDay: 1
  };
  const spoken = approach(s);
  const text = spoken.event.beats.map((beat) => beat.text).join('\n');
  assert.strictEqual(spoken.event.catId, 'ln05');
  assert.ok(!text.includes('kept clear at the ford'), text);
  const other = fresh(4);
  other.npcs.ln02.met = true;
  other.npcs.ln02.affinity = 25;
  other.npcs.ln02.homeZones = [other.region];
  other.worldMemory.facts.push({ factId: `${other.runId}/player_stayed_out_ford`, kind: 'note' });
  other.worldMemory.knowledge[`${other.runId}/player_stayed_out_ford`] = {
    scope: 'witnessed', participantIds: ['player', 'ln05'], witnessIds: ['ln02'], disclosedTo: [], prideIds: [], learnedAbsDay: 1
  };
  const heard = E.lone.beginApproach(other, {
    neighbours: E.W.neighbours(other.region), lonerHomePct: 0, lonerAdjacentPct: 0,
    priorityIds: ['ln02'],
    knowsFact: (id, knownId) => E.world.knowsFact(other, id, knownId),
    ownership: (id) => E.W.ownership(other.map.claims, id)
  });
  if (heard.event && heard.event.catId === 'ln02') {
    assert.ok(heard.event.beats.map((beat) => beat.text).join('\n').includes('kept clear at the ford'));
  }
});

test('the Mistwood request uses the plain or knows line and never a you-summary', () => {
  const book = { 'pride_aid/mistwood': 'A loner walked a cub home.', 'pride_aid/mistwood.knows': 'You walked that cub home.' };
  assert.strictEqual(Pass2.gossipLineFor(book, 'pride_aid/mistwood', '', false), 'A loner walked a cub home.');
  assert.strictEqual(Pass2.gossipLineFor(book, 'pride_aid/mistwood', '', true), 'You walked that cub home.');
  const s = fresh(5);
  const factId = `${s.runId}/cub/mw10`;
  s.worldMemory.facts.push({ factId, kind: 'pride_aid', summary: 'You walked a cub back to its mother.' });
  s.worldMemory.knowledge[factId] = {
    scope: 'private', participantIds: ['player'], witnessIds: ['mw04'], disclosedTo: [], prideIds: ['mistwood'], learnedAbsDay: 1
  };
  s.npcs.mw04.met = true;
  s.npcs.mw04.affinity = 30;
  s.npcs.mw04.personality = { aggression: 40, sociability: 40, boldness: 40, loyalty: 90, curiosity: 40 };
  s.region = 'mistwood';
  s.npcs.mw04.homeZones = ['mistwood'];
  const opened = E.lone.beginApproach(s, {
    neighbours: E.W.neighbours(s.region), lonerHomePct: 100, zoneHolder: 'mistwood',
    knowsFact: (id, knownId) => E.world.knowsFact(s, id, knownId),
    ownership: () => ({ state: 'held', holder: 'mistwood' }),
    scene: j('events/sample-beats.json')['npc_initiative.mistwood.request_help.v1']
  });
  const text = (opened.event.beats || []).map((beat) => beat.text).join('\n');
  assert.ok(!text.includes('You walked a cub'), text);
});

test('sharing food from the menu keeps the Mistwood promise and the +10 replaces the +5', () => {
  const s = fresh(6);
  s.npcs.mw04.met = true;
  s.npcs.mw04.affinity = 25;
  E.lone.promiseShare(s, 'mw04');
  E.lone.noteKill(s, null);
  const before = s.npcs.mw04.affinity;
  const shared = E.act(s, { type: 'shareKill', catId: 'mw04' }).state;
  assert.strictEqual(shared.npcs.mw04.affinity, before + 10);
  assert.strictEqual(shared.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').promise, 'kept');
});

test('the lost-cub intro does not name a mother before she arrives', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'cub-intro' });
  s.needs.energy = 40;
  const opened = E.act(s, { type: 'helpCub' }).state;
  assert.ok(opened.pending);
  const intro = opened.pending.beats[0];
  assert.ok(intro.text.includes('cub'));
  assert.ok(!intro.speaker, intro.speaker);
  assert.ok(!intro.speakerId);
  const guided = E.act(opened, { type: 'sceneChoose', choiceId: 'guide' }).state;
  const arrived = guided.pending.beats[guided.pending.beats.length - 1];
  assert.ok(arrived.speaker);
});

test('an open Mistwood promise plays the reminder, not the first ask', () => {
  const s = fresh(8);
  s.npcs.mw04.met = true;
  s.npcs.mw04.affinity = 30;
  s.npcs.mw04.personality.loyalty = 90;
  s.region = 'mistwood';
  s.npcs.mw04.homeZones = ['mistwood'];
  E.lone.promiseShare(s, 'mw04');
  s.day += 1;
  const opened = E.lone.beginApproach(s, {
    neighbours: E.W.neighbours(s.region), lonerHomePct: 100, zoneHolder: 'mistwood',
    knowsFact: () => false,
    ownership: () => ({ state: 'held', holder: 'mistwood' }),
    scene: j('events/sample-beats.json')['npc_initiative.mistwood.request_help.v1']
  });
  const text = opened.event.beats.map((beat) => beat.text).join('\n');
  assert.ok(text.includes('Did you find me a hare'), text);
  assert.ok(!text.includes('hare from these marshes'), text);
});

test('keeping a secret is +5 at the next meeting, and telling it is -5 once', () => {
  const s = fresh(9);
  const opened = approach(s);
  s.pending = opened.event;
  s.phase = 'event';
  const chosen = E.act(s, { type: 'sceneChoose', choiceId: 'accept_request' }).state;
  const fact = chosen.conversation.cats.ln05.facts.find((row) => row.promiseId === 'keep_secret');
  assert.ok(fact);
  assert.strictEqual(fact.promise, 'pending');
  assert.deepStrictEqual(chosen.worldMemory.knowledge[fact.factId].participantIds, ['player']);
  const affinity = chosen.npcs.ln05.affinity;
  chosen.day += 4;
  assert.strictEqual(fact.promise, 'pending');
  approach(chosen);
  assert.strictEqual(chosen.conversation.cats.ln05.facts.find((row) => row.promiseId === 'keep_secret').promise, 'kept');
  assert.strictEqual(chosen.npcs.ln05.affinity, affinity + 5);

  const told = fresh(10);
  const first = approach(told);
  told.pending = first.event;
  told.phase = 'event';
  const secret = E.act(told, { type: 'sceneChoose', choiceId: 'accept_request' }).state;
  const secretFact = secret.conversation.cats.ln05.facts.find((row) => row.promiseId === 'keep_secret');
  const before = secret.npcs.ln05.affinity;
  E.world.disclose(secret, { factId: secretFact.factId, toId: 'ln02', sourceEventId: 'tell' });
  assert.strictEqual(secret.conversation.cats.ln05.facts.find((row) => row.promiseId === 'keep_secret').promise, 'broken');
  assert.strictEqual(secret.npcs.ln05.affinity, before - 5);
  E.world.disclose(secret, { factId: secretFact.factId, toId: 'ln03', sourceEventId: 'again' });
  assert.strictEqual(secret.npcs.ln05.affinity, before - 5);
});

test('a motive aside stays off the watch and the loose stone until the cat has seen you', () => {
  const Motives = require('../src/renderer/js/motives');
  const s = fresh(11);
  const aside = Motives.asideLine('ln05', s.npcs.ln05.name);
  s.phase = 'event';
  s.pending = E.lone.watchPresence(s, s.npcs.ln05, { neighbours: E.W.neighbours(s.region) });
  const watched = E.sceneBeats(s).map((beat) => beat.text).join('\n');
  if (aside) assert.ok(!watched.includes(aside), watched);
  s.pending = E.lone.stonePresence(s, s.npcs.ln05, { eventId: 'slice.region.wind_scree', title: 'A loose stone' });
  const stone = E.sceneBeats(s).map((beat) => beat.text).join('\n');
  if (aside) assert.ok(!stone.includes(aside), stone);
  assert.ok(watched.length);
  assert.ok(stone.length);
});
