// Premade mates, showdown, Standing, and one legal Bonefield route.
// Tallgrass is Bonefield-held spring water. bf04 is the leader's mate and is not proof.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Fight = require('../src/renderer/js/fight');
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
const male = { catId: 'c2', name: 'Tester', sex: 'male', lifeStage: 'adult', genes: {} };
const female = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const PAIRS = [['hc01', 'hc03'], ['hc02', 'hc06'], ['bf01', 'bf04'], ['mw02', 'mw04']];

test('premade mates are mutual and every one of them refuses court', () => {
  const E = mk();
  const s = E.newRun({ mainCat: female, seed: 4, runId: 'mates' });
  for (const [a, b] of PAIRS) {
    assert.strictEqual(s.npcs[a].mateId, b);
    assert.strictEqual(s.npcs[b].mateId, a);
    assert.strictEqual(s.npcs[a].mateSource, 'world-gen-2.4');
  }
  for (const id of PAIRS.flat()) {
    const npc = s.npcs[id];
    s.records.bonds[id] = { stage: 'close', value: 40 };
    npc.affinity = 40;
    s.region = npc.faction;
    const before = JSON.stringify({ mate: npc.mateId, faction: npc.faction, pair: s.records.matePair });
    const tried = E.act(JSON.parse(JSON.stringify(s)), { type: 'court', catId: id });
    assert.strictEqual(tried.error, 'court.ineligible', id);
    assert.strictEqual(JSON.stringify({ mate: tried.state.npcs[id].mateId, faction: tried.state.npcs[id].faction, pair: tried.state.records.matePair }), before);
  }
});

test('migration restores missing premade mates and does not overwrite a real pairing', () => {
  const E = mk();
  const fresh = E.newRun({ mainCat: female, seed: 4, runId: 'mig' });
  const blank = JSON.parse(JSON.stringify(fresh));
  for (const npc of Object.values(blank.npcs)) delete npc.mateId;
  const restored = E.migrate(blank);
  assert.strictEqual(restored.npcs.bf04.mateId, 'bf01');
  assert.strictEqual(restored.npcs.bf01.mateId, 'bf04');
  const played = JSON.parse(JSON.stringify(fresh));
  played.records.matePair = { id: 'p', playerId: played.cat.catId, mateId: 'bf04', playerSex: 'female', mateSex: 'female', bondedDay: 4, foundingDay: null };
  played.npcs.bf04.mateId = played.cat.catId;
  const kept = E.migrate(played);
  assert.strictEqual(kept.npcs.bf04.mateId, played.cat.catId);
  assert.strictEqual(kept.npcs.bf01.mateId, 'bf04');
  const odd = JSON.parse(JSON.stringify(fresh));
  odd.npcs.hc03.mateId = 'stored-other';
  const flagged = E.migrate(odd);
  assert.strictEqual(flagged.npcs.hc03.mateId, 'stored-other');
  assert.ok(flagged.records.mateAmbiguity.some((row) => row.id === 'hc03' && row.reason === 'stored-mate-kept'));
});

test('showdown uses the suitor and rival Display milestones and injures nobody', () => {
  assert.strictEqual(Fight.showdownChance(4, 0), 90);
  assert.strictEqual(Fight.showdownChance(0, 4), 10);
  assert.strictEqual(Fight.showdownChance(0, 0), 50);
  assert.strictEqual(Fight.fightStat({ standingM: 5, mateChallenge: true }), 11);
  assert.strictEqual(Fight.fightStat({ standingM: 5, mateChallenge: false }), 10);
  assert.strictEqual(Fight.fightStat({ mateChallenge: true }), 10);
  const E = mk();
  function prep(holder) {
    const s = E.newRun({ mainCat: female, seed: 9, runId: `sd-${holder}` });
    const target = s.npcs.hc08;
    s.records.willingness[target.id] = { accepted: true, pride: 'highcrag', day: 1 };
    s.records.approval.highcrag = { approved: true, day: 1 };
    s.region = 'highcrag';
    s.cat.perks = holder === 'suitor' ? ['showdown', 'right_of_challenge'] : ['right_of_challenge'];
    s.cat.displayM = holder === 'suitor' ? 3 : 0;
    s.cat.standingM = 5;
    const offered = E.available(s).challenge.find((row) => row.catId === 'hc08');
    assert.ok(offered, 'a stored qualifier should offer the challenge');
    const rival = s.npcs[offered.rivalId];
    if (holder === 'rival') { rival.perks = ['showdown']; rival.displayM = 4; }
    return { s, rival };
  }
  const suitor = prep('suitor');
  const offered = E.available(suitor.s).challenge;
  assert.ok(offered.some((row) => row.catId === 'hc08'));
  const fought = E.act(suitor.s, { type: 'challenge', catId: 'hc08' });
  assert.ok(!fought.error, fought.error);
  const row = fought.state.records.fights[0];
  assert.strictEqual(row.replaced, 'showdown');
  assert.strictEqual(row.rolls.chance, 80);
  assert.strictEqual(row.injuries.loser, null);
  assert.strictEqual(row.deathRoll, false);
  assert.strictEqual(fought.state.injuries.length, 0);
  const again = E.act(fought.state, { type: 'continue' });
  assert.strictEqual(again.state.records.fights.length, 1);
  assert.strictEqual(again.state.injuries.length, 0);
  const loaded = E.migrate(JSON.parse(JSON.stringify(again.state)));
  assert.strictEqual(loaded.records.fights.length, 1);
  assert.strictEqual(loaded.injuries.length, 0);
  assert.strictEqual(E.available(loaded).challenge.length, 0);
  const rivalSide = prep('rival');
  const other = E.act(rivalSide.s, { type: 'challenge', catId: 'hc08' });
  assert.strictEqual(other.state.records.fights[0].rolls.chance, 10);
  assert.strictEqual(other.state.records.fights[0].injuries.winner, null);
  assert.ok(other.state.records.fights[0].playerStr == null);
  const plain = prep('suitor');
  plain.s.cat.perks = ['right_of_challenge'];
  plain.s.cat.displayM = 0;
  const low = JSON.parse(JSON.stringify(plain.s));
  low.cat.standingM = 0;
  const strength = E.act(low, { type: 'challenge', catId: 'hc08' });
  const boosted = E.act(plain.s, { type: 'challenge', catId: 'hc08' });
  const ratio = boosted.state.records.fights[0].playerStr / strength.state.records.fights[0].playerStr;
  assert.ok(Math.abs(ratio - 1.1) < 1e-9);
  const none = E.newRun({ mainCat: female, seed: 9, runId: 'no-rival' });
  none.cat.perks = ['right_of_challenge'];
  none.region = 'highcrag';
  none.records.willingness.hc04 = { accepted: true, pride: 'highcrag', day: 1 };
  none.records.approval.highcrag = { approved: true, day: 1 };
  for (const row of Object.values(none.records.catToCat)) if (row && row.value >= 15) row.value = 14;
  assert.deepStrictEqual(E.available(none).challenge, []);
  assert.strictEqual(E.act(none, { type: 'challenge', catId: 'hc04' }).error, 'challenge.none');
  const locked = E.newRun({ mainCat: female, seed: 9, runId: 'no-approval' });
  locked.cat.perks = ['right_of_challenge'];
  locked.region = 'highcrag';
  locked.records.willingness.hc08 = { accepted: true, pride: 'highcrag', day: 1 };
  assert.strictEqual(E.act(locked, { type: 'challenge', catId: 'hc08' }).error, 'court.locked');
});

test('a tallgrass Bonefield route mates an unpaired cat and does not use the leader’s mate', () => {
  const E = mk();
  const W = E.W;
  const started = E.newRun({ mainCat: male, seed: 18, runId: 'bf-18' });
  assert.strictEqual(started.npcs.bf04.mateId, 'bf01');
  assert.ok(started.npcs.bf06.mateId == null);
  assert.strictEqual(started.records.cats.bf06.skills, null);
  let s = started;
  let target = null;
  const ledger = [];
  function leave(state) {
    if (state.phase === 'encounter') {
      const v = E.encounterView(state);
      if (!v || v.terminal) return { type: 'continue' };
      const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
      const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
      return { type: 'encounterChoose', choiceId: c.id };
    }
    if (state.phase === 'ford') return state.ford && state.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' };
    if (state.phase === 'border') {
      const v = E.world.borderView(state);
      if (!v || !v.choices || !v.choices.length) return { type: 'continue' };
      const c = v.choices.find((x) => x.id === 'withdraw' || x.id === 'leave_request') || v.choices[0];
      return { type: 'borderChoose', choiceId: c.id };
    }
    if (state.phase === 'conversation') {
      const view = E.talkView(state);
      if (!view || view.terminal) return { type: 'continue' };
      const row = (view.choices || []).find((c) => !c.disabled && (c.id === 'leave' || c.id === 'pause' || c.pause));
      return row ? { type: 'choose', choiceId: row.id, nodeId: view.nodeId, instanceId: view.instanceId } : { type: 'continue' };
    }
    return null;
  }
  function act(state, action) {
    const r = E.act(state, action);
    if (r.error) throw new Error(r.error);
    return r.state;
  }
  function compat(state, n) {
    const kind = state.records.attraction[n.id];
    if (kind === 'either') return true;
    if (kind === 'same') return state.cat.sex === n.sex;
    return state.cat.sex !== n.sex;
  }
  function toward(state, dest) {
    if (state.region === dest) return null;
    const prev = new Map(); const seen = new Set([dest]); const queue = [dest];
    while (queue.length) {
      const cur = queue.shift();
      for (const next of W.neighbours(cur)) {
        if (seen.has(next)) continue;
        seen.add(next); prev.set(next, cur);
        if (next === state.region) return prev.get(state.region);
        queue.push(next);
      }
    }
    return null;
  }
  let audience = null; let mated = null;
  for (let i = 0; i < 900 && !s.over && !(s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown && s.records.pride); i++) {
    const special = leave(s);
    if (special) { s = act(s, special); continue; }
    if (s.phase === 'event' && s.pending && s.pending.bond) {
      const prefer = ['found_here', 'acknowledge', 'court', 'open_close', 'open_acquainted', 'talk_warm', 'continue', 'route_alone'];
      const choice = prefer.map((id) => (s.pending.choices || []).find((c) => c.id === id && !c.disabled)).find(Boolean)
        || (s.pending.choices || []).find((c) => !c.disabled);
      s = act(s, choice ? { type: 'choose', choiceId: choice.id } : { type: 'continue' });
      continue;
    }
    if (s.phase === 'event') {
      const e = E.eventById(s.pending.eventId);
      const improve = e && e.choices.find((c) => c.affinityIntent === 'improve');
      const pass = e && e.choices.find((c) => ['pass', 'withdraw', 'leave'].includes(c.id));
      s = act(s, { type: 'choose', choiceId: (improve || pass || e.choices[0]).id });
      continue;
    }
    if (s.phase === 'eventResult') { s = act(s, { type: 'continue' }); continue; }
    if (s.phase !== 'day') break;
    target = Object.values(s.npcs).find((n) => !n.mateId && n.met && n.faction === 'bonefield' && (n.stage === 'adult' || n.stage === 'elder') && compat(s, n) && !n.dead) || target;
    const av = E.available(s);
    const water = W.hasWater(s.region, 'spring');
    const home = s.region === 'tallgrass' || s.region === 'bonefield';
    let action = { type: 'rest' };
    if (av.forced) action = { type: 'forced' };
    else if (s.needs.thirst <= 40 && !water) {
      const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && t.to === 'tallgrass')
        || (av.travel || []).find((t) => t.allowed && t.days === 1 && W.hasWater(t.to, 'spring'));
      const hop = !to && toward(s, 'tallgrass');
      if (to) action = { type: 'travel', to: to.to };
      else if (hop && (av.travel || []).some((t) => t.allowed && t.to === hop)) action = { type: 'travel', to: hop };
    } else if (s.records.matePair && !s.records.pride && av.found && av.found.allowed) action = { type: 'found', name: av.found.name };
    else if (s.records.matePair && !s.records.pride && s.region !== 'split_rock') {
      const hop = toward(s, 'split_rock');
      if (hop && (av.travel || []).some((t) => t.allowed && t.to === hop)) action = { type: 'travel', to: hop };
    } else if (!s.records.matePair && !home) {
      const hop = toward(s, 'tallgrass');
      if (hop && (av.travel || []).some((t) => t.allowed && t.to === hop)) action = { type: 'travel', to: hop };
    } else if (s.needs.hunger < 50 && av.hunt && av.hunt.allowed) action = { type: 'hunt', size: 'small' };
    else if (target && (av.audience || []).some((row) => row.catId === target.id && row.allowed)) action = { type: 'askLeader', catId: target.id };
    else if (target && s.needs.energy >= 8 && s.day <= 20) {
      const court = (av.court || []).find((row) => row.catId === target.id && row.allowed);
      const seek = (av.seekMate || []).find((row) => row.catId === target.id && row.allowed);
      if (court) action = { type: 'court', catId: target.id };
      else if (seek) action = { type: 'seekMate', catId: target.id };
    } else if (av.hunt && av.hunt.allowed && s.needs.hunger < 70) action = { type: 'hunt', size: 'small' };
    ledger.push({ day: s.day, region: s.region, action: action.type, to: action.to || null, hunger: s.needs.hunger, thirst: s.needs.thirst });
    s = act(s, action);
    if (!audience && s.records.approval.bonefield) audience = JSON.parse(JSON.stringify(s));
    if (!mated && s.records.matePair) mated = JSON.parse(JSON.stringify(s));
  }
  assert.strictEqual(s.records.matePair.mateId, 'bf06');
  assert.notStrictEqual(s.records.matePair.mateId, 'bf04');
  assert.strictEqual(s.records.departure.from, 'bonefield');
  assert.ok(s.day >= 21 && s.records.seasonEndShown && !s.over);
  assert.ok(ledger.some((row) => row.region === 'tallgrass' || row.to === 'tallgrass'));
  assert.ok(audience && audience.records.approval.bonefield.approved);
  const loadedAudience = E.migrate(JSON.parse(JSON.stringify(audience)));
  assert.strictEqual(loadedAudience.records.approval.bonefield.approved, true);
  assert.deepStrictEqual(loadedAudience.records.matePair, audience.records.matePair);
  const loadedMated = E.migrate(mated);
  assert.strictEqual(loadedMated.records.matePair.mateId, 'bf06');
  const loadedEnd = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(loadedEnd.records.members.length, 2);
  assert.strictEqual(loadedEnd.npcs.bf06.portraitId, started.npcs.bf06.portraitId);
  assert.deepStrictEqual(loadedEnd.npcs.bf06.personality, started.npcs.bf06.personality);
  console.log('BONEFIELD', JSON.stringify({ seed: 18, sex: 'male', mate: 'bf06', day: s.day, rows: ledger.filter((row) => ['travel', 'court', 'seekMate', 'found', 'askLeader'].includes(row.action)) }));
});
