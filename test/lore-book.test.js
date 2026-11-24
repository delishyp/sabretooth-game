const test = require('node:test');
const assert = require('node:assert');
const LoreBook = require('../src/renderer/js/lore-book');

function section(model, id) {
  return model.find((row) => row.id === id);
}

test('common knowledge names the real leader and leaves no {token}', () => {
  const Slice = require('../src/renderer/js/slice');
  const path = require('path');
  const fs = require('fs');
  const D = path.join(__dirname, '../src/renderer/data');
  const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
  const E = Slice.create({
    map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
    slots: j('world-slots.json'), nameData: j('names/names.json'),
    looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
    conversation: j('events/recurring-conversation.json'),
    encounters: j('events/encounters-v0.2.json'),
    firstSeason: j('events/first-season-v0.6.2.json')
  });
  const s = E.newRun({ mainCat: { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: { v: 1, loci: {} } }, seed: 4, runId: 'lore' });
  const model = LoreBook.book(s, { heading: 'Guide', entries: [] });
  const bone = section(model, 'common').entries.find((row) => row.id === 'ck_leader_bonefield');
  assert.ok(bone.body.startsWith(s.npcs.bf01.name + ' leads Bonefield'));
  assert.ok(!bone.body.includes('{name}'));
  const raw = [];
  for (const sec of model) for (const row of sec.entries) {
    const blob = `${row.title || ''} ${row.body || ''} ${row.how || ''}`;
    if (/\{[A-Za-z]+\}/.test(blob) || blob.includes('[PH]')) raw.push(row.id + ': ' + blob);
  }
  assert.deepStrictEqual(raw, []);
});

test('the book has Common knowledge, Learned, Rumours, Useful notes, and the Guide', () => {
  const model = LoreBook.book({ map: { visited: [] }, worldMemory: { knowledge: {} } }, { heading: 'Guide', entries: [] });
  assert.deepStrictEqual(model.map((row) => row.id), ['common', 'learned', 'rumours', 'notes', 'guide']);
  assert.strictEqual(section(model, 'guide').title, 'Guide');
  assert.strictEqual(section(model, 'common').title, 'Common knowledge');
  assert.ok(section(model, 'common').entries.length > 10);
  assert.strictEqual(section(model, 'common').entries[0].title, 'The Vale');
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
  assert.strictEqual(section(model, 'learned').entries[0].id, 'kept/private');
  assert.ok(section(model, 'learned').entries[0].body);
  assert.strictEqual(section(model, 'rumours').entries[0].id, 'heard/highcrag');
  assert.ok(!JSON.stringify(section(model, 'rumours').entries).includes('"true"'));
  assert.strictEqual(section(model, 'notes').entries[0].descriptionKey, 'map.region.split_rock.description');
  assert.strictEqual(section(model, 'guide').entries[0].title, 'Get your bearings');
});
