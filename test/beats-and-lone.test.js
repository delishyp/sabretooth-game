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
  const voice = j('events/sample-beats.json');
  const doc = fs.readFileSync(path.join(__dirname, '../docs/narrative/voice-pass-1.md'), 'utf8');
  assert.ok(doc.includes('The wind turns, and with it comes the warm, grassy musk of a horse foal'));
  assert.ok(doc.includes('slice.meeting.bonefield'));
  assert.ok(fs.readFileSync(path.join(__dirname, '../docs/design/lone-cat-actions-v0.1.md'), 'utf8').includes('Read scent sign'));
  const bone = E.eventById('slice.meeting.bonefield');
  assert.deepStrictEqual(bone.beats.map((b) => b.text), voice['slice.meeting.bonefield'].beats.map((b) => b.text));
  assert.deepStrictEqual(bone.choices.map((c) => c.id), ['steady', 'withdraw', 'insult']);
  assert.ok(!JSON.stringify(bone.beats).includes('%'));
  assert.strictEqual(E.eventById('slice.meeting.highcrag').beats, undefined);
  assert.strictEqual(E.eventById('slice.meeting.mistwood').beats, undefined);
  const repeat = voice['m2.repeat_meeting'].beats;
  const calm = { npc: { id: 'n1', personality: { sociability: 50 }, injuries: [] }, knowsFact: () => false, knowsAny: () => false };
  assert.deepStrictEqual(Beats.visible(repeat, calm).map((b) => b.text).filter((t) => t.includes('You again.') || t.includes('flat stone') || t.includes('heartbeat')).length, 2);
  const hurt = { npc: { id: 'n1', personality: { sociability: 80 }, injuries: [{ tier: 'minor' }] }, knowsAny: () => true, knowsFact: () => false };
  const hurtText = Beats.visible(repeat, hurt).map((b) => b.text).join('\n');
  assert.ok(hurtText.includes("smells of a wound that's still healing"));
  assert.ok(!hurtText.includes('fresh scratch'));
  assert.ok(hurtText.includes("I've heard a few things lately"));
  assert.ok(!hurtText.includes('You again.'));
  const run = fresh(3);
  const before = run.npcs.bf01.affinity;
  run.phase = 'event';
  run.pending = { eventId: 'slice.meeting.bonefield', kind: 'first_meeting', catId: 'bf01', catName: run.npcs.bf01.name, day: run.day, hostile: false, choiceId: null, beatIndex: 0 };
  const leaderBeats = E.sceneBeats(run);
  assert.ok(leaderBeats.length >= 3);
  assert.match(leaderBeats.map((b) => b.text).join(' '), /I lead Bonefield/);
  let last = run;
  while ((last.pending.beatIndex || 0) < leaderBeats.length - 1) last = E.act(last, { type: 'advanceBeat' }).state;
  assert.strictEqual(last.pending.beatIndex, leaderBeats.length - 1);
  const greeted = E.act(last, { type: 'choose', choiceId: 'steady' }).state;
  assert.strictEqual(greeted.phase, 'eventResult');
  assert.strictEqual(greeted.npcs.bf01.affinity, before + 5);
  const grass = fresh(11);
  grass.region = 'bonefield';
  const hunted = E.act(grass, { type: 'hunt', size: 'medium' }).state;
  const huntLine = hunted.report.lines.find((l) => l.k === 'hunt');
  const said = E.huntReportText(huntLine, hunted.report.region);
  assert.ok(said);
  assert.ok(!said.includes('%'));
  assert.ok(said === 'The prey escaped.' || said.startsWith('You caught medium prey and ate.'));
  assert.ok(String(hunted.pending.eventId).startsWith('voice.hunt.medium.steppe'));
  assert.strictEqual(hunted.pending.beats.length, 4);
  const small = fresh(11);
  small.region = 'bonefield';
  const other = E.act(small, { type: 'hunt', size: 'small' }).state;
  const smallLine = other.report.lines.find((l) => l.k === 'hunt');
  assert.strictEqual(E.huntReportText(smallLine, other.report.region), null);
});

test('pronouns follow the cat sex', () => {
  assert.deepStrictEqual(Beats.pronouns('female'), { he: 'she', him: 'her', his: 'her', He: 'She', Him: 'Her', His: 'Her' });
  assert.strictEqual(Beats.pronouns('male').he, 'he');
  const line = Beats.line({ kind: 'speech', speaker: 'npc', text: '{He} watches {playerName}. {playerHe} waits.' }, {
    player: { name: 'Tester', sex: 'male' }, npc: { name: 'Moss', sex: 'female' }
  });
  assert.strictEqual(line.text, '\u201CShe watches Tester. he waits.\u201D');
});

test('scent names only met cats, is deterministic, and does not repeat after reload', () => {
  const s = fresh(4);
  s.npcs.ln05.met = true;
  const home = s.npcs.ln05.homeZones[0];
  s.region = home;
  const xpBefore = JSON.stringify(s.records.playerSkills.xp);
  const first = E.act(s, { type: 'scent' }).state;
  const advanced = E.act(first, { type: 'advanceBeat' }).state;
  assert.strictEqual(advanced.pending.beatIndex, 1);
  const resumed = E.migrate(JSON.parse(JSON.stringify(advanced)));
  assert.strictEqual(resumed.pending.beatIndex, 1);
  assert.strictEqual(resumed.records.receipts.filter((k) => k.includes('/scent/')).length, 1);
  assert.strictEqual(resumed.worldMemory.facts.filter((f) => f.kind === 'scent_sign').length, 1);
  const text = first.pending.beats.map((b) => b.text).join('\n');
  assert.ok(text.includes(s.npcs.ln05.name));
  const openers = j('events/scent-sign-v1.json').openers;
  assert.ok(openers.some((line) => text.includes(line)), text);
  assert.ok(/prey-scent/i.test(text));
  assert.ok(/you don't know/i.test(text));
  assert.strictEqual(first.pending.skill, 'threatScent');
  assert.strictEqual(first.pending.xpOutcome, 10);
  const fact = first.worldMemory.facts.find((f) => f.kind === 'scent_sign');
  assert.strictEqual(fact.xpGranted, false);
  assert.strictEqual(fact.xpOutcome, 10);
  assert.strictEqual(JSON.stringify(first.records.playerSkills.xp), xpBefore);
  assert.ok(first.records.receipts.includes(`${s.runId}/scent/${home}/${s.day}`));
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
  const prep = (seed) => {
    const s = fresh(seed);
    for (const n of Object.values(s.npcs)) if (n.faction === 'loner') { n.met = true; n.affinity = 25; }
    s.region = s.npcs.ln05.homeZones[0];
    return s;
  };
  let found = null;
  for (let seed = 1; seed <= 80 && !found; seed++) {
    const opened = E.act(prep(seed), { type: 'approach' }).state;
    if (opened.pending && opened.pending.catId) found = { seed, id: opened.pending.catId };
  }
  assert.ok(found, 'no known loner with value 20 approached in seeds 1-80');
  const s = prep(found.seed);
  const cat = s.npcs[found.id];
  cat.personality = Object.assign({}, cat.personality, { sociability: 40, aggression: 40, loyalty: 80, curiosity: 40 });
  const factId = `${s.runId}/known-only`;
  const playerFact = `${s.runId}/player-knows`;
  s.worldMemory.facts.push({ factId, kind: 'note' }, { factId: playerFact, kind: 'note' });
  s.worldMemory.knowledge[factId] = { scope: 'private', participantIds: [found.id], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  s.worldMemory.knowledge[playerFact] = { scope: 'private', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1 };
  const opened = E.act(s, { type: 'approach' }).state;
  assert.strictEqual(opened.pending.catId, found.id);
  assert.strictEqual(opened.pending.opener, 'loyal');
  const prose = opened.pending.beats.map((b) => b.text).join('\n');
  assert.ok(!prose.includes('PLACEHOLDER'));
  assert.ok(prose.includes('saw me out here'));
  assert.ok(!prose.includes(factId));
  assert.ok(!prose.includes('invented'));
  assert.ok(!prose.includes(playerFact));
  const affinity = opened.npcs[found.id].affinity;
  const promised = E.act(opened, { type: 'sceneChoose', choiceId: 'accept_request' }).state;
  assert.strictEqual(promised.npcs[found.id].affinity, affinity);
  const fact = promised.conversation.cats[found.id].facts.find((f) => f.promiseId === 'keep_secret');
  assert.strictEqual(fact.promise, 'pending');
  assert.strictEqual(E.act(promised, { type: 'sceneChoose', choiceId: 'accept_request' }).error, 'duplicate');
  const loaded = E.migrate(JSON.parse(JSON.stringify(opened)));
  const spread = E.act(loaded, { type: 'sceneChoose', choiceId: 'rumor_spread' }).state;
  assert.ok(spread.worldMemory.knowledge[playerFact].disclosedTo.includes(found.id));
  assert.ok(!spread.worldMemory.facts.some((f) => String(f.factId).includes('invented')));
  const day = E.act(spread, { type: 'continue' }).state;
  assert.strictEqual(day.phase, 'day');
  assert.strictEqual(day.day, loaded.day);
  assert.strictEqual(E.act(day, { type: 'approach' }).error, 'duplicate');
  const unmet = fresh(found.seed);
  unmet.region = unmet.npcs.ln05.homeZones[0];
  const noOne = E.act(unmet, { type: 'approach' }).state;
  assert.strictEqual(noOne.pending.catId, null);
  console.log('APPROACH SEED', JSON.stringify(found));
});

test('scent openers rotate by day and region and do not repeat two days running', () => {
  const openers = j('events/scent-sign-v1.json').openers;
  const regions = j('map.json').regions.map((r) => r.id);
  const s = fresh(4);
  s.region = regions[0];
  const spec = { regionIndex: 0, preyValue: null, hazards: [] };
  const first = E.lone.scentLines(s, spec).lines[0];
  s.day += 1;
  const second = E.lone.scentLines(s, spec).lines[0];
  assert.ok(openers.includes(first));
  assert.notStrictEqual(second, first);
  const collide = (s.day + 1 + 0) % openers.length;
  s.day += 1;
  s.records.scentOpener = { day: s.day - 1, index: collide };
  const bumped = E.lone.scentLines(s, spec).lines[0];
  assert.strictEqual(bumped, openers[(collide + 1) % openers.length]);
  assert.strictEqual(E.lone.scentLines(s, spec).lines[0], bumped);
  const moved = fresh(5);
  moved.day = 2;
  moved.region = regions[4] || regions[0];
  const stayed = E.lone.scentLines(moved, { regionIndex: 0, preyValue: null, hazards: [] }).lines[0];
  delete moved.records.scentOpener;
  const shifted = E.lone.scentLines(moved, { regionIndex: 4 % openers.length, preyValue: null, hazards: [] }).lines[0];
  if (stayed === shifted) assert.fail('a same-day region change reused an opener after the record was cleared');
});
