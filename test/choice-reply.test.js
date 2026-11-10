// Choice replies and per-scene labels. Saga's copy is not shipped; the Sleetbark ford sample stays in this test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pass2 = require('../src/renderer/js/pass2');

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
const lines = Pass2.lines();
const labels = lines['followups.js:choices'];
const replies = Pass2.replies();
const known = new Set(['player', 'ln02']);
const sleetbarkFord = {
  speaker: 'ln02',
  parts: [
    { beat: 'Sleetbark stays in the shallows at the ford, tail tip twitching.' },
    { say: 'You picked a side, and I saw which one.' }
  ]
};

function quiet() {
  const s = E.newRun({ mainCat: player, seed: 4, runId: 'reply' });
  Object.values(s.npcs).forEach((n) => { n.homeZones = []; });
  s.map.claims = Object.fromEntries(Object.keys(s.map.claims).map((id) => [id, {}]));
  s.usedEvents = j('events/slice-1.json').events.map((e) => e.id).filter((id) => id !== 'slice.region.horse_meadows');
  return s;
}
function playExplain() {
  const s = quiet();
  const cat = s.npcs.ln02;
  cat.met = true;
  cat.affinity = 0;
  cat.homeZones = [s.region];
  s.worldMemory.facts.push({ factId: 'aided', kind: 'test' });
  s.worldMemory.knowledge.aided = {
    scope: 'witnessed', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: s.day
  };
  s.followups.push({
    sourceEventId: 'm2.ford_prey_dispute', choiceId: 'help_bonefield_cat', catId: 'ln02',
    kind: 'ford_cold', factId: 'aided', fired: false, notBefore: null, expiresDay: null
  });
  const opened = E.act(s, { type: 'talk', catId: 'ln02' }).state;
  return E.act(opened, { type: 'choose', choiceId: 'explain' }).state;
}

test('a per-scene label wins, and listen in hyena_drive keeps the shared label', () => {
  assert.strictEqual(Pass2.choiceLabel('hyena_drive', 'listen'), 'Listen.');
  assert.strictEqual(Pass2.choices('hyena_drive').find((row) => row.id === 'listen').label, 'Listen.');
  labels['ford_cold.explain'] = 'The ford was not about your pride.';
  labels['ford_friend.listen'] = 'Hear the ford story out.';
  try {
    assert.strictEqual(Pass2.choiceLabel('ford_cold', 'explain'), 'The ford was not about your pride.');
    assert.strictEqual(Pass2.choices('ford_cold').find((row) => row.id === 'explain').label, 'The ford was not about your pride.');
    assert.strictEqual(Pass2.choiceLabel('hyena_leave', 'explain'), labels.explain);
    assert.strictEqual(Pass2.choices('hyena_drive').find((row) => row.id === 'listen').label, 'Listen.');
    assert.strictEqual(Pass2.choices('ford_friend').find((row) => row.id === 'listen').label, 'Hear the ford story out.');
    assert.throws(() => Pass2.validateChoices(Object.assign({}, labels, { 'nope.explain': 'No.' }), replies, known), /unknown scene nope/);
    assert.throws(() => Pass2.validateChoices(Object.assign({}, labels, { 'ford_cold.dance': 'No.' }), replies, known), /unknown choice dance/);
  } finally {
    delete labels['ford_cold.explain'];
    delete labels['ford_friend.listen'];
  }
});

test('the Sleetbark ford reply renders before the result and does not change the outcome', () => {
  const shipped = JSON.parse(JSON.stringify(replies['ford_cold.explain']));
  const plain = playExplain();
  const plainReply = plain.pending.choices.find((row) => row.id === 'explain').reply;
  assert.strictEqual(plainReply.speaker, 'ln02');
  assert.ok(plainReply.parts.some((part) => part.say && part.say.includes('looked that way')));
  replies['ford_cold.explain'] = sleetbarkFord;
  try {
    assert.strictEqual(Pass2.validateChoices(labels, replies, known), true);
    assert.throws(() => Pass2.validateChoices(labels, {
      'ford_cold.explain': { speaker: 'ghost', parts: [{ say: 'No.' }] }
    }, known), /unknown speaker ghost/);
    assert.strictEqual(Pass2.validateChoices(labels, {
      'ford_cold.explain': 'You let the water answer for you.'
    }, known), true);
    const result = Pass2.reply('ford_cold', 'explain', { name: 'Sleetbark' });
    const shown = Pass2.presentChoice('ford_cold', 'explain', result);
    assert.strictEqual(shown[0].reply, true);
    assert.strictEqual(shown[0].log[0].role, 'beat');
    assert.strictEqual(shown[0].log[0].text, sleetbarkFord.parts[0].beat);
    assert.strictEqual(shown[0].log[1].role, 'say');
    assert.strictEqual(shown[0].log[1].text, '\u201CYou picked a side, and I saw which one.\u201D');
    assert.deepStrictEqual(shown.slice(1), result);
    const voiced = playExplain();
    assert.strictEqual(voiced.saveVersion, plain.saveVersion);
    assert.strictEqual(voiced.saveVersion, 1);
    assert.strictEqual(voiced.phase, plain.phase);
    assert.strictEqual(voiced.npcs.ln02.affinity, plain.npcs.ln02.affinity);
    assert.deepStrictEqual(voiced.pending.beats.map((beat) => beat.text), plain.pending.beats.map((beat) => beat.text));
    assert.deepStrictEqual(voiced.pending.choices.find((row) => row.id === 'explain').reply, sleetbarkFord);
    assert.notDeepStrictEqual(plainReply, sleetbarkFord);
  } finally {
    replies['ford_cold.explain'] = shipped;
  }
});
