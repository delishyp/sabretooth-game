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
  const report = Parity.measure(Engine.config.bands.fightCells);
  assert.strictEqual(Engine.config.bands.fightCells, 2000);
  assert.strictEqual(Engine.config.bands.fightTolerance, 0.03);
  for (const row of report.fights) assert.strictEqual(row.n, 2000);
  assert.strictEqual(report.sensible.n, 2000);
  assert.strictEqual(report.sensible.tolerance, 0.03);
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

test('the section 8.3 band table maps all fifteen bands', () => {
  const log = Sim.bandTable({ seed: 8, count: 4000, engine: true });
  assert.strictEqual(Engine.config.enabled, false);
  assert.strictEqual(log.spec, 'encounters-v0.1.1');
  assert.deepStrictEqual(log.bands.map((row) => row.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  for (const row of log.bands) assert.strictEqual(row.result, 'PASS', JSON.stringify(row));
  assert.match(log.bands[7].name, /showdown/);
  assert.match(log.bands[7].got, /0 differences/);
  assert.match(log.bands[6].got, /40 HP, 0 injury rolls/);
  assert.match(log.bands[9].got, /64/);
  assert.match(log.bands[12].got, /\+/);
  const text = Sim.formatBandTable(log);
  assert.match(text, /band  8  PASS  showdown, identical seeds/);
  assert.match(text, /band 15  PASS  HP is the only number exposed  target HP  got HP only/);
  const off = Sim.bandTable({ seed: 8, count: 10 });
  assert.strictEqual(off.enabled, false);
  assert.deepStrictEqual(off.bands, []);
  assert.match(log.bands[0].got, /±3pp n=2000/);
  assert.deepStrictEqual(log.slow, []);
});

test('simulateEncounter covers bands 1 through 15', () => {
  const log = Sim.simulateEncounter({ bands: true, seed: 8, count: 4000, engine: true });
  assert.strictEqual(log.command, 'encounter');
  assert.deepStrictEqual(log.bands.map((row) => row.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  for (const id of [1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]) {
    const row = log.bands.find((item) => item.id === id);
    assert.strictEqual(row.result, 'PASS', JSON.stringify(row));
  }
  assert.ok(log.timeouts.ok, JSON.stringify(log.timeouts));
  assert.ok(log.timeouts.rate < 0.03);
  const text = Sim.formatBandTable(log);
  assert.match(text, /band  9  PASS  hunt steady/);
  assert.match(text, /band 10  PASS  hunt bold/);
  assert.match(text, /band  7  PASS  spar ends at 40 HP/);
  assert.match(text, /band  3  PASS  fight length/);
  assert.match(text, /timeouts  PASS  encounter timeouts  target <3%/);
  assert.match(log.bands[1].got, /sensible /);
  assert.match(log.bands[1].got, /biteOnly /);
  assert.match(log.bands[1].got, /average /);
  assert.ok(log.policies.sensible - log.policies.biteOnly >= 0.06);
});

test('the slow fight check stays out of the default suite', { skip: process.env.SABRETOOTH_PARITY_SLOW !== '1' }, () => {
  const spec = Engine.config.bands;
  const slow = Parity.fightReport(spec.slowFightCells, spec.slowFightTolerance, 8);
  const rows = slow.fights.concat([slow.sensible]);
  for (const row of rows) assert.ok(row.ok, `${row.label} ${row.got} vs ${row.target} at ±${row.tolerance}`);
  const log = Sim.bandTable({ seed: 8, count: 200, engine: true, slow: true });
  assert.strictEqual(log.slow.length, 5);
  for (const row of log.slow) assert.strictEqual(row.result, 'PASS', JSON.stringify(row));
  assert.match(Sim.formatBandTable(log), /slow  1  PASS/);
});
