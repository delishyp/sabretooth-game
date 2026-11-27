const test = require('node:test');
const assert = require('node:assert');
const Breeding = require('../src/renderer/js/breeding');

test('the JS engine stays inside the DELTA-v0.1f bands', () => {
  const figures = Breeding.simulate(200);
  console.log('DELTA-v0.1f JS engine', JSON.stringify(figures));
  assert.ok(figures.foundingY10 >= 20 && figures.foundingY10 <= 32, 'founding ' + figures.foundingY10);
  assert.ok(figures.playerY10 >= 8 && figures.playerY10 <= 16, 'player ' + figures.playerY10);
  assert.ok(figures.warnByY10 >= 75 && figures.warnByY10 <= 100, 'warn ' + figures.warnByY10);
  assert.ok(Math.abs(figures.aiY10.highcrag - 14) <= 4, 'highcrag ' + figures.aiY10.highcrag);
  assert.ok(Math.abs(figures.aiY10.bonefield - 10) <= 4, 'bonefield ' + figures.aiY10.bonefield);
  assert.ok(Math.abs(figures.aiY10.mistwood - 10) <= 4, 'mistwood ' + figures.aiY10.mistwood);
  assert.ok(figures.aiMax >= 16 && figures.aiMax <= 28, 'max ' + figures.aiMax);
  assert.ok(figures.extinctY20.bonefield >= 2 && figures.extinctY20.bonefield <= 14, 'bf extinct ' + figures.extinctY20.bonefield);
  assert.ok(figures.extinctY20.mistwood >= 2 && figures.extinctY20.mistwood <= 14, 'mw extinct ' + figures.extinctY20.mistwood);
});
