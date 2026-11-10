// Hyena cues, courtship reasons, bond labels, and the null year length.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pairing = require('../src/renderer/js/pairing');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(require('fs').readFileSync(path.join(D, f), 'utf8'));
const doc = j('events/first-season-v0.6.2.json');
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
const deps = { regionName: () => 'Split Rock', held: () => true, wild: () => true, applyIntent: () => 0 };

function run(seed) {
  const s = E.newRun({ mainCat: player, seed: seed || 4, runId: `finish-${seed || 4}` });
  pair.normalize(s);
  return s;
}
function flat(extra) {
  return Object.assign({ aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 }, extra || {});
}

function hyenaRun() {
  const main = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {}, portraitId: 'cat-6e2d788dd48ff440' };
  return E.newRun({ mainCat: main, seed: 3, runId: 'hyena-finish' });
}

test('the cat at the cache uses its own cues, not the hunter\'s', () => {
  let cur = E.act(hyenaRun(), { type: 'travel', to: 'twin_forks' }).state;
  cur = E.act(cur, { type: 'encounterChoose', choiceId: 'drive_off' }).state;
  cur = E.act(cur, { type: 'encounterChoose', choiceId: 'warn_off_trespasser' }).state;
  const lines = E.encounterView(cur).lines;
  const said = lines.find((line) => line.speakerId === 'bf01');
  const outsider = lines[lines.indexOf(said) - 1];
  assert.strictEqual(outsider.kind, 'action');
  assert.ok(!/kill|carcass|hyena/i.test(outsider.text), outsider.text);
  assert.ok(/gap|still|back|square|closer|quiet/i.test(outsider.text), outsider.text);
});

test('asking the lingering cat plays the reply, and the question comes first', () => {
  let cur = E.act(hyenaRun(), { type: 'travel', to: 'twin_forks' }).state;
  cur = E.act(cur, { type: 'encounterChoose', choiceId: 'drive_off' }).state;
  const before = E.encounterView(cur).lines.map((line) => line.text);
  assert.ok(before.some((line) => /ask them to move away/i.test(line)));
  cur = E.act(cur, { type: 'encounterChoose', choiceId: 'warn_off_trespasser' }).state;
  const after = E.encounterView(cur).lines.map((line) => line.text);
  const added = after.slice(before.length);
  assert.ok(!added.some((line) => /ask them to move away|Will you ask/i.test(line)));
  assert.ok(added.some((line) => /move away|moved away|clear of the cache/i.test(line)));
});

test('a middle focus trait uses the middle hyena cue', () => {
  const s = hyenaRun();
  s.npcs.hc05.personality = flat({ aggression: 90, loyalty: 50 });
  const cur = E.act(s, { type: 'travel', to: 'twin_forks' }).state;
  const action = E.encounterView(cur).lines.find((line) => line.kind === 'action');
  assert.ok(action.text.includes('checking the carcass'), action.text);
  assert.ok(!action.text.includes('lip curls'), action.text);
});

test('bond stage, join cooldown, and a full group use the hint strings', () => {
  assert.strictEqual(E.bondLabel('close'), 'Bonded');
  assert.strictEqual(E.bondLabel('met'), 'Met');
  const s = run(5);
  s.region = 'bonefield';
  s.npcs.bf01.met = true;
  s.records.joinAsk.bonefield = { approved: false, season: 1 };
  const gate = pair.joinBlockers(s, Object.assign({}, deps, { held: (region, pride) => pride === 'bonefield' }));
  assert.ok(gate.blockers.some((line) => line.includes('already asked this pride')));
  s.records.lonerGroups = [{ id: 'full', memberIds: ['ln01', 'ln02', 'ln03'], homeZones: ['split_rock'] }];
  s.region = 'split_rock';
  const visit = pair.groupVisit(s, deps);
  assert.ok(visit.line.includes('no room'));
});

test('an unknown cat is not called male, and a strange scent line has no placeholder', () => {
  const s = run(8);
  s.region = 'horse_meadows';
  s.usedEvents = ['slice.region.horse_meadows'];
  const cat = s.npcs.ln05;
  cat.sex = null;
  cat.name = 'Ash';
  cat.homeZones = ['horse_meadows'];
  cat.lastRegion = 'horse_meadows';
  for (const npc of Object.values(s.npcs)) if (npc.id !== cat.id) npc.homeZones = ['ice_wall'];
  s.pending = {
    meadow: true, eventId: 'slice.region.horse_meadows', title: 'Heads raised', day: s.day, beatIndex: 0,
    beats: [], choices: [{ id: 'watch_herd', label: 'Watch' }]
  };
  s.phase = 'event';
  const watched = E.act(s, { type: 'choose', choiceId: 'watch_herd' }).state;
  const text = ((watched.pending && watched.pending.beats) || (watched.report && watched.report.lines) || []).map((beat) => beat.text || '').join('\n');
  assert.ok(text.includes('Ash'), text);
  assert.ok(text.includes('their'), text);
  assert.ok(!/\bhis\b/.test(text), text);
  const scent = E.lone.scentLines(s, { holder: null, preyValue: null, hazards: [] });
  assert.ok(!scent.lines.some((line) => /A tom/.test(line) || line.includes('{')));
});

test('each courtship block has its own reason, and a null year stays generic', () => {
  const s = run(6);
  const npc = s.npcs.ln04;
  npc.met = true;
  s.records.bonds[npc.id] = { stage: 'close' };
  s.records.attractionRolled = true;
  s.records.attraction[npc.id] = 'either';
  npc.affinity = 40;
  npc.stage = 'cub';
  assert.strictEqual(pair.courtGate(s, npc).code, 'court.ineligible.young');
  npc.stage = 'adult';
  npc.mateId = 'ln01';
  assert.strictEqual(pair.courtGate(s, npc).code, 'court.ineligible.mated');
  npc.mateId = null;
  s.cat.lifeStage = 'cub';
  assert.strictEqual(pair.courtGate(s, npc).code, 'court.ineligible');
  s.cat.lifeStage = 'adult';
  const key = `${s.cat.catId}->${npc.id}`;
  s.records.catToCat[key] = { value: 20, kinds: ['family'] };
  assert.strictEqual(pair.courtGate(s, npc).code, 'court.ineligible.kin');
  s.records.catToCat[key].kinds = [];
  s.records.catToCat[key].value = -20;
  assert.strictEqual(pair.courtGate(s, npc).code, 'court.ineligible.dislike');
  delete s.records.catToCat[key];
  npc.affinity = 40;
  s.day = 21;
  s.records.yearLengthDays = null;
  const generic = pair.courtGate(s, npc);
  assert.strictEqual(generic.code, 'court.ineligible');
  assert.ok(!generic.hint.includes('next spring'));
  s.records.yearLengthDays = 20;
  const season = pair.courtGate(s, npc);
  assert.strictEqual(season.code, 'court.ineligible.season');
  assert.ok(season.hint.includes('next spring'));
});

test('a null year leaves out next spring, and a set year says courtship opens again', () => {
  const s = run(7);
  s.records.yearLengthDays = null;
  const open = pair.seasonPending(s, deps);
  const quiet = open.lines.map((line) => line.text).join('\n');
  assert.ok(quiet.includes('You can try to earn a place'));
  assert.ok(!quiet.includes('Courting opens again next spring'));
  s.records.yearLengthDays = 20;
  const dated = pair.seasonPending(s, deps);
  const spoken = dated.lines.map((line) => line.text);
  const routes = spoken.findIndex((line) => line.includes('You can try to earn a place'));
  const spring = spoken.findIndex((line) => line.includes('Courting opens again next spring'));
  assert.ok(routes >= 0 && spring === routes + 1);
});
