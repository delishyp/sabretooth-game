// Saga pass 3: loner first meetings, the wolf card, and boundary cues.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Speech = require('../src/renderer/js/speech');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const pass3 = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/pass-3-loner-meeting-and-nits.json'), 'utf8'));
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

function rendered(s, catId) {
  s.pending = { eventId: 'slice.meeting.loner', catId, beatIndex: 0, hostile: false };
  s.phase = 'event';
  const beats = E.sceneBeats(s);
  assert.ok(beats && beats.length, catId);
  return beats.map((beat) => E.beats.line(beat, E.beatContext(s)).text).join('\n');
}

test('seed 8 renders different loner meetings for Sleet and Cragward', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const sleet = Object.values(s.npcs).find((n) => n.name === 'Sleet');
  const crag = Object.values(s.npcs).find((n) => n.name === 'Cragward');
  assert.ok(sleet && crag);
  const event = E.eventById('slice.meeting.loner');
  assert.strictEqual(event.text, '{catName} stops where your paths cross. For a moment, both of you look behind the other for companions.');
  assert.deepStrictEqual(event.choices.map((c) => c.id), ['greet', 'pass', 'drive']);
  const a = rendered(s, sleet.id);
  const b = rendered(s, crag.id);
  assert.notStrictEqual(a, b);
  assert.ok(a.includes('Sleet'));
  assert.ok(b.includes('Cragward'));
  assert.ok(a.includes('A scent crosses yours on the trail'));
  assert.ok(b.includes('A scent crosses yours on the trail'));
});

test('the wolf card uses Saga\'s pass 3 line', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../src/renderer/js/game-screen.js'), 'utf8');
  assert.ok(screen.includes(pass3['B_encounterCost.wolf']));
});

test('a boundary cue renders with the cat\'s name and no leftover token', () => {
  const cues = j('events/recurring-conversation.json').personalityCoverage.contextActions.boundary;
  assert.deepStrictEqual(cues, pass3['C_recurring-conversation.json.contextActions.boundary']);
  const spoken = Speech.resolve({
    speechLocations: { highcrag_open: { focusTrait: 'aggression', base: 'Leave it.', high: 'Leave it.', low: 'Leave it.', context: 'boundary' } },
    contextActions: { boundary: cues }
  }, 'highcrag_open', { aggression: 80, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 }, { catName: 'Ash' });
  assert.strictEqual(spoken.action, "Ash's hackles rise, and claws slide out against the stone.");
  assert.ok(!spoken.action.includes('{catName}'));
});
