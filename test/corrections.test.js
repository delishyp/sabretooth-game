// Gameplay corrections after the proof pin. Fresh seeds only. Old saves are not backfilled.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Fight = require('../src/renderer/js/fight');
const Pairs = require('../src/renderer/js/pairs');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const mk = () => Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  encounters: j('events/encounters-v0.2.json'),
  conversation: j('events/recurring-conversation.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const female = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const IDENTITY = {
  1: 'dd3618084a5ac1501b1b708c21a57cd0c1803d37abc70d5b227c2e49ac1cd37d',
  2: 'acbafafef7c7d0b35e868de729b9efbebbb225de12f8b7c2a1d7cf9b65091a48',
  9: '6834345c4437f60503060b3635e85627df0b1b6e70bd1e7f921e852daa0080e1'
};

function rosterHash(s) {
  const rows = Object.values(s.npcs).sort((a, b) => (a.id < b.id ? -1 : 1)).map((n) => ({
    id: n.id, name: n.name, sex: n.sex, portrait: n.portraitId, traits: n.personality
  }));
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
function pair(s, a, b) {
  return s.records.catToCat[[a, b].sort().join('|')];
}

test('names, traits, and portraits stay on their old streams', () => {
  const E = mk();
  for (const seed of [1, 2, 9]) {
    const a = E.newRun({ mainCat: female, seed, runId: `id-${seed}-a` });
    const b = E.newRun({ mainCat: female, seed, runId: `id-${seed}-b` });
    assert.strictEqual(rosterHash(a), IDENTITY[seed]);
    assert.strictEqual(rosterHash(a), rosterHash(b));
    assert.deepStrictEqual(a.records.catToCat, b.records.catToCat);
    assert.strictEqual(a.records.pairsStream, 'pairs');
  }
});

test('kin, mates, same-pride values, and seed flags follow the attached tables', () => {
  const E = mk();
  const s = E.newRun({ mainCat: female, seed: 4, runId: 'pairs' });
  assert.strictEqual(pair(s, 'hc01', 'hc02').value, 40);
  assert.ok(pair(s, 'hc01', 'hc02').kinds.includes('family'));
  assert.strictEqual(pair(s, 'hc02', 'hc09').value, 30);
  assert.strictEqual(pair(s, 'ln03', 'ln05').value, 30);
  assert.strictEqual(pair(s, 'ln09', 'mw08').value, 30);
  assert.strictEqual(pair(s, 'hc07', 'ln02').value, 10);
  assert.ok(pair(s, 'hc07', 'ln02').kinds.includes('family'));
  assert.strictEqual(pair(s, 'hc01', 'hc03').value, 60);
  assert.ok(pair(s, 'hc01', 'hc03').kinds.includes('mates'));
  assert.strictEqual(pair(s, 'bf01', 'bf04').value, 60);
  const grudge = pair(s, 'ln03', 'bf01');
  assert.strictEqual(grudge.value, -55);
  assert.deepStrictEqual(grudge.flags.grudge.slice().sort(), ['bf01', 'ln03']);
  assert.strictEqual(pair(s, 'ln03', 'bf01').value, pair(s, 'bf01', 'ln03').value);
  assert.strictEqual(pair(s, 'ln01', 'hc01').value, -35);
  assert.ok(pair(s, 'ln01', 'hc01').kinds.includes('grudge'));
  assert.strictEqual(pair(s, 'ln01', 'hc05').value, 25);
  assert.ok(!pair(s, 'ln01', 'hc05').kinds.includes('grudge'));
  const crush = pair(s, 'ln02', 'bf02');
  assert.ok(crush.value === 30 || crush.value === 25);
  if (crush.kinds.includes('crush')) assert.strictEqual(crush.value, 30);
  else assert.strictEqual(crush.value, 25);
  for (const row of Object.values(s.records.catToCat)) {
    if (row.source !== 'pride-normal') continue;
    assert.ok(Math.abs(row.value) >= 15);
    assert.strictEqual(s.npcs[row.a].faction, s.npcs[row.b].faction);
  }
  assert.strictEqual(Pairs.roundHalfUp(1.5), 2);
  assert.strictEqual(Pairs.roundHalfUp(-1.5), -1);
});

test('an old save keeps its edges and does not gain a retrospective pair history', () => {
  const E = mk();
  const fresh = E.newRun({ mainCat: female, seed: 3, runId: 'old' });
  const raw = JSON.parse(JSON.stringify(fresh));
  raw.records.catToCat = { 'ln05->ln01': { value: 4 } };
  raw.records.pairsSeeded = false;
  delete raw.records.pairsDropped;
  const loaded = E.migrate(raw);
  assert.deepStrictEqual(Object.keys(loaded.records.catToCat), ['ln05->ln01']);
  assert.strictEqual(loaded.records.catToCat['ln05->ln01'].value, 4);
  assert.strictEqual(loaded.records.pairsSeeded, false);
});

test('a rival is the strongest same-sex adult with value at least 15, and no one is invented', () => {
  const E = mk();
  const s = E.newRun({ mainCat: female, seed: 2, runId: 'qual' });
  const target = s.npcs.hc08;
  const males = Object.values(s.npcs).filter((n) => n.faction === 'highcrag' && n.stage === 'adult' && n.sex === 'female' && n.id !== target.id);
  const valued = males.filter((n) => {
    const row = pair(s, n.id, target.id);
    return row && row.value >= 15;
  });
  assert.ok(valued.length > 0, 'this seed has no real Highcrag qualifier');
  s.records.willingness[target.id] = { accepted: true, pride: 'highcrag', day: 1 };
  target.affinity = 80;
  s.prideRelation.highcrag = 80;
  s.region = 'highcrag';
  let cur = E.act(s, { type: 'askLeader', catId: target.id }).state;
  let rivalScene = null;
  for (let n = 0; n < 6 && cur && cur.phase !== 'day'; n++) {
    if (cur.pending && cur.pending.eventId === 'm2.mate_rival') { rivalScene = cur; break; }
    if (cur.phase === 'eventResult') cur = E.act(cur, { type: 'continue' }).state;
    else break;
  }
  if (cur.records.approval.highcrag.approved) {
    assert.ok(rivalScene, 'a qualifying cat did not produce a challenge');
    const rivalId = rivalScene.records.fights[0].rivalId;
    assert.ok(valued.some((n) => n.id === rivalId));
    assert.strictEqual(rivalScene.records.fights[0].deathRoll, false);
    assert.strictEqual(rivalScene.records.fights[0].lethal, false);
    assert.notStrictEqual(cur.dead && cur.dead.cause, 'mate-challenge');
  }
  const skip = E.newRun({ mainCat: female, seed: 2, runId: 'skip' });
  for (const row of Object.values(skip.records.catToCat)) if (row && row.value >= 15) row.value = 14;
  const cat = skip.npcs.bf05;
  skip.records.willingness[cat.id] = { accepted: true, pride: 'bonefield', day: 1 };
  cat.affinity = 90;
  skip.prideRelation.bonefield = 90;
  skip.region = 'bonefield';
  const quiet = E.act(skip, { type: 'askLeader', catId: cat.id });
  if (!quiet.error && quiet.state.records.approval.bonefield.approved) {
    assert.strictEqual(quiet.state.records.fights.length, 0);
    assert.notStrictEqual(quiet.state.pending && quiet.state.pending.eventId, 'm2.mate_rival');
  }
});

test('injury chances, tiers, showdown, and the missing death roll match the formulas', () => {
  assert.strictEqual(Fight.injuryChance('loser', 'standard', 0), 0.40);
  assert.strictEqual(Fight.injuryChance('winner', 'standard', 0), 0.15);
  assert.strictEqual(Fight.injuryChance('loser', 'story', 0), 0.20);
  assert.ok(Math.abs(Fight.injuryChance('winner', 'sim', 0) - 0.225) < 1e-12);
  assert.ok(Math.abs(Fight.injuryChance('loser', 'sim', 5) - 0.40 * 1.5 * 0.7) < 1e-12);
  assert.strictEqual(Fight.guardFactor(10), 0.7);
  assert.strictEqual(Fight.tierOf('loser', 0.59), 'minor');
  assert.strictEqual(Fight.tierOf('loser', 0.60), 'serious');
  assert.strictEqual(Fight.tierOf('loser', 0.90), 'crippling');
  assert.strictEqual(Fight.tierOf('winner', 0.79), 'minor');
  assert.strictEqual(Fight.tierOf('winner', 0.80), 'serious');
  const rolls = [0, 0, 0, 0.95, 0, 0.90];
  const fought = Fight.resolve({
    rng: () => rolls.shift(), style: 'standard', showdown: false,
    suitorStat: 100, rivalStat: 1, suitorGuard: 0, rivalGuard: 0
  });
  assert.strictEqual(fought.won, true);
  assert.strictEqual(fought.injuries.loser, 'crippling');
  assert.strictEqual(fought.injuries.winner, 'serious');
  assert.strictEqual(fought.deathRoll, false);
  assert.strictEqual(fought.lethal, false);
  assert.strictEqual(Fight.showdownChance(2, 0), 70);
  assert.strictEqual(Fight.showdownChance(0, 4), 10);
  assert.strictEqual(Fight.showdownChance(2, 2), 50);
  const replaced = Fight.resolve({ rng: () => 0.69, style: 'standard', showdown: true, suitorDisplayM: 2, rivalDisplayM: 0, suitorStat: 10, rivalStat: 10, suitorGuard: 0, rivalGuard: 0 });
  assert.strictEqual(replaced.replaced, 'showdown');
  assert.strictEqual(replaced.won, true);
  assert.strictEqual(replaced.chance, 70);
  assert.strictEqual(replaced.injuries.loser, null);
  assert.strictEqual(replaced.injuries.winner, null);
  assert.strictEqual(replaced.deathRoll, false);
  const missed = Fight.resolve({ rng: () => 0.70, style: 'standard', showdown: true, suitorDisplayM: 2, rivalDisplayM: 0, suitorStat: 10, rivalStat: 10, suitorGuard: 0, rivalGuard: 0 });
  assert.strictEqual(missed.won, false);
  const tied = Fight.resolve({ rng: () => 0.5, style: 'standard', showdown: false, suitorStat: 10, rivalStat: 10, suitorGuard: 0, rivalGuard: 0 });
  assert.strictEqual(tied.won, false);
});

test('a challenge injury is stored once and a reload does not roll it again', () => {
  const E = mk();
  let found = null;
  for (let seed = 1; seed <= 12 && !found; seed++) {
    const s = E.newRun({ mainCat: female, seed, runId: `once-${seed}` });
    const target = Object.values(s.npcs).find((n) => n.faction === 'highcrag' && n.sex === 'male' && (n.stage === 'adult' || n.stage === 'elder') && n.id !== 'hc01');
    const qual = Object.values(s.npcs).some((n) => n.faction === 'highcrag' && n.sex === 'female' && n.id !== target.id && (pair(s, n.id, target.id) || {}).value >= 15);
    if (!qual) continue;
    s.records.willingness[target.id] = { accepted: true, pride: 'highcrag', day: 1 };
    target.affinity = 80;
    s.prideRelation.highcrag = 80;
    s.region = 'highcrag';
    let cur = E.act(s, { type: 'askLeader', catId: target.id }).state;
    for (let n = 0; n < 5 && cur.pending && cur.pending.eventId !== 'm2.mate_rival'; n++) {
      if (!cur.records.approval.highcrag || !cur.records.approval.highcrag.approved) break;
      if (cur.phase === 'eventResult') cur = E.act(cur, { type: 'continue' }).state;
      else break;
    }
    if (cur.pending && cur.pending.eventId === 'm2.mate_rival') found = cur;
  }
  assert.ok(found, 'no approved Highcrag audience reached a real rival');
  const before = JSON.parse(JSON.stringify(found.records.fights));
  const injuries = found.injuries.length;
  const loaded = E.migrate(JSON.parse(JSON.stringify(found)));
  assert.deepStrictEqual(loaded.records.fights, before);
  assert.strictEqual(loaded.injuries.length, injuries);
  const stepped = E.act(loaded, { type: 'continue' });
  assert.strictEqual(stepped.state.injuries.length, injuries);
  assert.strictEqual(stepped.state.records.fights.length, before.length);
  assert.notStrictEqual(stepped.state.dead && stepped.state.dead.cause, 'mate-challenge');
});

test('Mistwood season count stays 0 during season 1 and increments once at season end', () => {
  const E = mk();
  const Pair = require('../src/renderer/js/pairing').create(j('events/first-season-v0.6.2.json'), j('slice-rules.json'));
  const s = E.newRun({ mainCat: female, seed: 2, runId: 'mw-count' });
  assert.strictEqual(s.records.mistwoodSeasonsInRange, 0);
  s.region = 'mistwood';
  const asked = E.act(JSON.parse(JSON.stringify(s)), { type: 'rest' });
  assert.ok(!asked.error, asked.error);
  assert.ok(asked.state.records.mistwoodDaysThisWindow >= 1);
  assert.strictEqual(asked.state.records.mistwoodSeasonsInRange, 0);
  const scored = JSON.parse(JSON.stringify(asked.state));
  scored.records.willingness.mw03 = { accepted: true, pride: 'mistwood', day: 1 };
  scored.npcs.mw03.affinity = 80;
  scored.prideRelation.mistwood = 80;
  scored.region = 'mistwood';
  if (scored.phase !== 'day') scored.phase = 'day';
  scored.pending = null;
  const audience = E.act(scored, { type: 'askLeader', catId: 'mw03' });
  if (!audience.error && audience.state.records.approval.mistwood) {
    assert.strictEqual(audience.state.records.approval.mistwood.scored.mistwoodTerm, 0);
  }
  Pair.commitSeason(asked.state);
  assert.strictEqual(asked.state.records.mistwoodSeasonsInRange, 1);
  assert.strictEqual(asked.state.records.mistwoodDaysThisWindow, 0);
  Pair.commitSeason(asked.state);
  assert.strictEqual(asked.state.records.mistwoodSeasonsInRange, 1);
  const cap = E.newRun({ mainCat: female, seed: 2, runId: 'mw-cap' });
  cap.records.mistwoodSeasonsInRange = 5;
  cap.records.willingness.mw03 = { accepted: true, pride: 'mistwood', day: 1 };
  cap.npcs.mw03.affinity = 0;
  cap.prideRelation.mistwood = 0;
  cap.region = 'mistwood';
  const capped = E.act(cap, { type: 'askLeader', catId: 'mw03' });
  assert.strictEqual(capped.state.records.approval.mistwood.scored.mistwoodTerm, 10);
});
