const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const Q = E.quests;

function run() {
  return E.newRun({ mainCat: player, seed: 8, runId: 'quests' });
}
function fresh(kind, extra) {
  const s = run();
  const row = Q.forceOpen(s, Object.assign({ kind, askerId: 'hc01', prideAsk: true, prideId: 'highcrag' }, extra || {}));
  return { s, row };
}

test('each request kind can be kept and failed once, and a reload does not apply the receipt again', () => {
  for (const kind of ['bring_prey', 'scout_region', 'drive_off', 'carry_word', 'find_cub']) {
    const kept = fresh(kind, kind === 'find_cub' ? { cubId: 'hc10', prideAsk: false, askerId: 'hc06' } : {});
    const before = kept.row.prideAsk ? kept.s.prideRelation.highcrag : kept.s.npcs[kept.row.askerId].affinity;
    assert.ok(!Q.keep(kept.s, kept.row.id).error, kind);
    const after = kept.row.prideAsk ? kept.s.prideRelation.highcrag : kept.s.npcs[kept.row.askerId].affinity;
    assert.strictEqual(after, before + 5, kind);
    const again = JSON.parse(JSON.stringify(kept.s));
    Q.ensure(again);
    assert.ok(Q.keep(again, kept.row.id).duplicate, kind);
    const still = kept.row.prideAsk ? again.prideRelation.highcrag : again.npcs[kept.row.askerId].affinity;
    assert.strictEqual(still, after, kind);
    const failed = fresh(kind, kind === 'find_cub' ? { cubId: 'hc10', prideAsk: false, askerId: 'hc06' } : {});
    assert.ok(!Q.fail(failed.s, failed.row.id, 'deadline').error, kind);
    assert.strictEqual(failed.row.state, 'failed');
    assert.strictEqual(Q.fail(failed.s, failed.row.id, 'deadline').duplicate, true);
  }
});

test('a declined cub search does not kill the cub, and a failed accepted search does', () => {
  const s = run();
  assert.strictEqual(!!s.npcs.hc10.dead, false);
  s.world.offers.push({ id: 'offer-cub', kind: 'find_cub', askerId: 'hc06', cubId: 'hc10', state: 'offered', prideAsk: false });
  Q.decline(s, 'offer-cub');
  assert.strictEqual(!!s.npcs.hc10.dead, false);
  const row = Q.forceOpen(s, { kind: 'find_cub', askerId: 'hc06', cubId: 'hc10', prideAsk: false });
  Q.fail(s, row.id, 'deadline');
  assert.strictEqual(s.npcs.hc10.dead, true);
  assert.ok(s.worldMemory.knowledge['cub_lost_hc10']);
});

test('a gift cannot pass the absolute-10 cap, and a repeat in the season is worth nothing', () => {
  const s = run();
  s.npcs.bf06.personality = { aggression: 10, sociability: 10, curiosity: 10 };
  const items = [{ kind: 'prey', size: 'small' }, { kind: 'prey', size: 'medium' }, { kind: 'prey', size: 'large' }, { kind: 'herb' }];
  let total = 0;
  items.forEach((item, i) => {
    s.day = i + 1;
    const given = Q.give(s, { catId: 'bf06', item, conversationId: 'bf06-talk' });
    assert.ok(!given.error, given.error);
    total += given.delta;
  });
  assert.ok(total <= 10);
  assert.strictEqual(s.world.giftAbs['bf06-talk'], 10);
  s.day = 5;
  const repeat = Q.give(s, { catId: 'bf06', item: { kind: 'herb' }, conversationId: 'bf06-talk-2' });
  assert.strictEqual(repeat.delta, 0);
  s.day = 4;
  assert.strictEqual(Q.give(s, { catId: 'bf06', item: { kind: 'bone' }, conversationId: 'other' }).error, 'daily');
});

test('a trade never adds pride food', () => {
  const s = run();
  s.pride.food = 40;
  s.npcs.bf01.faction = 'bonefield';
  const struck = Q.strike(s, { leaderId: 'bf01', kind: 'food_for_passage', size: 'small' });
  assert.ok(!struck.error, struck.error);
  assert.ok(s.pride.food <= 40);
  assert.ok(s.pride.food < 40);
  const hunting = Q.strike(s, { leaderId: 'bf01', kind: 'food_for_hunting' });
  assert.ok(s.pride.food <= struck.food);
  const help = Q.strike(s, { leaderId: 'bf01', kind: 'help_for_help' });
  assert.strictEqual(s.pride.food, hunting.food);
  assert.strictEqual(help.food, s.pride.food);
  const hooked = Q.councilHook(s, help.trade);
  assert.strictEqual(hooked.agreed, true);
  assert.strictEqual(hooked.agreement.kind, 'admission_courtesy');
});

test('seed 8 offers at least one request in the first 10 days, and an old save still loads', () => {
  let s = run();
  for (let i = 0; i < 30 && s.day <= 10 && !s.over; i++) {
    if (s.phase !== 'day') {
      const next = E.act(s, { type: 'continue' });
      if (next.error) break;
      s = next.state;
      continue;
    }
    const rested = E.act(s, { type: 'rest' });
    if (rested.error) break;
    s = rested.state;
  }
  assert.ok(s.world.offers.length >= 1, 'no request was offered');
  const legacy = run();
  delete legacy.world;
  const loaded = E.migrate(legacy);
  assert.ok(Array.isArray(loaded.world.quests));
  assert.ok(Array.isArray(loaded.world.requests));
  assert.strictEqual(loaded.saveVersion, 2);
});

test('the join ending stays home without a pride and joins when the pride exists', () => {
  const stayed = run();
  stayed.npcs.bf06.affinity = 80;
  stayed.records.pride = null;
  const open = Q.forceOpen(stayed, { kind: 'bring_prey', askerId: 'bf06', prideAsk: false, lineId: 'ql_bf06_somebody_listening', step: 3 });
  Q.ensure(stayed).quests.push({ lineId: open.lineId, catId: 'bf06', step: 3, branch: 'credit', state: 'active', startAbsDay: 1, endAbsDay: null });
  Q.keep(stayed, open.id);
  assert.strictEqual(stayed.world.quests[0].join, 'stayed');
  assert.notStrictEqual(stayed.npcs.bf06.status, 'member');
  const joined = run();
  joined.npcs.bf06.affinity = 80;
  joined.records.pride = { id: 'player', name: 'The little pride' };
  const last = Q.forceOpen(joined, { kind: 'bring_prey', askerId: 'bf06', prideAsk: false, lineId: 'ql_bf06_somebody_listening', step: 3 });
  Q.ensure(joined).quests.push({ lineId: last.lineId, catId: 'bf06', step: 3, branch: 'credit', state: 'active', startAbsDay: 1, endAbsDay: null });
  Q.keep(joined, last.id);
  assert.strictEqual(joined.world.quests[0].join, 'joined');
  assert.strictEqual(joined.npcs.bf06.departure, 'left');
  assert.strictEqual(joined.npcs.bf06.status, 'member');
});

test('quest tokens resolve in a rendered beat', () => {
  const s = run();
  s.pending = {
    eventId: 'quest.ask', catId: 'hc06', questgiverId: 'hc06', cubId: 'hc10', leaderId: 'hc01', regionName: 'Horse Meadows',
    beats: [{ kind: 'narration', text: '{questgiverName} asks after {cubName}. Tell {leaderName} at {regionName}.' }]
  };
  s.phase = 'event';
  const ctx = E.beatContext(s);
  const line = E.beats.materialize(s.pending.beats[0].text, ctx);
  assert.ok(!/\{(questgiverName|cubName|leaderName|regionName)\}/.test(line), line);
  assert.ok(line.includes(s.npcs.hc06.name), line);
  assert.ok(line.includes(s.npcs.hc10.name), line);
});
