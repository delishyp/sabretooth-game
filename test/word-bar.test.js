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

test('meter labels are placeholder keys in menu copy', () => {
  for (const key of ['ui.meter.hunt', 'ui.meter.court', 'ui.meter.band']) {
    assert.match(hints[key], /^\[PH\]/);
  }
  assert.match(hints['ui.meter.band'], /\{band\}/);
  assert.match(hints['ui.meter.band'], /\{bands\}/);
});

test('the player encounter panel is a full-body portrait, not a scene crop', () => {
  const panels = Screen.encounterPanels({ assetId: 'giant-deer.png', encounterId: 'encounter.giant_deer.v1', displayName: 'Giant deer' }, { portraitId: 'cat-6e2d788dd48ff440', name: 'Ravenmark' });
  assert.match(panels.player.src, /assets\/portraits\/cats\/cat-6e2d788dd48ff440\.png$/);
  assert.ok(!panels.player.src.includes('encounters'));
  assert.match(panels.foe.src, /assets\/encounters\/giant-deer\.png$/);
  assert.strictEqual(panels.foe.flip, true);
});
