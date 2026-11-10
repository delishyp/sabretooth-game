// Saga's encounter narration. Every engine outcome has one line, with no digits and only the allowed tokens.
const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../src/renderer/js/encounter-engine');
const Sim = require('../src/dev/sim-hooks');
const narration = require('../src/renderer/data/encounter-narration-v1.json');

test('every engine outcome has one narration line and only foeName or name', () => {
  assert.ok(Engine.OUTCOMES.length > 0);
  for (const key of Engine.OUTCOMES) {
    const line = narration.lines[key];
    assert.strictEqual(typeof line, 'string', key);
    assert.ok(line.trim().length > 0, key);
    assert.ok(!/\d/.test(line), `${key} ${line}`);
    const tokens = line.match(/\{[^}]+\}/g) || [];
    for (const token of tokens) assert.ok(token === '{foeName}' || token === '{name}', `${key} ${token}`);
  }
  assert.strictEqual(Engine.telegraphKey(true), Engine.telegraphKey(false));
  const wolves = Engine.resolve({
    kind: 'fight', seed: 3, engine: true,
    player: { id: 'player', name: 'Ravenmark', strength: 10 },
    opponent: { id: 'wolves', kind: 'wolves', group: true, strength: 10 }
  });
  assert.ok(wolves.beats.some((item) => item.key === 'fight.warning.group'));
  assert.ok(wolves.beats.every((item) => item.key !== 'fight.warning' || item.key === 'fight.warning.group'));
  assert.ok(wolves.beats.some((item) => item.line.includes('the wolves')));
  const hyena = Engine.foeOf({ opponent: { kind: 'hyena' }, player: { name: 'Ravenmark' } });
  assert.strictEqual(hyena.foeName, 'the hyena');
  assert.strictEqual(hyena.group, false);
  const named = Engine.foeOf({ opponent: { name: 'Sleet' }, player: { name: 'Ravenmark' } });
  assert.strictEqual(named.foeName, 'Sleet');
  const repeat = Engine.resolve({
    kind: 'courtship', seed: 4, engine: true,
    player: { id: 'player', name: 'Ravenmark' },
    opponent: { id: 'cat', name: 'Ash' },
    courtship: { pairValue: 30, sociability: 80, repeat: true }
  });
  const keys = repeat.beats.map((item) => item.key);
  assert.ok(keys.includes('courtship.repeat'));
  assert.ok(!keys.some((key) => key.startsWith('courtship.reaction')));
  assert.strictEqual(keys.filter((key) => key === 'courtship.open' || key === 'courtship.repeat' || key.startsWith('courtship.')).length, keys.length);
  const large = Engine.resolve({ kind: 'hunt', seed: 9, size: 'large', quick: true, engine: true, player: { id: 'player', name: 'Ravenmark' }, opponent: { id: 'prey' } });
  if (large.injury) assert.ok(['hunt.injury.minor', 'hunt.injury.serious', 'hunt.injury.crippling'].includes(large.beats[1].key));
  const dumped = Sim.simulateEncounter({
    kind: 'spar', seed: 8, engine: true, narration: true,
    player: { id: 'player', name: 'Ravenmark' }, opponent: { id: 'foe', name: 'Sleet' }
  });
  assert.deepStrictEqual(dumped.narrationKeys, ['spar.open', 'spar.stop']);
});
