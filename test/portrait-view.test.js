// Shared head crop: one registry for every sex, source rectangle only, viewer does not act.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const V = require('../src/renderer/js/portrait-view');

const root = path.join(__dirname, '..');

test('shipped registry is one shared pose, a head rectangle, and no invented files', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/registry.json'), 'utf8'));
  const handoff = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/handoff-manifest.json'), 'utf8'));
  const reg = V.parse(raw);
  assert.strictEqual(reg.sharedPose, 'portrait-female');
  assert.strictEqual(reg.portraits.length, 40);
  assert.strictEqual(handoff.count, 40);
  const female = V.entryFor(reg, null, 'female');
  const male = V.entryFor(reg, null, 'male');
  assert.deepStrictEqual(female, male);
  assert.strictEqual(female.runtime, true);
  assert.strictEqual(female.id, null);
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

test('40 static cats keep manifest identity, aliases, hashes, and both sexes share one file', () => {
  const crypto = require('node:crypto');
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/registry.json'), 'utf8'));
  const handoff = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/handoff-manifest.json'), 'utf8'));
  const reg = V.parse(raw);
  const roles = {};
  let aliases = 0;
  assert.strictEqual(handoff.candidate_path_count, 44);
  assert.deepStrictEqual(handoff.role_counts, { original: 23, 'eye-alternate': 17 });
  for (const a of handoff.assets) {
    const p = reg.portraits.find((x) => x.id === a.id);
    assert.ok(p, a.id);
    roles[p.role] = (roles[p.role] || 0) + 1;
    aliases += p.aliases.length;
    assert.strictEqual(p.file, 'cats/' + path.basename(a.filename));
    assert.strictEqual(p.sourceLabel, a.source_label);
    assert.strictEqual(p.eyeLabel, a.eye_label);
    assert.strictEqual(p.nativeMode, a.native_mode);
    assert.deepStrictEqual(p.knownIssues, a.known_issues);
    assert.deepStrictEqual(p.head, reg.staticHead);
    const bytes = fs.readFileSync(path.join(root, 'assets/portraits', p.file));
    assert.strictEqual(bytes.length, a.bytes);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), a.encoded_sha256);
    const male = V.entryFor(reg, a.id, 'male');
    const female = V.entryFor(reg, a.id, 'female');
    assert.strictEqual(male.file, female.file);
    assert.strictEqual(male.id, a.id);
  }
  assert.deepStrictEqual(roles, { original: 23, 'eye-alternate': 17 });
  for (const p of reg.portraits) {
    const bytes = fs.readFileSync(path.join(root, 'assets/portraits', p.file));
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), p.encodedSha256, p.id);
  }
  assert.strictEqual(aliases, 44);
  const baked = reg.portraits.filter((p) => p.knownIssues.some((x) => /baked/i.test(x)));
  assert.deepStrictEqual(baked.map((p) => p.nativeMode).sort(), ['RGB', 'RGB']);
  assert.ok(baked.every((p) => p.sourceLabel === 'special-3' || p.sourceLabel === 'special-3-red-eyes'));
});

test('missing and unknown ids stay on the runtime pose and never select another cat', () => {
  const reg = V.parse(JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits/registry.json'), 'utf8')));
  const other = reg.portraits[0].id;
  const missing = V.entryFor(reg, 'cat-does-not-exist', 'female');
  assert.strictEqual(missing.runtime, true);
  assert.strictEqual(missing.id, null);
  assert.strictEqual(missing.file, null);
  assert.notStrictEqual(missing.requestedId, other);
  assert.deepStrictEqual(missing.head, reg.defaultHead);
});

test('registry adopt keeps the previous list when the next one is corrupt, and a stale paint does not win', () => {
  const session = V.createSession(V.FALLBACK);
  const canvas = {};
  const first = session.begin(canvas);
  assert.strictEqual(session.current(canvas, first.token, first.generation), true);
  const bad = session.adopt({ portraits: [{ id: 'Not A Slug', file: 'cats/x.png' }] });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(session.registry().portraits.length, 0);
  assert.strictEqual(session.current(canvas, first.token, first.generation), true);
  const good = session.adopt({
    sharedPose: 'portrait-female',
    defaultHead: V.FALLBACK.defaultHead,
    portraits: [{ id: 'cat-plain', file: 'cats/plain.png', head: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, eyeLabel: 'unknown', sourceLabel: 'unknown' }],
  });
  assert.strictEqual(good.ok, true);
  assert.strictEqual(session.current(canvas, first.token, first.generation), false);
  const second = session.begin(canvas);
  const raced = session.begin(canvas);
  assert.strictEqual(session.current(canvas, second.token, second.generation), false);
  assert.strictEqual(session.current(canvas, raced.token, raced.generation), true);
  assert.strictEqual(V.entryFor(session.registry(), 'cat-plain', 'male').eyeLabel, 'unknown');
  assert.strictEqual(V.entryFor(session.registry(), 'cat-other', 'male').id, null);
});
