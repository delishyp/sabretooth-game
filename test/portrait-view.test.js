// Shared head crop: one registry for every sex, source rectangle only, viewer does not act.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const V = require('../src/renderer/js/portrait-view');

const root = path.join(__dirname, '..');

test('shipped registry is one shared pose, a head rectangle, and no invented files', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/registry.json'), 'utf8'));
  const reg = V.parse(raw);
  assert.strictEqual(reg.sharedPose, 'portrait-female');
  assert.deepStrictEqual(reg.portraits, []);
  const female = V.entryFor(reg, null, 'female');
  const male = V.entryFor(reg, null, 'male');
  assert.deepStrictEqual(female, male);
  assert.strictEqual(female.runtime, true);
  assert.strictEqual(V.sharedPose(reg), 'portrait-female');
});

test('head rectangle stays inside the native canvas and does not depend on sex', () => {
  const reg = V.parse(V.FALLBACK);
  const rect = V.sourceRect(1152, 864, reg.defaultHead);
  assert.ok(rect.sx >= 0 && rect.sy >= 0 && rect.sx + rect.sw <= 1152 && rect.sy + rect.sh <= 864);
  assert.ok(rect.sw > 1 && rect.sh > 1);
  assert.deepStrictEqual(V.entryFor(reg, null, 'female').head, V.entryFor(reg, null, 'male').head);
  assert.throws(() => V.parse({ sharedPose: 'portrait-female', defaultHead: { x: 0.9, y: 0, w: 0.2, h: 0.2 }, portraits: [] }), /outside/);
});

test('a registered complete-cat file is used for either sex and keeps its own head', () => {
  const reg = V.parse({
    sharedPose: 'portrait-female',
    defaultHead: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    portraits: [{ id: 'plain', file: 'cats/plain.png', head: { x: 0.5, y: 0, w: 0.4, h: 0.4 } }],
  });
  const a = V.entryFor(reg, 'plain', 'male');
  const b = V.entryFor(reg, 'plain', 'female');
  assert.strictEqual(a.file, 'cats/plain.png');
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.runtime, false);
  assert.deepStrictEqual(V.sourceRect(1000, 500, a.head), { sx: 500, sy: 0, sw: 400, sh: 200 });
  assert.throws(() => V.parse({ ...reg, portraits: [{ id: 'x', file: '../secret.png', head: reg.defaultHead }] }), /relative png/);
});

test('opening and closing the full-cat viewer does not emit a day action', () => {
  const opened = V.openViewer('event-head');
  assert.deepStrictEqual(opened, { open: true, sourceId: 'event-head', action: null });
  assert.deepStrictEqual(V.closeViewer(), { open: false, sourceId: null, action: null });
});
