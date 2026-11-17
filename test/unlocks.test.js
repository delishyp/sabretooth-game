const test = require('node:test');
const assert = require('node:assert');
const Unlocks = require('../src/renderer/js/unlocks');

function save(extra) {
  return Object.assign({
    deathRule: 'permadeath',
    season: 'summer',
    region: 'split_rock',
    npcs: {},
    world: {},
    records: { receipts: [], bonds: {} },
    map: { visited: ['split_rock'], claims: { split_rock: {} } },
    cat: { status: 'loner' }
  }, extra || {});
}

test('home, wilderness, smilodons and lore start open, and locked sections stay grey', () => {
  const fresh = save();
  const states = Unlocks.unlockedSystems(fresh);
  for (const id of Unlocks.STARTERS) assert.strictEqual(states[id], 'open', id);
  for (const id of Unlocks.SECTIONS) assert.strictEqual(states[id], 'locked', id);
  assert.strictEqual(states.map, undefined);
  assert.strictEqual(states.deeds, undefined);
  assert.strictEqual(Unlocks.SHOW_ALL, false);
  assert.strictEqual(Unlocks.displayState(fresh, 'pride'), 'locked');
  assert.strictEqual(Unlocks.displayState(fresh, 'home'), 'open');
  assert.strictEqual(Unlocks.displayState(fresh, 'map'), 'open');
  assert.strictEqual(Unlocks.displayState(fresh, 'deeds'), 'open');
});

test('pride opens on the first of border scent, patrol, joining or founding', () => {
  const scent = save();
  scent.records.receipts.push('run/scout/highcrag/3');
  assert.strictEqual(Unlocks.systemState(scent, 'pride'), 'new');

  const patrol = save();
  patrol.records.receipts.push('run/patrol/bonefield/4');
  assert.strictEqual(Unlocks.systemState(patrol, 'pride'), 'new');

  const member = save();
  member.cat = { status: 'member', prideId: 'mistwood' };
  assert.strictEqual(Unlocks.systemState(member, 'pride'), 'new');
  assert.strictEqual(Unlocks.systemState(member, 'den'), 'locked');

  const founded = save();
  founded.records.pride = { id: 'player', name: 'Ash' };
  assert.strictEqual(Unlocks.systemState(founded, 'pride'), 'new');
  assert.strictEqual(Unlocks.systemState(founded, 'den'), 'new');
  assert.strictEqual(Unlocks.systemState(founded, 'councils'), 'new');
});

test('inventory, market, quests and reputation follow the save, and noteUse does not unlock them', () => {
  const s = save();
  assert.strictEqual(Unlocks.noteUse(s, 'inventory'), 'locked');
  assert.strictEqual(Unlocks.noteUse(s, 'market'), 'locked');
  assert.strictEqual(Unlocks.noteUse(s, 'quests'), 'locked');
  s.world.offers = [{ id: 'ask', state: 'offered' }];
  assert.strictEqual(Unlocks.systemState(s, 'quests'), 'locked');
  s.world.requests = [{ id: 'ask', state: 'open' }];
  assert.strictEqual(Unlocks.systemState(s, 'quests'), 'new');
  s.world.carried = { kind: 'herb' };
  assert.strictEqual(Unlocks.systemState(s, 'inventory'), 'new');
  s.world.trades = [{ id: 't', kind: 'food_for_passage', state: 'active' }];
  assert.strictEqual(Unlocks.systemState(s, 'market'), 'new');
  s.records.deedFacts = { 'hunt.success': true };
  assert.strictEqual(Unlocks.systemState(s, 'reputation'), 'new');
  Unlocks.remember(s, 'inventory');
  s.world.carried = null;
  assert.strictEqual(Unlocks.systemState(s, 'inventory'), 'open');
});

test('a locked section or action stays selectable and returns its opens-when line', () => {
  const s = save();
  assert.deepStrictEqual(Unlocks.selectSection(s, 'home'), { navigate: true });
  assert.deepStrictEqual(Unlocks.selectSection(s, 'map'), { navigate: true });
  assert.deepStrictEqual(Unlocks.selectSection(s, 'deeds'), { navigate: true });
  assert.deepStrictEqual(Unlocks.selectSection(s, 'cats'), { navigate: true });
  const pride = Unlocks.selectSection(s, 'pride');
  assert.strictEqual(pride.navigate, undefined);
  assert.ok(pride.opensWhen.startsWith('Opens when you catch a border scent'));
  assert.ok(!/\d/.test(pride.opensWhen));
  s.records.receipts.push('run/scout/highcrag/2');
  assert.deepStrictEqual(Unlocks.selectSection(s, 'pride'), { navigate: true });
  const court = Unlocks.selectSection(s, 'court');
  assert.ok(court.opensWhen.startsWith('Opens when you and a cat are Bonded'));
  s.season = 'spring';
  s.records.bonds.ln05 = { stage: 'close' };
  assert.deepStrictEqual(Unlocks.selectSection(s, 'court'), { navigate: true });
  assert.ok(Unlocks.selectSection(s, 'found').opensWhen.startsWith('Opens when you have a mate'));
  s.records.matePair = { mateId: 'ln05' };
  assert.deepStrictEqual(Unlocks.selectSection(s, 'found'), { navigate: true });
  assert.ok(Unlocks.selectSection(s, 'spar').opensWhen.startsWith('Opens when you and a cat know'));
  s.npcs.ln05 = { id: 'ln05', met: true, stage: 'adult', affinity: 20 };
  assert.deepStrictEqual(Unlocks.selectSection(s, 'spar'), { navigate: true });
  assert.strictEqual(Unlocks.toastLine('Pride'), 'New: Pride');
  assert.strictEqual(Unlocks.topBarDay({ season: 'spring', day: 1 }), 'Spring · Day 1 · Mating season');
  assert.strictEqual(Unlocks.topBarDay({ season: 'spring', day: 21, records: { seasonEndShown: true } }), 'Spring · Day 21');
  assert.ok(!Unlocks.topBarDay({ season: 'spring', day: 4 }).includes('/'));
  assert.strictEqual(Unlocks.foeStateLine({ name: 'Sleetbark', named: true }), "Sleetbark is circling. You're winded.");
  assert.strictEqual(Unlocks.foeStateLine({ kind: 'wolf' }), "The wolf is circling. You're winded.");
  const actions = Unlocks.moreActions(save());
  const lockedAt = actions.findIndex((row) => row.locked);
  assert.ok(actions.slice(0, lockedAt).every((row) => !row.locked));
  assert.ok(actions.slice(lockedAt).every((row) => row.locked && row.opensWhen));
  assert.ok(actions.some((row) => row.id === 'askjoin' && row.locked));
  const ready = save();
  ready.region = 'highcrag';
  ready.map.claims.highcrag = { highcrag: 80 };
  ready.npcs.hc01 = { id: 'hc01', met: true };
  const asked = Unlocks.moreActions(ready).find((row) => row.id === 'askjoin');
  assert.strictEqual(asked.locked, false);
  assert.strictEqual(Unlocks.unavailableTip().title, 'Greyed sections');
  assert.ok(!/Unavailable/.test(Unlocks.unavailableTip().body));
});
