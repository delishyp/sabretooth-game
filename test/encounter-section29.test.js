// Encounters §2.9, proposed and on by default. Humans get no intent tell.
const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../src/renderer/js/encounter-engine');
const narration = require('../src/renderer/data/encounter-narration-v1.json');

test('section 2.9 defend, even cap, and who may flee', () => {
  assert.strictEqual(Engine.config.section29.enabled, true);
  assert.strictEqual(Engine.config.fight.maxRounds, 13);
  assert.strictEqual(Engine.defendCounter(false, 0.1, 0.5), false);
  assert.strictEqual(Engine.defendCounter(true, 0.1, 0.5), true);
  assert.strictEqual(Engine.defendCounter(true, 0.8, 0.5), false);
  assert.deepStrictEqual(Engine.evenCap(40, 40, 100, 100, 'player'), { winner: 'player', key: 'fight.win' });
  assert.deepStrictEqual(Engine.evenCap(40, 40, 100, 100, 'foe'), { winner: 'opponent', key: 'fight.lose' });
  assert.deepStrictEqual(Engine.evenCap(40, 40, 100, 100, null), { winner: null, key: 'timeout_even' });
  assert.strictEqual(Engine.evenCap(40, 30, 100, 100, null), null);
  assert.strictEqual(Engine.mayFlee({ kind: 'wolves', group: true }, 10), false);
  assert.strictEqual(Engine.mayFlee({ kind: 'hyena', group: true }, 10), false);
  assert.strictEqual(Engine.mayFlee({ kind: 'hyena', group: false }, 30), true);
  assert.strictEqual(Engine.mayFlee({ kind: 'hyena', group: false }, 31), false);
  const held = Engine.resolve({
    kind: 'fight', seed: 1, quick: false, policy: 'defend', defender: null, engine: true,
    player: { id: 'player', name: 'Ravenmark', strength: 1 },
    opponent: { id: 'foe', name: 'Sleet', strength: 1 }
  });
  assert.ok(held.beats.some((item) => item.key === 'fight.defend.counter' || item.key === 'fight.defend.held'));
});

test('a human standoff has no tell, and intimidate ignores strength', () => {
  for (const key of Object.keys(narration.lines)) {
    assert.ok(!(/human/i.test(key) && /tell|telegraph/i.test(key)), key);
  }
  const low = Engine.resolve({
    kind: 'standoff', seed: 11, action: 'intimidate', engine: true,
    player: { id: 'player', name: 'Ravenmark', strength: 1 },
    opponent: { kind: 'humans', foeName: 'the humans', strength: 1 }
  });
  const high = Engine.resolve({
    kind: 'standoff', seed: 11, action: 'intimidate', engine: true,
    player: { id: 'player', name: 'Ravenmark', strength: 100 },
    opponent: { kind: 'humans', foeName: 'the humans', strength: 100 }
  });
  assert.strictEqual(low.outcome, high.outcome);
  for (const row of [low, high]) {
    assert.ok(row.beats.every((item) => !/tell|telegraph/i.test(item.key)));
    const moods = row.beats.filter((item) => item.key === 'standoff.humans');
    if (row.outcome === 'continues') assert.strictEqual(moods.length, 1);
    if (row.outcome === 'back-off') assert.strictEqual(moods.length, 0);
  }
  let backs = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    const row = Engine.resolve({
      kind: 'standoff', seed: 1000 + i, action: 'intimidate', engine: true,
      player: { id: 'player', name: 'Ravenmark', strength: 3 },
      opponent: { kind: 'humans', foeName: 'the humans' }
    });
    if (row.outcome === 'back-off') {
      backs += 1;
      assert.strictEqual(row.unhurt, true);
      assert.strictEqual(row.injury, null);
    } else {
      assert.strictEqual(row.injury, 'minor');
      assert.strictEqual(row.beats.filter((item) => item.key === 'standoff.humans').length, 1);
    }
  }
  assert.ok(Math.abs(backs / n - 0.5) <= 0.08, backs / n);
  const fled = Engine.resolve({
    kind: 'standoff', seed: 4, action: 'flee', engine: true,
    player: { id: 'player', name: 'Ravenmark', strength: 10 },
    opponent: { kind: 'humans', foeName: 'the humans', strength: 10 }
  });
  assert.ok(fled.beats.every((item) => !/tell|telegraph/i.test(item.key)));
  if (fled.ok) {
    assert.strictEqual(fled.injury, null);
    assert.strictEqual(fled.dropped, false);
  } else {
    assert.strictEqual(fled.injury, 'serious');
    assert.strictEqual(fled.dropped, true);
    assert.strictEqual(fled.beats[0].key, 'standoff.flee.fail');
  }
});
