// Ford and border scenes use their own action cues, not the ln05 talk set.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
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
  borderPolicy: producer
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const flat = { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 };

test('a cat with no extreme trait hears the scene neutral, not the talk neutral', () => {
  const row = { focusTrait: 'sociability', base: 'Leave it.', high: 'High.', low: 'Low.', context: 'walking' };
  const ford = Speech.resolve({
    speechLocations: { line: row }, contextActions: producer.fordStory.contextActions, neutral: producer.fordStory.neutral
  }, 'line', flat, Speech.nameVars({ name: 'Ash', sex: 'male' }));
  assert.strictEqual(ford.actionId, 'walking:neutral');
  assert.ok(ford.action.includes('noise of the river'));
  const border = Speech.resolve({
    speechLocations: { line: Object.assign({}, row, { context: 'opening' }) },
    contextActions: graph.factionStoryConsumer.contextActions,
    neutral: graph.factionStoryConsumer.neutral
  }, 'line', flat, Speech.nameVars({ name: 'Ash', sex: 'male' }));
  assert.ok(border.action.includes('scent line'));
  assert.ok(!ford.action.includes('flat stone'));
  assert.ok(!border.action.includes('flat stone'));
});

test('the live ford and border scenes speak with their own cue sets', () => {
  let s = E.newRun({ mainCat: player, seed: 4, runId: 'scene-cues' });
  s.day = 2;
  s.phase = 'day';
  s = E.act(s, { type: 'travel', to: 'greywater_ford' }).state;
  while (s.phase !== 'ford' && s.phase !== 'day' && !s.over) {
    if (s.phase === 'encounter') {
      const view = E.encounterView(s);
      const choice = view && (view.choices || []).find((row) => !row.disabled);
      s = E.act(s, choice ? { type: 'encounterChoose', choiceId: choice.id } : { type: 'continue' }).state;
    } else if (s.phase === 'event' || s.phase === 'eventResult') {
      s = E.act(s, { type: 'continue' }).state;
    } else break;
  }
  if (s.phase === 'day') s = E.act(s, { type: 'travel', to: 'greywater_ford' }).state;
  assert.strictEqual(s.phase, 'ford');
  const fordAction = (s.ford.lines || []).find((line) => line.kind === 'action');
  assert.ok(fordAction, 'ford scene has an action cue');
  assert.ok(/river|stones|carcass|spray|water/.test(fordAction.text), fordAction.text);
  s = E.act(s, { type: 'continue' }).state;
  while (s.phase !== 'day' && !s.over) s = E.act(s, { type: 'continue' }).state;
  s.region = 'split_rock';
  s = E.act(s, { type: 'border' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  const borderAction = (E.world.borderView(s).lines || []).find((line) => line.kind === 'action');
  assert.ok(borderAction, 'border scene has an action cue');
  assert.ok(/scent|border|line|crag/.test(borderAction.text), borderAction.text);
});
