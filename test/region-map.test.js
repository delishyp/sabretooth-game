const test = require('node:test');
const assert = require('node:assert');
const RegionMap = require('../src/renderer/js/region-map');
const map = require('../src/renderer/data/map.json');

test('every region has a place on the board', () => {
  const missing = map.regions.map((r) => r.id).filter((id) => !RegionMap.LAYOUT[id]);
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(Object.keys(RegionMap.LAYOUT).length, map.regions.length);
});

test('the hover card is not a layer on the board, so it cannot cover East Saddle', () => {
  const discovered = map.regions.map((r) => r.id);
  for (const id of discovered) {
    const view = RegionMap.build(map, { region: 'split_rock', map: { discovered, visited: ['split_rock'] } }, { hover: id });
    assert.strictEqual(view.cardBox.overlay, false, id);
    const node = view.nodes.find((n) => n.id === 'east_saddle');
    assert.ok(node.left >= 70, 'East Saddle stays on the east of the board');
    assert.ok(node.left + node.width <= 100);
  }
});

test('a new game shows only the discovered ground, and an unknown id stays Unknown land', () => {
  const state = { region: 'split_rock', map: { discovered: ['split_rock', 'tallgrass'], visited: ['split_rock'] } };
  const view = RegionMap.build(map, state, { hover: 'split_rock' });
  assert.deepStrictEqual(view.nodes.map((n) => n.id).sort(), ['split_rock', 'tallgrass']);
  assert.strictEqual(view.nodes.find((n) => n.id === 'split_rock').here, true);
  assert.strictEqual(view.card.known, true);
  assert.strictEqual(view.card.descriptionKey, 'map.region.split_rock.description');
  assert.strictEqual(view.card.name, 'The Split Rock');
  assert.deepStrictEqual(RegionMap.cardFor(map, state, 'east_saddle'), { id: 'east_saddle', known: false, unknownKey: 'game.region.unknown' });
});
