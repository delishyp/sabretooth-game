const test = require('node:test');
const assert = require('node:assert');
const Screen = require('../src/renderer/js/encounter-screen');
const Engine = require('../src/renderer/js/encounter-engine');
const hints = require('../src/renderer/data/events/first-season-v0.6.2.json').uiHints;

test('a fight shows the six moves and HP, and a human does not', () => {
  const fight = Screen.screen({ kind: 'fight' });
  assert.deepStrictEqual(fight.moves.map((m) => m.id), Screen.FIGHT_MOVES);
  assert.strictEqual(fight.bars, 'hp');
  assert.strictEqual(fight.tell, true);
  const human = Screen.screen({ kind: 'human' });
  assert.deepStrictEqual(human.moves.map((m) => m.id), ['intimidate', 'flee']);
  assert.strictEqual(human.bars, null);
  assert.strictEqual(human.tell, false);
  assert.strictEqual(human.flip, false);
  const hyena = Screen.screen({ kind: 'hyena' });
  assert.strictEqual(hyena.lethal, true);
  assert.match(hyena.art, /cave-hyena/);
});

test('hunt hides Cut it off without a partner, and courtship has no HP', () => {
  const alone = Screen.screen({ kind: 'hunt', phase: 'chase' });
  assert.ok(!alone.moves.some((m) => m.id === 'cut_off'));
  const helped = Screen.screen({ kind: 'hunt', phase: 'chase', partner: true });
  assert.ok(helped.moves.some((m) => m.id === 'cut_off'));
  const small = Screen.screen({ kind: 'hunt', phase: 'kill', size: 'small' });
  assert.ok(!small.moves.some((m) => m.id === 'hamstring'));
  const court = Screen.screen({ kind: 'courtship', band: 2 });
  assert.strictEqual(court.bars, 'court');
  assert.strictEqual(court.wordKey, 'ui.meter.court.word.2');
  assert.ok(Screen.readable(court));
  assert.ok(Screen.readable(alone));
});

test('move and band labels are placeholders', () => {
  for (const id of Screen.FIGHT_MOVES.concat(Screen.COURT_MOVES)) {
    assert.match(hints['ui.encounter.move.' + id], /^\[PH\]/);
  }
  for (let i = 0; i < 4; i++) assert.match(hints['ui.meter.hunt.word.' + i], /^\[PH\]/);
  for (let i = 0; i < 5; i++) assert.match(hints['ui.meter.court.word.' + i], /^\[PH\]/);
});

test('reloading a pending encounter repeats the same result', () => {
  const input = {
    kind: 'spar', seed: 9, quick: false, policy: 'average', engine: true,
    player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
  };
  const first = Engine.resolve(input);
  const saved = Engine.pendingEncounter(input);
  const again = Engine.resume(saved);
  const third = Engine.resume(JSON.parse(JSON.stringify(saved)));
  assert.strictEqual(again.winner, first.winner);
  assert.strictEqual(again.rounds, first.rounds);
  assert.strictEqual(third.winner, first.winner);
  assert.strictEqual(third.rounds, first.rounds);
});
