const test = require('node:test');
const assert = require('node:assert');
const Screen = require('../src/renderer/js/encounter-screen');
const Engine = require('../src/renderer/js/encounter-engine');
const hints = require('../src/renderer/data/events/first-season-v0.6.2.json').uiHints;
const words = require('../src/renderer/data/encounter-bar-words-v1.json');

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

test('move names are Saga\'s words, and hunt and courtship bars do not use placeholders', () => {
  for (const id of Screen.FIGHT_MOVES.concat(Screen.COURT_MOVES)) {
    const line = hints['ui.encounter.move.' + id];
    assert.ok(line && !line.includes('[PH]') && !/\d/.test(line), id);
  }
  assert.strictEqual(hints['ui.encounter.tell'], 'It gathers itself.');
  for (let i = 0; i < 4; i++) {
    const hunt = Screen.screen({ kind: 'hunt', band: i });
    assert.strictEqual(hunt.word, words.hunt_escape[i].text);
    assert.strictEqual(hints['ui.meter.hunt.word.' + i], words.hunt_escape[i].text);
    assert.ok(!hunt.word.includes('[PH]'));
  }
  for (let i = 0; i < 5; i++) {
    const court = Screen.screen({ kind: 'courtship', band: i });
    assert.strictEqual(court.word, words.courtship_interest[i].text);
    assert.strictEqual(hints['ui.meter.court.word.' + i], words.courtship_interest[i].text);
    assert.ok(!court.word.includes('[PH]'));
    assert.strictEqual(court.directionText, null);
  }
});

test('a courtship direction variant never repeats twice in a row', () => {
  const court = Screen.screen({ kind: 'courtship', band: 3, direction: 'down', directionId: 'dir.down.a' });
  assert.strictEqual(court.word, 'Warming to you');
  assert.strictEqual(court.directionText, 'That cost you.');
  for (const direction of ['up', 'down', 'none']) {
    let state = { lastDirectionId: null };
    const seen = [];
    for (let i = 0; i < 8; i++) {
      state = Screen.afterMove(state, direction, () => 0);
      seen.push(state.directionId);
      assert.ok(words.courtship_direction[direction].some((item) => item.id === state.directionId));
      assert.ok(!state.directionText.includes('[PH]'));
    }
    for (let i = 1; i < seen.length; i++) assert.notStrictEqual(seen[i], seen[i - 1]);
  }
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
