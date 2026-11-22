const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../src/renderer/js/encounter-engine');

test('odds bands use the v0.2h cutoffs', () => {
  assert.strictEqual(Engine.oddsBand(80), 'easy');
  assert.strictEqual(Engine.oddsBand(100), 'easy');
  assert.strictEqual(Engine.oddsBand(79), 'good');
  assert.strictEqual(Engine.oddsBand(60), 'good');
  assert.strictEqual(Engine.oddsBand(59), 'even');
  assert.strictEqual(Engine.oddsBand(40), 'even');
  assert.strictEqual(Engine.oddsBand(39), 'bad');
  assert.strictEqual(Engine.oddsBand(20), 'bad');
  assert.strictEqual(Engine.oddsBand(19), 'hopeless');
  assert.strictEqual(Engine.oddsBand(0), 'hopeless');
});

test('Keen Nose lifts the band and Dull Nose drops it, without changing the chance', () => {
  const good = Engine.huntForecast(65, 0);
  assert.strictEqual(good.band, 'good');
  assert.strictEqual(good.word, "You'll probably catch it.");
  const keen = Engine.huntForecast(65, -1);
  assert.strictEqual(keen.chance, 65);
  assert.strictEqual(keen.raw, 'good');
  assert.strictEqual(keen.band, 'easy');
  assert.strictEqual(keen.word, 'This should be an easy catch.');
  const dull = Engine.huntForecast(65, 1);
  assert.strictEqual(dull.chance, 65);
  assert.strictEqual(dull.band, 'even');
  assert.strictEqual(dull.word, 'It could go either way.');
  assert.strictEqual(Engine.shiftOddsBand('easy', -1), 'easy');
  assert.strictEqual(Engine.shiftOddsBand('hopeless', 1), 'hopeless');
});

test('hunt words and fight words stay on their own sentences', () => {
  assert.strictEqual(Engine.oddsWord('even', 'hunt'), 'It could go either way.');
  assert.strictEqual(Engine.oddsWord('even', 'fight'), 'This could go either way.');
  assert.strictEqual(Engine.oddsWord('hopeless', 'hunt'), "You won't catch this one.");
  assert.strictEqual(Engine.oddsWord('hopeless', 'fight'), "You won't win this. Get away.");
});

test('tier-only contests map clean, partial, fail, and injury', () => {
  assert.strictEqual(Engine.tierOddsBand('clean'), 'easy');
  assert.strictEqual(Engine.tierOddsBand('partial'), 'good');
  assert.strictEqual(Engine.tierOddsBand('fail'), 'bad');
  assert.strictEqual(Engine.tierOddsBand('injured'), 'hopeless');
  assert.strictEqual(Engine.oddsWord(Engine.tierOddsBand('clean'), 'fight'), "You'd win this easily.");
});

test('fight win chance is even at equal strength and uses the same bands', () => {
  assert.strictEqual(Engine.fightWinChance(10, 10), 50);
  assert.strictEqual(Engine.fightForecast(10, 10).band, 'even');
  assert.strictEqual(Engine.fightForecast(10, 10).word, 'This could go either way.');
  const ahead = Engine.fightForecast(16, 10);
  assert.ok(ahead.chance >= 80);
  assert.strictEqual(ahead.band, 'easy');
  assert.strictEqual(ahead.word, "You'd win this easily.");
  const behind = Engine.fightForecast(6, 10);
  assert.ok(behind.chance < 20);
  assert.strictEqual(behind.band, 'hopeless');
  assert.strictEqual(Engine.fightWinChance(100, 10), 95);
  assert.strictEqual(Engine.fightWinChance(1, 100), 5);
});
