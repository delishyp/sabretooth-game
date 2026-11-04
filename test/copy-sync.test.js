const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { parseCopy } = require('../scripts/sync-copy');
const { SANDBOX_OPTIONS } = require('../src/main/saves-store');
const root = path.join(__dirname, '..');
const parsed = parseCopy(fs.readFileSync(path.join(root, 'docs/main-menu-copy.md'), 'utf8'));

test('committed menu-copy.json is in sync with Saga\'s doc', () => {
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/menu-copy.json'), 'utf8')), parsed);
});
test('sandbox panel ids/values match the store; labels and descriptions per value', () => {
  const opts = parsed.sandboxPanel.options;
  assert.deepStrictEqual(opts.map((o) => o.id), Object.keys(SANDBOX_OPTIONS));
  for (const o of opts) {
    assert.deepStrictEqual(o.values, SANDBOX_OPTIONS[o.id].values);
    assert.strictEqual(o.labels.length, o.values.length);
    assert.strictEqual(o.descriptions.length, o.values.length);
    assert.ok(o.description);
  }
  assert.strictEqual(opts.find((o) => o.id === 'needsDrain').name, 'Hunger and Thirst');
});
test('parseCopy rejects missing sections and mismatched labels', () => {
  assert.throws(() => parseCopy('```json\n{"taglines":[]}\n```'), /missing/);
  const bad = '```json\n' + JSON.stringify({ taglines: [], storytellerModes: [], difficulties: [], playStyles: [],
    sandboxPanel: { options: [{ id: 'x', values: [1, 2], labels: ['a'] }] }, strings: {} }) + '\n```';
  assert.throws(() => parseCopy(bad), /mismatch/);
});
