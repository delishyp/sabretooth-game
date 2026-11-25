// Saga's encounter narration. Every engine outcome has one line, with no digits and only the allowed tokens.
const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../src/renderer/js/encounter-engine');
const Sim = require('../src/dev/sim-hooks');
const narration = require('../src/renderer/data/encounter-narration-v1.json');

function narrationTexts(node, out) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.text === 'string') out.push(node.text);
  const list = Array.isArray(node) ? node : Object.keys(node).filter((key) => !key.startsWith('_')).map((key) => node[key]);
  for (const child of list) narrationTexts(child, out);
  return out;
}

test('every engine outcome has one narration line and only foeName or name', () => {
  assert.ok(Engine.OUTCOMES.length > 0);
  const everyLine = narrationTexts(narration, []);
  assert.ok(everyLine.length >= 678, everyLine.length);
  for (const line of everyLine) assert.ok(!/\d/.test(line), line);
  for (const key of Engine.OUTCOMES) {
    const line = Engine.lineFor(key, { group: true, lethal: true, winner: 'player', actor: 'you' });
    assert.strictEqual(typeof line, 'string', key);
    assert.ok(line.trim().length > 0, key);
    assert.ok(!/\d/.test(line), `${key} ${line}`);
    const tokens = line.match(/\{[^}]+\}/g) || [];
    for (const token of tokens) assert.ok(token === '{foeName}' || token === '{name}', `${key} ${token}`);
  }
  assert.strictEqual(Engine.telegraphKey(true), Engine.telegraphKey(false));
  for (const key of Object.keys(narration.lines)) {
    assert.ok(!(/human/i.test(key) && /tell|telegraph/i.test(key)), key);
  }
  const humans = Engine.resolve({
    kind: 'standoff', seed: 2, action: 'intimidate', engine: true,
    player: { id: 'player', name: 'Ravenmark' },
    opponent: { kind: 'humans', foeName: 'the humans' }
  });
  assert.ok(humans.beats.every((item) => !/tell|telegraph/i.test(item.key)));
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
