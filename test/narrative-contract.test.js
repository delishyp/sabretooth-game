// Saga contract v1 on the existing ln05 arc. FIXTURE blocks place the meeting.
// Personality overrides are labelled fixtures. Ordinary play is separate and is not claimed when the meeting was placed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const rules = j('slice-rules.json');
const mk = (over = {}) => Slice.create({
  map: j('map.json'), rules: over.rules || rules, events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };

function placed(E, seed) {
  const s = E.newRun({ mainCat: player, seed, runId: `contract-${seed}` });
  const npc = s.npcs.ln05;
  s.region = npc.homeZones[0];
  s.npcs.ln05.met = true;
  return s;
}
function talk(E, s) {
  const r = E.act(s, { type: 'talk', catId: 'ln05' });
  assert.ok(!r.error, r.error);
  return r.state;
}
function pick(E, s, id) {
  const v = E.talkView(s);
  const choice = v.choices.find((c) => c.id === id);
  assert.ok(choice, `${id} missing at ${v.nodeId}`);
  const r = E.act(s, { type: 'choose', choiceId: id, nodeId: v.nodeId, instanceId: v.instanceId });
  assert.ok(!r.error, r.error);
  return r.state;
}
function finish(E, s) {
  const r = E.act(s, { type: 'continue' });
  assert.ok(!r.error, r.error);
  return r.state;
}
function chain(E, s, ids) {
  let cur = talk(E, s);
  for (const id of ids) cur = pick(E, cur, id);
  return finish(E, cur);
}

test('FIXTURE meeting placement: quiet-return and boundary-disagreement reach different third-meeting choices', () => {
  const E = mk();
  const seed = 4;
  const quiet = placed(E, seed);
  const name = quiet.npcs.ln05.name;
  const traits = { ...quiet.npcs.ln05.personality };
  let s = chain(E, quiet, ['company', 'quiet', 'return_quiet']);
  assert.strictEqual(s.conversation.cats.ln05.initialOutcome, 'quiet_company');
  assert.strictEqual(s.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'pending');
  s.day = s.conversation.cats.ln05.cooldownUntilDay;
  s = chain(E, s, ['quiet_again']);
  assert.strictEqual(s.conversation.cats.ln05.followupOutcome, 'quiet_renewed');
  assert.strictEqual(s.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'kept');
  s.day = s.conversation.cats.ln05.cooldownUntilDay;
  const third = talk(E, s);
  const ids = E.talkView(third).choices.map((c) => c.id);
  assert.deepStrictEqual(ids.filter((id) => id !== 'leave'), ['listen', 'honest_limit']);
  const before = third.npcs.ln05.affinity;
  const xp = JSON.parse(JSON.stringify(third.records.playerSkills));
  const heard = finish(E, pick(E, third, 'listen'));
  assert.strictEqual(heard.conversation.cats.ln05.thirdOutcome, 'third_confide_listen');
  assert.strictEqual(heard.conversation.cats.ln05.initialOutcome, 'quiet_company');
  assert.strictEqual(heard.npcs.ln05.affinity, before + 5);
  assert.deepStrictEqual(heard.records.playerSkills, xp);
  assert.deepStrictEqual(heard.npcs.ln05.personality, traits);

  let hard = placed(E, seed);
  hard = talk(E, hard);
  hard = pick(E, hard, 'company');
  hard = pick(E, hard, 'press');
  hard = pick(E, hard, 'dismiss');
  assert.ok(E.talkView(hard).lines.some((l) => l.text.includes(`${name} still wants some space`)));
  hard = finish(E, hard);
  assert.strictEqual(hard.conversation.cats.ln05.initialOutcome, 'dismissed_boundary');
  hard.day = hard.conversation.cats.ln05.cooldownUntilDay;
  hard = chain(E, hard, ['need_words']);
  assert.strictEqual(hard.conversation.cats.ln05.followupOutcome, 'boundary_difference');
  hard.day = hard.conversation.cats.ln05.cooldownUntilDay;
  const repair = talk(E, hard);
  assert.deepStrictEqual(E.talkView(repair).choices.map((c) => c.id).filter((id) => id !== 'leave'), ['repair', 'distance']);
  assert.ok(!E.talkView(repair).choices.some((c) => c.id === 'listen'));
  console.log('CONTRACT CHAIN', JSON.stringify({ seed, catId: 'ln05', name, traits, quietThird: ids, repairThird: ['repair', 'distance'] }));
});

test('FIXTURE personalities: high, middle, and low change the line at one location and not the choices', () => {
  const E = mk();
  function voice(traits) {
    const s = placed(E, 4);
    s.npcs.ln05.personality = traits;
    const opened = talk(E, s);
    return {
      ids: E.talkView(opened).choices.map((c) => c.id),
      text: E.talkView(opened).lines.filter((l) => l.kind === 'say').map((l) => l.text).join('\n')
    };
  }
  const mid = voice({ aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 });
  const high = voice({ aggression: 50, sociability: 80, boldness: 50, loyalty: 50, curiosity: 50 });
  const low = voice({ aggression: 50, sociability: 20, boldness: 50, loyalty: 50, curiosity: 50 });
  assert.deepStrictEqual(high.ids, mid.ids);
  assert.deepStrictEqual(low.ids, mid.ids);
  assert.ok(high.text.includes('Walk with me for a bit'));
  assert.ok(low.text.includes('Did you want something'));
  assert.ok(mid.text.includes('just passing through'));
  assert.ok(mid.ids.includes('leave'));
});

test('FIXTURE reload keeps the frozen reply and the post-cap receipt', () => {
  const tight = mk({ rules: { ...rules, conversation: { ...rules.conversation, absDeltaCap: 6 } } });
  let s = placed(tight, 4);
  s = chain(tight, s, ['company', 'quiet', 'return_quiet']);
  s.day = s.conversation.cats.ln05.cooldownUntilDay;
  const pending = talk(tight, s);
  const before = tight.migrate(JSON.parse(JSON.stringify(pending)));
  assert.deepStrictEqual(tight.talkView(before).choices.map((c) => c.id), tight.talkView(pending).choices.map((c) => c.id));
  const chosen = pick(tight, before, 'quiet_again');
  const text = tight.talkView(chosen).lines.map((l) => l.text).join('\n');
  assert.ok(text.includes('You kept your promise to return.'));
  assert.ok(!/improved by \d+/.test(text));
  assert.ok(!/worsened by \d+/.test(text));
  assert.ok(chosen.npcs.ln05.affinity > 0);
  const again = tight.migrate(JSON.parse(JSON.stringify(chosen)));
  assert.strictEqual(tight.talkView(again).lines.map((l) => l.text).join('\n'), text);
  assert.strictEqual(again.npcs.ln05.affinity, chosen.npcs.ln05.affinity);
  const stayed = tight.act(again, { type: 'continue' });
  const twice = tight.act(stayed.state, { type: 'continue' });
  assert.ok(twice.error);
  assert.strictEqual(twice.state.npcs.ln05.affinity, chosen.npcs.ln05.affinity);
});

test('FIXTURE: an unmated season choice is an intent, and day 21 can change it without a reward', () => {
  const E = mk();
  let s = E.newRun({ mainCat: player, seed: 4, runId: 'route-4' });
  const xp = JSON.parse(JSON.stringify(s.records.playerSkills));
  s.day = 20;
  s.needs = { health: 100, hunger: 100, thirst: 100, energy: 100 };
  s = E.act(s, { type: 'rest' }).state;
  for (let i = 0; i < 8 && !(s.pending && s.pending.seasonEnd); i++) {
    if (s.phase === 'event' && s.pending && s.pending.eventId === 'slice.meeting.loner') {
      s = E.act(s, { type: 'choose', choiceId: 'pass' }).state;
    } else s = E.act(s, { type: 'continue' }).state;
  }
  assert.strictEqual(s.pending.variant, 'unmated');
  const prose = (s.pending.lines || []).map((l) => l.text).join('\n');
  assert.ok(prose.includes('tomorrow still needs water, food and shelter.'));
  assert.ok(prose.includes('The cats you met have not vanished'));
  assert.ok(prose.includes('You can change your mind.'));
  s = E.act(s, { type: 'choose', choiceId: 'route_pride' }).state;
  assert.strictEqual(s.pending.summary, 'You decide to seek a place in an existing pride.');
  assert.strictEqual(s.records.routeIntent, 'pride');
  s = E.act(s, { type: 'continue' }).state;
  assert.strictEqual(s.day, 21);
  assert.strictEqual(s.phase, 'day');
  assert.ok(!s.records.matePair);
  assert.deepStrictEqual(s.records.playerSkills, xp);
  const offered = E.available(s);
  assert.strictEqual(offered.route.intent, 'pride');
  assert.ok(offered.route.reason.includes('not on land a pride holds'));
  assert.ok(!offered.route.reason.includes('courtship'));
  const changed = E.act(s, { type: 'setRoute', intent: 'alone' }).state;
  assert.strictEqual(changed.records.routeIntent, 'alone');
  assert.strictEqual(changed.day, 21);
  assert.deepStrictEqual(changed.needs, s.needs);
  assert.ok(E.available(changed).route.reason.includes('Hunt, rest, and travel'));
  assert.ok(E.available(changed).hunt.allowed || E.available(changed).hunt.reason);
  const group = E.act(changed, { type: 'setRoute', intent: 'group' }).state;
  assert.ok(E.available(group).route.reason.includes('No eligible group'));
  assert.deepStrictEqual(group.needs, changed.needs);
  assert.deepStrictEqual(group.records.playerSkills, xp);
});
