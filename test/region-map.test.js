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

test('name chips never intersect, including The Split Rock and The Bonefield', () => {
  const discovered = map.regions.map((r) => r.id);
  const state = { region: 'split_rock', map: { discovered, visited: ['split_rock'] } };
  const view = RegionMap.build(map, state, {});
  const sizes = [[480, 320], [640, 400], [800, 480], [1100, 640], [1600, 900]];
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const [w, h] of sizes) {
    const chips = RegionMap.layoutChips(view.nodes, w, h, 18);
    assert.strictEqual(chips.length, view.nodes.length, w + 'x' + h);
    for (let i = 0; i < chips.length; i++) {
      const a = chips[i];
      assert.ok(a.w >= 18 && a.h >= 18, a.id);
      assert.ok(a.x >= -0.01 && a.y >= -0.01 && a.x + a.w <= w + 0.5, a.id + ' ' + w);
      for (let j = i + 1; j < chips.length; j++) {
        assert.ok(!hit(a, chips[j]), a.id + ' overlaps ' + chips[j].id + ' at ' + w + 'x' + h);
      }
    }
    const split = chips.find((c) => c.id === 'split_rock');
    const bone = chips.find((c) => c.id === 'bonefield');
    assert.ok(split && bone && !hit(split, bone));
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
