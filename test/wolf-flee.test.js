// Wolf-pack flee uses the map wolves hazard, not the combat-flee formula.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(require('fs').readFileSync(path.join(D, f), 'utf8'));
const map = j('map.json');
const wolves = map.hazards.find((row) => row.id === 'wolves');
const pct = Number(String(wolves.defaultOutcome).match(/(\d+)%/)[1]);
const E = Slice.create({
  map, rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json')
});
const player = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const plain = j('events/encounters-v0.2.json').encounters.find((row) => row.id === 'encounter.wolf_pack.v1').outcomeRendering.resolve_existing_flee;
const cover = j('events/encounters-v0.2.json').encounters.find((row) => row.id === 'encounter.wolf_pack.v1').outcomeRendering.resolve_existing_flee_with_cover;

function open(seed, node, withCover) {
  const s = E.newRun({ mainCat: player, seed, runId: `wolf-${seed}-${node}-${withCover ? 'cover' : 'open'}` });
  s.phase = 'encounter';
  s.encounters.pending = {
    encounterId: 'encounter.wolf_pack.v1',
    encounterInstanceId: `${s.runId}/encounter.wolf_pack.v1/${s.day}`,
    nodeId: node,
    lines: [],
    receipts: [],
    coverAvailable: !!withCover,
    terminal: false,
    result: null
  };
  return s;
}
function flee(seed, choice, node, withCover) {
  const s = open(seed, node || (choice === 'withdraw' || choice === 'keep_cover' ? 'watch' : 'opening'), withCover);
  const acted = E.act(s, { type: 'encounterChoose', choiceId: choice });
  assert.ok(!acted.error, acted.error);
  return acted.state;
}
function shown(s) {
  return s.encounters.pending.lines.map((line) => line.text);
}

test('a carried carcass is lost with no injury, and the loss lines are the only pursuit text', () => {
  const s = open(1, 'opening', false);
  s.records = s.records || {};
  s.records.freshKill = { day: s.day, region: s.region, owner: null };
  const acted = E.act(s, { type: 'encounterChoose', choiceId: 'give_ground' }).state;
  const result = acted.encounters.pending.result;
  assert.strictEqual(result.flee, 'loss');
  assert.strictEqual(result.pursued, true);
  assert.strictEqual(result.injuryTier, null);
  assert.strictEqual(acted.needs.health, 100);
  assert.strictEqual(acted.records.freshKill.lost, true);
  const text = shown(acted);
  assert.ok(text.includes(plain.pursued));
  assert.ok(text.includes(plain.lossOverlay));
  assert.ok(!text.includes(plain.injuryOverlay));
  assert.ok(!text.includes(plain.success));
});

test('without a carcass the roll is a minor injury or a clean escape', () => {
  const injured = flee(11, 'give_ground');
  const clean = flee(2, 'withdraw', 'watch', false);
  const found = { injury: null, success: null };
  for (let seed = 1; seed <= 80 && (!found.injury || !found.success); seed++) {
    const state = flee(seed, 'give_ground');
    const kind = state.encounters.pending.result.flee;
    if (kind === 'injury' && !found.injury) found.injury = state;
    if (kind === 'success' && !found.success) found.success = state;
  }
  assert.ok(found.injury && found.success);
  assert.strictEqual(found.injury.encounters.pending.result.pursued, true);
  assert.strictEqual(found.injury.encounters.pending.result.injuryTier, 'minor');
  assert.ok(found.injury.injuries.some((row) => row.tier === 'minor'));
  assert.strictEqual(found.injury.needs.health, 90);
  const hurt = shown(found.injury);
  assert.ok(hurt.includes(plain.pursued));
  assert.ok(hurt.includes(plain.injuryOverlay));
  assert.ok(!hurt.includes(plain.lossOverlay));
  assert.strictEqual(found.success.encounters.pending.result.pursued, false);
  assert.strictEqual(found.success.needs.health, 100);
  assert.deepStrictEqual(shown(found.success), [plain.success]);
  assert.strictEqual(clean.encounters.pending.result.outcomeId, 'resolve_existing_flee');
  const withdrawn = flee(11, 'withdraw', 'watch', false);
  assert.strictEqual(withdrawn.encounters.pending.result.outcomeId, 'resolve_existing_flee');
  assert.ok(withdrawn.encounters.pending.result.flee === 'injury' || withdrawn.encounters.pending.result.flee === 'success');
});

test('the pursuit rate stays near the wolves hazard percent', () => {
  assert.strictEqual(pct, 40);
  let pursued = 0;
  const n = 200;
  const first = [];
  for (let seed = 1; seed <= n; seed++) {
    const state = flee(seed, 'give_ground');
    const hit = state.encounters.pending.result.flee === 'injury';
    if (hit) pursued += 1;
    if (seed <= 20) first.push(hit);
  }
  assert.ok(Math.abs(pursued / n - pct / 100) < 0.08, `${pursued}/${n}`);
  const again = [];
  for (let seed = 1; seed <= 20; seed++) again.push(flee(seed, 'give_ground').encounters.pending.result.flee === 'injury');
  assert.deepStrictEqual(again, first);
});

test('a minor pursuit cannot drop Health below 1 or kill', () => {
  let found = null;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const s = open(seed, 'opening', false);
    s.needs.health = 1;
    const acted = E.act(s, { type: 'encounterChoose', choiceId: 'give_ground' }).state;
    if (acted.encounters.pending.result.flee === 'injury') found = acted;
  }
  assert.ok(found);
  assert.strictEqual(found.needs.health, 1);
  assert.ok(!found.dead);
});

test('keep_cover uses the same roll and is hidden without cover', () => {
  const bare = open(4, 'opening', false);
  assert.deepStrictEqual(E.encounterView(bare).choices.map((row) => row.id), ['give_ground']);
  bare.encounters.pending.nodeId = 'watch';
  assert.deepStrictEqual(E.encounterView(bare).choices.map((row) => row.id), ['withdraw']);
  const covered = open(4, 'watch', true);
  assert.ok(E.encounterView(covered).choices.some((row) => row.id === 'keep_cover'));
  const shared = open(4, 'watch', true);
  const left = E.act(JSON.parse(JSON.stringify(shared)), { type: 'encounterChoose', choiceId: 'withdraw' }).state;
  const hid = E.act(shared, { type: 'encounterChoose', choiceId: 'keep_cover' }).state;
  assert.strictEqual(hid.encounters.pending.result.flee, left.encounters.pending.result.flee);
  assert.strictEqual(hid.encounters.pending.result.outcomeId, 'resolve_existing_flee_with_cover');
  if (hid.encounters.pending.result.flee === 'success') {
    assert.deepStrictEqual(shown(hid), [cover.success]);
    assert.notStrictEqual(cover.success, plain.success);
  }
});
