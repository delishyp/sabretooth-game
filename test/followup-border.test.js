// Follow-up replies stay on the result card, and a finished border visit shows that choice's reply.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pass2 = require('../src/renderer/js/pass2');
const Screen = require('../src/renderer/js/game-screen');
const Speech = require('../src/renderer/js/speech');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(require('fs').readFileSync(path.join(D, f), 'utf8'));
const graph = j('events/recurring-conversation.json');
const producer = j('events/faction-proof-reconciled.json');
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: graph, encounters: j('events/encounters-v0.2.json'),
  borderPolicy: producer, firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const voice = {
  speechLocations: producer.policy.personalityCoverage.speechLocations,
  contextActions: graph.personalityCoverage.contextActions
};

function quiet() {
  const s = E.newRun({ mainCat: player, seed: 4, runId: 'follow-reply' });
  Object.values(s.npcs).forEach((n) => { n.homeZones = []; });
  s.map.claims = Object.fromEntries(Object.keys(s.map.claims).map((id) => [id, {}]));
  s.usedEvents = j('events/slice-1.json').events.map((e) => e.id).filter((id) => id !== 'slice.region.horse_meadows');
  return s;
}

test('a follow-up result keeps the REPLIES line after the card drops speech', () => {
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
  const voiced = E.act(opened, { type: 'choose', choiceId: 'explain' }).state;
  const card = Screen.resultCardBeats(voiced.pending.beats, 'eventResult');
  assert.ok(card.every((beat) => !beat || beat.kind !== 'speech'));
  assert.strictEqual(voiced.pending.resultReply.reply, true);
  assert.ok(voiced.pending.resultReply.log.some((part) => part.role === 'say' && part.text.includes('looked that way')));
  assert.ok(voiced.pending.resultReply.log.some((part) => part.speaker === 'ln02'));
});

test('follow-up labels and replies fill placeholders, and {catId} is the npc speaker', () => {
  const ctx = { npc: { id: 'ln02', name: 'Sleet', sex: 'male' }, catId: 'ln02', player: { name: 'Ravenmark', sex: 'female' } };
  assert.strictEqual(Pass2.choiceLabel('foal_hit', 'share', ctx), 'Push today\'s kill toward Sleet.');
  const shown = Pass2.presentChoice('foal_hit', 'share', [], ctx);
  assert.strictEqual(shown[0].log[0].speaker, 'ln02');
  assert.ok(shown[0].log[0].text.includes('Thank you'));
  assert.strictEqual(Pass2.replies()['foal_hit.share'].speaker, '{catId}');
  assert.strictEqual(Pass2.validateChoices(Pass2.lines()['followups.js:choices'], Pass2.replies(), new Set(['ln02'])), true);
});

test('a border choice that ends the visit shows that reply, not the guard\'s earlier line', () => {
  let s = E.newRun({ mainCat: player, seed: 4, runId: 'border-leave' });
  s = E.act(s, { type: 'border' }).state;
  const opening = E.world.borderView(s).title;
  s = E.act(s, { type: 'borderChoose', choiceId: 'leave' }).state;
  const done = E.world.borderView(s);
  assert.strictEqual(s.border.node, 'done');
  assert.notStrictEqual(done.title, opening);
  assert.ok(!(done.lines || []).some((line) => line.text && line.text.includes(opening.replace(/[“”]/g, ''))));

  let permitted = E.newRun({ mainCat: player, seed: 4, runId: 'border-send' });
  Object.assign(permitted.worldMemory.policy['highcrag->bonefield'], { source: 'leader-ruling', topic: 'bonefield', status: 'permits' });
  permitted = E.act(permitted, { type: 'border' }).state;
  permitted = E.act(permitted, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  const gate = E.world.borderView(permitted).lines.filter((line) => line.kind === 'say').map((line) => line.text).join('\n');
  permitted = E.act(permitted, { type: 'borderChoose', choiceId: 'send_request' }).state;
  const reply = E.world.borderView(permitted).lines.filter((line) => line.kind === 'say').map((line) => line.text).join('\n');
  const sent = Speech.resolve(voice, 'relay_accepted', permitted.npcs.hc07.personality, { catName: permitted.npcs.hc07.name }).text;
  assert.strictEqual(permitted.border.presentation.location, 'relay_accepted');
  assert.ok(reply.includes(sent));
  assert.ok(!reply.includes(gate));
});

test('the shared-kill choice stays, the second route label shows, and the five border speeches resolve', () => {
  let s = E.newRun({ mainCat: player, seed: 4, runId: 'border-wire' });
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  const route = E.world.borderView(s).choices.find((choice) => choice.id === 'route_withdraw');
  assert.ok(route);
  assert.strictEqual(route.label, producer.policy.normalRoute[0].choices[1].label);
  const says = E.world.borderView(s).lines.filter((line) => line.kind === 'say').map((line) => line.text);
  const offer = Speech.resolve(voice, 'unknown_offer', s.npcs.hc07.personality, { catName: s.npcs.hc07.name }).text;
  assert.ok(says.includes(offer));

  let known = E.newRun({ mainCat: player, seed: 4, runId: 'border-share' });
  Object.assign(known.worldMemory.policy['highcrag->bonefield'], { source: 'leader-ruling', topic: 'bonefield', status: 'defers' });
  known.worldMemory.facts.push({ factId: 'aid-share', kind: 'aid' });
  known.worldMemory.knowledge['aid-share'] = {
    scope: 'private', participantIds: ['player', 'hc07'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1
  };
  known = E.act(known, { type: 'border' }).state;
  known = E.act(known, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  known = E.act(known, { type: 'borderChoose', choiceId: 'explain_known_aid' }).state;
  assert.strictEqual(known.border.presentation.location, 'account_request');
  const explain = E.world.borderView(known);
  assert.ok(explain.choices.some((choice) => choice.id === 'disclose_verified_share' && choice.label.includes('We shared a kill')));
  const told = E.act(known, { type: 'borderChoose', choiceId: 'disclose_verified_share' }).state;
  assert.strictEqual(told.border.presentation.location, 'verified_disclosure');
  const heard = Speech.resolve(voice, 'verified_disclosure', told.npcs.hc07.personality, { catName: told.npcs.hc07.name }).text;
  assert.ok(E.world.borderView(told).lines.some((line) => line.text === heard));

  let quiet = E.newRun({ mainCat: player, seed: 4, runId: 'border-private' });
  Object.assign(quiet.worldMemory.policy['highcrag->bonefield'], { source: 'leader-ruling', topic: 'bonefield', status: 'defers' });
  quiet.worldMemory.facts.push({ factId: 'aid-share', kind: 'aid' });
  quiet.worldMemory.knowledge['aid-share'] = {
    scope: 'private', participantIds: ['player', 'hc07'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1
  };
  quiet = E.act(quiet, { type: 'border' }).state;
  quiet = E.act(quiet, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  quiet = E.act(quiet, { type: 'borderChoose', choiceId: 'explain_known_aid' }).state;
  quiet = E.act(quiet, { type: 'borderChoose', choiceId: 'keep_private' }).state;
  assert.strictEqual(quiet.border.presentation.location, 'keep_private');
  const kept = Speech.resolve(voice, 'keep_private', quiet.npcs.hc07.personality, { catName: quiet.npcs.hc07.name }).text;
  assert.ok(E.world.borderView(quiet).lines.some((line) => line.text === kept));
});
