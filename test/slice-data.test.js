// Slice-1 runtime data: map.json/world-slots.json are generated from the specs; the event library is Saga's, validated on sync.
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { validateEvents } = require('../scripts/sync-events');
const root = path.join(__dirname, '..');
const map = require('../src/renderer/data/map.json');
const events = require('../src/renderer/data/events/slice-1.json');
const slots = require('../src/renderer/data/world-slots.json');
const rules = require('../src/renderer/data/slice-rules.json');

test('map.json + world-slots.json match docs/design (slice-data-from-specs --check)', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/slice-data-from-specs.js'), '--check'], { cwd: root, stdio: 'pipe' });
});
test('shipped event library validates against the map (kinds, intents, hostile branch, every region covered)', () => {
  assert.deepStrictEqual(validateEvents(events, map), []);
  for (const f of map.factions.filter((x) => x.kind === 'pride')) {
    assert.ok(events.events.some((e) => e.kind === 'first_meeting' && e.faction === f.id), `first_meeting ${f.id}`);
    assert.ok(events.events.some((e) => e.kind === 'patrol' && e.faction === f.id), `patrol ${f.id}`);
  }
  assert.ok(events.events.some((e) => e.kind === 'first_meeting' && e.faction === 'loner'));
});
test('world slots: 39 slots, loners have home zones on the map', () => {
  assert.strictEqual(slots.slots.length, 39);
  const ids = new Set(map.regions.map((r) => r.id));
  for (const s of slots.slots.filter((x) => x.faction === 'loner')) for (const z of s.homeZones) assert.ok(ids.has(z), `${s.slot} ${z}`);
});
test('slice rules start region exists and season length is 20', () => {
  assert.ok(map.regions.some((r) => r.id === rules.start.region)); assert.strictEqual(rules.seasonDays, 20);
});
