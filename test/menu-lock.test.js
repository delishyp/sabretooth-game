// Slice 1 scope IN §1: New Game is locked to Standard + permadeath (slice-rules.json menuLock), renderer + main.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const Nav = require('../src/renderer/js/nav');
const { menuLockFrom, createMenuHandlers } = require('../src/main/menu-handlers');
const { createSavesStore } = require('../src/main/saves-store');
const { createSettingsStore } = require('../src/main/settings-store');
const I18n = require('../src/renderer/js/i18n');
const rules = require('../src/renderer/data/slice-rules.json');
const copy = require('../src/renderer/data/menu-copy.json');
const t = I18n.create(copy.strings);

test('menuLock is Standard + permadeath, ids exist in Saga\'s copy, no new copy keys needed', () => {
  const lock = menuLockFrom(rules, {});
  assert.deepStrictEqual(lock, { styles: ['standard'], difficulties: ['permadeath'] });
  for (const id of lock.styles) assert.ok(copy.playStyles.some((d) => d.id === id));
  for (const id of lock.difficulties) assert.ok(copy.difficulties.some((d) => d.id === id));
  assert.strictEqual(menuLockFrom(rules, { SABRETOOTH_MENU_UNLOCK: '1' }), null, 'dev/test escape hatch');
  assert.strictEqual(menuLockFrom({}, {}), null);
});
test('locked setup model: one style, one death rule, no Sandbox panel, Begin starts Standard + permadeath', () => {
  const lock = menuLockFrom(rules, {});
  let s = Nav.setupInit(lock.styles, lock.difficulties, copy.sandboxPanel.options.map((o) => ({ ...o, default: o.values[0] })));
  assert.deepStrictEqual([s.style, s.death, s.focus], ['standard', 'permadeath', 'style:standard']);
  for (const a of ['left', 'right', 'confirm', 'down', 'left', 'right', 'confirm']) s = Nav.setupReduce(s, a).state;
  assert.deepStrictEqual([s.style, s.death], ['standard', 'permadeath']);
  for (const id of ['style:story', 'style:sim', 'death:heir', 'death:sandbox']) { s = Nav.setupReduce(s, 'click', id).state; assert.deepStrictEqual([s.style, s.death], ['standard', 'permadeath'], id); }
  s = Nav.setupReduce(s, 'down').state; assert.strictEqual(s.focus, 'begin', 'no sandbox option stops');
  assert.deepStrictEqual(Nav.setupReduce(s, 'confirm').effect, { type: 'start', style: 'standard', difficulty: 'permadeath' });
});
test('main rejects any New Game outside the lock (no run created); Standard + permadeath still starts', async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-lock-'));
  const saves = createSavesStore(path.join(ud, 'saves')); const logs = [];
  const h = createMenuHandlers({ settings: createSettingsStore(ud), saves, t, log: (m) => logs.push(m), checkStoryteller: async () => ({ available: true }), lock: menuLockFrom(rules, {}) });
  for (const [style, difficulty] of [['story', 'permadeath'], ['sim', 'permadeath'], ['standard', 'heir'], ['standard', 'sandbox']]) {
    assert.deepStrictEqual(await h.newGame({ style, difficulty }), { ok: false, errorId: 'toast.startFailed' }, `${style}/${difficulty}`);
  }
  assert.deepStrictEqual(saves.list().runs, [null, null]);
  assert.ok(logs.some((l) => l.includes('locked')));
  const ok = await h.newGame({ style: 'standard', difficulty: 'permadeath' });
  assert.strictEqual(ok.ok, true); assert.deepStrictEqual([ok.run.style, ok.run.difficulty, ok.run.sandboxOptions], ['standard', 'permadeath', null]);
});
