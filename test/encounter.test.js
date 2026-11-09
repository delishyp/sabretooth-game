// Bounded deer, wolf, and cave-hyena proof. Needs are never patched on the played routes.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Speech = require('../src/renderer/js/speech');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const rules = j('slice-rules.json');
const graph = j('events/recurring-conversation.json');
const producer = j('events/faction-proof-reconciled.json');
const encounters = j('events/encounters-v0.2.json');
const E = Slice.create({
  map: j('map.json'), rules, events: j('events/slice-1.json'), slots: j('world-slots.json'),
  nameData: j('names/names.json'), looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: graph, borderPolicy: producer, encounters
});
const cat = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {}, portraitId: 'cat-6e2d788dd48ff440' };
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const standing = (s) => s.worldMemory.prideToPlayer['highcrag->player'].value;
const deeds = (s) => s.worldMemory.ledger.filter((row) => String(row.receiptKey).includes('/standing_deed/'));
const deed = (s, leaf) => deeds(s).find((row) => row.receiptKey.endsWith('/' + leaf));

function start(seed, personality, runId) {
  const main = personality ? { ...cat, genes: { personality } } : cat;
  return E.newRun({ mainCat: main, seed, runId: runId || ('enc-' + seed) });
}
function choose(s, choiceId) {
  return E.act(s, { type: 'encounterChoose', choiceId });
}
function finishScene(s) {
  let cur = s;
  if (!E.encounterView(cur).terminal) cur = choose(cur, 'finish').state;
  return E.act(cur, { type: 'continue' }).state;
}

test('the three supplied images are the unchanged originals', () => {
  const root = path.join(__dirname, '..', 'assets', 'encounters');
  const hyena = encounters.encounters.find((row) => row.id === 'encounter.cave_hyena.v1');
  const correction = hyena.outcomeRendering.resolve_hyena_contest.thresholdCorrection;
  assert.strictEqual(correction.handoffSha256, '66de49ea1afaf66b11e04d41256d201446735827e94241811914044b8909b475');
  assert.strictEqual(hash(path.join(D, 'events/encounters-v0.2.json')), '9c5d479c6d767a66f0206e2fae8f859e13fbef49f7b116fb2bb14202464412c4');
  assert.strictEqual(hash(path.join(root, 'giant-deer.png')), encounters.assets['giant-deer.png'].sha256);
  assert.strictEqual(hash(path.join(root, 'old-pack-enemy.png')), encounters.assets['old-pack-enemy.png'].sha256);
  assert.strictEqual(hash(path.join(root, 'cave-hyena.png')), encounters.assets['cave-hyena.png'].sha256);
  assert.strictEqual(encounters.assets['old-pack-enemy.png'].displayLabel, 'Wolf pack enemy');
});

test('the first Split Rock hunt is the giant deer, and leaving or failing invents no food', () => {
  let s = start(5, null, 'deer');
  s = E.act(s, { type: 'hunt', size: 'small' }).state;
  const view = E.encounterView(s);
  assert.strictEqual(view.assetId, 'giant-deer.png');
  assert.strictEqual(view.displayName, 'Giant deer');
  assert.strictEqual(view.nodeId, 'opening');
  assert.deepStrictEqual(view.choices.map((c) => c.id), ['observe', 'stalk', 'leave']);
  assert.strictEqual(s.needs.energy, 70);
  assert.strictEqual(s.day, 1);
  const saved = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(E.encounterView(saved).nodeId, 'opening');
  assert.deepStrictEqual(E.encounterView(saved).choices.map((c) => c.id), view.choices.map((c) => c.id));
  assert.strictEqual(saved.needs.energy, 70);
  const left = finishScene(choose(saved, 'leave').state);
  assert.strictEqual(left.encounters.log.at(-1).outcomeId, 'prey_attempt_abandoned');
  assert.strictEqual(left.needs.hunger, 68);
  assert.strictEqual(standing(left), 0);
  assert.strictEqual(deeds(left).length, 0);
  let watched = start(6, null, 'deer-watch');
  watched = E.act(watched, { type: 'hunt', size: 'large' }).state;
  watched = choose(watched, 'observe').state;
  assert.strictEqual(E.encounterView(watched).nodeId, 'observe');
  watched = finishScene(choose(watched, 'leave').state);
  assert.strictEqual(watched.encounters.log.at(-1).yieldHunger, 0);
  const poor = start(7, null, 'deer-poor');
  poor.needs.energy = 25;
  let blocked = E.act(poor, { type: 'hunt', size: 'large' }).state;
  assert.strictEqual(blocked.needs.energy, 15);
  blocked = choose(blocked, 'stalk').state;
  const commit = E.encounterView(blocked).choices.find((c) => c.id === 'commit_hunt');
  assert.strictEqual(commit.disabled, true);
  assert.strictEqual(choose(blocked, 'commit_hunt').error, 'unaffordable');
  assert.strictEqual(blocked.needs.energy, 15);
  assert.strictEqual(blocked.needs.hunger, 80);
});

test('a committed deer hunt rolls once, and a later hunt is not a second deer', () => {
  let s = start(8, null, 'deer-commit');
  s = E.act(s, { type: 'hunt', size: 'medium' }).state;
  s = choose(s, 'stalk').state;
  s = choose(s, 'commit_hunt').state;
  const result = s.encounters.pending.result;
  assert.ok(result.resolverReceipt.endsWith('/resolver'));
  assert.strictEqual(result.yieldHunger, result.ok ? 80 : 0);
  assert.strictEqual(s.needs.energy, 50);
  const again = choose(s, 'commit_hunt');
  assert.strictEqual(again.error, 'stale');
  assert.strictEqual(again.state.needs.energy, 50);
  s = E.act(s, { type: 'continue' }).state;
  if (s.phase !== 'day') s = E.act(s, { type: 'continue' }).state;
  const second = E.act(s, { type: 'hunt', size: 'small' }).state;
  assert.notStrictEqual(second.phase, 'encounter');
  assert.strictEqual(second.encounters.log.filter((row) => row.encounterId === 'encounter.giant_deer.v1').length, 1);
  assert.strictEqual(standing(second), 0);
});

test('the first day ended among wolves is the flee-only pack, and it pays nothing', () => {
  let s = start(4, null, 'wolf');
  s = E.act(s, { type: 'travel', to: 'greywater_ford' }).state;
  const view = E.encounterView(s);
  assert.strictEqual(s.day, 1);
  assert.strictEqual(s.phase, 'encounter');
  assert.strictEqual(view.assetId, 'old-pack-enemy.png');
  assert.strictEqual(view.displayName, 'Wolf pack enemy');
  assert.deepStrictEqual(view.choices.map((c) => c.id), ['give_ground', 'watch']);
  assert.notStrictEqual(s.phase, 'ford');
  s = choose(s, 'watch').state;
  assert.deepStrictEqual(E.encounterView(s).choices.map((c) => c.id), ['withdraw', 'keep_cover']);
  const saved = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(E.encounterView(saved).nodeId, 'watch');
  s = choose(saved, 'keep_cover').state;
  assert.strictEqual(s.encounters.pending.result.outcomeId, 'resolve_existing_flee_with_cover');
  assert.strictEqual(s.needs.health, 100);
  assert.strictEqual(standing(s), 0);
  const warning = E.world.unusedService(s, 'wolf_warning');
  assert.strictEqual(warning.delta, 0);
  assert.strictEqual(standing(s), 0);
  assert.strictEqual(E.world.unusedService(s, 'wolf_warning').reason, 'duplicate');
  s = E.act(s, { type: 'continue' }).state;
  assert.strictEqual(s.day, 2);
  assert.strictEqual(s.phase, 'ford');
  assert.strictEqual(standing(s), 0);
});

test('a fresh cat drives the hyena, records three separate +5 deeds, and reaches a warm permit without the ford', () => {
  let s = start(3, null, 'permit-route');
  assert.strictEqual(E.encounter.fightStat(s), 10);
  assert.strictEqual(E.encounter.hyenaTier(s).tier, 'partial');
  const before = { ...s.needs };
  s = E.act(s, { type: 'travel', to: 'twin_forks' }).state;
  const open = E.encounterView(s);
  assert.strictEqual(s.day, 1);
  assert.strictEqual(s.region, 'twin_forks');
  assert.strictEqual(open.assetId, 'cave-hyena.png');
  assert.strictEqual(open.displayName, 'Cave hyena');
  assert.strictEqual(open.cast.hunterId, 'hc05');
  assert.strictEqual(open.cast.outsiderId, 'bf01');
  assert.strictEqual(open.cast.presence, 'authored-scene-cast');
  assert.deepStrictEqual(open.cast.hunterTraits, s.npcs.hc05.personality);
  assert.deepStrictEqual(open.choices.map((c) => c.id), ['drive_off', 'yield_kill', 'take_the_kill', 'retreat']);
  const said = open.lines.find((line) => line.kind === 'say' && line.speakerId === 'hc05');
  const expected = Speech.resolve(encounters.encounters.find((row) => row.id === 'encounter.cave_hyena.v1').personality && {
    speechLocations: Object.fromEntries(Object.entries(encounters.encounters[2].personality.utterances).map(([id, row]) => [id, { focusTrait: row.focusTrait, base: row.baseline, low: row.low, high: row.high, context: id }])),
    contextActions: {}
  }, 'opening', s.npcs.hc05.personality, { catName: s.npcs.hc05.name });
  assert.strictEqual(said.text, expected.text);
  assert.strictEqual(s.needs.energy, before.energy - 15);
  s = choose(s, 'drive_off').state;
  assert.strictEqual(s.encounters.pending.nodeId, 'after_drive');
  assert.strictEqual(s.needs.energy, before.energy - 15 - 10);
  assert.strictEqual(deed(s, 'drive_hyena').delta, 5);
  assert.strictEqual(standing(s), 5);
  assert.ok(E.world.knowsFact(s, 'highcrag', deed(s, 'drive_hyena').factId));
  assert.strictEqual(E.world.knowsFact(s, 'hc01', deed(s, 'drive_hyena').factId), false);
  const mid = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(E.encounterView(mid).nodeId, 'after_drive');
  assert.ok(E.encounterView(mid).choices.some((c) => c.id === 'share_remains'));
  assert.ok(E.encounterView(mid).choices.some((c) => c.id === 'warn_off_trespasser'));
  s = choose(mid, 'warn_off_trespasser').state;
  assert.strictEqual(deed(s, 'return_trespasser').delta, 5);
  assert.ok(E.encounterView(s).choices.some((c) => c.id === 'share_remains'));
  assert.ok(!E.encounterView(s).choices.some((c) => c.id === 'warn_off_trespasser'));
  s = choose(s, 'share_remains').state;
  assert.strictEqual(deed(s, 'share_kill').delta, 5);
  assert.strictEqual(choose(s, 'share_remains').error, 'choice');
  assert.strictEqual(standing(s), 15);
  assert.strictEqual(deeds(s).filter((row) => row.delta > 0).length, 3);
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, 0);
  assert.strictEqual(s.conversation.cats.hc05, undefined);
  s = finishScene(s);
  assert.strictEqual(s.day, 2);
  assert.strictEqual(s.region, 'twin_forks');
  assert.deepStrictEqual(s.map.visited, ['split_rock', 'twin_forks']);
  assert.strictEqual(s.needs.energy, 80);
  assert.strictEqual(s.needs.hunger, 68);
  assert.strictEqual(s.needs.thirst, 80);
  assert.strictEqual(standing(s), 15);
  s = E.act(s, { type: 'seek' }).state;
  assert.strictEqual(s.phase, 'border');
  assert.strictEqual(s.border.guardId, 'hc05');
  assert.strictEqual(s.needs.energy, 75);
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_policy_review' }).state;
  assert.strictEqual(E.world.knowsFact(s, 'hc01', s.worldMemory.reviews[0].factId), false);
  s = E.act(s, { type: 'continue' }).state;
  assert.strictEqual(s.day, 3);
  assert.strictEqual(s.worldMemory.reviews[0].status, 'relayed');
  assert.strictEqual(E.world.knowsFact(s, 'hc01', s.worldMemory.reviews[0].factId), true);
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].source, 'unreconciled');
  s = E.act(s, { type: 'border', guardId: 'hc05' }).state;
  assert.strictEqual(s.border.pendingRuling.decision, 'permit_relay');
  assert.strictEqual(s.border.pendingRuling.cause, 'warm');
  s = E.act(s, { type: 'borderChoose', choiceId: 'accept_ruling' }).state;
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].decision, 'permit_relay');
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].cause, 'warm');
  assert.strictEqual(standing(s), 15);
  assert.strictEqual(deeds(s).filter((row) => row.delta > 0).length, 3);
  const kept = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(kept.worldMemory.policy['highcrag->bonefield'].decision, 'permit_relay');
  assert.strictEqual(E.act(kept, { type: 'borderChoose', choiceId: 'accept_ruling' }).error, 'duplicate');
  assert.strictEqual(standing(kept), 15);
});

test('the other follow-up order also pays each deed once', () => {
  let s = start(3, null, 'order');
  s = E.act(s, { type: 'travel', to: 'twin_forks' }).state;
  s = choose(s, 'drive_off').state;
  s = choose(s, 'share_remains').state;
  s = choose(s, 'warn_off_trespasser').state;
  assert.strictEqual(standing(s), 15);
  assert.deepStrictEqual(deeds(s).map((row) => row.receiptKey.split('/').pop()), ['drive_hyena', 'share_kill', 'return_trespasser']);
});

test('a Standard minimum aggression fails the drive and pays nothing', () => {
  let s = start(3, { aggression: 20, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 }, 'fail-drive');
  assert.ok(E.encounter.fightStat(s) < 9);
  assert.strictEqual(E.encounter.hyenaTier(s).tier, 'fail');
  assert.strictEqual(E.encounter.hyenaTier(s).injury, null);
  s = E.act(s, { type: 'travel', to: 'twin_forks' }).state;
  const energy = s.needs.energy;
  s = choose(s, 'drive_off').state;
  assert.strictEqual(s.encounters.pending.nodeId, 'hyena_keeps_kill');
  assert.strictEqual(s.needs.energy, energy);
  assert.strictEqual(s.needs.health, 100);
  assert.strictEqual(standing(s), 0);
  assert.strictEqual(deeds(s).length, 0);
  assert.strictEqual(E.encounterView(s).choices.length, 0);
});

test('yield and retreat pay nothing, and taking the kill is one witnessed -5', () => {
  let yielded = start(3, null, 'yield');
  yielded = E.act(yielded, { type: 'travel', to: 'twin_forks' }).state;
  yielded = choose(yielded, 'yield_kill').state;
  assert.strictEqual(yielded.encounters.pending.nodeId, 'hyena_keeps_kill');
  assert.strictEqual(standing(yielded), 0);
  let retreated = start(3, null, 'retreat');
  retreated = E.act(retreated, { type: 'travel', to: 'twin_forks' }).state;
  retreated = choose(retreated, 'retreat').state;
  assert.strictEqual(retreated.encounters.pending.nodeId, 'hyena_retreated');
  assert.strictEqual(standing(retreated), 0);
  assert.strictEqual(retreated.needs.hunger, 80);
  let stolen = start(3, null, 'steal');
  stolen = E.act(stolen, { type: 'travel', to: 'twin_forks' }).state;
  stolen = choose(stolen, 'take_the_kill').state;
  assert.strictEqual(stolen.needs.hunger, 100);
  assert.strictEqual(deed(stolen, 'steal_kill').delta, -5);
  assert.strictEqual(standing(stolen), -5);
  assert.strictEqual(deeds(stolen).length, 1);
  const reloaded = E.migrate(JSON.parse(JSON.stringify(stolen)));
  assert.strictEqual(standing(reloaded), -5);
});

test('FIXTURE: low health is not the played route; it only proves the fail tier pays 0', () => {
  const s0 = start(3, null, 'fixture-health');
  s0.needs.health = 40;
  let s = E.act(s0, { type: 'travel', to: 'twin_forks' }).state;
  assert.strictEqual(s.encounters.pending.forecast.tier, 'fail');
  s = choose(s, 'drive_off').state;
  assert.strictEqual(standing(s), 0);
  assert.strictEqual(deeds(s).length, 0);
});

test('a known ford feud still defers after the hyena standing is +15', () => {
  let s = start(4, null, 'defer-after-standing');
  s = E.act(s, { type: 'travel', to: 'twin_forks' }).state;
  s = choose(s, 'drive_off').state;
  s = choose(s, 'share_remains').state;
  s = choose(s, 'warn_off_trespasser').state;
  s = finishScene(s);
  assert.strictEqual(standing(s), 15);
  assert.strictEqual(s.day, 2);
  s = E.act(s, { type: 'travel', to: 'greywater_ford' }).state;
  assert.strictEqual(s.phase, 'encounter');
  assert.strictEqual(E.encounterView(s).encounterId, 'encounter.wolf_pack.v1');
  s = choose(s, 'give_ground').state;
  assert.strictEqual(standing(s), 15);
  s = E.act(s, { type: 'continue' }).state;
  assert.strictEqual(s.phase, 'ford');
  assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, -20);
  s = E.act(s, { type: 'fordChoose', choiceId: 'stay_out' }).state;
  s = E.act(s, { type: 'continue' }).state;
  s = E.act(s, { type: 'border', guardId: 'hc07' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_introduction' }).state;
  s = E.act(s, { type: 'borderChoose', choiceId: 'request_policy_review' }).state;
  const petition = s.worldMemory.reviews[0].factId;
  s = E.act(s, { type: 'continue' }).state;
  let guard = 0;
  while (s.worldMemory.reviews[0].status !== 'relayed' && guard < 6) {
    if (s.phase === 'day') s = E.act(s, { type: 'rest' }).state;
    else if (s.phase === 'event') s = E.act(s, { type: 'choose', choiceId: E.eventById(s.pending.eventId).choices[0].id }).state;
    else s = E.act(s, { type: 'continue' }).state;
    guard += 1;
  }
  assert.strictEqual(s.worldMemory.reviews[0].status, 'relayed');
  assert.strictEqual(E.world.knowsFact(s, 'hc01', `${s.runId}/ford_dispute/highcrag/bonefield`), true);
  s = E.act(s, { type: 'border', guardId: 'hc07' }).state;
  assert.strictEqual(s.border.pendingRuling.decision, 'defer_relay');
  assert.strictEqual(s.border.pendingRuling.cause, 'feud');
  s = E.act(s, { type: 'borderChoose', choiceId: 'accept_ruling' }).state;
  assert.strictEqual(s.worldMemory.policy['highcrag->bonefield'].decision, 'defer_relay');
  assert.strictEqual(standing(s), 15);
  assert.strictEqual(deeds(s).filter((row) => row.delta > 0).length, 3);
  assert.ok(petition);
});
