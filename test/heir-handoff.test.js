const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Deeds = require('../src/renderer/js/deeds');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {}, scars: [] };

function ready(deathRule) {
  const s = E.newRun({ mainCat: player, seed: 3, runId: 'heir-run', deathRule });
  s.needs.health = 5;
  s.needs.hunger = 0;
  s.counters.starving = 3;
  s.records.pride = { id: 'pride-heir-run', name: 'Ash Pride', heirId: 'briar' };
  s.records.members = [
    { catId: 'c1', role: 'founder' },
    { catId: 'briar', role: 'heir' }
  ];
  s.records.matePair = { mateId: 'briar' };
  s.npcs.briar = { id: 'briar', name: 'Briar', sex: 'male', stage: 'adult', ageSeasons: 16, dead: false, faction: 'pride-heir-run', met: true, portraitId: 'cat-46f04e1c79d4e443' };
  return s;
}

test('an Heir run continues as the ranked adolescent-or-older heir', () => {
  const s = ready('heir');
  const runId = s.runId;
  const next = E.act(s, { type: 'rest' });
  assert.strictEqual(next.state.over, false);
  assert.strictEqual(next.state.cat.catId, 'briar');
  assert.strictEqual(next.state.cat.name, 'Briar');
  assert.strictEqual(next.state.npcs.c1.dead, true);
  assert.strictEqual(next.state.lineage[0].name, 'Ravenmark');
  assert.ok(next.state.worldMemory.facts.some((row) => row.kind === 'death' && row.name === 'Ravenmark'));
  assert.strictEqual(next.state.pending.eventId, 'heir.death');
  assert.match(next.state.pending.beats[0].text, /Ravenmark/);
  assert.match(next.state.pending.beats[0].text, /Briar/);
  assert.strictEqual(next.state.runId, runId);
  assert.ok(next.state.needs.health > 0);
  const saved = JSON.parse(JSON.stringify(next.state));
  const loaded = E.migrate(saved);
  assert.strictEqual(loaded.cat.catId, 'briar');
  assert.strictEqual(loaded.pending.eventId, 'heir.death');
  assert.strictEqual(loaded.over, false);
  assert.strictEqual(loaded.runId, runId);
  assert.strictEqual(loaded.records.pride.name, 'Ash Pride');
});

test('Heir with nobody old enough, and Permadeath, both end the run', () => {
  const young = ready('heir');
  young.npcs.briar.ageSeasons = 2;
  young.npcs.briar.stage = 'cub';
  const ended = E.act(young, { type: 'rest' });
  assert.strictEqual(ended.state.over, true);
  assert.strictEqual(ended.state.cat.name, 'Ravenmark');
  const perm = ready('permadeath');
  const dead = E.act(perm, { type: 'rest' });
  assert.strictEqual(dead.state.over, true);
  assert.strictEqual(dead.state.phase, 'over');
});

test('newly reachable deeds read the facts the game already writes', () => {
  const won = Deeds.scan({
    deathRule: 'permadeath', level: 'standard',
    records: { fights: [{ won: true }], deedFacts: { 'court.refused': 2, 'pride.founded_clean': true, 'season.lean': true, 'mate.hostile': true }, matePair: { mateId: 'a' }, pride: { name: 'Ash' } },
    encounters: { log: [{ outcomeId: 'hyena_driven' }] },
    world: { gifts: [{ feel: 'disliked' }] }
  });
  for (const id of ['first_blood', 'hyena_bane', 'heartbreaker', 'across_lines', 'loner_king', 'lean_season', 'gift_gone_wrong']) {
    assert.ok(won.includes(id), id);
  }
  for (const id of ['read_you', 'bloodless', 'spear_dancer', 'lion_slayer', 'first_council', 'titled', 'first_litter', 'three_banners']) {
    assert.ok(!won.includes(id), id);
  }
});
