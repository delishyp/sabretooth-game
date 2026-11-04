// Every copy id the code uses must exist in Saga's strings map (or be a marked placeholder) — B12.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const I18n = require('../src/renderer/js/i18n');
const copy = require('../src/renderer/data/menu-copy.json');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const strings = copy.strings;

function usedIds() {
  const ids = new Set();
  const html = read('src/renderer/index.html');
  for (const m of html.matchAll(/data-t="([^"]+)"/g)) ids.add(m[1]);
  for (const f of ['src/renderer/js/menu.js', 'src/main/main.js', 'src/main/menu-handlers.js']) {
    const src = read(f);
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) ids.add(m[1]);
    for (const m of src.matchAll(/'(toast\.[\w.]+)'/g)) ids.add(m[1]);
    for (const m of src.matchAll(/v \? '(common\.\w+)' : '(common\.\w+)'/g)) { ids.add(m[1]); ids.add(m[2]); }
  }
  // Template ids `prefix.${x}` expanded over their known values:
  const expand = { 'settings.tab.': ['audio', 'display', 'controls', 'storyteller'], 'season.': ['spring', 'summer', 'autumn', 'winter'],
    'storyteller.shortName.': ['online', 'local', 'offline'], 'settings.display.mode.': ['fullscreen', 'borderless', 'windowed'],
    'settings.audio.': ['master', 'music', 'sfx', 'ambient', 'mute'], 'settings.display.': ['mode', 'uiScale', 'reducedMotion', 'vsync'],
    'settings.controls.': ['controllerVibration', 'invertY'] };
  const menu = read('src/renderer/js/menu.js');
  assert.ok(menu.includes('t(`settings.${settingsTab}.${key}`)'), 'settings label template present');
  for (const [p, vals] of Object.entries(expand)) vals.forEach((v) => ids.add(p + v));
  return [...ids];
}

test('every id used in code exists in Saga strings or a marked placeholder', () => {
  const t = I18n.create(strings);
  const missing = usedIds().filter((id) => !t.has(id));
  assert.deepStrictEqual(missing, []);
});
test('placeholder ids are not also covered by Saga (remove them once she does)', () => {
  const overlap = Object.keys(I18n.PLACEHOLDER_STRINGS).filter((k) => k in strings);
  assert.deepStrictEqual(overlap, []);
  for (const v of Object.values(I18n.PLACEHOLDER_STRINGS)) assert.ok(v.startsWith('[PH]'), 'placeholders are visibly marked');
});
test('t() fills {vars} and marks unknown ids', () => {
  const t = I18n.create(strings);
  assert.strictEqual(t('run.label', { catName: 'Ash', prideName: 'Frostfang' }), 'Ash of Frostfang');
  assert.strictEqual(t('nope.id'), '⟦nope.id⟧');
  assert.strictEqual(t('difficulty.begin'), strings['difficulty.begin']);
});
test('no raw user-facing literals left in renderer for known old strings', () => {
  const menu = read('src/renderer/js/menu.js');
  for (const s of ['Could not start', 'Quit Sabretooth?', 'Empty run', 'Damaged run', 'Reset to defaults', 'unavailable, using']) assert.ok(!menu.includes(s), s);
});
