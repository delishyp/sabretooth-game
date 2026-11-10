// Mate-challenge injury application. FIXTURE rolls are labelled. The ordinary case uses the live rival stream.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Fight = require('../src/renderer/js/fight');
const Pairing = require('../src/renderer/js/pairing');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const rules = j('slice-rules.json');
const firstSeason = j('events/first-season-v0.6.2.json');
const mk = () => Slice.create({
  map: j('map.json'), rules, events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  encounters: j('events/encounters-v0.2.json'),
  conversation: j('events/recurring-conversation.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'), firstSeason
});
const female = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };

function scripted(list) { return () => list.shift(); }

test('FIXTURE: a forced roll chips the loser and the winner on the correct cats once', () => {
  const E = mk();
  const Pair = Pairing.create(firstSeason, rules);
  const s = E.newRun({ mainCat: female, seed: 9, runId: 'inj-fix' });
  const rival = s.npcs.hc05;
  const bystander = s.npcs.hc06;
  s.needs.health = 100;
  const both = Fight.resolve({
    rng: scripted([0, 0, 0, 0.1, 0, 0.1]), style: 'standard', showdown: false,
    suitorStat: 1, rivalStat: 100, suitorGuard: 0, rivalGuard: 0
  });
  assert.strictEqual(both.won, false);
  assert.strictEqual(both.injuries.loser, 'minor');
  assert.strictEqual(both.injuries.winner, 'minor');
  const stored = { won: false, replaced: null, injuries: both.injuries, day: 4, applied: { player: null, rival: null } };
  const deps = { injure: (st, tier, source) => E.act ? null : null };
  // Use the live nonlethal applier by going through a one-cat copy of slice rules.
  let playerChips = 0;
  stored.applied = { player: null, rival: null };
  const live = {
    injure: (st, tier) => {
      playerChips += 1;
      st.injuries.push({ tier, daysLeft: rules.injuries[tier].days, source: 'mate-challenge' });
      st.needs.health = Math.max(1, st.needs.health - rules.injuries[tier].health);
    }
  };
  Pair.commitFightInjuries(s, stored, rival, live);
  Pair.commitFightInjuries(s, stored, rival, live);
  assert.strictEqual(playerChips, 1);
  assert.strictEqual(stored.applied.player, 'minor');
  assert.strictEqual(stored.applied.rival, 'minor');
  assert.strictEqual(s.needs.health, 90);
  assert.strictEqual(s.injuries.length, 1);
  assert.strictEqual(rival.injuries.length, 1);
  assert.strictEqual(rival.injuries[0].tier, 'minor');
  assert.strictEqual(rival.injuries[0].rolled, 'minor');
  assert.ok(!bystander.injuries);
  assert.ok(!s.dead);
  const win = Fight.resolve({
    rng: scripted([0, 0, 0, 0.95, 0.99]), style: 'standard', showdown: false,
    suitorStat: 100, rivalStat: 1, suitorGuard: 0, rivalGuard: 0
  });
  assert.strictEqual(win.won, true);
  assert.strictEqual(win.injuries.loser, 'crippling');
  assert.strictEqual(win.injuries.winner, null);
  const rival2 = s.npcs.hc07;
  const wonStored = { won: true, replaced: null, injuries: win.injuries, day: 5, applied: { player: null, rival: null } };
  Pair.commitFightInjuries(s, wonStored, rival2, live);
  assert.strictEqual(wonStored.applied.player, null);
  assert.strictEqual(wonStored.applied.rival, 'serious');
  assert.strictEqual(rival2.injuries[0].rolled, 'crippling');
  assert.strictEqual(s.needs.health, 90);
  const show = Fight.resolve({ rng: scripted([0]), style: 'standard', showdown: true, suitorDisplayM: 2, rivalDisplayM: 0, suitorStat: 10, rivalStat: 10, suitorGuard: 0, rivalGuard: 0 });
  s.needs.health = 10;
  const shown = { won: show.won, replaced: 'showdown', injuries: show.injuries, day: 6, applied: { player: null, rival: null } };
  Pair.commitFightInjuries(s, shown, rival, live);
  assert.strictEqual(shown.applied.player, null);
  assert.strictEqual(shown.applied.rival, null);
  assert.strictEqual(s.needs.health, 10);
  assert.ok(!s.dead);
});

test('an ordinary challenge applies the live roll once and the scene names only that injury', () => {
  const E = mk();
  let found = null;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const s = E.newRun({ mainCat: female, seed, runId: `live-${seed}` });
    s.records.willingness.hc08 = { accepted: true, pride: 'highcrag', day: 1 };
    s.records.approval.highcrag = { approved: true, day: 1 };
    s.region = 'highcrag';
    s.cat.perks = ['right_of_challenge'];
    const offer = E.available(s).challenge.find((row) => row.catId === 'hc08');
    if (!offer) continue;
    const health = s.needs.health;
    const rivalBefore = JSON.stringify(s.npcs[offer.rivalId].injuries || null);
    const other = Object.values(s.npcs).find((n) => n.id !== offer.rivalId && n.id !== 'hc08');
    const acted = E.act(s, { type: 'challenge', catId: 'hc08' });
    assert.ok(!acted.error, acted.error);
    const fight = acted.state.records.fights[0];
    assert.strictEqual(fight.deathRoll, false);
    assert.strictEqual(fight.lethal, false);
    const text = (acted.state.pending.committedInjuries || []).join(' ');
    if (fight.applied.player) assert.ok(text.includes(`You have a ${fight.applied.player} injury`));
    else assert.ok(!text.includes('You have a'));
    if (fight.applied.rival) assert.ok(text.includes(`${acted.state.npcs[fight.rivalId].name} has a ${fight.applied.rival} injury`));
    else assert.ok(!text.includes(`${acted.state.npcs[fight.rivalId].name} has a`));
    if (!fight.applied.player && !fight.applied.rival) assert.deepStrictEqual(acted.state.pending.committedInjuries, []);
    if (fight.applied.player) {
      assert.ok(acted.state.injuries.some((row) => row.tier === fight.applied.player && row.source === 'mate-challenge'));
      assert.ok(acted.state.needs.health < health);
    } else assert.strictEqual(acted.state.needs.health, health);
    if (fight.applied.rival) assert.ok(acted.state.npcs[fight.rivalId].injuries.some((row) => row.tier === fight.applied.rival));
    else assert.strictEqual(JSON.stringify(acted.state.npcs[fight.rivalId].injuries || null), rivalBefore);
    assert.ok(!other.injuries || !other.injuries.some((row) => row.source === 'mate-challenge'));
    assert.ok(!acted.state.dead);
    const pending = JSON.parse(JSON.stringify(acted.state));
    const loaded = E.migrate(pending);
    assert.deepStrictEqual(loaded.records.fights, pending.records.fights);
    assert.deepStrictEqual(loaded.injuries, pending.injuries);
    assert.strictEqual(loaded.needs.health, pending.needs.health);
    assert.deepStrictEqual(loaded.npcs[fight.rivalId].injuries || null, pending.npcs[fight.rivalId].injuries || null);
    const stepped = E.act(loaded, { type: 'continue' });
    assert.deepStrictEqual(stepped.state.injuries, loaded.injuries);
    assert.strictEqual(stepped.state.needs.health, loaded.needs.health);
    assert.strictEqual(stepped.state.records.fights.length, 1);
    const second = E.act(stepped.state, { type: 'challenge', catId: 'hc08' });
    assert.ok(second.error);
    assert.strictEqual(second.state.records.fights.length, 1);
    found = { seed, fight };
  }
  assert.ok(found, 'no ordinary Highcrag challenge was available');
  function live(seed) {
    const s = E.newRun({ mainCat: female, seed, runId: `pin-${seed}` });
    s.records.willingness.hc08 = { accepted: true, pride: 'highcrag', day: 1 };
    s.records.approval.highcrag = { approved: true, day: 1 };
    s.region = 'highcrag';
    s.cat.perks = ['right_of_challenge'];
    return E.act(s, { type: 'challenge', catId: 'hc08' }).state;
  }
  const rivalHurt = live(1);
  assert.strictEqual(rivalHurt.records.fights[0].applied.rival, 'serious');
  assert.strictEqual(rivalHurt.records.fights[0].applied.player, null);
  assert.ok(rivalHurt.npcs[rivalHurt.records.fights[0].rivalId].injuries.some((row) => row.tier === 'serious' && row.rolled === 'crippling'));
  const playerHurt = live(8);
  assert.strictEqual(playerHurt.records.fights[0].won, false);
  assert.strictEqual(playerHurt.records.fights[0].applied.player, 'serious');
  assert.ok(playerHurt.injuries.some((row) => row.tier === 'serious' && row.source === 'mate-challenge'));
  assert.strictEqual(playerHurt.needs.health, 75);
  const low = E.newRun({ mainCat: female, seed: 8, runId: 'low-health' });
  low.records.willingness.hc08 = { accepted: true, pride: 'highcrag', day: 1 };
  low.records.approval.highcrag = { approved: true, day: 1 };
  low.region = 'highcrag';
  low.cat.perks = ['right_of_challenge'];
  low.needs.health = 20;
  const survived = E.act(low, { type: 'challenge', catId: 'hc08' }).state;
  assert.strictEqual(survived.needs.health, 1);
  assert.ok(!survived.dead);
  console.log('LIVE INJURY', JSON.stringify({
    npcLoser: { seed: 1, applied: rivalHurt.records.fights[0].applied },
    playerLoser: { seed: 8, applied: playerHurt.records.fights[0].applied, health: playerHurt.needs.health }
  }));
});
