// Headless encounter engine. The flag defaults off. Showdown is not paced here.
const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../src/renderer/js/encounter-engine');
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
