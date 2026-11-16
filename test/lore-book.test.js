const test = require('node:test');
const assert = require('node:assert');
const LoreBook = require('../src/renderer/js/lore-book');

function section(model, id) {
  return model.find((row) => row.id === id);
}

test('the book has Common knowledge, Learned, Rumours, Useful notes, and the Guide', () => {
  const model = LoreBook.book({ map: { visited: [] }, worldMemory: { knowledge: {} } }, { heading: 'Guide', entries: [] });
  assert.deepStrictEqual(model.map((row) => row.id), ['common', 'learned', 'rumours', 'notes', 'guide']);
  assert.strictEqual(section(model, 'guide').title, 'Guide');
  assert.strictEqual(section(model, 'common').titleKey, 'ui.lore.common');
  assert.deepStrictEqual(section(model, 'common').entries, []);
});

test('a rumour is not filed as something learned, and a visited region becomes a useful note', () => {
  const model = LoreBook.book({
    map: { visited: ['split_rock'] },
    worldMemory: {
      knowledge: {
        'kept/private': { scope: 'private' },
        'heard/highcrag': { scope: 'private', rumorPride: 'highcrag', rumorDay: 4 }
      }
    }
  }, { heading: 'Guide', entries: [{ id: 'goal.first_day', title: 'Get your bearings', body: 'Eat, and look at the land.' }] });
  assert.deepStrictEqual(section(model, 'learned').entries, [{ id: 'kept/private', bodyKey: 'ui.lore.learnedLine' }]);
  assert.deepStrictEqual(section(model, 'rumours').entries, [{ id: 'heard/highcrag', bodyKey: 'ui.lore.rumour' }]);
  assert.strictEqual(section(model, 'notes').entries[0].descriptionKey, 'map.region.split_rock.description');
  assert.strictEqual(section(model, 'guide').entries[0].title, 'Get your bearings');
});
