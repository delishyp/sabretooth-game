// Type (b) ask. FIXTURE blocks place the cat on held land and mark the leader met.
// They do not grant courtship, energy, or membership. Ordinary travel is separate.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };

function fresh(seed) {
  const s = E.newRun({ mainCat: player, seed, runId: `join-${seed}` });
  assert.deepStrictEqual(s.records.willingness, {});
  assert.strictEqual(s.records.matePair, null);
  return s;
}
function ask(s) {
  const before = { needs: { ...s.needs }, members: s.records.members.slice(), relation: s.prideRelation.highcrag, xp: JSON.parse(JSON.stringify(s.records.playerSkills)) };
  const r = E.act(s, { type: 'joinAsk', pride: 'highcrag' });
  assert.ok(!r.error, r.error);
  return { state: r.state, before };
}

test('FIXTURE: Greywater is not held land, and the reminder does not name courtship', () => {
  const s = fresh(2);
  s.day = 21;
  s.records.seasonEndShown = true;
  s.records.routeIntent = 'pride';
  s.region = 'greywater_ford';
  const reason = E.available(s).route.reason;
  assert.ok(reason.includes('not on land a pride holds'));
  assert.ok(!reason.includes('courtship'));
  const blocked = E.act(s, { type: 'joinAsk', pride: 'highcrag' });
  assert.strictEqual(blocked.error, 'join.notHeld');
  assert.strictEqual(blocked.state.records.joinAsk.highcrag, undefined);
});

test('FIXTURE: an unmated cat on Highcrag can ask once the leader is met, without courtship', () => {
  const found = { approved: null, refused: null };
  for (let seed = 1; seed <= 80 && (!found.approved || !found.refused); seed++) {
    const s = fresh(seed);
    s.region = 'highcrag';
    s.npcs.hc01.met = true;
    const gate = E.available(s).joinAsk;
    assert.deepStrictEqual(gate.blockers, []);
    const { state, before } = ask(s);
    const row = state.records.joinAsk.highcrag;
    assert.strictEqual(row.requestType, 'b');
    assert.strictEqual(row.scored.requestType, -10);
    assert.ok(!state.records.willingness.hc01);
    assert.strictEqual(state.records.matePair, null);
    assert.deepStrictEqual(state.records.members, before.members);
    assert.deepStrictEqual(state.records.playerSkills.receipts, before.xp.receipts);
    assert.strictEqual(state.day, s.day + 1);
    const loaded = E.migrate(JSON.parse(JSON.stringify(state)));
    assert.deepStrictEqual(loaded.records.joinAsk.highcrag, row);
    const back = E.act(loaded, { type: 'continue' }).state;
    const again = E.act(back, { type: 'joinAsk', pride: 'highcrag' });
    assert.strictEqual(again.error, 'duplicate');
    assert.strictEqual(again.state.prideRelation.highcrag, back.prideRelation.highcrag);
    if (row.approved) found.approved = seed;
    else {
      assert.strictEqual(state.prideRelation.highcrag, before.relation - 5);
      found.refused = seed;
    }
  }
  assert.ok(found.approved, 'no approving roll in seeds 1-80');
  assert.ok(found.refused, 'no refusing roll in seeds 1-80');
  console.log('JOIN ASK FIXTURE', JSON.stringify(found));
});

function place(seed, pride, day) {
  const s = fresh(seed);
  s.day = day;
  s.region = pride;
  s.npcs[pride === 'highcrag' ? 'hc01' : 'mw01'].met = true;
  return s;
}
function scored(seed, pride, day, patch) {
  const s = place(seed, pride, day);
  if (patch) patch(s);
  const r = E.act(s, { type: 'joinAsk', pride });
  assert.ok(!r.error, r.error);
  return r.state.records.joinAsk[pride].scored;
}

test('Tundra examples: fresh Highcrag out of season floors at 5, and cultivated Mistwood out of season is 28', () => {
  // Fresh: relation 0, leader affinity 0 (affinityStart), Highcrag −10, type (b) −10, day 21 −15. No standing, proven, elder, or earlier refusal.
  // 30 + 0 + 0 − 10 − 10 − 15 = −5, clamped to 5%.
  const freshOut = scored(1, 'highcrag', 21);
  assert.strictEqual(freshOut.leaderValue, 0);
  assert.strictEqual(freshOut.relation, 0);
  assert.strictEqual(freshOut.temperament, -10);
  assert.strictEqual(freshOut.requestType, -10);
  assert.strictEqual(freshOut.outOfSeason, -15);
  assert.strictEqual(freshOut.priorRefusals, 0);
  assert.strictEqual(freshOut.refusalTerm, 0);
  assert.strictEqual(freshOut.standingSkillTerm, 0);
  assert.strictEqual(freshOut.points, -5);
  assert.strictEqual(freshOut.p, 5);
  const freshIn = scored(1, 'highcrag', 20);
  assert.strictEqual(freshIn.outOfSeason, 0);
  assert.strictEqual(freshIn.inMatingWindow, true);
  assert.strictEqual(freshIn.points, 10);
  assert.strictEqual(freshIn.p, 10);

  // Cultivated: relation +20, leader affinity 30, mistwoodSeasonsInRange 2 → +4. The 28% figure includes the day-21 −15 and zero earlier refusals.
  // 30 + 10 + 9 + 4 − 10 − 15 = 28. The same inputs on day 20 are 43. An in-season cat with three refusals is also 28, but that adds an input this example does not name.
  const mist = (day, refusals) => scored(1, 'mistwood', day, (s) => {
    s.prideRelation.mistwood = 20;
    s.npcs.mw01.affinity = 30;
    s.records.mistwoodSeasonsInRange = 2;
    s.records.admissionRefusals.mistwood = refusals;
  });
  const out = mist(21, 0);
  assert.strictEqual(out.relation, 20);
  assert.strictEqual(out.leaderValue, 30);
  assert.strictEqual(out.mistwoodTerm, 4);
  assert.strictEqual(out.mistwoodSeasons, 2);
  assert.strictEqual(out.requestType, -10);
  assert.strictEqual(out.outOfSeason, -15);
  assert.strictEqual(out.refusalTerm, 0);
  assert.strictEqual(out.standingSkillTerm, 0);
  assert.strictEqual(out.proven, 0);
  assert.strictEqual(out.elder, 0);
  assert.strictEqual(out.points, 28);
  assert.strictEqual(out.p, 28);
  assert.strictEqual(mist(20, 0).points, 43);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((n) => mist(20, n).refusalTerm), [0, -5, -10, -15, -15]);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((n) => mist(20, n).points), [43, 38, 33, 28, 28]);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((n) => mist(20, n).p), [43, 38, 33, 28, 28]);
});

test('a refusal is stored once, and day 21 does not open a second ask or a second penalty', () => {
  const s = place(35, 'highcrag', 20);
  const first = E.act(s, { type: 'joinAsk', pride: 'highcrag' });
  assert.ok(!first.error, first.error);
  const row = first.state.records.joinAsk.highcrag;
  assert.strictEqual(row.scored.outOfSeason, 0);
  assert.strictEqual(row.approved, false);
  assert.strictEqual(row.relationDelta, -5);
  assert.strictEqual(first.state.records.admissionRefusals.highcrag, 1);
  assert.strictEqual(first.state.prideRelation.highcrag, -5);
  let st = E.migrate(JSON.parse(JSON.stringify(first.state)));
  assert.strictEqual(st.records.admissionRefusals.highcrag, 1);
  assert.deepStrictEqual(st.records.joinAsk.highcrag, row);
  const charged = st.prideRelation.highcrag;
  st = E.act(st, { type: 'continue' }).state;
  st = E.act(st, { type: 'choose', choiceId: 'route_alone' }).state;
  st = E.act(st, { type: 'continue' }).state;
  assert.strictEqual(st.day, 21);
  assert.strictEqual(st.phase, 'day');
  const again = E.act(st, { type: 'joinAsk', pride: 'highcrag' });
  assert.strictEqual(again.error, 'duplicate');
  assert.strictEqual(again.state.prideRelation.highcrag, charged);
  assert.strictEqual(again.state.records.admissionRefusals.highcrag, 1);
  assert.strictEqual(again.state.records.joinAsk.highcrag.roll, row.roll);
  const later = place(35, 'highcrag', 21);
  later.records.admissionRefusals.highcrag = 4;
  const saved = E.migrate(JSON.parse(JSON.stringify(later)));
  assert.strictEqual(saved.records.admissionRefusals.highcrag, 4);
  const asked = E.act(saved, { type: 'joinAsk', pride: 'highcrag' });
  assert.strictEqual(asked.state.records.joinAsk.highcrag.scored.priorRefusals, 4);
  assert.strictEqual(asked.state.records.joinAsk.highcrag.scored.refusalTerm, -15);
  assert.strictEqual(asked.state.records.joinAsk.highcrag.scored.outOfSeason, -15);
  if (!asked.state.records.joinAsk.highcrag.approved) {
    assert.strictEqual(asked.state.records.admissionRefusals.highcrag, 5);
    assert.strictEqual(asked.state.prideRelation.highcrag, -5);
  }
});

test('an older refused ask is counted once on load and is not charged again', () => {
  const s = place(35, 'highcrag', 21);
  s.records.joinAsk.highcrag = { approved: false, roll: 0.42, p: 10, points: 10, day: 21, requestType: 'b', relationDelta: -5 };
  s.prideRelation.highcrag = -5;
  delete s.records.admissionRefusals;
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(loaded.records.admissionRefusals.highcrag, 1);
  assert.strictEqual(loaded.prideRelation.highcrag, -5);
  const again = E.migrate(JSON.parse(JSON.stringify(loaded)));
  assert.strictEqual(again.records.admissionRefusals.highcrag, 1);
  assert.strictEqual(again.prideRelation.highcrag, -5);
  const dup = E.act(again, { type: 'joinAsk', pride: 'highcrag' });
  assert.strictEqual(dup.error, 'duplicate');
  assert.strictEqual(dup.state.records.admissionRefusals.highcrag, 1);
  assert.strictEqual(dup.state.prideRelation.highcrag, -5);
  assert.strictEqual(dup.state.records.joinAsk.highcrag.roll, 0.42);
});

test('the mate audience on day 21 still uses type (a) and still requires an accepted courtship', () => {
  const s = place(4, 'highcrag', 21);
  const blocked = E.act(s, { type: 'askLeader', catId: 'hc05' });
  assert.strictEqual(blocked.error, 'court.locked');
  s.records.willingness.hc05 = { accepted: true, pride: 'highcrag', day: 21 };
  const opened = E.act(s, { type: 'askLeader', catId: 'hc05' });
  assert.ok(!opened.error, opened.error);
  const row = opened.state.records.approval.highcrag;
  assert.strictEqual(row.scored.points, 20);
  assert.strictEqual(row.scored.p, 20);
  assert.strictEqual(row.scored.requestType, undefined);
  assert.strictEqual(row.scored.outOfSeason, undefined);
  assert.strictEqual(opened.state.records.joinAsk.highcrag, undefined);
  assert.strictEqual(opened.state.records.admissionRefusals.highcrag, undefined);
});

test('FIXTURE: the ask stays shut until the leader has been met', () => {
  const s = fresh(4);
  s.region = 'highcrag';
  assert.strictEqual(s.npcs.hc01.met, false);
  const gate = E.available(s).joinAsk;
  assert.ok(gate.blockers.some((line) => line.includes('have not met') && line.includes(s.npcs.hc01.name)));
  assert.ok(!gate.blockers.some((line) => line.includes('courtship')));
  const blocked = E.act(s, { type: 'joinAsk', pride: 'highcrag' });
  assert.strictEqual(blocked.error, 'join.blocked');
});
