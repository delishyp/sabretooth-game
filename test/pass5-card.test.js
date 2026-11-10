// Pass-5 card words, meeting replies, and the three presence closings.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Screen = require('../src/renderer/js/game-screen');
const Words = require('../src/renderer/js/card-words');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const pass5 = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/pass-5-tracker-d69115c.json'), 'utf8'));
const events = j('events/slice-1.json');
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events,
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const choice = (id, choiceId) => events.events.find((row) => row.id === id).choices.find((row) => row.id === choiceId);

function arm() {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'presence-close' });
  const cat = s.npcs.ln02;
  s.region = cat.homeZones[0];
  cat.met = true;
  E.lone.noteKill(s, null);
  s.pending = E.lone.killPresence(s, cat, { ownership: () => ({ state: 'wild' }) });
  s.phase = 'event';
  return { s, cat };
}

test('affinity and hunger words follow the pass-5 bands on the existing deltas', () => {
  const affinity = pass5.item2_card_words.affinity;
  const hunger = pass5.item2_card_words.hunger;
  assert.strictEqual(Words.affinity('Sleet', 5), affinity['gain_small (+1..+5)'].replace('{catName}', 'Sleet'));
  assert.strictEqual(Words.affinity('Sleet', 10), affinity['gain_big (+6 or more)'].replace('{catName}', 'Sleet'));
  assert.strictEqual(Words.affinity('Sleet', -5), affinity['loss_small (-1..-5)'].replace('{catName}', 'Sleet'));
  assert.strictEqual(Words.affinity('Sleet', -10), affinity['loss_big (-6 or less)'].replace('{catName}', 'Sleet'));
  assert.strictEqual(Words.affinity('Sleet', 0), affinity.zero);
  assert.strictEqual(Words.hunger(15), hunger['small (+1..+15)']);
  assert.strictEqual(Words.hunger(25), hunger['medium (+16..+35)']);
  assert.strictEqual(Words.hunger(20), hunger['medium (+16..+35)']);
  assert.strictEqual(Words.hunger(50), hunger['large (+36 or more)']);
  assert.strictEqual(Words.hunger(80), hunger['large (+36 or more)']);
});

test('the two meeting replies match pass-5, and a result card drops speech', () => {
  assert.strictEqual(choice('slice.meeting.loner', 'greet').text, pass5.item3_meeting_replies['slice.meeting.loner/greet.text']);
  assert.strictEqual(choice('slice.meeting.highcrag', 'introduce').text, pass5.item3_meeting_replies['slice.meeting.highcrag/introduce.text']);
  const beats = [
    { kind: 'narration', text: 'Both of you look behind the other.' },
    { kind: 'speech', text: 'Just you?' }
  ];
  assert.deepStrictEqual(Screen.resultCardBeats(beats, 'event').map((b) => b.kind), ['narration', 'speech']);
  assert.deepStrictEqual(Screen.resultCardBeats(beats, 'eventResult').map((b) => b.text), ['Both of you look behind the other.']);
});

test('Let them watch, Share and Warn off use the presence summary', () => {
  const moment = (name) => `The moment passes, and ${name} goes on about the day.`;
  const watched = arm();
  const letWatch = E.act(watched.s, { type: 'sceneChoose', choiceId: 'let_watch' }).state;
  assert.strictEqual(letWatch.phase, 'eventResult');
  assert.strictEqual(letWatch.pending.summary, moment(watched.cat.name));
  assert.ok(letWatch.pending.beats[0].text.endsWith('pads away without a word.'));
  assert.strictEqual(letWatch.pending.beats[0].text, j('events/cat-presence-v0.1.json')['presence.hunt.let_watch'].text.replaceAll('{name}', watched.cat.name));

  const warned = arm();
  const warn = E.act(warned.s, { type: 'sceneChoose', choiceId: 'warn_off' }).state;
  assert.strictEqual(warn.pending.summary, moment(warned.cat.name));

  const shared = arm();
  let share = E.act(shared.s, { type: 'sceneChoose', choiceId: 'share' }).state;
  assert.strictEqual(share.pending.summary, moment(shared.cat.name));
  while (share.phase === 'event') share = E.act(share, { type: 'advanceBeat' }).state;
  assert.strictEqual(share.pending.summary, moment(shared.cat.name));
});
