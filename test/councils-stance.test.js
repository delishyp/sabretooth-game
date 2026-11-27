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
  assert.match(left.results.highcrag.line, /Highcrag is cooler toward you/);
  assert.match(left.results.mistwood.line, /Mistwood has made up its mind about you/);
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
  assert.ok(high.text.includes('as Highcrag always has'));
  loaded.npcs.hc01.personality.loyalty = 50;
  const mid = Councils.spoken(loaded, 'council.opening.hc01', 'hc01');
  assert.ok(mid.text.includes('We can speak in order'));
  assert.strictEqual(Councils.openScene({ day: 1, records: {}, npcs: loaded.npcs, cat: loaded.cat }).error, 'loner');
  const seatedRun = Councils.openScene(loaded);
  assert.strictEqual(seatedRun.state.pending.eventId, 'council.offline.complete');
  assert.strictEqual(seatedRun.state.pending.choices[seatedRun.state.pending.choices.length - 1].id, 'leave');
});

function middling(s) {
  const personality = { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 };
  for (const id of ['hc01', 'bf01', 'mw01']) s.npcs[id].personality = Object.assign({}, personality);
}

test('offline speak_for_b has Bonefield accept, Highcrag refuse, and reversed standing', () => {
  const book = JSON.parse(fs.readFileSync(path.join(D, 'events/council-scenes-v2.json'), 'utf8'));
  const offered = book.offlineFallback.start.find((step) => step.kind === 'choice').options.map((opt) => opt.id);
  for (const id of offered) assert.ok(book.offlineFallback.branches[id], id + ' has a branch');
  assert.ok(!book.standingOutcomes.capped.outcome, 'capped has no receipt outcome');
  const s = run();
  middling(s);
  Councils.openScene(s);
  assert.ok(s.pending.choices.some((row) => row.id === 'speak_for_b'));
  const done = Councils.resolve(s, 'speak_for_b');
  const text = s.pending.beats.map((beat) => beat.text).join('\n');
  assert.ok(text.includes('Bonefield agrees'));
  assert.ok(text.includes("That deal doesn't suit Highcrag"));
  assert.ok(text.includes('Bonefield is warmer toward you.'));
  assert.ok(text.includes('Highcrag is cooler toward you.'));
  assert.ok(text.includes("Mistwood's feeling toward you is unchanged."));
  assert.ok(!text.includes('Would you be my mate'));
  assert.strictEqual(done.outcome.results.bonefield.applied, 2);
  assert.strictEqual(done.outcome.results.highcrag.applied, -2);
  assert.strictEqual(done.outcome.results.mistwood.applied, 0);
  assert.strictEqual(s.councils.bonefield.lifetimeDelta, 2);
  assert.strictEqual(s.councils.highcrag.lifetimeDelta, -2);
  assert.strictEqual(s.prideRelation.bonefield, 2);
  assert.strictEqual(s.prideRelation.highcrag, -2);
  assert.strictEqual(s.prideRelation.mistwood, 0);
  assert.strictEqual(s.worldMemory.ledger.filter((row) => row.sourceType === 'council_stance').length, 2);
  assert.strictEqual(s.phase, 'event');
  const before = s.prideRelation.bonefield;
  Councils.resolve(s, 'continue');
  assert.strictEqual(s.prideRelation.bonefield, before);
  assert.strictEqual(s.phase, 'event');
});

test('a clamp that still changes standing uses the cooler line and a receipt', () => {
  const s = run();
  Councils.ensure(s);
  s.councils.highcrag.lifetimeDelta = -9;
  s.prideRelation.highcrag = -9;
  const row = Councils.applyPooled(s, 'highcrag', -2, 'run/cap/partial', 'council_walk_out');
  assert.strictEqual(row.applied, -1);
  assert.strictEqual(row.receipt, true);
  assert.strictEqual(row.line, 'Highcrag is cooler toward you.');
  assert.strictEqual(s.councils.highcrag.lifetimeDelta, -10);
  const receipt = s.worldMemory.ledger.find((entry) => entry.receiptKey === 'run/cap/partial');
  assert.strictEqual(receipt.delta, -1);
  assert.ok(!s.councils.lore.some((entry) => entry.body === 'Highcrag has made up its mind about you.'));
});

test('a zero applied change says the pride has made up its mind and writes no receipt', () => {
  const s = run();
  middling(s);
  Councils.ensure(s);
  s.councils.mistwood.lifetimeDelta = -10;
  s.prideRelation.mistwood = -10;
  Councils.openScene(s);
  Councils.resolve(s, 'leave');
  const text = s.pending.beats.map((beat) => beat.text).join('\n');
  assert.ok(text.includes('Mistwood has made up its mind about you.'));
  assert.ok(!text.includes('Mistwood is cooler toward you.'));
  assert.ok(text.includes('Highcrag is cooler toward you.'));
  assert.ok(text.includes('Bonefield is cooler toward you.'));
  assert.ok(!s.worldMemory.ledger.some((row) => row.receiptKey.endsWith('/walk/mistwood')));
  const book = LoreBook.book(s, { heading: 'Guide', entries: [] });
  const notes = book.find((section) => section.id === 'notes').entries.map((row) => row.body).join('\n');
  assert.ok(notes.includes('Mistwood has made up its mind about you.'));
  const row = Councils.applyPooled(s, 'bonefield', 2, 'run/cap/zero', 'council_stance');
  s.councils.bonefield.lifetimeDelta = 10;
  const capped = Councils.applyPooled(s, 'bonefield', 2, 'run/cap/zero-b', 'council_stance');
  assert.strictEqual(row.applied, 2);
  assert.strictEqual(capped.applied, 0);
  assert.strictEqual(capped.receipt, false);
  assert.strictEqual(capped.line, 'Bonefield has made up its mind about you.');
  assert.ok(!s.worldMemory.ledger.some((entry) => entry.receiptKey === 'run/cap/zero-b'));
});

test('a repeat stance in the same season applies nothing and does not say warmer or cooler', () => {
  const s = run();
  middling(s);
  Councils.openScene(s);
  Councils.resolve(s, 'speak_for_a');
  while (s.pending) Councils.resolve(s, 'continue');
  const before = s.worldMemory.ledger.filter((row) => row.sourceType === 'council_stance').length;
  const again = Councils.applyChoice(s, 'speak_for_a', {
    councilId: s.runId + '/council/' + Councils.seasonOf(s.day),
    seated, prideA: 'highcrag', prideB: 'bonefield'
  });
  for (const id of ['highcrag', 'bonefield']) {
    assert.strictEqual(again.results[id].applied, 0);
    assert.strictEqual(again.results[id].receipt, false);
    assert.match(again.results[id].line, /has made up its mind about you/);
    assert.doesNotMatch(again.results[id].line, /warmer|cooler/);
  }
  assert.strictEqual(s.worldMemory.ledger.filter((row) => row.sourceType === 'council_stance').length, before);
  assert.ok(s.councils.lore.some((row) => row.body === 'Highcrag has made up its mind about you.'));
});

test('one council a season stays locked after save and reload, and a feud can still call the early council', () => {
  const s = run();
  assert.strictEqual(Councils.councilAvailable(s), true);
  assert.strictEqual(Councils.councilButton(s).locked, false);
  Councils.openScene(s);
  assert.strictEqual(Councils.openScene(s).error, 'already');
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(loaded.records.lastCouncilSeason, 0);
  assert.strictEqual(Councils.councilAvailable(loaded), false);
  const button = Councils.councilButton(loaded);
  assert.strictEqual(button.locked, true);
  assert.match(button.label, /Go to the council · Locked/);
  assert.strictEqual(button.note, 'Opens next season. The leaders already met this season.');
  assert.doesNotMatch(button.note, /ready to sit/);
  loaded.records.councilLatch = { reason: 'hostile', pair: ['highcrag', 'bonefield'], day: loaded.day };
  const early = Councils.offerEarly(loaded);
  assert.strictEqual(early.error, undefined);
  assert.strictEqual(loaded.pending.council, true);
  loaded.day = 21;
  loaded.pending = null;
  assert.strictEqual(Councils.councilAvailable(loaded), true);
  assert.strictEqual(Councils.councilButton(loaded).locked, false);
  assert.strictEqual(Councils.openScene(loaded).error, undefined);
  const old = run();
  delete old.records.lastCouncilSeason;
  const aged = E.migrate(JSON.parse(JSON.stringify(old)));
  assert.strictEqual(Councils.councilAvailable(aged), true);
  assert.strictEqual(Councils.councilButton(aged).locked, false);
});

test('every council line, online and offline, has its tokens filled', () => {
  const book = JSON.parse(fs.readFileSync(path.join(D, 'events/council-scenes-v2.json'), 'utf8'));
  const TOKEN = /\{[A-Za-z][^}]*\}/;
  const bands = {
    high: { aggression: 90, sociability: 90, boldness: 90, loyalty: 90, curiosity: 90 },
    low: { aggression: 10, sociability: 10, boldness: 10, loyalty: 10, curiosity: 10 },
    mid: { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 }
  };
  const seen = [];
  const s = run();
  for (const path of Object.keys(book.speechLocations || {})) {
    const row = book.speechLocations[path];
    for (const personality of Object.values(bands)) {
      if (s.npcs[row.slot]) s.npcs[row.slot].personality = Object.assign({}, personality);
      const line = Councils.spoken(s, path, row.slot);
      seen.push(line.text, line.beat);
    }
  }
  const vars = Councils.bindings(s);
  for (const key of ['warmer', 'cooler', 'unchanged', 'capped', 'walkOut']) {
    const row = book.standingOutcomes[key];
    seen.push(Councils.spoken ? '' : '');
    for (const field of ['narration', 'lore', 'outcome']) if (row[field]) seen.push(row[field].replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m)));
  }
  for (const id of ['speak_for_a', 'speak_for_b', 'stay_out', 'leave']) {
    const fresh = run();
    middling(fresh);
    const opened = Councils.openScene(fresh);
    assert.strictEqual(opened.error, undefined);
    for (const beat of fresh.pending.beats) seen.push(beat.text);
    for (const choice of fresh.pending.choices) seen.push(choice.label);
    Councils.resolve(fresh, id);
    for (const beat of fresh.pending.beats) seen.push(beat.text);
  }
  const raw = seen.filter((text) => TOKEN.test(text || ''));
  assert.deepStrictEqual(raw, []);
});
