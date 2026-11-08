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
