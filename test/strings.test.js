// Every copy id the code uses must exist in Saga's strings map (or be a marked placeholder) — B12.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const I18n = require('../src/renderer/js/i18n');
const C = require('../src/renderer/js/creator');
const copy = require('../src/renderer/data/menu-copy.json');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const strings = copy.strings;
const MAP = require('../src/renderer/data/map.json');

function usedIds() {
  const ids = new Set();
  const html = read('src/renderer/index.html');
  for (const m of html.matchAll(/data-t="([^"]+)"/g)) ids.add(m[1]);
  for (const f of ['src/renderer/js/menu.js', 'src/renderer/js/game-screen.js', 'src/main/main.js', 'src/main/menu-handlers.js']) {
    const src = read(f);
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) ids.add(m[1]);
    for (const m of src.matchAll(/'(toast\.[\w.]+)'/g)) ids.add(m[1]);
    for (const m of src.matchAll(/v \? '(common\.\w+)' : '(common\.\w+)'/g)) { ids.add(m[1]); ids.add(m[2]); }
  }
  // Template ids `prefix.${x}` expanded over their known values:
  const expand = { 'settings.tab.': ['audio', 'display', 'controls', 'storyteller'], 'season.': ['spring', 'summer', 'autumn', 'winter'],
    'storyteller.shortName.': ['online', 'local', 'offline'], 'settings.display.mode.': ['fullscreen', 'borderless', 'windowed'],
    'settings.audio.': ['master', 'music', 'sfx', 'ambient', 'mute'], 'settings.display.': ['mode', 'uiScale', 'reducedMotion', 'vsync'],
    'settings.controls.': ['controllerVibration', 'invertY'],
    // Make Your Sabrecat (menu.js creator section, ids built from js/creator.js option/trait/preset ids)
    'creator.row.': ['name', 'sex', 'coat', 'markings', 'eyes', 'oddEyes', 'eyeLeft', 'eyeRight', 'preset'], 'creator.help.': ['sex', 'coat', 'markings', 'eyes'],
    'creator.sex.': C.SEXES, 'creator.coat.': C.coatsFor(true), 'creator.oddEyes.': C.OFF_ON, 'creator.rareTag': [''], 'creator.markings.': C.MARKINGS, 'creator.eyes.': C.EYES,
    'creator.preview.markings.': C.MARKINGS,
    'creator.preset.': [...C.PRESET_IDS, 'custom'].flatMap((p) => [p, `${p}.desc`]),
    'creator.trait.': C.TRAITS.flatMap((k) => [k, `${k}.desc`, `${k}.low`, `${k}.high`]),
    // Slice 1 game screen (js/game-screen.js); hazard/faction ids from map.json
    'game.need.': ['health', 'hunger', 'thirst', 'energy'], 'game.needState.': ['ok', 'low', 'critical', 'empty'], 'game.injury.': ['minor', 'serious'],
    'game.region.': ['prey', 'danger', 'water', 'owner'], 'game.prey.': ['0', '1', '2', '3'], 'game.danger.': ['0', '1', '2', '3'],
    'game.faction.': [...MAP.factions.map((f) => f.id), 'loner'], 'game.size.': ['small', 'medium', 'large'], 'game.forced.': ['rest', 'stuck', 'lost', 'travel'],
    'game.report.injury.': ['minor', 'serious'], 'game.report.healed.': ['minor', 'serious'],
    'game.report.': ['drink', 'tarEscaped', 'starving', 'parched', 'stuck', 'lost'], 'game.hazard.': MAP.hazards.map((h) => h.id),
    'summary.cause.': ['starvation', 'thirst', 'hunt', 'patrol', 'hazard'], 'summary.': ['days', 'regions', 'cats', 'best'] };
  const menu = read('src/renderer/js/menu.js');
  assert.ok(menu.includes('t(`settings.${settingsTab}.${key}`)'), 'settings label template present');
  for (const [p, vals] of Object.entries(expand)) vals.forEach((v) => ids.add(p + v));
  for (const tpl of ['t(`creator.row.${id}`)', 't(`creator.${row}.${id}`)', 't(`creator.trait.${trait}.low`)', 't(`creator.preset.${c.preset}.desc`)', 't(`creator.help.${id}`)'])
    assert.ok(menu.includes(tpl), `creator template ${tpl} present`);
  return [...ids];
}

test('every id used in code exists in Saga strings or a marked placeholder', () => {
  const t = I18n.create(strings);
  const missing = usedIds().filter((id) => !t.has(id));
  assert.deepStrictEqual(missing, []);
});
test('creator: no [PH] placeholders left, default names list ≥ 20, unique', () => {
  assert.deepStrictEqual(Object.keys(I18n.PLACEHOLDER_STRINGS).filter((k) => k.startsWith('creator.')), []);
  assert.strictEqual(strings['creator.name.reroll'], 'Randomize name');                   // dice label/tooltip (Saga), no code-only fallback
  assert.ok(!read('src/renderer/js/menu.js').includes("'Reroll name'"));
  const n = copy.creator.defaultNames; assert.ok(n.length >= 20); assert.strictEqual(new Set(n).size, n.length);
  for (const x of n) assert.strictEqual(C.sanitizeName(x).value, x);
  assert.ok(!('creator.backConfirm.body' in strings) && !read('src/renderer/js/menu.js').includes('backConfirm'));
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
test('slice 1 copy: no [PH] anywhere, no placeholders left, every used id is Saga\'s, every region has a description', () => {
  assert.deepStrictEqual(Object.keys(I18n.PLACEHOLDER_STRINGS), []);
  const ph = Object.entries(strings).filter(([, v]) => typeof v === 'string' && v.includes('[PH]')).map(([k]) => k);
  assert.deepStrictEqual(ph, []);
  assert.ok(!JSON.stringify(require('../src/renderer/data/menu-copy.json')).includes('[PH]'));
  assert.ok(!read('src/renderer/js/game-screen.js').includes('[PH]') && !read('src/renderer/js/i18n.js').includes('[PH]"'));
  assert.deepStrictEqual(usedIds().filter((id) => !(id in strings)), []);
  assert.deepStrictEqual(MAP.regions.filter((r) => !strings[`map.region.${r.id}.description`]).map((r) => r.id), []);
  const known = new Set(MAP.regions.map((r) => r.id));
  assert.deepStrictEqual(Object.keys(strings).filter((k) => k.startsWith('map.region.') && !known.has(k.split('.')[2])), [], 'no description for an unknown region');
});
