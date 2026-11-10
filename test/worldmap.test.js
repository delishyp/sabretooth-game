// map-v1 v1.0.1 data model: map.json generated from docs/design/map-v1.md (scripts/slice-data-from-specs.js).
const test = require('node:test');
const assert = require('node:assert');
const WorldMap = require('../src/renderer/js/worldmap');
const map = require('../src/renderer/data/map.json');
const W = WorldMap.create(map);

test('30 regions, edges symmetric and reference real regions, graph connected', () => {
  assert.strictEqual(W.regions.length, 30);
  const ids = new Set(W.regions.map((r) => r.id));
  for (const e of map.edges) { assert.ok(ids.has(e.a) && ids.has(e.b), `${e.a}-${e.b}`); assert.ok(W.neighbours(e.a).includes(e.b)); assert.ok(W.neighbours(e.b).includes(e.a)); }
  const seen = new Set(['split_rock']); const q = ['split_rock'];
  while (q.length) for (const n of W.neighbours(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.strictEqual(seen.size, 30);
});

test('every region has a biome, prey, danger band and travel days ≥ 1 to each neighbour', () => {
  for (const r of W.regions) {
    assert.ok(W.biome(W.region(r.id).biome), r.id);
    assert.ok(typeof W.preyPoints(r.id, 'spring') === 'number');
    assert.ok([0, 1, 2, 3].includes(W.danger(r.id, 'spring')));
    assert.ok(W.danger(r.id, 'spring') <= 3);
    for (const n of W.neighbours(r.id)) assert.ok(W.travelDays(r.id, n, 'spring') >= 1);
  }
});

test('danger mode max uses the highest hazard and sum adds them, both cap at 3', () => {
  assert.strictEqual(WorldMap.mapRules.dangerMode, 'max');
  assert.strictEqual(W.danger('tar_seeps', 'spring'), 2);
  assert.strictEqual(W.danger('salt_flats', 'spring'), 2);
  assert.strictEqual(W.danger('south_range', 'spring'), 2);
  assert.strictEqual(W.danger('west_spur', 'spring'), 0);
  const bands = map.dangerBands;
  const hazards = [{ pct: 10 }, { pct: 2 }];
  assert.strictEqual(WorldMap.dangerValue(hazards, { mode: 'max', bands, featureBonus: 0 }), 2);
  assert.strictEqual(WorldMap.dangerValue(hazards, { mode: 'sum', bands }), 3);
  assert.strictEqual(WorldMap.dangerValue([{ pct: 80 }, { pct: 80 }], { mode: 'sum', bands }), 3);
  assert.strictEqual(WorldMap.dangerValue([{ pct: 80 }], { mode: 'max', bands, featureBonus: 0 }), 3);
  assert.strictEqual(WorldMap.dangerValue([{ pct: 4 }], { mode: 'max', bands, featureBonus: 8 }), 3);
  assert.strictEqual(WorldMap.dangerValue([{ pct: 4 }], { mode: 'max', bands, featureBonus: 0 }), 2);
});

test('ownership + trespass: start claims give holders; wolves never trespass-patrol', () => {
  const claims = W.initClaims();
  const owned = W.regions.filter((r) => W.ownership(claims, r.id).holder);
  assert.ok(owned.length > 0);
  for (const r of W.regions) assert.ok(!W.trespassFactions(claims, r.id).includes('wolves'));
  assert.deepStrictEqual(W.trespassFactions(claims, 'split_rock'), [], 'start region is unclaimed');
});

test('map.json uses only known enum values, including pool water', () => {
  assert.ok(WorldMap.ENUMS.water.includes('pool'));
  assert.deepStrictEqual(WorldMap.validate(map), []);
  assert.strictEqual(map.regions.find((row) => row.id === 'tallgrass').water, 'pool');
  const bad = JSON.parse(JSON.stringify(map));
  bad.regions[0] = Object.assign({}, bad.regions[0], { water: 'puddle' });
  assert.ok(WorldMap.validate(bad).some((error) => error.includes('puddle')));
});

test('discover marks the region and its neighbours; migrateMap keeps known state', () => {
  const d = W.discover([], 'split_rock');
  assert.ok(d.includes('split_rock')); for (const n of W.neighbours('split_rock')) assert.ok(d.includes(n));
  const m = WorldMap.migrateMap({ dataVersion: 0, discovered: [...d, 'gone_region'], visited: ['split_rock', 'gone_region'], claims: {} }, W);
  assert.strictEqual(m.dataVersion, map.dataVersion); assert.ok(!m.discovered.includes('gone_region')); assert.ok(!m.visited.includes('gone_region'));
});
