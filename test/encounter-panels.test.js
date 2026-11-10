// Fix 3: both encounter panels are the same full-body 4:3 frame.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Screen = require('../src/renderer/js/game-screen');

const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');

test('player and foe share one 4:3 contain frame, and only animals flip', () => {
  const player = { name: 'Ravenmark', portraitId: 'cat-6e2d788dd48ff440' };
  const deer = Screen.encounterPanels({ assetId: 'giant-deer.png', encounterId: 'encounter.giant_deer.v1', displayName: 'Giant deer' }, player);
  const hyena = Screen.encounterPanels({ assetId: 'cave-hyena.png', encounterId: 'encounter.cave_hyena.v1', displayName: 'Cave hyena' }, player);
  const human = Screen.encounterPanels({ assetId: 'human-enemy.png', encounterId: 'encounter.human.v1', displayName: 'Human' }, player);
  assert.strictEqual(deer.player.flip, false);
  assert.strictEqual(deer.player.src, hyena.player.src);
  assert.ok(deer.player.src.endsWith('/cats/cat-6e2d788dd48ff440.png'));
  assert.strictEqual(deer.foe.flip, true);
  assert.strictEqual(hyena.foe.flip, true);
  assert.strictEqual(human.foe.flip, false);
  assert.ok(deer.foe.src.endsWith('/encounters/giant-deer.png'));
  assert.match(css, /\.encounter-panel \{[\s\S]*?aspect-ratio:\s*1448\s*\/\s*1086/);
  assert.match(css, /\.encounter-panel img \{[\s\S]*?object-fit:\s*contain/);
  assert.match(css, /\.encounter-panel\.is-foe img\.is-flipped \{[\s\S]*?scaleX\(-1\)/);
  assert.ok(!/\.encounter-panel[\s\S]{0,180}object-fit:\s*cover/.test(css));
});
