// Pride food store and header words. No screen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Header = require('../src/renderer/js/pride-header');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] }
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const WORDS = ['Nothing left', 'Running low', 'Enough for now', 'Plenty', 'Quiet', 'Band warning', 'Scout report', 'Scent sign'];

function fresh() {
  return E.newRun({ mainCat: player, seed: 4, runId: 'pride-food' });
}

test('a new run and a v1 save both carry a pooled pride food store', () => {
  const s = fresh();
  assert.strictEqual(s.pride.food, 0);
  assert.deepStrictEqual(s.pride.roles, {});
  assert.strictEqual(s.saveVersion, 1);
  const legacy = fresh();
  delete legacy.pride;
  legacy.saveVersion = 1;
  const loaded = E.migrate(JSON.parse(JSON.stringify(legacy)));
  assert.strictEqual(loaded.saveVersion, 1);
  assert.strictEqual(loaded.pride.food, 0);
  const kept = fresh();
  kept.pride.food = 40;
  assert.strictEqual(E.migrate(JSON.parse(JSON.stringify(kept))).pride.food, 40);
  const nested = fresh();
  delete nested.pride;
  nested.records = { pride: { id: 'pride-1', food: 24 } };
  assert.strictEqual(E.migrate(JSON.parse(JSON.stringify(nested))).pride.food, 24);
  const bad = fresh();
  bad.pride.food = -3;
  assert.strictEqual(E.migrate(bad).pride.food, 0);
});

test('food words hit every band edge and never print a number', () => {
  const one = (food, members) => Header.headerFood({ food, members });
  assert.strictEqual(one(0, 1), 'Nothing left');
  assert.strictEqual(one(11, 1), 'Nothing left');
  assert.strictEqual(one(12, 1), 'Running low');
  assert.strictEqual(one(24, 1), 'Running low');
  assert.strictEqual(one(35, 1), 'Running low');
  assert.strictEqual(one(36, 1), 'Enough for now');
  assert.strictEqual(one(60, 1), 'Enough for now');
  assert.strictEqual(one(71, 1), 'Enough for now');
  assert.strictEqual(one(72, 1), 'Plenty');
  assert.strictEqual(one(23, 2), 'Nothing left');
  assert.strictEqual(one(24, 2), 'Running low');
  assert.strictEqual(one(71, 2), 'Running low');
  assert.strictEqual(one(72, 2), 'Enough for now');
  assert.strictEqual(one(144, 2), 'Plenty');
  assert.strictEqual(one(12, 0), 'Nothing left');
  assert.strictEqual(one(12, []), 'Nothing left');
  assert.strictEqual(Header.headerFood({ food: 108, members: ['a', 'b', 'c'] }), 'Enough for now');
  for (const word of WORDS) assert.ok(!/\d/.test(word), word);
});

test('the threat word uses only a fact the player knows', () => {
  const held = ['highcrag'];
  const neighbours = { wind_scree: ['highcrag'], bonefield: ['mistwood'] };
  const base = { held, neighbours, facts: [] };
  assert.strictEqual(Header.headerThreat(base), 'Quiet');
  assert.strictEqual(Header.headerThreat({
    ...base,
    facts: [{ kind: 'band_warning', known: false }, { kind: 'scent_sign', known: false }, { kind: 'scout', region: 'wind_scree', known: false }]
  }), 'Quiet');
  assert.strictEqual(Header.headerThreat({
    ...base,
    facts: [{ kind: 'scout', region: 'bonefield', known: true }]
  }), 'Quiet');
  assert.strictEqual(Header.headerThreat({
    ...base,
    facts: [{ kind: 'scout', region: 'highcrag', known: true }]
  }), 'Quiet');
  assert.strictEqual(Header.headerThreat({
    ...base,
    facts: [{ kind: 'scent_sign', known: true }]
  }), 'Scent sign');
  assert.strictEqual(Header.headerThreat({
    ...base,
    facts: [{ kind: 'scout', region: 'wind_scree', known: true }, { kind: 'scent_sign', known: true }]
  }), 'Scout report');
  assert.strictEqual(Header.headerThreat({
    ...base,
    facts: [
      { kind: 'band_warning', known: true },
      { kind: 'scout', region: 'wind_scree', known: true },
      { kind: 'scent_sign', known: true }
    ]
  }), 'Band warning');
  assert.strictEqual(Header.headerThreat({
    worldMemory: {
      facts: [{ factId: 'scent-1', kind: 'scent_sign', region: 'wind_scree' }],
      knowledge: { 'scent-1': { scope: 'private', participantIds: ['player'], disclosedTo: [], witnessIds: [] } }
    }
  }), 'Scent sign');
  assert.strictEqual(Header.headerThreat({
    held, neighbours,
    worldMemory: {
      facts: [{ factId: 'scent-2', kind: 'scent_sign' }],
      knowledge: { 'scent-2': { scope: 'private', participantIds: ['hc01'], disclosedTo: [], witnessIds: [] } }
    }
  }), 'Quiet');
});
