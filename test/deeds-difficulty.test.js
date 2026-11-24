const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Difficulty = require('../src/renderer/js/difficulty');
const Deeds = require('../src/renderer/js/deeds');
const Engine = require('../src/renderer/js/encounter-engine');
const { createAchievementsStore } = require('../src/main/achievements-store');
const { createSavesStore } = require('../src/main/saves-store');

test('difficulty knobs: Standard is 1, approved foe scales apply, candidate knobs stay off', () => {
  assert.strictEqual(Difficulty.applied('foe', 'standard'), 1);
  assert.strictEqual(Difficulty.foeMultiplier('standard', { kind: 'lion' }), 1);
  assert.strictEqual(Difficulty.foeMultiplier('gentle', { kind: 'cat' }), 0.9);
  assert.strictEqual(Difficulty.foeMultiplier('harsh', { kind: 'lion' }), 1.05);
  assert.strictEqual(Difficulty.foeMultiplier('ice_age', { group: true, kind: 'hyena' }), 1.15);
  assert.strictEqual(Difficulty.applied('prey', 'gentle'), 1);
  assert.strictEqual(Difficulty.listed('prey', 'gentle'), 1.25);
  assert.strictEqual(Difficulty.applied('hunger', 'ice_age'), 1);
  assert.strictEqual(Difficulty.listed('hunger', 'ice_age'), 1.3);
  assert.strictEqual(Difficulty.applied('reputation', 'harsh'), 1);
  assert.strictEqual(Difficulty.listed('reputation', 'harsh'), 1.25);
  assert.strictEqual(Difficulty.adjustInjury('gentle', 'serious'), 'minor');
  assert.strictEqual(Difficulty.adjustInjury('standard', 'serious'), 'serious');
  assert.strictEqual(Difficulty.mayRefuse('ice_age', false), false);
  assert.strictEqual(Difficulty.mayRefuse('gentle', false), true);
  assert.strictEqual(Difficulty.mayRefuse('gentle', true), false);
  assert.strictEqual(Difficulty.canChangeMidRun('permadeath'), false);
  assert.strictEqual(Difficulty.canChangeMidRun('sandbox'), true);
});

test('Standard foe strength does not move a seeded encounter', () => {
  const plain = Engine.resolve({
    kind: 'fight', seed: 4, quick: true, policy: 'average', engine: true,
    player: { id: 'player', strength: 10 }, opponent: { id: 'matched', strength: 10 }
  });
  const standard = Engine.resolve({
    kind: 'fight', seed: 4, quick: true, policy: 'average', engine: true, level: 'standard',
    player: { id: 'player', strength: 10 }, opponent: { id: 'matched', strength: 10 }
  });
  assert.strictEqual(standard.winner, plain.winner);
  assert.strictEqual(standard.rounds, plain.rounds);
});

test('deeds earn once, survive a deleted save, and sandbox and hard gates hold', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-deeds-'));
  const saves = createSavesStore(path.join(dir, 'saves'));
  const deeds = createAchievementsStore(dir);
  const run = saves.createRun({ difficulty: 'permadeath', level: 'standard' });
  const first = deeds.earn({ id: 'first_kill', runId: run.runId, difficulty: 'standard' });
  assert.strictEqual(first.earned, true);
  assert.strictEqual(deeds.earn({ id: 'first_kill', runId: 'other', difficulty: 'harsh' }).earned, false);
  assert.strictEqual(deeds.list().length, 1);
  saves.deleteRun(run.runId);
  assert.strictEqual(saves.list().runs.filter(Boolean).length, 0);
  assert.strictEqual(deeds.list()[0].id, 'first_kill');
  assert.deepStrictEqual(Object.keys(deeds.list()[0]).sort(), ['difficulty', 'earnedAt', 'id', 'runId']);
  const old = saves.createRun({ difficulty: 'heir' });
  const file = path.join(dir, 'saves', 'run-0', 'run.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete raw.level;
  fs.writeFileSync(file, JSON.stringify(raw));
  assert.strictEqual(saves.findRun(old.runId).level, 'standard');
  assert.throws(() => saves.setLevel(old.runId, 'gentle'), /locked/);
  const sand = saves.createRun({ difficulty: 'sandbox', replaceRunId: old.runId, level: 'gentle' });
  assert.strictEqual(saves.setLevel(sand.runId, 'ice_age'), 'ice_age');
});

test('each live deed fires from existing state, and a missing system stays locked', () => {
  assert.strictEqual(Deeds.RULES.length, 34);
  const state = {
    deathRule: 'permadeath', level: 'standard',
    records: { deedFacts: { 'hunt.success': true, 'hunt.large': true, 'fight.win': true, 'gift.backfire': true }, matePair: { mateId: 'ln01' }, pride: { name: 'Ash' } },
    npcs: { ln01: { affinity: 60 } },
    pride: { food: 1000, members: 2 },
    worldMemory: { facts: [{ factId: 'quest_done_a' }, { factId: 'quest_done_b' }, { factId: 'quest_done_c' }, { factId: 'quest_done_d' }, { factId: 'quest_done_e' }] }
  };
  const earned = Deeds.scan(state);
  for (const id of ['first_kill', 'big_game', 'first_blood', 'first_friend', 'mated', 'founder', 'feast', 'errand_cat', 'storyteller']) {
    assert.ok(earned.includes(id), id);
  }
  assert.ok(!earned.includes('first_council'));
  assert.ok(!earned.includes('titled'));
  assert.ok(!earned.includes('lion_slayer'));
  const sand = Deeds.scan(Object.assign({}, state, { deathRule: 'sandbox' }));
  assert.deepStrictEqual(sand, []);
  const gentleHard = Deeds.scan({ deathRule: 'permadeath', level: 'gentle', records: { deedFacts: { 'lion.adult': true } } });
  assert.ok(!gentleHard.includes('lion_slayer'));
  const hard = Deeds.scan({ deathRule: 'heir', level: 'harsh', records: { deedFacts: { 'lion.adult': true } } });
  assert.ok(hard.includes('lion_slayer'));
  const hidden = Deeds.tile('lean_season', false);
  assert.strictEqual(hidden.name, '???');
  assert.ok(!/\d/.test(hidden.hint));
  assert.strictEqual(Deeds.counter(['first_kill']), Deeds.copy.screen.counter.replace('{earned}', '1').replace('{total}', '34'));
});
