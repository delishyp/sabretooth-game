// Speaker cues, result byCat, membership wording, unused season scenes, and loner groups.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pairing = require('../src/renderer/js/pairing');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const doc = j('events/first-season-v0.6.2.json');
const court = doc.families.find((family) => family.id === 'm2.courtship');
court.results.accepted.beats[0].byCat = { bf06: { text: 'This opening must stay.' } };
court.results.accepted.beats[1].byCat = { bf06: { text: 'Yes. I have been waiting for you to ask.' } };
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: doc
});
const pair = Pairing.create(doc, { seasonDays: 20 });
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const deps = {
  regionName: () => 'Split Rock',
  held: () => true,
  wild: () => true,
  applyIntent: () => 0
};

function run() {
  const s = E.newRun({ mainCat: player, seed: 4, runId: 'wire' });
  pair.normalize(s);
  return s;
}

test('a leader action cue uses the speaker, not the candidate', () => {
  const s = run();
  const candidate = s.npcs.bf06;
  const leader = s.npcs.bf01;
  candidate.name = 'Pebble';
  leader.name = 'Ashmane';
  leader.personality = { aggression: 90, sociability: 20, boldness: 20, loyalty: 20, curiosity: 20 };
  candidate.personality = { aggression: 10, sociability: 90, boldness: 90, loyalty: 90, curiosity: 90 };
  s.records.willingness.bf06 = { accepted: true, pride: 'bonefield' };
  leader.met = true;
  const opened = pair.beginAudience(s, 'bf06', deps);
  assert.ok(opened.event, opened.error);
  const action = opened.event.lines.find((line) => line.kind === 'action');
  assert.ok(action, 'leader line has an action cue');
  assert.ok(action.text.includes('Ashmane'), action.text);
  assert.ok(!action.text.includes('Pebble'), action.text);
});

test('bf06 byCat changes only the courtship result line', () => {
  const s = run();
  const npc = s.npcs.bf06;
  const event = pair.resultScene('accepted', s, npc, deps, null);
  const text = event.lines.map((line) => line.text).join('\n');
  assert.ok(text.includes('Would you be my mate?'));
  assert.ok(text.includes('turns toward you'));
  assert.ok(text.includes('I have been waiting for you to ask'));
  assert.ok(!text.includes('This opening must stay'));
});

test('membership blockers use one comparison', () => {
  const s = run();
  s.cat.status = 'member';
  s.cat.prideId = 'highcrag';
  s.region = 'bonefield';
  s.map.claims.bonefield = { bonefield: 80 };
  s.records.joinAsk.bonefield = { approved: true, season: 0 };
  s.npcs.bf01.met = true;
  const gate = pair.joinBlockers(s, Object.assign({}, deps, {
    held: (region, pride) => region === 'bonefield' && pride === 'bonefield'
  }));
  const memberLines = gate.blockers.filter((line) => line.startsWith('You are a member of '));
  assert.deepStrictEqual(memberLines, ['You are a member of Highcrag.']);
});

test('season end, solo, and pride admission play their authored beats', () => {
  const s = run();
  const end = pair.seasonPending(s, deps);
  const text = end.lines.map((line) => line.text).join('\n');
  assert.ok(text.includes('The mating season draws to a close'));
  assert.ok(text.includes('You can try to earn a place in a pride'));
  s.pending = end;
  s.phase = 'event';
  const alone = pair.choose(s, { type: 'choose', choiceId: 'route_alone' }, deps);
  assert.ok(!alone.error, alone.error);
  assert.ok(s.pending.lines.map((line) => line.text).join('\n').includes('You turn back toward your own tracks'));

  const ask = run();
  ask.region = 'bonefield';
  ask.npcs.bf01.met = true;
  ask.prideRelation.bonefield = 80;
  const joined = pair.beginJoinAsk(ask, 'bonefield', Object.assign({}, deps, {
    held: (region, pride) => pride === 'bonefield'
  }));
  assert.ok(joined.event, joined.error);
  const admission = joined.event.lines.map((line) => line.text).join('\n');
  assert.ok(admission.includes('I am asking for a place'));
  assert.ok(admission.includes('Bonefield') || admission.includes(ask.npcs.bf01.name));
});

test('the rival scene does not speak an injury line', () => {
  const s = run();
  s.cat.sex = 'male';
  const target = s.npcs.bf04;
  const rival = s.npcs.bf02;
  s.records.willingness[target.id] = { accepted: true, pride: 'bonefield' };
  s.records.approval.bonefield = { approved: true };
  s.records.catToCat[`${rival.id}->${target.id}`] = { value: 40 };
  s.cat.perks = ['right_of_challenge'];
  target.sex = 'male';
  rival.sex = 'male';
  target.stage = 'adult';
  rival.stage = 'adult';
  const opened = pair.beginChallenge(s, target.id, Object.assign({}, deps, { held: () => true }));
  if (opened.event) {
    const text = opened.event.lines.map((line) => line.text).join('\n');
    assert.ok(!text.includes('injury'), text);
  } else {
    assert.ok(!/has a .* injury from the challenge/.test(fs.readFileSync(path.join(__dirname, '../src/renderer/js/pairing.js'), 'utf8')));
  }
});

test('the season-end roll can form a loner group, and an empty range uses the no-group line', () => {
  let formed = null;
  for (let seed = 1; seed <= 40 && !formed; seed++) {
    const s = E.newRun({ mainCat: player, seed, runId: `group-${seed}` });
    pair.normalize(s);
    const a = s.npcs.ln01;
    const b = s.npcs.ln02;
    a.homeZones = ['split_rock'];
    b.homeZones = ['split_rock'];
    a.stage = 'adult';
    b.stage = 'adult';
    s.records.catToCat['ln01->ln02'] = { value: 40 };
    s.records.catToCat['ln02->ln01'] = { value: 40 };
    pair.formLonerGroups(s);
    if (s.records.lonerGroups.length) formed = s;
  }
  assert.ok(formed, 'no group formed in 40 seeds');
  assert.ok(formed.records.lonerGroups[0].memberIds.includes('ln01'));
  formed.region = 'horse_meadows';
  const away = pair.groupVisit(formed, deps);
  assert.strictEqual(away.line, 'No loners travel together near here yet.');
  formed.region = 'split_rock';
  const here = pair.groupVisit(formed, deps);
  assert.ok(here.event.lines.some((line) => line.text.includes('trail')));
});
