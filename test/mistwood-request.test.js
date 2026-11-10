// Mistwood "cats come to you" request. The promise uses the existing share +10 and does not add +5.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const scene = j('events/sample-beats.json')['npc_initiative.mistwood.request_help.v1'];
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
function fresh(seed) { return E.newRun({ mainCat: player, seed: seed || 1, runId: `mw-${seed || 1}` }); }
function loyal(npc, affinity) {
  npc.met = true;
  npc.affinity = affinity;
  npc.personality = { aggression: 40, sociability: 50, boldness: 40, loyalty: 90, curiosity: 40 };
}
function approach(s) { return E.act(s, { type: 'approach' }); }

test('the mistwood request uses the authored beats and only the matching conditions', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../docs/narrative/scene-cats-come-to-you-mistwood-v1.md'), 'utf8');
  for (const beat of scene.beats) assert.ok(doc.includes(beat.text), beat.text);
  assert.ok(doc.includes(scene.replies.bring));
  assert.ok(doc.includes(scene.replies.kept));
  assert.ok(doc.includes(scene.replies.broken));
  assert.ok(doc.includes(scene.gossip.bonefieldBorder));
  const offline = [scene.beats[0].text, scene.beats[5].text, scene.beats[7].text].join(' ');
  assert.strictEqual(scene.text, offline);
  let found = null;
  for (let seed = 1; seed <= 80 && !found; seed++) {
    const s = fresh(seed);
    loyal(s.npcs.mw04, 25);
    s.region = 'mistwood';
    const opened = approach(s);
    if (opened.state.pending && opened.state.pending.eventId === 'npc_initiative.mistwood.request_help.v1') found = { seed, id: opened.state.pending.catId };
  }
  assert.ok(found, 'no mistwood request in seeds 1-80');
  const s = fresh(found.seed);
  loyal(s.npcs.mw04, 25);
  s.npcs.mw04.personality.curiosity = 80;
  s.region = 'mistwood';
  const factId = 'border/bonefield/witness';
  s.worldMemory.facts.push({ factId, kind: 'border', faction: 'bonefield' });
  s.worldMemory.knowledge[factId] = { scope: 'private', participantIds: ['mw04'], witnessIds: ['mw04'], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  const opened = approach(s).state;
  assert.strictEqual(opened.pending.catId, 'mw04');
  assert.strictEqual(opened.pending.want, 'feed_the_pride');
  const shown = E.sceneBeats(opened).map((b) => b.text);
  assert.strictEqual(shown[0], scene.beats[0].text);
  assert.ok(shown.some((t) => t.includes('Quietly, please')));
  assert.ok(shown.some((t) => t.includes('Does it get easier?')));
  assert.ok(shown.some((t) => t === scene.gossip.bonefieldBorder));
  assert.strictEqual(shown.at(-1), scene.beats[7].text);
  const quiet = fresh(found.seed);
  loyal(quiet.npcs.mw04, 25);
  quiet.region = 'mistwood';
  const plain = E.sceneBeats(approach(quiet).state).map((b) => b.text).join('\n');
  assert.ok(!plain.includes('Bonefield'));
  assert.ok(!plain.includes('Does it get easier?'));
  const low = fresh(found.seed);
  low.region = 'mistwood';
  low.npcs.mw04.met = true;
  low.npcs.mw04.affinity = 19;
  low.npcs.mw04.personality = { aggression: 40, sociability: 40, boldness: 40, loyalty: 90, curiosity: 40 };
  assert.notStrictEqual(approach(low).state.pending.eventId, 'npc_initiative.mistwood.request_help.v1');
  const away = fresh(found.seed);
  loyal(away.npcs.mw04, 25);
  away.region = 'split_rock';
  assert.notStrictEqual(approach(away).state.pending.eventId, 'npc_initiative.mistwood.request_help.v1');
  console.log('MISTWOOD SEED', JSON.stringify(found));
});

test('accepting records the promise, asking returns to the other choices, and declining changes nothing', () => {
  const s = fresh(1);
  loyal(s.npcs.mw04, 30);
  s.region = 'mistwood';
  let opened = null;
  for (let seed = 1; seed <= 80 && !opened; seed++) {
    const t = fresh(seed);
    loyal(t.npcs.mw04, 30);
    t.region = 'mistwood';
    const row = approach(t);
    if (row.state.pending && row.state.pending.eventId === 'npc_initiative.mistwood.request_help.v1') opened = { seed, state: row.state };
  }
  assert.ok(opened);
  const asked = E.act(opened.state, { type: 'sceneChoose', choiceId: 'ask_pride' }).state;
  assert.strictEqual(asked.phase, 'event');
  assert.strictEqual(asked.npcs.mw04.affinity, 30);
  assert.deepStrictEqual(asked.pending.choices.map((c) => c.id), ['bring_prey', 'decline']);
  assert.ok(asked.pending.reply.includes('since the Breaking'));
  const declined = E.act(asked, { type: 'sceneChoose', choiceId: 'decline' }).state;
  assert.strictEqual(declined.npcs.mw04.affinity, 30);
  assert.ok(declined.pending.summary.includes('Forget you saw me'));
  assert.strictEqual(E.lone.bringPrey(declined, 'mw04'), null);
  const again = fresh(opened.seed);
  loyal(again.npcs.mw04, 30);
  again.npcs.mw04.personality.sociability = 20;
  again.region = 'mistwood';
  const low = approach(again).state;
  const curt = E.act(low, { type: 'sceneChoose', choiceId: 'decline' }).state;
  assert.strictEqual(curt.pending.summary, '“Then forget I asked.”');
  assert.strictEqual(curt.npcs.mw04.affinity, 30);
  const promisedRun = fresh(opened.seed);
  loyal(promisedRun.npcs.mw04, 30);
  promisedRun.region = 'mistwood';
  const promised = E.act(approach(promisedRun).state, { type: 'sceneChoose', choiceId: 'bring_prey' }).state;
  const fact = E.lone.bringPrey(promised, 'mw04');
  assert.strictEqual(fact.promise, 'pending');
  assert.strictEqual(fact.kind, 'bring_prey');
  assert.strictEqual(fact.want, 'feed_the_pride');
  assert.strictEqual(promised.npcs.mw04.affinity, 30);
  assert.ok(promised.pending.summary.includes('Then I owe you'));
  assert.ok(promised.pending.summary.includes('melts back into the fog'));
});

test('a kept share is +10 not +15, a refusal is -5 once, and waiting does not break it', () => {
  const s = fresh(4);
  loyal(s.npcs.mw04, 25);
  s.npcs.ln01.met = true;
  s.npcs.ln01.affinity = 10;
  const factId = 'bring_prey/1';
  if (!s.conversation.cats.mw04) s.conversation.cats.mw04 = { facts: [], activeByTopic: {}, log: [] };
  s.conversation.cats.mw04.facts.push({
    factId, catId: 'mw04', promise: 'pending', promiseId: 'bring_prey', kind: 'bring_prey', want: 'feed_the_pride',
    keptText: scene.replies.kept, brokenText: scene.replies.broken, told: false, status: 'active'
  });
  s.report = { day: s.day, region: 'mistwood', lines: [{ k: 'hunt', size: 'medium', ok: true, ate: 50, chance: 40 }] };
  s.records._huntOk = false;
  s.phase = 'event';
  s.pending = {
    bond: true, eventId: 'm2.repeat_meeting', catId: 'mw04', catName: s.npcs.mw04.name, day: s.day,
    choices: [{ id: 'share', label: 'Drag your kill closer and share it.', result: 'share', summary: 'You shared your kill.' }]
  };
  const shared = E.act(s, { type: 'choose', choiceId: 'share' }).state;
  assert.strictEqual(shared.npcs.mw04.affinity, 35);
  assert.strictEqual(shared.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').promise, 'kept');
  assert.ok(shared.pending.summary.includes('Thank you, loner'));
  assert.ok(shared.records.receipts.includes(`${s.runId}/mw04/${factId}`));
  const again = E.act(shared, { type: 'choose', choiceId: 'share' });
  assert.ok(again.error);
  assert.strictEqual(again.state.npcs.mw04.affinity, 35);
  const loaded = E.migrate(JSON.parse(JSON.stringify(shared)));
  assert.strictEqual(loaded.npcs.mw04.affinity, 35);
  assert.strictEqual(loaded.records.receipts.filter((k) => k === `${s.runId}/mw04/${factId}`).length, 1);
  const waited = fresh(5);
  loyal(waited.npcs.mw04, 25);
  waited.conversation.cats.mw04 = { facts: [], activeByTopic: {}, log: [] };
  waited.conversation.cats.mw04.facts.push({
    factId, catId: 'mw04', promise: 'pending', promiseId: 'bring_prey', kind: 'bring_prey', want: 'feed_the_pride',
    keptText: scene.replies.kept, brokenText: scene.replies.broken, told: false, status: 'active'
  });
  waited.day = 18;
  assert.strictEqual(E.lone.bringPrey(waited, 'mw04').promise, 'pending');
  assert.strictEqual(waited.npcs.mw04.affinity, 25);
  waited.phase = 'event';
  waited.pending = {
    bond: true, eventId: 'm2.repeat_meeting', catId: 'mw04', catName: waited.npcs.mw04.name, day: waited.day,
    choices: [{ id: 'refuse_prey', label: '“I can\'t.”', result: 'refuse_prey' }]
  };
  const refused = E.act(waited, { type: 'choose', choiceId: 'refuse_prey' }).state;
  assert.strictEqual(refused.npcs.mw04.affinity, 20);
  assert.strictEqual(refused.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').promise, 'broken');
  assert.ok(refused.pending.summary.includes('I waited at the reeds'));
  const second = E.act(refused, { type: 'choose', choiceId: 'refuse_prey' });
  assert.strictEqual(second.state.npcs.mw04.affinity, 20);
  const given = fresh(6);
  loyal(given.npcs.mw04, 25);
  given.npcs.ln01.met = true;
  given.npcs.ln01.affinity = 10;
  given.conversation.cats.mw04 = { facts: [], activeByTopic: {}, log: [] };
  given.conversation.cats.mw04.facts.push({
    factId, catId: 'mw04', promise: 'pending', promiseId: 'bring_prey', kind: 'bring_prey', want: 'feed_the_pride',
    keptText: scene.replies.kept, brokenText: scene.replies.broken, told: false, status: 'active'
  });
  given.report = { day: given.day, region: 'mistwood', lines: [{ k: 'hunt', ok: true, size: 'small', ate: 25, chance: 50 }] };
  given.phase = 'event';
  given.pending = {
    bond: true, eventId: 'm2.repeat_meeting', catId: 'ln01', catName: given.npcs.ln01.name, day: given.day,
    choices: [{ id: 'share', result: 'share', label: 'Drag your kill closer and share it.', summary: 'Shared.' }]
  };
  const other = E.act(given, { type: 'choose', choiceId: 'share' }).state;
  assert.strictEqual(other.npcs.ln01.affinity, 20);
  assert.strictEqual(other.npcs.mw04.affinity, 25);
  assert.strictEqual(other.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').promise, 'pending');
  assert.ok(!other.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').brokenAt);
  const reloaded = E.migrate(JSON.parse(JSON.stringify(other)));
  assert.strictEqual(reloaded.npcs.mw04.affinity, 25);
  assert.strictEqual(reloaded.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').promise, 'pending');
});

test('a bring_prey promise has no deadline: skipping or sharing elsewhere leaves it open, and only a refusal breaks it', () => {
  const kept = fresh(8);
  loyal(kept.npcs.mw04, 25);
  E.lone.promiseShare(kept, 'mw04');
  kept.report = { day: kept.day, region: 'mistwood', lines: [{ k: 'hunt', size: 'medium', ok: true, ate: 50, chance: 40 }] };
  kept.records._huntOk = true;
  kept.phase = 'event';
  kept.pending = {
    bond: true, eventId: 'm2.repeat_meeting', catId: 'mw04', catName: kept.npcs.mw04.name, day: kept.day,
    choices: [{ id: 'share', result: 'share', label: 'Drag your kill closer and share it.', summary: 'You shared your kill.' }]
  };
  const shared = E.act(kept, { type: 'choose', choiceId: 'share' }).state;
  assert.strictEqual(shared.conversation.cats.mw04.facts.find((f) => f.promiseId === 'bring_prey').promise, 'kept');
  assert.strictEqual(E.lone.bringPrey(shared, 'mw04'), null);

  const s = fresh(9);
  loyal(s.npcs.mw04, 25);
  s.npcs.ln01.met = true;
  s.npcs.ln01.affinity = 10;
  const factId = E.lone.promiseShare(s, 'mw04');
  const open = E.lone.bringPrey(s, 'mw04');
  assert.strictEqual(open.promise, 'pending');
  assert.ok(!Object.prototype.hasOwnProperty.call(open, 'deadline'));
  assert.ok(!Object.prototype.hasOwnProperty.call(open, 'expiresDay'));
  assert.ok(!String(factId).includes(String(s.day)));
  s.day = 40;
  s.records._huntOk = true;
  s.report = { day: s.day, region: 'mistwood', lines: [{ k: 'hunt', size: 'small', ok: true, ate: 25, chance: 50 }] };
  assert.strictEqual(E.lone.bringPrey(s, 'mw04').promise, 'pending');
  s.phase = 'event';
  s.pending = {
    bond: true, eventId: 'm2.repeat_meeting', catId: 'ln01', catName: s.npcs.ln01.name, day: s.day,
    choices: [{ id: 'share', result: 'share', label: 'Drag your kill closer and share it.', summary: 'Shared.' }]
  };
  const elsewhere = E.act(s, { type: 'choose', choiceId: 'share' }).state;
  assert.strictEqual(E.lone.bringPrey(elsewhere, 'mw04').promise, 'pending');
  assert.strictEqual(elsewhere.npcs.mw04.affinity, 25);
  elsewhere.phase = 'event';
  elsewhere.pending = {
    bond: true, eventId: 'm2.repeat_meeting', catId: 'mw04', catName: elsewhere.npcs.mw04.name, day: elsewhere.day,
    choices: [{ id: 'refuse_prey', label: '“I can\'t.”', result: 'refuse_prey' }]
  };
  const refused = E.act(elsewhere, { type: 'choose', choiceId: 'refuse_prey' }).state;
  const broken = refused.conversation.cats.mw04.facts.find((f) => f.factId === factId);
  assert.strictEqual(broken.promise, 'broken');
  assert.strictEqual(broken.brokenAt, 'refused');
});
