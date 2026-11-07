// Audit only. Does not change thresholds, costs, or scene rules.
// Canonical JSON gives clean and partial the same outcome id, hyena_driven, and different text.
// A Standard creator cannot reach clean: aggression 100 is outside the 20–80 range.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const encounters = j('events/encounters-v0.2.json');
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'), slots: j('world-slots.json'),
  nameData: j('names/names.json'), looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'), borderPolicy: j('events/faction-proof-reconciled.json'), encounters
});
const HYENA = encounters.encounters.find((row) => row.id === 'encounter.cave_hyena.v1');
const CONTEST = HYENA.outcomeRendering.resolve_hyena_contest;
const cat = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {}, portraitId: 'cat-6e2d788dd48ff440' };
const standing = (s) => s.worldMemory.prideToPlayer['highcrag->player'].value;
const deeds = (s) => s.worldMemory.ledger.filter((row) => String(row.receiptKey).includes('/standing_deed/'));
const deed = (s, leaf) => deeds(s).find((row) => row.receiptKey.endsWith('/' + leaf));
const reload = (s) => E.migrate(JSON.parse(JSON.stringify(s)));
const choose = (s, choiceId) => E.act(s, { type: 'encounterChoose', choiceId });
const traits = (aggression) => ({ aggression, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 });

function start(personality, runId) {
  const main = personality ? { ...cat, genes: { personality } } : cat;
  return E.newRun({ mainCat: main, seed: 3, runId });
}
function arrive(personality, runId) {
  return E.act(start(personality, runId), { type: 'travel', to: 'twin_forks' }).state;
}
function says(s, text) {
  return (E.encounterView(s).lines || []).some((line) => line.text === text);
}
function positiveDeeds(s) {
  return deeds(s).filter((row) => row.delta > 0);
}

function assertDeed(s, leaf, sourceType) {
  const row = deed(s, leaf);
  assert.ok(row, leaf);
  assert.strictEqual(row.delta, 5);
  assert.strictEqual(row.sourceType, sourceType);
  assert.strictEqual(row.recordKind, 'prideToPlayer');
  assert.strictEqual(row.actor, 'highcrag');
  assert.strictEqual(row.target, 'player');
  assert.strictEqual(row.knowledgeScope, 'witnessed');
  assert.deepStrictEqual(row.witnessIds, ['hc05']);
  assert.strictEqual(s.worldMemory.ledger.filter((item) => item.receiptKey === row.receiptKey).length, 1);
  const fact = s.worldMemory.knowledge[row.factId];
  assert.strictEqual(fact.scope, 'witnessed');
  assert.deepStrictEqual(fact.witnessIds, ['hc05']);
  assert.ok(fact.participantIds.includes('player'));
  assert.ok(fact.prideIds.includes('highcrag'));
  assert.strictEqual(E.world.knowsFact(s, 'hc05', row.factId), true);
  assert.strictEqual(E.world.knowsFact(s, 'highcrag', row.factId), true);
  assert.strictEqual(E.world.knowsFact(s, 'hc01', row.factId), false);
  const again = E.world.recordDeed(s, { deedId: leaf, delta: 5, sourceType, witnessIds: ['hc05'] });
  assert.strictEqual(again.reason, 'duplicate');
  assert.strictEqual(again.applied, false);
}

function payOnce(s, choiceId, leaf, sourceType, expectedStanding) {
  const before = E.encounterView(s);
  assert.strictEqual(before.choices.find((choice) => choice.id === choiceId).disabled, false);
  assert.strictEqual(deed(s, leaf), undefined);
  let loaded = reload(s);
  assert.strictEqual(E.encounterView(loaded).nodeId, before.nodeId);
  assert.strictEqual(E.encounterView(loaded).choices.find((choice) => choice.id === choiceId).disabled, false);
  assert.strictEqual(deed(loaded, leaf), undefined);
  loaded = choose(loaded, choiceId).state;
  assertDeed(loaded, leaf, sourceType);
  assert.strictEqual(standing(loaded), expectedStanding);
  const kept = reload(loaded);
  assert.strictEqual(deeds(kept).filter((row) => row.receiptKey.endsWith('/' + leaf)).length, 1);
  assert.strictEqual(choose(kept, choiceId).error, 'choice');
  assert.strictEqual(standing(kept), expectedStanding);
  assert.strictEqual(E.world.recordDeed(kept, { deedId: leaf, delta: 5, sourceType, witnessIds: ['hc05'] }).reason, 'duplicate');
  assert.strictEqual(standing(kept), expectedStanding);
  return kept;
}

test('canonical JSON uses one outcome id for clean and partial, with different text and cost', () => {
  const file = path.join(D, 'events/encounters-v0.2.json');
  assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), '66de49ea1afaf66b11e04d41256d201446735827e94241811914044b8909b475');
  assert.strictEqual(CONTEST.clean.outcome, 'hyena_driven');
  assert.strictEqual(CONTEST.partial.outcome, 'hyena_driven');
  assert.strictEqual(CONTEST.clean.next, 'after_drive');
  assert.strictEqual(CONTEST.partial.next, 'after_drive');
  assert.strictEqual(CONTEST.clean.deed, 'drive_hyena');
  assert.strictEqual(CONTEST.partial.deed, 'drive_hyena');
  assert.notStrictEqual(CONTEST.clean.text, CONTEST.partial.text);
  assert.strictEqual(CONTEST.fail.outcome, 'hyena_keeps_kill');
  assert.strictEqual(CONTEST.fail.noDeeds, true);
  assert.strictEqual(HYENA.standingDeeds.drive_hyena.receipt, 'runId/standing_deed/highcrag/drive_hyena');
  assert.strictEqual(HYENA.standingDeeds.drive_hyena.sourceType, 'pride_aid');
  assert.strictEqual(HYENA.standingDeeds.share_kill.sourceType, 'gift_share');
  assert.strictEqual(HYENA.standingDeeds.return_trespasser.sourceType, 'pride_aid');
  assert.match(HYENA.standingDeeds.drive_hyena.requires, /clean\/partial/);
  assert.match(CONTEST.authority, /partial with extra Energy -10/);
});

test('every Standard trait step is partial or fail, never clean', () => {
  const fresh = start(null, 'fresh-stat');
  assert.strictEqual(E.encounter.fightStat(fresh), 10);
  assert.deepStrictEqual(
    { tier: E.encounter.hyenaTier(fresh).tier, extra: E.encounter.hyenaTier(fresh).extraEnergy, injury: E.encounter.hyenaTier(fresh).injury },
    { tier: 'partial', extra: 10, injury: null }
  );
  for (let aggression = 20; aggression <= 80; aggression += 5) {
    const tier = E.encounter.hyenaTier(start(traits(aggression), 'band-' + aggression));
    assert.notStrictEqual(tier.tier, 'clean', String(aggression));
    if (aggression >= 25) assert.strictEqual(tier.tier, 'partial');
    else assert.strictEqual(tier.tier, 'fail');
  }
});

test('reachable partial saves before and after each deed, in both follow-up orders, and a reply does not pay again', () => {
  function route(order, runId, ruling) {
    let s = arrive(null, runId);
    assert.strictEqual(E.encounterView(s).forecast.tier, 'partial');
    assert.strictEqual(s.needs.energy, 65);
    const parked = reload(s);
    assert.strictEqual(E.encounterView(parked).nodeId, 'opening');
    assert.strictEqual(deed(parked, 'drive_hyena'), undefined);
    s = payOnce(parked, 'drive_off', 'drive_hyena', 'pride_aid', 5);
    assert.strictEqual(s.encounters.pending.result.outcomeId, 'hyena_driven');
    assert.strictEqual(s.encounters.pending.result.tier, 'partial');
    assert.strictEqual(s.needs.energy, 55);
    assert.ok(says(s, CONTEST.partial.text));
    assert.ok(!says(s, CONTEST.clean.text));
    assert.strictEqual(E.encounterView(s).nodeId, 'after_drive');
    for (const step of order) s = payOnce(s, step.id, step.leaf, step.source, step.standing);
    assert.deepStrictEqual(positiveDeeds(s).map((row) => row.receiptKey.split('/').pop()), ['drive_hyena', ...order.map((step) => step.leaf)]);
    assert.strictEqual(positiveDeeds(s).length, 3);
    if (!ruling) return s;
    s = choose(s, 'finish').state;
    assert.strictEqual(positiveDeeds(s).length, 3);
    s = E.act(s, { type: 'continue' }).state;
    s = E.act(s, { type: 'seek' }).state;
    s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
    s = E.act(s, { type: 'borderChoose', choiceId: 'request_policy_review' }).state;
    s = E.act(s, { type: 'continue' }).state;
    s = E.act(s, { type: 'border', guardId: 'hc05' }).state;
    s = E.act(s, { type: 'borderChoose', choiceId: 'accept_ruling' }).state;
    assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].decision, 'permit_relay');
    assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].cause, 'warm');
    assert.strictEqual(positiveDeeds(s).length, 3);
    assert.strictEqual(standing(s), 15);
    const kept = reload(s);
    assert.strictEqual(E.act(kept, { type: 'borderChoose', choiceId: 'accept_ruling' }).error, 'duplicate');
    assert.strictEqual(standing(kept), 15);
    assert.strictEqual(positiveDeeds(kept).length, 3);
    return kept;
  }
  const warnThenShare = [
    { id: 'warn_off_trespasser', leaf: 'return_trespasser', source: 'pride_aid', standing: 10 },
    { id: 'share_remains', leaf: 'share_kill', source: 'gift_share', standing: 15 }
  ];
  const shareThenWarn = [
    { id: 'share_remains', leaf: 'share_kill', source: 'gift_share', standing: 10 },
    { id: 'warn_off_trespasser', leaf: 'return_trespasser', source: 'pride_aid', standing: 15 }
  ];
  route(warnThenShare, 'audit-warn-share', true);
  route(shareThenWarn, 'audit-share-warn', false);
});

test('FIXTURE unreachable on Standard: aggression 100 is clean, costs no extra Energy, and still uses hyena_driven', () => {
  const preview = E.encounter.hyenaTier(start(traits(100), 'clean-preview'));
  assert.strictEqual(preview.tier, 'clean');
  assert.strictEqual(preview.extraEnergy, 0);
  assert.ok(preview.stat >= 12);
  let s = arrive(traits(100), 'clean-fixture');
  assert.strictEqual(E.encounterView(s).forecast.tier, 'clean');
  const energy = s.needs.energy;
  s = choose(s, 'drive_off').state;
  assert.strictEqual(s.encounters.pending.result.outcomeId, 'hyena_driven');
  assert.strictEqual(s.encounters.pending.result.tier, 'clean');
  assert.strictEqual(s.needs.energy, energy);
  assert.ok(says(s, CONTEST.clean.text));
  assert.ok(!says(s, CONTEST.partial.text));
  assert.strictEqual(E.encounterView(s).nodeId, 'after_drive');
  assertDeed(s, 'drive_hyena', 'pride_aid');
  assert.strictEqual(standing(s), 5);
  const kept = reload(s);
  assert.strictEqual(kept.encounters.pending.result.tier, 'clean');
  assert.strictEqual(choose(kept, 'drive_off').error, 'choice');
  assert.strictEqual(standing(kept), 5);
  assert.strictEqual(positiveDeeds(kept).length, 1);
});

test('a failed drive, a yield, and a retreat cannot start share or warn', () => {
  let failed = arrive(traits(20), 'audit-fail');
  assert.strictEqual(E.encounterView(failed).forecast.tier, 'fail');
  const energy = failed.needs.energy;
  failed = choose(failed, 'drive_off').state;
  assert.strictEqual(failed.encounters.pending.result.outcomeId, 'hyena_keeps_kill');
  assert.strictEqual(failed.encounters.pending.result.tier, 'fail');
  assert.strictEqual(failed.needs.energy, energy);
  assert.ok(says(failed, CONTEST.fail.text));
  assert.strictEqual(choose(failed, 'share_remains').error, 'stale');
  assert.strictEqual(choose(failed, 'warn_off_trespasser').error, 'stale');
  assert.strictEqual(standing(failed), 0);
  assert.strictEqual(deeds(failed).length, 0);
  for (const choiceId of ['yield_kill', 'retreat']) {
    let s = choose(arrive(null, 'audit-' + choiceId), choiceId).state;
    assert.notStrictEqual(s.encounters.pending.nodeId, 'after_drive');
    assert.strictEqual(choose(s, 'share_remains').error, 'stale');
    assert.strictEqual(choose(s, 'warn_off_trespasser').error, 'stale');
    assert.strictEqual(positiveDeeds(s).length, 0);
    assert.strictEqual(standing(reload(s)), 0);
  }
});

test('warn is absent without an outsider, and incomplete hunter traits do not pay', () => {
  const bare = start(null, 'no-outsider');
  for (const npc of Object.values(bare.npcs)) {
    if ((npc.faction === 'loner' || npc.faction === 'bonefield') && npc.stage === 'adult') npc.dead = true;
  }
  let s = E.act(bare, { type: 'travel', to: 'twin_forks' }).state;
  assert.strictEqual(E.encounterView(s).cast.outsiderId, null);
  s = choose(s, 'drive_off').state;
  assert.ok(E.encounterView(s).choices.some((choice) => choice.id === 'share_remains'));
  assert.ok(!E.encounterView(s).choices.some((choice) => choice.id === 'warn_off_trespasser'));
  assert.strictEqual(choose(s, 'warn_off_trespasser').error, 'choice');
  assert.strictEqual(deed(s, 'return_trespasser'), undefined);
  s = choose(s, 'share_remains').state;
  assertDeed(s, 'share_kill', 'gift_share');
  assert.deepStrictEqual(positiveDeeds(s).map((row) => row.sourceType).sort(), ['gift_share', 'pride_aid']);

  const quiet = start(null, 'no-traits');
  quiet.npcs.hc05.personality = null;
  let unpaid = E.act(quiet, { type: 'travel', to: 'twin_forks' }).state;
  unpaid = choose(unpaid, 'drive_off').state;
  assert.strictEqual(unpaid.encounters.pending.nodeId, 'after_drive');
  assert.strictEqual(deed(unpaid, 'drive_hyena'), undefined);
  assert.strictEqual(standing(unpaid), 0);
  unpaid = choose(unpaid, 'share_remains').state;
  unpaid = choose(unpaid, 'warn_off_trespasser').state;
  assert.strictEqual(positiveDeeds(unpaid).length, 0);
  assert.strictEqual(standing(reload(unpaid)), 0);
});

test('partial drive is refused when Energy cannot pay 10, and the follow-ups stay free after that Energy is gone', () => {
  let blocked = arrive(null, 'depleted-drive');
  blocked.needs.energy = 9;
  assert.strictEqual(E.encounterView(blocked).forecast.tier, 'partial');
  assert.strictEqual(E.encounterView(blocked).choices.find((choice) => choice.id === 'drive_off').disabled, true);
  assert.strictEqual(E.encounterView(blocked).choices.find((choice) => choice.id === 'yield_kill').disabled, false);
  assert.strictEqual(E.encounterView(blocked).choices.find((choice) => choice.id === 'retreat').disabled, false);
  const refused = choose(blocked, 'drive_off');
  assert.strictEqual(refused.error, 'unaffordable');
  assert.strictEqual(refused.state.needs.energy, 9);
  assert.strictEqual(refused.state.encounters.pending.nodeId, 'opening');
  assert.strictEqual(deeds(refused.state).length, 0);
  const kept = reload(blocked);
  assert.strictEqual(kept.needs.energy, 9);
  assert.strictEqual(E.encounterView(kept).choices.find((choice) => choice.id === 'drive_off').disabled, true);

  let paid = choose(arrive(null, 'depleted-followup'), 'drive_off').state;
  assert.strictEqual(paid.needs.energy, 55);
  paid.needs.energy = 0;
  const resumed = reload(paid);
  assert.strictEqual(resumed.needs.energy, 0);
  assert.strictEqual(resumed.encounters.pending.nodeId, 'after_drive');
  assert.strictEqual(E.encounterView(resumed).choices.find((choice) => choice.id === 'share_remains').disabled, false);
  assert.strictEqual(E.encounterView(resumed).choices.find((choice) => choice.id === 'warn_off_trespasser').disabled, false);
  let done = choose(resumed, 'share_remains').state;
  done = choose(done, 'warn_off_trespasser').state;
  assert.strictEqual(done.needs.energy, 0);
  assert.strictEqual(standing(done), 15);
  assert.strictEqual(positiveDeeds(done).length, 3);
});
