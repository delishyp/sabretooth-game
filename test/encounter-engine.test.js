// Headless encounter engine. The flag defaults off. Showdown is not paced here.
const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../src/renderer/js/encounter-engine');
const Fight = require('../src/renderer/js/fight');
const Sim = require('../src/dev/sim-hooks');
const Parity = require('../src/dev/encounter-parity');

test('the engine flag defaults off and showdown is left alone', () => {
  assert.strictEqual(Engine.config.enabled, false);
  assert.strictEqual(Engine.enabled({}), false);
  assert.strictEqual(Engine.enabled({ env: {} }), false);
  assert.strictEqual(Engine.enabled({ engine: true }), true);
  const stub = Sim.simulateEncounter({ kind: 'spar', seed: 4, player: { id: 'player' }, opponent: { id: 'foe' } });
  assert.strictEqual(stub.adapter, 'todo');
  assert.strictEqual(stub.enabled, false);
  const show = Engine.resolve({ kind: 'showdown', seed: 1, player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 12 } });
  assert.strictEqual(show.skipped, true);
  assert.strictEqual(show.reason, 'showdown-untouched');
  assert.strictEqual(show.rounds, null);
});

test('quick resolve matches the section 8.2 bands', () => {
  const report = Parity.measure(4000);
  for (const row of report.fights) assert.ok(row.ok, `${row.label} ${row.got} vs ${row.target}`);
  for (const row of report.hunts) assert.ok(row.ok, `${row.size} ${row.got} vs ${row.target}`);
  assert.ok(report.courtship.ok, JSON.stringify(report.courtship));
  assert.ok(report.sensible.ok, JSON.stringify(report.sensible));
  assert.ok(report.medianRounds.ok, JSON.stringify(report.medianRounds));
  const spar = Engine.resolve({
    kind: 'spar', seed: 3, quick: false, policy: 'average',
    player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
  });
  assert.strictEqual(spar.lethal, false);
  assert.strictEqual(spar.stoppedAt, 40);
  assert.ok(spar.rounds >= 5 && spar.rounds <= 8);
  const read = Engine.courtshipChance({ pairValue: 30, sociability: 50, curiosity: 90 }, 'readTraits');
  const plain = Engine.courtshipChance({ pairValue: 30, sociability: 50, curiosity: 90 }, 'average');
  assert.ok(read > plain);
  const bold = Engine.huntChance('small', 'standard', 'allBold');
  assert.strictEqual(Engine.huntChance('small', 'standard', 'steady'), 55);
  assert.ok(bold > 55);
});

test('a seeded batch summarizes thousands of encounters and keeps failing seeds', () => {
  const started = Date.now();
  const log = Sim.simulateEncounterBatch({ seed: 8, count: 400, engine: true });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2000, `batch took ${elapsed}ms`);
  assert.strictEqual(log.adapter, 'engine');
  assert.strictEqual(Engine.config.enabled, false);
  assert.ok(log.summary.fight.length >= 4);
  for (const row of log.summary.fight) {
    assert.ok(row.policy && row.opponent);
    assert.ok(row.winRate >= 0 && row.winRate <= 1);
    assert.ok(Number.isInteger(row.medianRounds) && row.medianRounds >= 1);
    assert.ok(row.fleeRate >= 0 && row.fleeRate <= 1);
  }
  assert.ok(log.summary.fight.some((row) => row.policy === 'fleeAt30' && row.fleeRate > 0));
  const steady = log.summary.hunt.find((row) => row.policy === 'steady' && row.size === 'all');
  const bold = log.summary.hunt.find((row) => row.policy === 'allBold' && row.size === 'all');
  assert.ok(steady && bold);
  assert.ok(bold.meanEnergy > steady.meanEnergy);
  assert.ok(bold.injuryRate > steady.injuryRate);
  const plain = log.summary.courtship.find((row) => row.policy === 'average');
  const read = log.summary.courtship.find((row) => row.policy === 'readTraits');
  assert.strictEqual(log.summary.traitsReadDelta, Math.round((read.success - plain.success) * 1000) / 1000);
  assert.ok(log.summary.traitsReadDelta > 0);
  assert.strictEqual(log.summary.spar.endedAt40, log.summary.spar.n);
  assert.strictEqual(log.summary.spar.seriousInjuries, 0);
  assert.deepStrictEqual(log.summary.spar.failSeeds, []);
  assert.strictEqual(log.summary.showdown.skipped, true);
  assert.deepStrictEqual(log, Sim.simulateEncounterBatch({ seed: 8, count: 400, engine: true }));
  const csv = Sim.toCsv(log);
  assert.match(csv, /section,seed,kind,policy/);
  assert.match(csv, /failure,8,|showdown,8,/);
  const again = Fight.resolve({ showdown: true, suitorDisplayM: 2, rivalDisplayM: 1, rng: () => 0.49 });
  assert.strictEqual(again.replaced, 'showdown');
  assert.strictEqual(again.chance, 60);
  assert.strictEqual(again.won, true);
  assert.strictEqual(again.injuries.loser, null);
  assert.strictEqual(again.injuries.winner, null);
  assert.strictEqual(Fight.showdownChance(0, 0), 50);
});
