const test = require('node:test');
const assert = require('node:assert');
const Panel = require('../src/renderer/js/directory-panel');
const hints = require('../src/renderer/data/events/first-season-v0.6.2.json').uiHints;

test('an unselected directory asks for a cat, and a selected cat keeps its saved name', () => {
  const empty = Panel.detail(null);
  assert.strictEqual(empty.emptyKey, 'ui.directory.choose');
  assert.match(hints[empty.emptyKey], /^\[PH\]/);
  assert.match(hints[empty.titleKey], /^\[PH\]/);
  assert.deepStrictEqual(Panel.detail({ id: 'ln05', name: 'Darkclaw', bond: 'Met' }), {
    id: 'ln05', name: 'Darkclaw', bond: 'Met', titleKey: 'ui.directory.detail'
  });
});

test('a pride with no name uses the empty placeholder', () => {
  assert.strictEqual(Panel.pride(false).emptyKey, 'ui.pride.empty');
  assert.match(hints['ui.pride.empty'], /^\[PH\]/);
  assert.strictEqual(Panel.pride(true), null);
});
