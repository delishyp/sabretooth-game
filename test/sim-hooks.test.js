// Dev-only sim harness. Stub engines, seeded logs, release exclusion.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');
const Sim = require('../src/dev/sim-hooks');

const root = path.join(__dirname, '..');
const player = { id: 'player' };
const opponent = { id: 'hc01' };

test('the same seed prints the same encounter, world, and lifetime logs', () => {
  const encounter = Sim.simulateEncounter({ kind: 'spar', seed: 8, player, opponent, policy: { playerBias: 0.5 } });
  assert.deepStrictEqual(encounter, Sim.simulateEncounter({ kind: 'spar', seed: 8, player, opponent, policy: { playerBias: 0.5 } }));
  assert.notDeepStrictEqual(encounter, Sim.simulateEncounter({ kind: 'spar', seed: 9, player, opponent, policy: { playerBias: 0.5 } }));
  assert.strictEqual(encounter.rows[0].adapter, 'todo');
  assert.ok(encounter.rows[0].winner === 'player' || encounter.rows[0].winner === 'opponent');

  const batch = Sim.simulateEncounterBatch({ kind: 'spar', seed: 8, count: 4, player, opponent });
  assert.deepStrictEqual(batch, Sim.simulateEncounterBatch({ kind: 'spar', seed: 8, count: 4, player, opponent }));
  assert.deepStrictEqual(batch.rows.map((row) => row.index), [0, 1, 2, 3]);

  const world = Sim.simulateWorld({ seed: 8, seasons: 4 });
  assert.deepStrictEqual(world, Sim.simulateWorld({ seed: 8, seasons: 4 }));
  assert.notDeepStrictEqual(world, Sim.simulateWorld({ seed: 3, seasons: 4 }));
  assert.ok(world.rows.some((row) => row.ownership.some((own) => own.zoneId && own.holder && Number.isInteger(own.strength))));
  assert.ok(world.rows.some((row) => row.changes.some((change) => change.todo === true && change.from && change.to)));

  const life = Sim.simulateLifetime({ seed: 8, days: 20, policy: { titles: ['unproven', 'noted'] } });
  assert.deepStrictEqual(life, Sim.simulateLifetime({ seed: 8, days: 20, policy: { titles: ['unproven', 'noted'] } }));
  assert.notDeepStrictEqual(life.rows.map((row) => row.roll), Sim.simulateLifetime({ seed: 11, days: 20 }).rows.map((row) => row.roll));
  assert.strictEqual(life.rows.length, 20);
  assert.ok(life.rows.every((row) => Number.isInteger(row.level) && row.title && Array.isArray(row.deeds) && Array.isArray(row.witnesses)));

  const csv = Sim.toCsv(world);
  assert.strictEqual(csv, Sim.toCsv(Sim.simulateWorld({ seed: 8, seasons: 4 })));
  assert.match(csv.split('\n')[0], /zoneId,holder,state,strength,changeFrom,changeTo,todo/);
});

test('stub adapters are still marked TODO and the CLI stays dev-only', () => {
  const source = fs.readFileSync(path.join(root, 'src/dev/sim-hooks.js'), 'utf8');
  assert.match(source, /TODO\(encounter-engine\)/);
  assert.match(source, /TODO\(world-engine\)/);
  assert.match(source, /TODO\(lifetime-engine\)/);
  assert.strictEqual(typeof Sim.engines.encounter.resolve, 'function');
  assert.strictEqual(typeof Sim.engines.world.step, 'function');
  assert.strictEqual(typeof Sim.engines.lifetime.step, 'function');
  assert.strictEqual(Sim.allowed({ env: {}, packaged: false }), false);
  assert.strictEqual(Sim.allowed({ env: { SABRETOOTH_SIM: '1' }, packaged: true }), false);
  assert.strictEqual(Sim.allowed({ env: { SABRETOOTH_SIM: '1' }, packaged: false }), true);
  const files = require(path.join(root, 'package.json')).build.files;
  assert.ok(files.includes('!src/dev/**'));
  assert.ok(files.includes('!docs/**'));

  const denied = spawnSync(process.execPath, ['src/dev/sim-hooks.js', 'encounter', '--seed', '8'], { cwd: root, encoding: 'utf8' });
  assert.notStrictEqual(denied.status, 0);
  const allowed = spawnSync(process.execPath, ['src/dev/sim-hooks.js', 'encounter', '--seed', '8', '--kind', 'spar'], {
    cwd: root, encoding: 'utf8', env: Object.assign({}, process.env, { SABRETOOTH_SIM: '1' })
  });
  assert.strictEqual(allowed.status, 0, allowed.stderr);
  const parsed = JSON.parse(allowed.stdout);
  assert.strictEqual(parsed.seed, 8);
  assert.strictEqual(parsed.rows[0].adapter, 'todo');
});
