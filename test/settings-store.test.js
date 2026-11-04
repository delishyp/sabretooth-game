const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { createSettingsStore, DEFAULTS } = require('../src/main/settings-store');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-'));

test('first launch writes spec defaults', () => {
  const d = tmp(); const s = createSettingsStore(d);
  assert.deepStrictEqual(s.get(), DEFAULTS);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(d, 'settings.json'))), DEFAULTS);
  assert.strictEqual(s.get().storyteller.mode, 'offline');
});
test('set persists storyteller mode across reloads', () => {
  const d = tmp(); createSettingsStore(d).set({ storyteller: { mode: 'online' } });
  const s2 = createSettingsStore(d);
  assert.strictEqual(s2.get().storyteller.mode, 'online');
  assert.strictEqual(s2.get().audio.master, 0.8);
});
test('invalid storyteller mode and unknown keys are rejected', () => {
  const s = createSettingsStore(tmp()); const r = s.set({ storyteller: { mode: 'classic' }, hack: 1 });
  assert.strictEqual(r.storyteller.mode, 'offline'); assert.ok(!('hack' in r));
});
test('corrupt settings are backed up and reset', () => {
  const d = tmp(); fs.writeFileSync(path.join(d, 'settings.json'), '{oops');
  const s = createSettingsStore(d);
  assert.deepStrictEqual(s.get(), DEFAULTS);
  assert.strictEqual(fs.readFileSync(path.join(d, 'settings.bad.json'), 'utf8'), '{oops');
  assert.strictEqual(s.takeRecovered(), true); assert.strictEqual(s.takeRecovered(), false);
});
test('reset a single section', () => {
  const s = createSettingsStore(tmp()); s.set({ audio: { master: 0.1 }, display: { vsync: false } });
  const r = s.reset('audio'); assert.strictEqual(r.audio.master, 0.8); assert.strictEqual(r.display.vsync, false);
});
test('menu copy keeps offline id with Classic label', () => {
  const c = require('../src/renderer/data/menu-copy.json');
  const off = c.storytellerModes.find((m) => m.id === 'offline');
  assert.strictEqual(off.name, 'Classic Storyteller'); assert.strictEqual(c.taglines.length, 9);
  assert.deepStrictEqual(c.difficulties.map((d) => d.id), ['permadeath', 'heir', 'sandbox']);
});
test('wrong-type and out-of-range values are cleaned (B10)', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'settings.json'), JSON.stringify({ audio: { master: 'loud', music: 7, sfx: null }, display: { mode: 'banana', uiScale: 3, vsync: 'yes' }, storyteller: { localModelPath: 5 } }));
  const s = createSettingsStore(d).get();
  assert.strictEqual(s.audio.master, 0.8); assert.strictEqual(s.audio.music, 1); assert.strictEqual(s.audio.sfx, 0.8);
  assert.strictEqual(s.display.mode, 'borderless'); assert.strictEqual(s.display.uiScale, 1.0); assert.strictEqual(s.display.vsync, true);
  assert.strictEqual(s.storyteller.localModelPath, null);
  const r = createSettingsStore(d).set({ audio: { master: NaN }, display: { mode: 'windowed' } });
  assert.strictEqual(r.audio.master, 0.8); assert.strictEqual(r.display.mode, 'windowed');
});
