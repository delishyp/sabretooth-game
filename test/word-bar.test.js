// Hunt and courtship meters: band counts and placeholder keys, no invented words.
const test = require('node:test');
const assert = require('node:assert');
const WordBar = require('../src/renderer/js/word-bar');
const hints = require('../src/renderer/data/events/first-season-v0.6.2.json').uiHints;
const Screen = require('../src/renderer/js/game-screen');

test('hunt has four bands and courtship has five', () => {
  const hunt = WordBar.describe({ kind: 'hunt', band: 1 });
  const court = WordBar.describe({ kind: 'court', band: 4 });
  assert.deepStrictEqual([hunt.bands, hunt.band, hunt.titleKey], [4, 1, 'ui.meter.hunt']);
  assert.deepStrictEqual([court.bands, court.band], [5, 4]);
  assert.strictEqual(WordBar.describe({ kind: 'fight' }), null);
  assert.strictEqual(WordBar.describe({ kind: 'hunt', band: 9 }).band, 3);
});

test('meter titles are words, and the band caption is the existing word rather than digits', () => {
  assert.strictEqual(hints['ui.meter.hunt'], 'Hunt');
  assert.strictEqual(hints['ui.meter.court'], 'Courtship');
  assert.strictEqual(hints['ui.meter.band'], '');
  assert.strictEqual(WordBar.caption('hunt', 0), 'Nearly yours');
  assert.strictEqual(WordBar.caption('court', 4), 'Drawn to you');
  assert.ok(!/\d/.test(WordBar.caption('hunt', 2)));
});

test('the player encounter panel is a full-body portrait, not a scene crop', () => {
  const panels = Screen.encounterPanels({ assetId: 'giant-deer.png', encounterId: 'encounter.giant_deer.v1', displayName: 'Giant deer' }, { portraitId: 'cat-6e2d788dd48ff440', name: 'Ravenmark' });
  assert.match(panels.player.src, /assets\/portraits\/cats\/cat-6e2d788dd48ff440\.png$/);
  assert.ok(!panels.player.src.includes('encounters'));
  assert.match(panels.foe.src, /assets\/encounters\/giant-deer\.png$/);
  assert.strictEqual(panels.foe.flip, true);
});
