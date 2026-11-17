const test = require('node:test');
const assert = require('node:assert');
const Reputation = require('../src/renderer/js/reputation');
const Territory = require('../src/renderer/js/territory');
const Councils = require('../src/renderer/js/councils');
const Deeds = require('../src/renderer/js/deeds');
const LoreBook = require('../src/renderer/js/lore-book');
const WorldSim = require('../src/renderer/js/world-sim');
const map = require('../src/renderer/data/map.json');

function fresh() {
  return { day: 1, runId: 'run', worldMemory: {}, records: { pride: { id: 'player', name: 'Ash' } }, prideRelation: {}, world: {} };
}

test('reputation: one deed cannot cross more than a third of the band, and a same-day burst does not level', () => {
  const state = fresh();
  for (let i = 0; i < 12; i++) {
    const row = Reputation.add(state, { axis: 'mercy', sign: 1, weightClass: 'legend', deedId: 'burst', receiptKey: 'b' + i, day: 1 });
    assert.ok(row.applied <= Reputation.spanOf(0) / 3);
    assert.strictEqual(row.level, 0);
  }
  const again = Reputation.add(state, { axis: 'mercy', sign: 1, weightClass: 'small', deedId: 'burst', receiptKey: 'b0', day: 2 });
  assert.strictEqual(again.duplicate, true);
});

test('reputation: the gate needs the deed counts and three different days, then a title, a legend and two faces write deed facts', () => {
  const state = fresh();
  const days = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (let n = 0; n < 40; n++) {
    Reputation.add(state, { axis: 'mercy', sign: 1, weightClass: 'legend', deedId: 'm' + (n % 3), receiptKey: 'm/' + n, day: days[n % days.length] + Math.floor(n / days.length) * 20 });
    Reputation.add(state, { axis: 'honour', sign: -1, weightClass: 'legend', deedId: 'h' + (n % 3), receiptKey: 'h/' + n, day: days[n % days.length] + Math.floor(n / days.length) * 20 });
  }
  const view = Reputation.view(state, 'player', 'Ravenmark');
  const mercy = view.find((row) => row.axis === 'mercy');
  const honour = view.find((row) => row.axis === 'honour');
  assert.ok(mercy.level >= 3, 'mercy ' + mercy.level);
  assert.ok(honour.level >= 3 && honour.pole === 'negative');
  assert.ok(mercy.word.indexOf('Merciful') >= 0 || mercy.level > 3);
  assert.strictEqual(state.records.deedFacts['reputation.title'], true);
  assert.strictEqual(state.records.deedFacts['reputation.two_faces'], true);
  assert.ok(!/\d/.test(mercy.word + honour.word));
});

test('reputation: an old save with no store starts empty and a seed applies once', () => {
  const state = { day: 1, records: {} };
  assert.deepStrictEqual(Reputation.view(state, 'player', 'Ash').map((row) => row.level), [0, 0, 0]);
  Reputation.seed(state, 'hc01', 'honour', 280);
  Reputation.seed(state, 'hc01', 'honour', 280);
  assert.strictEqual(Reputation.view(state, 'hc01', 'Ashmane').find((row) => row.axis === 'honour').level, 3);
});

test('danger words match the four fixed features, and a mark is the cited +25', () => {
  const byId = Object.fromEntries(map.regions.map((row) => [row.id, row]));
  assert.strictEqual(Territory.danger(byId.salt_flats, { holder: 'neutral', claim: 0 }, 'player'), 2);
  assert.strictEqual(Territory.danger(byId.camel_ridge, { holder: 'neutral', claim: 0 }, 'player'), 3);
  assert.strictEqual(Territory.danger(byId.tar_seeps, { holder: 'neutral', claim: 0 }, 'player'), 3);
  assert.strictEqual(Territory.danger(byId.south_range, { holder: 'neutral', claim: 0 }, 'player'), 2);
  assert.strictEqual(Territory.word(0), 'Safe');
  assert.strictEqual(Territory.word(3), 'Deadly');
  const claims = { split_rock: {} };
  assert.strictEqual(Territory.mark(claims, 'split_rock', 'player'), 25);
  const held = fresh();
  held.map = { claims: {} };
  for (const id of ['split_rock', 'tallgrass', 'herd_trail', 'south_range', 'reedbank', 'mistwood']) {
    held.map.claims[id] = { player: 80 };
  }
  held.map.claims.greywater_ford = { highcrag: 80 };
  held.map.claims.bonefield = { bonefield: 80 };
  held.map.claims.fog_paths = { mistwood: 80 };
  held.records.pride.denRegionId = 'split_rock';
  held.records.denHeldDays = 79;
  Territory.noteDeeds(held);
  assert.strictEqual(held.records.deedFacts['regions.six'], true);
  assert.strictEqual(held.records.deedFacts['borders.three'], true);
  assert.strictEqual(held.records.deedFacts['den.held_year'], true);
});

test('councils: one season, keep is +5 each way, a break is -15/-10 plus a negative Honour deed', () => {
  const state = fresh();
  assert.strictEqual(Councils.open(state).error, undefined);
  assert.strictEqual(Councils.open(state).error, 'already');
  assert.strictEqual(state.records.deedFacts['council.attended'], true);
  const struck = Councils.strike(state, { id: 'grand', kind: 'truce', parties: ['highcrag', 'bonefield', 'mistwood'] }, true);
  assert.strictEqual(state.records.deedFacts['council.grand'], true);
  Councils.keep(state, struck.agreement.id);
  assert.strictEqual(Councils.relation(state, 'highcrag', 'bonefield'), 5);
  assert.strictEqual(Councils.relation(state, 'bonefield', 'highcrag'), 5);
  assert.strictEqual(state.records.deedFacts['agreement.kept'], 1);
  const again = Councils.strike(state, { id: 'border', kind: 'border', parties: ['player', 'bonefield'] }, true);
  Councils.breach(state, again.agreement.id, 'player');
  assert.strictEqual(Councils.relation(state, 'player', 'bonefield'), -15);
  assert.strictEqual(Councils.relation(state, 'bonefield', 'player'), -10);
  assert.ok(state.worldMemory.facts.some((row) => row.kind === 'broke_border'));
  assert.strictEqual(state.records.deedFacts['agreement.broken'], true);
  assert.ok(state.worldMemory.reputation.totals.player.honour < 0);
  const loner = { day: 1, records: {} };
  assert.strictEqual(Councils.open(loner).error, 'loner');
  assert.strictEqual(Councils.acceptChance(-40, 8, 8, 'highcrag', 'truce'), 5);
  assert.strictEqual(Councils.acceptChance(0, 8, 7, 'mistwood', 'truce', { afterBlood: true }), 70);
});

test('territory and council pass bands over 200 seeds and 40 seasons', () => {
  const band = WorldSim.summarise(200, 40);
  assert.ok(band.holderChanges >= 0.6 && band.holderChanges <= 1.5, String(band.holderChanges));
  assert.ok(band.mostP95 <= 7, String(band.mostP95));
  assert.ok(band.freezeP95 <= 8, String(band.freezeP95));
  for (const pride of ['highcrag', 'bonefield', 'mistwood']) {
    assert.ok(band.held[pride] >= 3 && band.held[pride] <= 6, pride + ' ' + band.held[pride]);
  }
  assert.ok(band.fights >= 4);
  assert.ok(band.bonefieldHighcrag >= 0.8 && band.bonefieldMistwood >= 0.8);
  assert.ok(band.highcragMistwood >= 0.5);
  assert.ok(band.broken >= 0.2 && band.broken <= 0.3, String(band.broken));
  assert.ok(band.borderRun <= 4);
  assert.ok(band.councilsPerSeason <= 1);
});

test('lore: a grudge lies one time in four, the flag stays off the page, and an old save still opens', () => {
  const state = { day: 4, map: { visited: [] }, worldMemory: { knowledge: {} } };
  const lie = LoreBook.spread(state, 'aid/run', 'bf01', -20, 0);
  const truth = LoreBook.spread({ day: 4, map: { visited: [] }, worldMemory: { knowledge: {} } }, 'aid/run', 'bf01', -20, 0.9);
  assert.strictEqual(lie.false, true);
  assert.strictEqual(truth.false, false);
  const model = LoreBook.book(state, { heading: 'Guide', entries: [] });
  const rumour = model.find((row) => row.id === 'rumours').entries[0];
  assert.ok(rumour.body);
  assert.ok(!/false|true rate|1 time/i.test(rumour.body + (rumour.how || '')));
  const old = { map: { visited: ['split_rock'] }, worldMemory: { knowledge: { met: { scope: 'private' } } } };
  const opened = LoreBook.book(old, { heading: 'Guide', entries: [] });
  assert.ok(opened.find((row) => row.id === 'common').entries.length > 10);
  assert.ok(opened.find((row) => row.id === 'learned').entries.some((row) => row.id === 'met'));
  const earned = Deeds.scan({ deathRule: 'permadeath', level: 'standard', records: { deedFacts: { 'council.attended': true, 'reputation.title': true, 'borders.three': true, 'den.held_year': true, 'regions.six': true, 'agreement.broken': true, 'council.grand': true, 'agreement.kept': 3, 'reputation.legend': true, 'reputation.two_faces': true } } });
  for (const id of ['first_council', 'titled', 'three_banners', 'holdfast', 'expansion', 'oathbreaker', 'grand_council', 'peacemaker', 'legend', 'two_faces']) {
    assert.ok(earned.includes(id), id);
  }
});
