const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const hints = require('../src/renderer/data/events/first-season-v0.6.2.json').uiHints;
const copy = require('../docs/design/copy/ui-copy-v1.json');

test('runtime-loaded copy JSON has no [PH] markers', () => {
  const root = path.join(__dirname, '../src/renderer/data');
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (name.endsWith('.json') && fs.readFileSync(file, 'utf8').includes('[PH]')) hits.push(path.relative(root, file));
    }
  };
  walk(root);
  assert.deepStrictEqual(hits, []);
});

test('uiHints no longer carry placeholder markers', () => {
  const left = Object.entries(hints).filter(([, value]) => typeof value === 'string' && value.includes('[PH]'));
  assert.deepStrictEqual(left, []);
  assert.strictEqual(hints['ui.meter.band'], '');
  assert.strictEqual(hints['ui.council.agenda.truce'], 'A truce between {prideA} and {prideB}');
});

test('the new UI strings contain no digits', () => {
  const keys = Object.keys(hints).filter((key) => key.startsWith('unlock.opensWhen.') || key.startsWith('ui.unlock.') || key.startsWith('tip.place.unavailable') || key.startsWith('guide.tip.place.unavailable') || key.startsWith('ui.'));
  const bad = keys.filter((key) => typeof hints[key] === 'string' && /\d/.test(hints[key]));
  assert.deepStrictEqual(bad, []);
  const file = fs.readFileSync(path.join(__dirname, '../src/renderer/js/councils.js'), 'utf8');
  assert.ok(!file.includes('[PH]'));
});

test('every placeholder Saga wrote for this tip is in uiHints', () => {
  const absent = Object.keys(copy.placeholders).filter((key) => hints[key] == null);
  assert.deepStrictEqual(absent, []);
});
