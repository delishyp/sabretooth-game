const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Beats = require('../src/renderer/js/beats');
const Speech = require('../src/renderer/js/speech');
const Pass2 = require('../src/renderer/js/pass2');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
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

test('a slice label and a reply block fill the same placeholders', () => {
  const ctx = { npc: { id: 'ln02', name: 'Sleet', sex: 'male' }, player: { name: 'Ravenmark', sex: 'female' }, catId: 'ln02' };
  assert.strictEqual(Beats.materialize('Wait for {catName}', ctx), 'Wait for Sleet');
  const reply = Beats.materialize({ speaker: 'ln02', parts: [{ beat: '{playerName} stays.' }, { say: 'On {playerHis} own trail.' }] }, ctx);
  assert.strictEqual(reply.parts[0].beat, 'Ravenmark stays.');
  assert.strictEqual(reply.parts[1].say, 'On her own trail.');
});

test('{his} stays the speaker pronoun and {playerHis} is the player', () => {
  const ctx = { npc: { id: 'ln02', name: 'Sleet', sex: 'male' }, player: { name: 'Ravenmark', sex: 'female' } };
  const npcLine = Beats.line({ kind: 'narration', text: '{catName} shows {his} sabers.' }, ctx);
  assert.strictEqual(npcLine.text, 'Sleet shows his sabers.');
  const event = E.eventById('slice.meeting.loner');
  const greeting = event.beats.find((beat) => beat.text && beat.text.includes('playerHis'));
  assert.ok(greeting);
  const spoken = Beats.line(greeting, ctx);
  assert.ok(spoken.text.includes('on her own'));
  assert.ok(!spoken.text.includes('{playerHis}'));
  assert.ok(!spoken.text.includes('on his own'));
});

test('{regionName} is the display name, not the region id', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'region-name' });
  s.region = 'greywater_ford';
  s.pending = { eventId: 'day.quiet', beats: [{ kind: 'narration', text: 'You are in {regionName}.' }], beatIndex: 0 };
  s.phase = 'event';
  const ctx = E.beatContext(s);
  assert.strictEqual(ctx.vars.regionName, 'Greywater Ford');
  assert.notStrictEqual(ctx.vars.regionName, 'greywater_ford');
  assert.strictEqual(Beats.line(s.pending.beats[0], ctx).text, 'You are in Greywater Ford.');
});

test('cat speech is stored without quotes and the renderer adds them', () => {
  const event = E.eventById('slice.meeting.loner');
  const greeting = event.beats.find((beat) => beat.text && beat.text.includes('playerHis'));
  assert.ok(greeting);
  assert.ok(!/[“”"]/.test(greeting.text));
  const spoken = Beats.line(greeting, {
    npc: { id: 'ln02', name: 'Sleet', sex: 'male' },
    player: { name: 'Ravenmark', sex: 'female' }
  });
  assert.ok(spoken.text.startsWith('\u201C'));
  assert.ok(spoken.text.endsWith('\u201D'));
  assert.strictEqual(Beats.line({ kind: 'speech', text: '"Hello."' }, {}).text, '\u201CHello.\u201D');
});

test('spotting a stranger does not open the repeat-meeting You again line', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'sighting' });
  const cat = s.npcs.ln05;
  cat.met = false;
  s.phase = 'event';
  s.pending = {
    lone: true, presence: 'watch', eventId: 'action.watch', title: 'The vantage',
    catId: cat.id, catName: cat.name, beatIndex: 0,
    beats: [{ kind: 'narration', text: 'You see ' + cat.name + ' below.' }],
    choices: [{ id: 'go_down', label: 'Go down to them.' }]
  };
  assert.strictEqual(s.npcs[cat.id].met, false);
  s = E.act(s, { type: 'sceneChoose', choiceId: 'go_down' }).state;
  assert.strictEqual(s.pending.eventId, 'slice.meeting.loner');
  assert.strictEqual(s.npcs[cat.id].met, true);
  const text = (E.sceneBeats(s) || []).map((beat) => E.beats.line(beat, E.beatContext(s)).text).join('\n');
  assert.ok(!text.includes('You again'));
});

test('a middle-band trait cue is read when no trait is extreme', () => {
  const spoken = Speech.resolve({
    speechLocations: { greet: { focusTrait: 'sociability', base: 'Even.', low: 'Short.', high: 'Warm.', context: 'greet' } },
    contextActions: { greet: { sociability: { low: 'stands back', middle: '{catName} speaks evenly.', high: 'steps in' } } }
  }, 'greet', { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 }, { catName: 'Ash' });
  assert.strictEqual(spoken.action, 'Ash speaks evenly.');
  assert.strictEqual(spoken.actionId, 'greet:sociability:middle');
});

test('byCat beats a per-scene label, which beats the shared label', () => {
  const table = Pass2.lines()['followups.js:choices'];
  const original = table.explain;
  table['ford_cold.explain'] = 'The water chose.';
  table.explain = { default: original, byCat: { ln02: 'Sleetbark, it was not about you.' } };
  const ctx = { catId: 'ln02', npc: { id: 'ln02', name: 'Sleetbark', sex: 'male' }, player: { name: 'Ravenmark', sex: 'female' } };
  try {
    assert.strictEqual(Pass2.choiceLabel('ford_cold', 'explain', ctx), 'Sleetbark, it was not about you.');
    assert.strictEqual(Pass2.choiceLabel('ford_cold', 'explain', { catId: 'hc02' }), 'The water chose.');
    assert.strictEqual(Pass2.choiceLabel('hyena_drive', 'listen'), 'Listen.');
    assert.throws(() => Pass2.validateChoices({
      explain: { default: 'Explain.', byCat: { ghost: 'No.' } },
      'ford_cold.explain': 'Scene.'
    }, {}, new Set(['ln02'])), /unknown catId ghost/);
  } finally {
    table.explain = original;
    delete table['ford_cold.explain'];
  }
});

test('a removed beat is accepted and then skipped', () => {
  const beats = [
    { kind: 'narration', text: 'First.' },
    { kind: 'narration', text: 'Gone.', removed: true },
    { removed: true },
    { kind: 'speech', speaker: '{catId}', parts: [{ say: 'Still here.' }] }
  ];
  assert.strictEqual(Beats.validBeats(beats), true);
  const shown = Beats.visible(beats, { npc: { id: 'ln02', name: 'Sleet', sex: 'male' } });
  assert.deepStrictEqual(shown.map((beat) => beat.text || beat.parts[0].say), ['First.', 'Still here.']);
  const line = Beats.line(shown[1], { npc: { id: 'ln02', name: 'Sleet', sex: 'male' } });
  assert.strictEqual(line.speaker, 'Sleet');
  assert.strictEqual(line.text, '\u201CStill here.\u201D');
});
