// Saga's card-word fill. Same cutoffs as hunger. Positive means better.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Words = require('../src/renderer/js/card-words');
const Slice = require('../src/renderer/js/slice');

const fill = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/events/card-words-fill-4647955.json'), 'utf8'));
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };

function edges(fn, table) {
  assert.strictEqual(fn(0), '');
  assert.strictEqual(fn(1), table.up.small);
  assert.strictEqual(fn(15), table.up.small);
  assert.strictEqual(fn(16), table.up.medium);
  assert.strictEqual(fn(35), table.up.medium);
  assert.strictEqual(fn(36), table.up.large);
  assert.strictEqual(fn(-1), table.down.small);
  assert.strictEqual(fn(-15), table.down.small);
  assert.strictEqual(fn(-16), table.down.medium);
  assert.strictEqual(fn(-35), table.down.medium);
  assert.strictEqual(fn(-36), table.down.large);
  for (const line of [fn(15), fn(16), fn(35), fn(36), fn(-15), fn(-16), fn(-35), fn(-36)]) {
    assert.ok(!/\d/.test(line), line);
  }
}

test('energy, health and thirst use hunger\'s three bands on both signs', () => {
  const keys = Object.keys(fill).filter((key) => !key.startsWith('_'));
  assert.deepStrictEqual(keys, ['energy', 'health', 'thirst', 'hunger_down', '1.5_seeking_company_gossip_opener']);
  edges(Words.energy, fill.energy);
  edges(Words.health, fill.health);
  edges(Words.thirst, fill.thirst);
});

test('hunger down is banded, and starvation uses the large line', () => {
  assert.strictEqual(Words.hunger(-15), fill.hunger_down.small);
  assert.strictEqual(Words.hunger(-16), fill.hunger_down.medium);
  assert.strictEqual(Words.hunger(-35), fill.hunger_down.medium);
  assert.strictEqual(Words.hunger(-36), fill.hunger_down.large);
  assert.strictEqual(Words.hunger(-36), "You're starving.");
  assert.strictEqual(Words.hunger(15), "You've taken the edge off your hunger.");
  assert.strictEqual(Words.hunger(16), 'Your belly is fuller.');
  assert.strictEqual(Words.hunger(35), 'Your belly is fuller.');
  assert.strictEqual(Words.hunger(36), "You've eaten well.");
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'starve-line' });
  s.needs = { health: 80, hunger: 0, thirst: 100, energy: 100 };
  s.counters.starving = 2;
  const worn = E.act(s, { type: 'rest' }).state;
  assert.ok(String(worn.pending && worn.pending.resultLine).includes("You're starving."));
  assert.ok(!/\d/.test(worn.pending.resultLine));
});
