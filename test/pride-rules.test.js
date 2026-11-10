// My Pride rules. No screen. Every action id has to run an effect.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Rules = require('../src/renderer/js/pride-rules');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] }
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };

function changedKeys(before, after) {
  const keys = new Set(Object.keys(before).concat(Object.keys(after)));
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && key !== 'lastAction');
}

test('a v1 save gains roles, orders, feeding order, heir, and exiles', () => {
  const s = E.newRun({ mainCat: player, seed: 2, runId: 'pride-rules' });
  assert.strictEqual(s.saveVersion, 1);
  assert.deepStrictEqual(s.pride.roles, {});
  assert.deepStrictEqual(s.pride.orders, {});
  assert.deepStrictEqual(s.pride.feedingOrder, []);
  assert.strictEqual(s.pride.heirId, null);
  assert.deepStrictEqual(s.pride.exiles, []);
  const legacy = E.newRun({ mainCat: player, seed: 2, runId: 'pride-rules' });
  legacy.pride = { food: 18 };
  legacy.saveVersion = 1;
  const loaded = E.migrate(JSON.parse(JSON.stringify(legacy)));
  assert.strictEqual(loaded.saveVersion, 1);
  assert.strictEqual(loaded.pride.food, 18);
  assert.deepStrictEqual(loaded.pride.feedingOrder, []);
  assert.deepStrictEqual(loaded.pride.exiles, []);
});

test('every exposed pride action maps to an effect', () => {
  assert.ok(Rules.actionIds.length >= 8);
  assert.deepStrictEqual(Rules.actionIds.slice().sort(), Object.keys(Rules.actions).sort());
  for (const id of Rules.actionIds) {
    const fn = Rules.actions[id];
    assert.strictEqual(typeof fn, 'function', id);
    assert.strictEqual(fn.effectId, id);
    const before = Rules.sample();
    const out = fn(Rules.clone(before));
    assert.strictEqual(out.effect, id);
    assert.strictEqual(out.stateOnly, false);
    assert.ok(out.delta, id);
    const keys = changedKeys(before, out.state);
    assert.ok(keys.length > 0, `${id} only stored itself`);
  }
});

test('hunter stores a medium kill, and a daily order overrides the role', () => {
  const hunter = Rules.actions.assignHunter(Rules.sample());
  assert.strictEqual(hunter.state.pride.roles.briar, 'hunter');
  assert.strictEqual(hunter.delta.hunt.prey, 'medium');
  assert.strictEqual(hunter.delta.hunt.chance, 55);
  assert.strictEqual(hunter.delta.hunt.gained, hunter.delta.hunt.ok ? 50 : 0);
  const crowded = Rules.clone(Rules.sample());
  crowded.roster.push({ id: 'cub', stage: 'cub', status: 'member', fight: 4 });
  const again = Rules.actions.assignHunter(crowded);
  assert.strictEqual(again.delta.hunt.gained, again.delta.hunt.ok ? Rules.config.pride.hunterKillFood : 0);
  assert.strictEqual(Rules.config.pride.hunterKillPerMember, false);
  const ordered = Rules.actions.orderHunt(Rules.sample());
  assert.strictEqual(ordered.state.pride.orders.briar, 'hunt');
  assert.strictEqual(ordered.delta.hunt.chance, 50);
  const rested = Rules.actions.orderRest(Rules.sample());
  assert.strictEqual(rested.delta.rest.hunted, false);
  assert.ok(rested.delta.strength < Rules.defendStrength(Rules.sample()));
});

test('a guard counts one tenth more, and a cub-sitter covers cubs unless the store is empty', () => {
  const base = Rules.sample();
  const open = Rules.defendStrength(base);
  const guarded = Rules.actions.assignGuard(Rules.clone(base));
  assert.ok(Math.abs(guarded.delta.strength - (open + 1)) < 1e-9);
  const two = Rules.clone(base);
  two.roster.push({ id: 'second', stage: 'adult', status: 'member', fight: 10 });
  two.pride.roles.briar = 'guard';
  two.pride.roles.second = 'guard';
  assert.strictEqual(Rules.defendStrength(two), 31);
  assert.strictEqual(Rules.config.pride.guardStacks, false);
  const cared = Rules.actions.assignCubSitter(Rules.clone(base));
  assert.strictEqual(cared.delta.starvingExtra, 0);
  const empty = Rules.clone(base);
  empty.pride.food = 0;
  empty.pride.roles.briar = 'cubSitter';
  assert.strictEqual(Rules.starvingCubExtra(empty), 0.1);
  const safe = Rules.actions.resolveLostChallenge(cared.state);
  assert.strictEqual(safe.delta.cubsSafe, true);
  assert.deepStrictEqual(safe.delta.harms, [{ id: 'cub', harmed: false }]);
  const hurt = Rules.actions.resolveLostChallenge(Rules.sample());
  assert.deepStrictEqual(hurt.delta.harms, [{ id: 'cub', harmed: true }]);
});

test('scout warns on a hostile border, feeding follows the list, and the heir steps ahead', () => {
  const scout = Rules.actions.assignScout(Rules.sample());
  assert.strictEqual(scout.delta.report.warning, true);
  assert.strictEqual(scout.delta.report.known, true);
  const fed = Rules.actions.setFeedingOrder(Rules.sample());
  assert.strictEqual(fed.delta.feed.ate[0], 'cub');
  assert.ok(!fed.delta.feed.ate.includes('ash') || fed.state.pride.food === 0);
  assert.strictEqual(fed.delta.feed.ate.length, 1);
  const heir = Rules.actions.designateHeir(Rules.sample());
  assert.strictEqual(heir.delta.ranking[0], heir.delta.heirId);
  assert.notStrictEqual(heir.delta.heirId, 'ash');
  const exiled = Rules.actions.exile(Rules.sample());
  assert.strictEqual(exiled.state.roster.find((cat) => cat.id === 'briar').departure, 'exiled');
  assert.strictEqual(exiled.state.pride.exiles.length, 1);
  assert.ok(!Rules.eatOrder(exiled.state).some((cat) => cat.id === 'briar'));
});
