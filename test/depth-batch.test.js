// Batch 2 hooks, offline trait reactions, and a lost rival challenge.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Prompt = require('../src/renderer/js/storyteller-prompt');
const Traits = require('../src/renderer/js/cat-traits');
const Pairing = require('../src/renderer/js/pairing');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const tracker = j('events/pass-4-tracker.json');
const season = j('events/first-season-v0.6.2.json');
const events = j('events/slice-1.json').events;
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  encounters: j('events/encounters-v0.2.json'),
  firstSeason: season
});
const pair = Pairing.create(season, { seasonDays: 20 });
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const regionOf = {};
for (const event of events) {
  for (const choice of event.choices || []) {
    if (choice.writes && choice.writes.fact) regionOf[choice.writes.fact] = (event.regions || [])[0];
  }
}

function fresh() {
  return E.newRun({ mainCat: player, seed: 4, runId: 'depth' });
}

test('every region callback and mate line is reachable', () => {
  const callbacks = tracker.regionCallbacks;
  const mates = tracker.mateRegionLines;
  assert.strictEqual(Object.keys(callbacks).length, 22);
  assert.strictEqual(Object.keys(mates).length, 22);
  for (const [fact, line] of Object.entries(callbacks)) {
    const s = fresh();
    const factId = `${s.runId}/${fact}`;
    s.region = regionOf[fact];
    s.worldMemory.facts.push({ factId, kind: 'region_moment', region: s.region });
    s.worldMemory.knowledge[factId] = {
      scope: 'private', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1
    };
    const shown = Prompt.regionCallbackLines(s);
    assert.deepStrictEqual(shown.map((row) => row.line), [line], fact);
    const prompt = Prompt.buildOnlinePrompt(s.npcs.ln01, s.cat, s);
    assert.strictEqual(prompt.playerNarration.ownFacts[0].line, line);
    assert.ok(!prompt.cast[0].knownFactIds.includes(factId));
  }
  for (const [fact, line] of Object.entries(mates)) {
    const s = fresh();
    const factId = `${s.runId}/${fact}`;
    s.records.matePair = { mateId: 'ln05' };
    s.worldMemory.knowledge[factId] = {
      scope: 'private', participantIds: ['player'], witnessIds: [], disclosedTo: ['ln05'], prideIds: [], learnedAbsDay: 1
    };
    const shown = Prompt.mateRegionLines(s);
    assert.deepStrictEqual(shown.map((row) => row.line), [line], fact);
  }
});

test('a rest in the region and a den day with the mate speak the hooked lines', () => {
  const fact = 'region_moment/split_rock.hollow/lie_down';
  const s = fresh();
  const factId = `${s.runId}/${fact}`;
  s.region = 'split_rock';
  s.usedEvents = events.map((event) => event.id);
  s.worldMemory.facts.push({ factId, kind: 'region_moment', region: 'split_rock' });
  s.worldMemory.knowledge[factId] = {
    scope: 'private', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: 1
  };
  s.records.matePair = { mateId: 'ln05', playerId: s.cat.catId };
  s.records.pride = { id: 'pride-test', denRegionId: 'split_rock', name: 'Ash' };
  s.records.members = [{ catId: 'ln05', role: 'founder' }];
  s.npcs.ln05.homeZones = ['split_rock'];
  const rested = E.act(s, { type: 'rest' });
  assert.ok(!rested.error, rested.error);
  const lines = rested.state.report.lines.map((row) => row.text);
  assert.ok(lines.includes(tracker.regionCallbacks[fact]));
  assert.ok(lines.includes(tracker.mateRegionLines[fact]));
});

test('offline mode still speaks a trait reaction', () => {
  const remark = Traits.offerRemark({
    mode: 'offline',
    scene: 'first',
    catId: 'ln05',
    speakerName: 'Pebble',
    knownTraits: ['iron_jaw'],
    personality: { aggression: 80 },
    tags: []
  });
  assert.ok(remark.line && remark.line.includes('splits bone'));
});

test('a lost rival challenge shows only Continue, costs ten regard, and can be courted again', () => {
  const deps = { regionName: () => 'Bonefield', held: () => true, wild: () => true, applyIntent: () => 0 };
  let lost = null;
  let won = null;
  for (let day = 1; day <= 40 && (!lost || !won); day++) {
    const s = E.newRun({ mainCat: { ...player, sex: 'male' }, seed: 4, runId: 'rival' });
    pair.normalize(s);
    const target = s.npcs.bf04;
    const rival = s.npcs.bf02;
    s.day = day;
    s.records.willingness[target.id] = { accepted: true, pride: 'bonefield' };
    s.records.approval.bonefield = { approved: true };
    s.records.catToCat[`${rival.id}->${target.id}`] = { value: 40 };
    s.cat.perks = ['right_of_challenge'];
    target.sex = 'male';
    rival.sex = 'male';
    target.mateId = null;
    rival.mateId = null;
    target.stage = 'adult';
    rival.stage = 'adult';
    target.affinity = 40;
    s.records.bonds[target.id] = { stage: 'courting', originPrideId: null };
    const beforePride = s.prideRelation.bonefield;
    const beforeStage = pair.bondOf ? null : (s.records.bonds[target.id] && s.records.bonds[target.id].stage);
    const opened = pair.beginChallenge(s, target.id, deps);
    if (!opened.event) continue;
    const fight = s.records.fights.find((row) => row.catId === target.id);
    if (fight && fight.won && !won) won = { day, choices: opened.event.choices.length };
    if (fight && !fight.won && !lost) {
      const text = opened.event.lines.map((line) => line.text).join('\n');
      lost = {
        choices: opened.event.choices,
        text,
        affinity: target.affinity,
        stage: s.records.bonds[target.id] && s.records.bonds[target.id].stage,
        pride: s.prideRelation.bonefield,
        beforePride,
        beforeStage
      };
      s.day = 2;
      s.records.attractionRolled = true;
      s.records.attraction[target.id] = 'either';
      s.records.bonds[target.id].stage = 'courting';
      target.affinity = 30;
      assert.strictEqual(pair.courtGate(s, target), null);
      assert.strictEqual(pair.beginChallenge(s, target.id, deps).error, 'duplicate');
    }
  }
  assert.ok(lost, 'no lost challenge');
  assert.ok(won, 'no won challenge');
  assert.deepStrictEqual(lost.choices, []);
  assert.ok(!lost.text.includes('Would you be my mate?'));
  assert.strictEqual(lost.text.split('I won\'t pretend that didn\'t matter here.').length, 2);
  assert.strictEqual(lost.affinity, 30);
  assert.strictEqual(lost.pride, lost.beforePride);
  assert.ok(won.choices > 0, 'a win still offers the mate question');
});
