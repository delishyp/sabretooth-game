const test = require('node:test');
const assert = require('node:assert');
const Unlocks = require('../src/renderer/js/unlocks');

function save(extra) {
  return Object.assign({
    deathRule: 'permadeath',
    npcs: {},
    world: {},
    records: { receipts: [] },
    map: { visited: ['split_rock'], claims: {} }
  }, extra || {});
}

test('home, wilderness, smilodons and lore start open, and the live flag keeps every section open', () => {
  const fresh = save();
  const states = Unlocks.unlockedSystems(fresh);
  for (const id of Unlocks.STARTERS) assert.strictEqual(states[id], 'open', id);
  for (const id of ['pride', 'den', 'breeding', 'inventory', 'market', 'quests', 'reputation', 'councils']) {
    assert.strictEqual(states[id], 'locked', id);
  }
  assert.strictEqual(Unlocks.SHOW_ALL, true);
  assert.strictEqual(Unlocks.displayState(fresh, 'pride'), 'open');
  assert.strictEqual(Unlocks.displayState(fresh, 'market'), 'open');
});

test('pride, den and breeding move locked to new to open, and seen never re-locks', () => {
  const s = save();
  assert.strictEqual(Unlocks.systemState(s, 'pride'), 'locked');
  s.records.receipts.push('run/scout/highcrag/3');
  assert.strictEqual(Unlocks.systemState(s, 'pride'), 'new');
  assert.strictEqual(Unlocks.remember(s, 'pride'), 'open');
  s.records.receipts = [];
  assert.strictEqual(Unlocks.systemState(s, 'pride'), 'open');
  assert.strictEqual(s.unlocks.seen.filter((id) => id === 'pride').length, 1);

  assert.strictEqual(Unlocks.systemState(s, 'den'), 'locked');
  s.records.pride = { id: 'player', name: 'Ash' };
  assert.strictEqual(Unlocks.systemState(s, 'den'), 'new');
  Unlocks.remember(s, 'den');
  assert.strictEqual(Unlocks.systemState(s, 'den'), 'open');

  assert.strictEqual(Unlocks.systemState(s, 'breeding'), 'locked');
  s.records.matePair = { mateId: 'ln05' };
  assert.strictEqual(Unlocks.systemState(s, 'breeding'), 'new');
});

test('inventory, market, quests, reputation and councils open on first use', () => {
  const s = save();
  assert.strictEqual(Unlocks.noteUse(s, 'inventory'), 'new');
  assert.strictEqual(Unlocks.noteUse(s, 'market'), 'new');
  Unlocks.remember(s, 'inventory');
  assert.strictEqual(Unlocks.systemState(s, 'inventory'), 'open');
  s.unlocks.used = s.unlocks.used.filter((id) => id !== 'inventory');
  assert.strictEqual(Unlocks.systemState(s, 'inventory'), 'open');

  s.world.offers = [{ id: 'ask', state: 'offered' }];
  assert.strictEqual(Unlocks.systemState(s, 'quests'), 'new');
  s.worldMemory = { reputation: { deeds: [{ deedId: 'share_kill' }] }, facts: [] };
  assert.strictEqual(Unlocks.systemState(s, 'reputation'), 'new');
  s.records.deedFacts = { 'council.attended': true };
  assert.strictEqual(Unlocks.systemState(s, 'councils'), 'new');
  assert.strictEqual(Unlocks.systemState(s, 'market'), 'new');
});

test('persist records the four starters and does not drop a remembered section', () => {
  const s = save();
  s.records.receipts.push('run/scout/bonefield/2');
  const seen = Unlocks.persist(s);
  for (const id of Unlocks.STARTERS) assert.ok(seen.indexOf(id) >= 0, id);
  assert.strictEqual(Unlocks.systemState(s, 'pride'), 'new');
  Unlocks.remember(s, 'pride');
  s.records.receipts = [];
  Unlocks.persist(s);
  assert.ok(s.unlocks.seen.indexOf('pride') >= 0);
  assert.strictEqual(Unlocks.systemState(s, 'pride'), 'open');
});
