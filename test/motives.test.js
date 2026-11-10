// Motives stay in the storyteller prompt. An aside is spoken once.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Motives = require('../src/renderer/js/motives');
const Prompt = require('../src/renderer/js/storyteller-prompt');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const motives = j('events/motives-v1.json');
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

test('every motive slot exists, and motive is only in the online and local prompts', () => {
  const slots = j('world-slots.json').slots.map((row) => row.slot);
  const keys = Object.keys(motives).filter((key) => !key.startsWith('_'));
  assert.deepStrictEqual(keys.filter((key) => !slots.includes(key)), []);
  assert.deepStrictEqual(slots.filter((slot) => !keys.includes(slot)), []);
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'motive' });
  const npc = s.npcs.hc01;
  const online = Prompt.buildOnlinePrompt(npc);
  const local = Prompt.buildLocalPrompt(npc);
  const offline = Prompt.buildOfflinePrompt(npc);
  assert.strictEqual(online.cast[0].motive, motives.hc01.motive);
  assert.strictEqual(local.cast[0].motive, motives.hc01.motive);
  assert.ok(!Object.prototype.hasOwnProperty.call(offline.cast[0], 'motive'));
  s.pending = { eventId: 'slice.meeting.highcrag', catId: 'hc01', beatIndex: 0, hostile: false };
  s.phase = 'event';
  const rendered = E.sceneBeats(s).map((beat) => E.beats.line(beat, E.beatContext(s)).text).join('\n');
  assert.ok(!rendered.includes(motives.hc01.motive));
  assert.ok(!rendered.includes(motives.hc01.gossip));
});

test('an aside plays once, on the first meeting, and is remembered on the cat', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'aside' });
  const npc = s.npcs.ln02;
  assert.ok(!npc.asideSaid);
  s.pending = { eventId: 'slice.meeting.loner', catId: 'ln02', beatIndex: 0, hostile: false };
  s.phase = 'event';
  const first = E.sceneBeats(s).map((beat) => beat.text).join('\n');
  assert.ok(first.includes(Motives.asideLine('ln02', npc.name)));
  assert.strictEqual(npc.asideSaid, true);
  s.pending = { eventId: 'slice.meeting.loner', catId: 'ln02', beatIndex: 0, hostile: false };
  const second = E.sceneBeats(s).map((beat) => beat.text).join('\n');
  assert.ok(!second.includes(motives.ln02.aside));
});
