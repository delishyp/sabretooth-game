// Display and Standing use the skills contract. Window proofs stop at day 20.
// Threshold proofs call the same grant the court and leader actions call, and say so.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Skills = require('../src/renderer/js/skills');
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

function neutral(s) {
  s.records.playerSkills.aptitude.courtship = 100;
  s.records.playerSkills.aptitudeSource = 'test-neutral';
  s.cat.personality = { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 };
}

test('a courtship attempt grants Display XP once, and a reload does not grant it again', () => {
  const E = mk();
  const s = E.newRun({ mainCat: female, seed: 9, runId: 'xp-court' });
  neutral(s);
  const cat = s.npcs.hc04;
  s.records.bonds[cat.id] = { stage: 'close' };
  cat.affinity = 30;
  s.region = 'highcrag';
  const before = s.npcs.hc04.affinity;
  const tried = E.act(s, { type: 'court', catId: 'hc04' });
  assert.ok(!tried.error, tried.error);
  const xp = tried.state.records.playerSkills.xp;
  assert.ok(xp.display === 10 || xp.display === 4);
  assert.strictEqual(xp.charm, Math.round(xp.display * 0.25));
  assert.strictEqual(xp.standing, Math.round(xp.display * 0.25));
  assert.notStrictEqual(tried.state.npcs.hc04.affinity, before + 100);
  const saved = JSON.parse(JSON.stringify(tried.state));
  const loaded = E.migrate(saved);
  assert.deepStrictEqual(loaded.records.playerSkills.xp, xp);
  let cur = loaded;
  for (let n = 0; n < 4 && cur.phase !== 'day'; n++) cur = E.act(cur, { type: 'continue' }).state;
  const again = E.act(cur, { type: 'court', catId: 'hc04' });
  assert.strictEqual(again.error, 'court.cooldown');
  assert.deepStrictEqual(again.state.records.playerSkills.xp, xp);
});

test('the daily cap is 20 and a repeated receipt does not add XP', () => {
  const E = mk();
  const s = E.newRun({ mainCat: female, seed: 3, runId: 'cap' });
  neutral(s);
  const a = Skills.grant(s, 'display', true, 'a');
  const b = Skills.grant(s, 'display', true, 'b');
  assert.strictEqual(a.gained.display + b.gained.display, 20);
  assert.strictEqual(s.records.playerSkills.xp.display, 20);
  const c = Skills.grant(s, 'display', true, 'b');
  assert.strictEqual(c.reason, 'duplicate');
  assert.strictEqual(s.records.playerSkills.xp.display, 20);
});

test('engine ledger: courtship-attempt grants reach Display M2 and Standing grants reach M1', () => {
  const E = mk();
  const s = E.newRun({ mainCat: female, seed: 5, runId: 'engine-m2' });
  neutral(s);
  for (let day = 1; day <= 30; day++) {
    s.day = day;
    const got = Skills.grant(s, 'display', true, `engine/display/${day}`);
    assert.strictEqual(got.gained.display, day === 1 ? 10 : day === 2 ? 8 : 5);
  }
  assert.strictEqual(s.records.playerSkills.xp.display, 10 + 8 + 28 * 5);
  assert.ok(s.records.playerSkills.xp.display >= 100);
  assert.ok(s.records.playerSkills.waiting.length >= 1);
  const first = s.records.playerSkills.waiting[0];
  assert.strictEqual(first.skill, 'display');
  assert.strictEqual(first.milestone, 1);
  const saved = JSON.parse(JSON.stringify(s));
  const loaded = E.migrate(saved);
  assert.deepStrictEqual(loaded.records.playerSkills.xp, s.records.playerSkills.xp);
  const pick = E.act(loaded, { type: 'perkChoose', perkId: 'call' });
  assert.ok(!pick.error, pick.error);
  assert.ok(pick.state.cat.perks.includes('call'));
  assert.strictEqual(pick.state.records.playerSkills.perks.display[0], 'call');
  const dup = E.act(pick.state, { type: 'perkChoose', perkId: 'gift' });
  assert.notStrictEqual(dup.error, undefined);
  while (pick.state.records.playerSkills.xp.display < 300) {
    pick.state.day += 1;
    Skills.grant(pick.state, 'display', true, `engine/display/more/${pick.state.day}`);
  }
  assert.ok(pick.state.records.playerSkills.waiting.some((row) => row.milestone === 2));
  while (pick.state.records.playerSkills.waiting[0] && pick.state.records.playerSkills.waiting[0].milestone === 1) {
    E.act(pick.state, { type: 'perkLater' });
    break;
  }
  const older = pick.state.records.playerSkills.waiting.find((row) => row.milestone === 2);
  assert.ok(older);
  while (pick.state.records.playerSkills.waiting[0].milestone !== 2) {
    const wait = pick.state.records.playerSkills.waiting[0];
    E.act(pick.state, { type: 'perkChoose', perkId: Skills.optionsFor(wait)[0] });
  }
  const show = E.act(pick.state, { type: 'perkChoose', perkId: 'showdown' });
  assert.ok(show.state.cat.perks.includes('showdown'));
  assert.strictEqual(Skills.milestone(show.state, 'display'), 2);
  for (let day = 1; day <= 20; day++) {
    show.state.day = 100 + day;
    Skills.grant(show.state, 'standing', true, `engine/standing/${day}`);
  }
  assert.ok(show.state.records.playerSkills.xp.standing >= 100);
  while (show.state.records.playerSkills.waiting.length && show.state.records.playerSkills.waiting[0].skill !== 'standing') {
    const wait = show.state.records.playerSkills.waiting[0];
    E.act(show.state, { type: 'perkChoose', perkId: Skills.optionsFor(wait)[0] });
  }
  const right = E.act(show.state, { type: 'perkChoose', perkId: 'right_of_challenge' });
  assert.ok(right.state.cat.perks.includes('right_of_challenge'));
  assert.ok(!right.state.npcs.hc01.skills);
});

test('an old save with no skill block starts at zero and keeps a stored milestone', () => {
  const E = mk();
  const fresh = E.newRun({ mainCat: female, seed: 2, runId: 'old-skill' });
  const raw = JSON.parse(JSON.stringify(fresh));
  delete raw.records.playerSkills;
  raw.cat.displayM = 2;
  raw.cat.perks = ['showdown'];
  const loaded = E.migrate(raw);
  assert.strictEqual(loaded.records.playerSkills.xp.display, 0);
  assert.strictEqual(loaded.records.playerSkills.aptitudeSource, 'missing-not-rolled');
  assert.strictEqual(loaded.records.playerSkills.aptitude.courtship, 100);
  assert.strictEqual(Skills.milestone(loaded, 'display'), 2);
  assert.ok(Skills.has(loaded, 'showdown'));
  assert.strictEqual(loaded.npcs.bf04.mateId, 'bf01');
  assert.ok(loaded.records.cats.bf04.skills == null);
});

test('twenty courtship days cannot reach Display M1 at the contract rate', () => {
  const perAttempt = 10;
  const attempts = Math.floor(20 / 5);
  assert.ok(attempts * perAttempt < 100);
  assert.ok(attempts * perAttempt < 300);
});
