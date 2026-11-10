// Rendered beats and the day-10 rendezvous fixture must not keep a raw {token}.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
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
const TOKEN = /\{(name|catName|playerName)\}/;

function collect(value, out) {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { value.forEach((item) => collect(item, out)); return; }
  if (!value || typeof value !== 'object') return;
  if (typeof value.text === 'string') out.push(value.text);
  if (typeof value.label === 'string') out.push(value.label);
  if (typeof value.summary === 'string') out.push(value.summary);
  if (typeof value.beat === 'string') out.push(value.beat);
  if (typeof value.say === 'string') out.push(value.say);
  if (value.reply) collect(value.reply, out);
  if (value.parts) collect(value.parts, out);
}
function stringsOf(s) {
  const pending = s.pending || {};
  const out = [];
  collect(pending.beats, out);
  collect(pending.lines, out);
  const ctx = E.beatContext(s);
  for (const choice of pending.choices || []) {
    if (!choice) continue;
    if (typeof choice.label === 'string') out.push(E.beats.materialize(choice.label, ctx));
    if (choice.reply != null) collect(E.beats.materialize(choice.reply, ctx), out);
  }
  const library = pending.eventId && E.eventById(pending.eventId);
  for (const choice of (!pending.choices || !pending.choices.length) && library && library.choices || []) {
    if (choice && typeof choice.label === 'string') out.push(E.beats.materialize(choice.label, ctx));
    if (choice && choice.reply != null) collect(E.beats.materialize(choice.reply, ctx), out);
  }
  if (pending.summary) out.push(pending.summary);
  const beats = E.sceneBeats(s) || [];
  for (const beat of beats) {
    collect(beat, out);
    collect(E.beats.line(beat, ctx), out);
  }
  return out;
}
function assertResolved(s, where) {
  for (const text of stringsOf(s)) assert.ok(!TOKEN.test(text), `${where}: ${text}`);
}
function meet(s, npc) {
  const cat = s.npcs[npc.id];
  if (!cat.homeZones || !cat.homeZones.length) cat.homeZones = [s.region];
  s.region = cat.homeZones[0];
  cat.met = true;
  cat.lastRegion = s.region;
  s.records.presenceFirst = { day: s.day, catId: cat.id };
  s.phase = 'day';
  s.pending = null;
  s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/approach/'));
  const opened = E.act(s, { type: 'approach' });
  assert.ok(!opened.error, opened.error);
  return opened.state;
}

test('day-10 rendezvous beats resolve {catName} above the meeting line', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'day-10-tokens' });
  s.day = 10;
  const opened = meet(s, s.npcs.ln02);
  const ask = (opened.pending.choices || []).find((row) => row.id === 'ask_meet');
  assert.ok(ask, 'day-10 fixture has no meeting line');
  assert.strictEqual(ask.label, '“Meet me here at Greywater Ford tomorrow?”');
  assert.ok((opened.pending.beats || []).some((beat) => beat.text && beat.text.includes(s.npcs.ln02.name)));
  assertResolved(opened, 'day-10 fixture');
  let cursor = opened;
  const beats = E.sceneBeats(cursor) || [];
  for (let i = 0; i < beats.length; i++) {
    cursor.pending.beatIndex = i;
    assertResolved(cursor, `day-10 beat ${i}`);
  }
});

test('seed 8 rendered beats and cub text have no unresolved tokens', () => {
  let cub = E.newRun({ mainCat: player, seed: 8, runId: 'seed-8-tokens' });
  cub.needs.energy = 90;
  cub = E.act(cub, { type: 'helpCub' }).state;
  assertResolved(cub, 'cub intro');
  cub = E.act(cub, { type: 'sceneChoose', choiceId: 'guide' }).state;
  assert.ok((cub.pending.beats || []).some((beat) => beat.text && beat.text.includes(cub.npcs[cub.pending.motherId].name)));
  assertResolved(cub, 'cub help');
});

test('choice labels and reply blocks are filled before the token scan', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'label-fill' });
  const cat = s.npcs.ln02;
  s.pending = {
    eventId: 'lone.scent',
    catId: cat.id,
    choices: [{
      id: 'explain',
      label: 'Meet {catName}',
      reply: { speaker: cat.id, parts: [{ beat: '{playerName} waits.' }, { say: 'Hello, {catName}.' }] }
    }]
  };
  s.phase = 'event';
  assertResolved(s, 'filled label and reply');
  const ctx = E.beatContext(s);
  assert.strictEqual(E.beats.materialize('Meet {catName}', ctx), `Meet ${cat.name}`);
});

test('a choice reply is covered by the unresolved-token scan', () => {
  const choice = {
    id: 'explain',
    label: 'Explain.',
    reply: { speaker: 'ln02', parts: [{ beat: 'At the ford.' }, { say: '{catName} waits for {playerName}.' }] }
  };
  const pieces = [];
  collect(choice, pieces);
  assert.ok(pieces.some((text) => text.includes('{catName}')));
  assert.ok(pieces.some((text) => text.includes('{playerName}')));
  assert.throws(() => {
    for (const text of pieces) assert.ok(!TOKEN.test(text), text);
  });
});

test('a mixed parts block with {name}, {catName}, or {playerName} fails the scan', () => {
  const rendered = {
    speaker: 'bf04',
    parts: [
      { beat: 'A scent of {name} crosses the trail.' },
      { say: '{catName} looks back at {playerName}.' }
    ]
  };
  const pieces = [];
  collect(rendered, pieces);
  assert.ok(pieces.some((text) => text.includes('{name}')));
  assert.ok(pieces.some((text) => text.includes('{catName}')));
  assert.ok(pieces.some((text) => text.includes('{playerName}')));
  assert.throws(() => {
    for (const text of pieces) assert.ok(!TOKEN.test(text), text);
  });
});
