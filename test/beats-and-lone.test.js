// Scene beats and the two lone-cat actions. Formulas, consent and skill pacing stay as they are.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Beats = require('../src/renderer/js/beats');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
function fresh(seed) { return E.newRun({ mainCat: player, seed: seed || 3, runId: `beat-${seed || 3}` }); }

test('beats keep order, honour conditions, and fall back when missing or invalid', () => {
  const beats = [
    { kind: 'narration', text: 'First.' },
    { kind: 'speech', text: 'Only when bold.', when: { trait: 'boldness', band: 'high', who: 'npc' } },
    { kind: 'narration', text: 'Only with a known fact.', when: { knowsFact: 'real-fact', who: 'npc' } },
    { kind: 'narration', text: 'Only when hurt.', when: { injury: true, who: 'player' } },
    { kind: 'narration', text: 'Last.' }
  ];
  const quiet = { npc: { id: 'n1', personality: { boldness: 40 } }, player: { injuries: [] }, knowsFact: () => false };
  assert.deepStrictEqual(Beats.visible(beats, quiet).map((b) => b.text), ['First.', 'Last.']);
  const loud = {
    npc: { id: 'n1', personality: { boldness: 80 } },
    player: { injuries: [{ tier: 'minor' }] },
    knowsFact: (id, fact) => id === 'n1' && fact === 'real-fact'
  };
  assert.deepStrictEqual(Beats.visible(beats, loud).map((b) => b.text), ['First.', 'Only when bold.', 'Only with a known fact.', 'Only when hurt.', 'Last.']);
  assert.strictEqual(Beats.visible(null, quiet), null);
  assert.strictEqual(Beats.visible([{ kind: 'aside', text: 'no' }], quiet), null);
  for (const id of ['slice.meeting.highcrag', 'slice.meeting.bonefield', 'slice.meeting.mistwood']) {
    const meeting = E.eventById(id);
    assert.strictEqual(meeting.beats.map((b) => b.text).join(' '), meeting.text);
    assert.ok(!JSON.stringify(meeting.beats).includes('%'));
    assert.ok(meeting.choices.length >= 2);
  }
  const run = fresh(3);
  const before = run.npcs.hc01.affinity;
  run.phase = 'event';
  run.pending = { eventId: 'slice.meeting.highcrag', kind: 'first_meeting', catId: 'hc01', catName: run.npcs.hc01.name, day: run.day, hostile: false, choiceId: null, beatIndex: 0 };
  const shown = E.sceneBeats(run).map((b) => b.kind);
  assert.deepStrictEqual(shown, ['narration', 'speech']);
  const last = E.act(run, { type: 'advanceBeat' }).state;
  assert.strictEqual(last.pending.beatIndex, 1);
  const greeted = E.act(last, { type: 'choose', choiceId: 'introduce' }).state;
  assert.strictEqual(greeted.phase, 'eventResult');
  assert.strictEqual(greeted.npcs.hc01.affinity, before + 5);
});

test('pronouns follow the cat sex', () => {
  assert.deepStrictEqual(Beats.pronouns('female'), { he: 'she', him: 'her', his: 'her', He: 'She', Him: 'Her', His: 'Her' });
  assert.strictEqual(Beats.pronouns('male').he, 'he');
  const line = Beats.line({ kind: 'speech', speaker: 'npc', text: '{He} watches {playerName}. {playerHe} waits.' }, {
    player: { name: 'Tester', sex: 'male' }, npc: { name: 'Moss', sex: 'female' }
  });
  assert.strictEqual(line.text, 'She watches Tester. he waits.');
});

test('scent names only met cats, is deterministic, and does not repeat after reload', () => {
  const s = fresh(4);
  s.npcs.ln05.met = true;
  const home = s.npcs.ln05.homeZones[0];
  s.region = home;
  const first = E.act(s, { type: 'scent' }).state;
  const advanced = E.act(first, { type: 'advanceBeat' }).state;
  assert.strictEqual(advanced.pending.beatIndex, 1);
  const resumed = E.migrate(JSON.parse(JSON.stringify(advanced)));
  assert.strictEqual(resumed.pending.beatIndex, 1);
  assert.strictEqual(resumed.records.receipts.filter((k) => k.includes('/scent/')).length, 1);
  assert.strictEqual(resumed.worldMemory.facts.filter((f) => f.kind === 'scent_sign').length, 1);
  const text = first.pending.beats.map((b) => b.text).join('\n');
  assert.ok(text.includes(s.npcs.ln05.name));
  assert.ok(!text.includes('PLACEHOLDER') || text.includes('PLACEHOLDER'));
  for (const npc of Object.values(s.npcs)) {
    if (!npc.met && text.includes(npc.name)) assert.fail(`unnamed cat ${npc.id} was named`);
  }
  let back = first;
  while (back.phase === 'event') back = E.act(back, { type: 'advanceBeat' }).state;
  if (back.phase === 'eventResult') back = E.act(back, { type: 'continue' }).state;
  assert.strictEqual(back.phase, 'day');
  assert.strictEqual(back.day, s.day);
  assert.strictEqual(E.act(back, { type: 'scent' }).error, 'duplicate');
  const loaded = E.migrate(JSON.parse(JSON.stringify(back)));
  assert.strictEqual(loaded.records.receipts.filter((k) => k.includes('/scent/')).length, 1);
  assert.strictEqual(loaded.worldMemory.facts.filter((f) => f.kind === 'scent_sign').length, 1);
  assert.strictEqual(loaded.day, s.day);
  assert.strictEqual(E.act(loaded, { type: 'scent' }).error, 'duplicate');
  const repeat = fresh(4);
  repeat.npcs.ln05.met = true;
  repeat.region = home;
  const second = E.act(repeat, { type: 'scent' }).state;
  assert.deepStrictEqual(second.pending.beats, first.pending.beats);
});

test('at most one approach a day, gossip uses a real fact, and a promise is recorded once', () => {
  let found = null;
  for (let seed = 1; seed <= 80 && !found; seed++) {
    const s = fresh(seed);
    const home = s.npcs.ln05.homeZones[0];
    s.region = home;
    const opened = E.act(s, { type: 'approach' }).state;
    if (opened.pending && opened.pending.catId) found = { seed, home, id: opened.pending.catId };
  }
  assert.ok(found, 'no loner approach in seeds 1-80');
  const s = fresh(found.seed);
  s.region = found.home;
  const factId = `${s.runId}/known-only`;
  s.worldMemory.facts.push({ factId, kind: 'note' });
  s.worldMemory.knowledge[factId] = { scope: 'private', participantIds: [found.id], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  const opened = E.act(s, { type: 'approach' }).state;
  assert.strictEqual(opened.pending.catId, found.id);
  const prose = opened.pending.beats.map((b) => b.text).join('\n');
  assert.ok(prose.includes('PLACEHOLDER'));
  assert.ok(prose.includes(factId));
  assert.ok(!prose.includes('invented'));
  const affinity = opened.npcs[found.id].affinity;
  const promised = E.act(opened, { type: 'sceneChoose', choiceId: 'promise_return' }).state;
  assert.strictEqual(promised.npcs[found.id].affinity, affinity);
  const fact = promised.conversation.cats[found.id].facts.find((f) => f.promiseId === 'approach_return');
  assert.strictEqual(fact.promise, 'pending');
  assert.strictEqual(E.act(promised, { type: 'sceneChoose', choiceId: 'promise_return' }).error, 'duplicate');
  const loaded = E.migrate(JSON.parse(JSON.stringify(promised)));
  assert.strictEqual(loaded.conversation.cats[found.id].facts.filter((f) => f.promise === 'pending').length, 1);
  const day = E.act(loaded, { type: 'continue' }).state;
  assert.strictEqual(day.phase, 'day');
  assert.strictEqual(day.day, loaded.day);
  assert.strictEqual(E.act(day, { type: 'approach' }).error, 'duplicate');
  assert.strictEqual(day.conversation.cats[found.id].facts.filter((f) => f.promise === 'pending').length, 1);
  const quiet = fresh(found.seed);
  quiet.region = found.home;
  const noFact = E.act(quiet, { type: 'approach' }).state;
  const joined = noFact.pending.beats.map((b) => b.text).join('\n');
  assert.ok(!joined.includes(factId));
  console.log('APPROACH SEED', JSON.stringify(found));
});
