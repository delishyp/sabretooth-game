// Council standing: §10.5, §10.6, §13a. Walk-out shares the ±10 pool.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Councils = require('../src/renderer/js/councils');
const Slice = require('../src/renderer/js/slice');
const LoreBook = require('../src/renderer/js/lore-book');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  encounters: j('events/encounters-v0.2.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
function run() {
  const s = E.newRun({ mainCat: player, seed: 3, runId: 'council-stance' });
  if (!s.records) s.records = {};
  s.records.pride = { id: 'pride-test', name: 'Ash' };
  return s;
}
const seated = ['highcrag', 'bonefield', 'mistwood'];

test('a stance moves a pride by at most 2, and a request past that is clamped', () => {
  const s = run();
  const row = Councils.applyPooled(s, 'highcrag', 5, 'run/clamp', 'council_stance');
  assert.strictEqual(row.applied, 2);
  assert.strictEqual(row.delta, 2);
  assert.strictEqual(row.receipt, true);
  assert.strictEqual(s.councils.highcrag.lifetimeDelta, 2);
  assert.strictEqual(s.prideRelation.highcrag, 2);
  const spoken = Councils.applyChoice(s, 'speak_for_a', { councilId: 'run/council/1', seated, prideA: 'highcrag', prideB: 'bonefield' });
  assert.strictEqual(spoken.results.highcrag.applied, 2);
  assert.strictEqual(spoken.results.bonefield.applied, -2);
  assert.strictEqual(spoken.results.mistwood.applied, 0);
  assert.strictEqual(spoken.results.mistwood.receipt, false);
});

test('walk-out at -9 is clamped to -10 and the receipt shows -1; at the cap there is no receipt', () => {
  const s = run();
  Councils.ensure(s);
  s.councils.highcrag.lifetimeDelta = -9;
  s.prideRelation.highcrag = -9;
  s.councils.mistwood.lifetimeDelta = -10;
  s.prideRelation.mistwood = -10;
  const left = Councils.applyChoice(s, 'leave', { councilId: 'run/council/walk', seated });
  assert.strictEqual(left.results.highcrag.applied, -1);
  assert.strictEqual(left.results.highcrag.delta, -1);
  assert.strictEqual(left.results.highcrag.receipt, true);
  assert.strictEqual(s.councils.highcrag.lifetimeDelta, -10);
  assert.strictEqual(s.prideRelation.highcrag, -10);
  const receipt = s.worldMemory.ledger.find((row) => row.receiptKey.endsWith('/walk/highcrag'));
  assert.strictEqual(receipt.delta, -1);
  assert.strictEqual(receipt.sourceType, 'council_walk_out');
  assert.strictEqual(left.results.bonefield.applied, -2);
  assert.strictEqual(left.results.mistwood.applied, 0);
  assert.strictEqual(left.results.mistwood.receipt, false);
  assert.ok(!s.worldMemory.ledger.some((row) => row.receiptKey.endsWith('/walk/mistwood')));
  assert.ok(s.councils.lore.some((row) => row.body === 'Mistwood has made up its mind about you.'));
  const book = LoreBook.book(s, { heading: 'Guide', entries: [] });
  const notes = book.find((section) => section.id === 'notes').entries.map((row) => row.body).join('\n');
  assert.ok(notes.includes('Mistwood has made up its mind about you.'));
});

test('save and reload does not apply the same council shift twice', () => {
  const s = run();
  Councils.applyChoice(s, 'speak_for_a', { councilId: 'run/council/once', seated, prideA: 'highcrag', prideB: 'bonefield' });
  const before = {
    high: s.prideRelation.highcrag,
    life: s.councils.highcrag.lifetimeDelta,
    receipts: s.worldMemory.ledger.filter((row) => row.sourceType === 'council_stance').length
  };
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  const again = Councils.applyChoice(loaded, 'speak_for_a', { councilId: 'run/council/once', seated, prideA: 'highcrag', prideB: 'bonefield' });
  assert.strictEqual(again.results.highcrag.duplicate, true);
  assert.strictEqual(loaded.prideRelation.highcrag, before.high);
  assert.strictEqual(loaded.councils.highcrag.lifetimeDelta, before.life);
  assert.strictEqual(loaded.worldMemory.ledger.filter((row) => row.sourceType === 'council_stance').length, before.receipts);
});

test('a deal break stays outside the council pool', () => {
  const s = run();
  s.world = { agreements: [], relations: {} };
  const struck = Councils.strike(s, { id: 'border', kind: 'border', parties: ['player', 'bonefield'] }, true);
  Councils.breach(s, struck.agreement.id, 'player');
  assert.strictEqual(Councils.relation(s, 'player', 'bonefield'), -15);
  assert.strictEqual(Councils.relation(s, 'bonefield', 'player'), -10);
  Councils.ensure(s);
  assert.strictEqual(s.councils.bonefield.lifetimeDelta, 0);
  assert.ok(!s.worldMemory.ledger.some((row) => row.sourceType === 'council_stance' || row.sourceType === 'council_walk_out'));
});

test('old saves gain empty council records, and a leader line follows the focus trait', () => {
  const s = run();
  delete s.councils;
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(loaded.councils.highcrag.lifetimeDelta, 0);
  assert.deepStrictEqual(loaded.councils.lore, []);
  loaded.npcs.hc01.personality = { aggression: 50, sociability: 50, boldness: 50, loyalty: 90, curiosity: 50 };
  const high = Councils.spoken(loaded, 'council.opening.hc01', 'hc01');
  assert.ok(high.text.includes('as we should'));
  loaded.npcs.hc01.personality.loyalty = 50;
  const mid = Councils.spoken(loaded, 'council.opening.hc01', 'hc01');
  assert.ok(mid.text.includes('We can speak in order'));
  assert.strictEqual(Councils.openScene({ day: 1, records: {}, npcs: loaded.npcs, cat: loaded.cat }).error, 'loner');
  const seatedRun = Councils.openScene(loaded);
  assert.strictEqual(seatedRun.state.pending.eventId, 'council.offline.complete');
  assert.strictEqual(seatedRun.state.pending.choices[seatedRun.state.pending.choices.length - 1].id, 'leave');
});
