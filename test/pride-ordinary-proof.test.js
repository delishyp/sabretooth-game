// Proof only. Does not change courtship, approval, rival, or presentation rules.
// Mistwood seeds below are ordinary legal play. Bonefield is reported as blocked.
const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const map = j('map.json'); const rules = j('slice-rules.json'); const slots = j('world-slots.json');
const nameData = j('names/names.json');
const events = j('events/slice-1.json');
const looks = { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] };
const encounters = j('events/encounters-v0.2.json');
const graph = j('events/recurring-conversation.json');
const border = j('events/faction-proof-reconciled.json');
const firstSeason = j('events/first-season-v0.6.2.json');
const mk = () => Slice.create({
  map, rules, events, slots, nameData, looks, encounters, conversation: graph, borderPolicy: border, firstSeason
});
const LEADER = { bonefield: 'bf01', mistwood: 'mw01' };
const HOME = { bonefield: 'bonefield', mistwood: 'mistwood' };

function playerOf(sex) {
  return { catId: sex === 'female' ? 'c1' : 'c2', name: 'Tester', sex, lifeStage: 'adult', genes: {} };
}
function leave(E, s) {
  if (s.phase === 'encounter') {
    const v = E.encounterView(s);
    if (!v || v.terminal) return { type: 'continue' };
    const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
    const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
    return { type: 'encounterChoose', choiceId: c.id };
  }
  if (s.phase === 'ford') return s.ford && s.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' };
  if (s.phase === 'border') {
    const v = E.world.borderView(s);
    if (!v || !v.choices || !v.choices.length) return { type: 'continue' };
    const c = v.choices.find((x) => x.id === 'withdraw' || x.id === 'leave_request') || v.choices[0];
    return { type: 'borderChoose', choiceId: c.id };
  }
  if (s.phase === 'conversation') {
    const view = E.talkView(s);
    if (!view || view.terminal) return { type: 'continue' };
    const row = (view.choices || []).find((c) => !c.disabled && (c.id === 'leave' || c.id === 'pause' || c.pause));
    return row ? { type: 'choose', choiceId: row.id, nodeId: view.nodeId, instanceId: view.instanceId } : { type: 'continue' };
  }
  return null;
}
function act(E, s, action) {
  const r = E.act(s, action);
  if (r.error) throw new Error(`${r.error} day ${s.day} ${s.phase} ${JSON.stringify(action)}`);
  return r.state;
}
function compatible(s, n) {
  const kind = s.records.attraction[n.id];
  if (kind === 'either') return true;
  if (kind === 'same') return s.cat.sex === n.sex;
  if (kind === 'opposite') return s.cat.sex !== n.sex;
  return false;
}
function pick(s, faction) {
  return Object.values(s.npcs).find((n) => n.id !== LEADER[faction] && n.met && n.faction === faction && (n.stage === 'adult' || n.stage === 'elder') && compatible(s, n) && !n.dead);
}
function toward(E, s, dest) {
  if (s.region === dest) return null;
  const prev = new Map(); const seen = new Set([dest]); const queue = [dest];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of E.W.neighbours(cur)) {
      if (seen.has(next)) continue;
      seen.add(next); prev.set(next, cur);
      if (next === s.region) return { type: 'travel', to: prev.get(s.region) };
      queue.push(next);
    }
  }
  return null;
}
function play(E, seed, faction, sex) {
  const player = playerOf(sex);
  let s = E.newRun({ mainCat: player, seed, runId: `proof-${faction}-${seed}-${sex}` });
  const started = {};
  for (const n of Object.values(s.npcs)) started[n.id] = { sex: n.sex, portrait: n.portraitId, traits: n.personality, name: n.name };
  let target = null; let best = 0; let heldReject = null;
  const ledger = []; const snaps = {};
  const home = HOME[faction];
  const note = (label) => { if (!snaps[label]) snaps[label] = JSON.parse(JSON.stringify(s)); };
  for (let i = 0; i < 700 && !s.over && !(s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown && s.records.pride); i++) {
    const special = leave(E, s);
    if (special) { s = act(E, s, special); continue; }
    if (s.phase === 'event' && s.pending && s.pending.bond) {
      const prefer = ['found_here', 'acknowledge', 'court', 'open_close', 'open_acquainted', 'talk_warm', 'continue', 'route_alone'];
      const choice = prefer.map((id) => (s.pending.choices || []).find((c) => c.id === id && !c.disabled)).find(Boolean)
        || (s.pending.choices || []).find((c) => !c.disabled);
      s = act(E, s, choice ? { type: 'choose', choiceId: choice.id } : { type: 'continue' });
    } else if (s.phase === 'event') {
      const e = E.eventById(s.pending.eventId);
      const improve = e && e.choices.find((c) => c.affinityIntent === 'improve');
      s = act(E, s, { type: 'choose', choiceId: (improve || e.choices[0]).id });
    } else if (s.phase === 'eventResult') s = act(E, s, { type: 'continue' });
    else if (s.phase === 'day') {
      target = pick(s, faction) || target;
      if (target) best = Math.max(best, s.npcs[target.id].affinity);
      const av = E.available(s);
      const water = (id) => E.W.hasWater(id, 'spring');
      let action = { type: 'rest' };
      if (av.forced) action = { type: 'forced' };
      else if (s.needs.thirst < 25 && !water(s.region)) {
        const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && water(t.to));
        if (to) action = { type: 'travel', to: to.to };
      } else if (s.records.matePair && !s.records.pride && av.found && av.found.allowed) action = { type: 'found', name: av.found.name };
      else if (s.records.matePair && !s.records.pride && s.region !== 'split_rock') {
        const hop = toward(E, s, 'split_rock');
        if (hop && (av.travel || []).some((t) => t.allowed && t.to === hop.to)) action = hop;
      } else if (!s.records.matePair && s.region !== home && s.needs.thirst >= 25) {
        const hop = toward(E, s, home);
        if (hop && (av.travel || []).some((t) => t.allowed && t.to === hop.to)) action = hop;
      } else if (target && (av.audience || []).some((row) => row.catId === target.id && row.allowed)) action = { type: 'askLeader', catId: target.id };
      else if (target && s.needs.energy >= 5) {
        const court = (av.court || []).find((row) => row.catId === target.id && row.allowed);
        const seek = (av.seekMate || []).find((row) => row.catId === target.id && row.allowed);
        if (court && s.day <= 20) action = { type: 'court', catId: target.id };
        else if (seek && s.needs.hunger > 20) action = { type: 'seekMate', catId: target.id };
        else if (s.needs.hunger < 60 && av.hunt && av.hunt.allowed) action = { type: 'hunt', size: 'small' };
      } else if (s.needs.hunger < 60 && av.hunt && av.hunt.allowed) action = { type: 'hunt', size: 'small' };
      ledger.push({ day: s.day, region: s.region, action: action.type, to: action.to || null, hunger: s.needs.hunger, thirst: s.needs.thirst, energy: s.needs.energy });
      if (s.records.matePair && !s.records.pride && s.region === home && !heldReject) {
        const probe = E.act(JSON.parse(JSON.stringify(s)), { type: 'found', name: 'Probe' });
        heldReject = { error: probe.error, faction: probe.state.npcs[s.records.matePair.mateId].faction, members: probe.state.records.members.length };
      }
      s = act(E, s, action);
    } else break;
    const mateId = target && target.id;
    if (mateId && s.records.willingness[mateId] && !s.records.matePair) note('willingness');
    if (s.records.approval[faction] && s.records.approval[faction].approved && !s.records.matePair) note('approved');
    if (s.records.matePair && !s.records.departure) note('mated');
    if (s.records.departure && s.records.pride) note('founded');
    if (s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown) note('day21');
  }
  const ap = s.records.approval[faction];
  return {
    s, started, ledger, snaps, heldReject, best, target: target && target.id,
    dead: s.dead && s.dead.cause, approved: ap ? ap.approved : null
  };
}

test('presentation pin still separates Mates from unknown attraction and hides an empty romance line', () => {
  const current = fs.readFileSync(path.join(__dirname, '../src/renderer/js/game-screen.js'), 'utf8');
  const pinned = execSync('git show b054b87:src/renderer/js/game-screen.js', { encoding: 'utf8' });
  const lines = (src) => src.split('\n').filter((line) => /relation-mates|relation-romance|relation-attraction|Bond · /.test(line)).join('\n');
  assert.strictEqual(lines(current), lines(pinned));
  assert.match(current, /relation-mates', 'Mates'/);
  assert.match(current, /relation-attraction', 'Attraction · Unknown'/);
  assert.match(current, /else if \(!mates\)[\s\S]*Romance · Unknown/);
  assert.match(current, /Bond · /);
});

test('ordinary Mistwood play reaches mates, departure, wild founding, and day 21 twice', () => {
  const E = mk();
  const cases = [{ seed: 2, sex: 'female', mate: 'mw03' }, { seed: 34, sex: 'male', mate: 'mw05' }];
  for (const item of cases) {
    const played = play(E, item.seed, 'mistwood', item.sex);
    const s = played.s;
    assert.strictEqual(s.records.matePair && s.records.matePair.mateId, item.mate, `${item.seed} ${item.sex}`);
    assert.strictEqual(s.records.departure.from, 'mistwood');
    assert.strictEqual(s.records.departure.fromName, 'Mistwood');
    assert.strictEqual(s.records.pride.territory.claim, 60);
    assert.strictEqual(s.records.pride.territory.size, 60);
    assert.strictEqual(E.W.ownership(s.map.claims, s.records.pride.denRegionId).state, 'held');
    assert.notStrictEqual(s.records.pride.denRegionId, 'mistwood');
    assert.ok(s.day >= 21 && s.records.seasonEndShown && !s.over);
    const mate = s.npcs[item.mate];
    assert.strictEqual(mate.sex, played.started[item.mate].sex);
    assert.strictEqual(mate.name, played.started[item.mate].name);
    assert.strictEqual(mate.portraitId, played.started[item.mate].portrait);
    assert.deepStrictEqual(mate.personality, played.started[item.mate].traits);
    assert.strictEqual(s.records.cats[item.mate].skills, null);
    assert.strictEqual(Object.values(s.npcs).filter((n) => n.id === item.mate).length, 1);
    assert.deepStrictEqual(s.records.members.map((row) => row.catId).sort(), [s.cat.catId, item.mate].sort());
    assert.deepStrictEqual(s.records.departure.witnesses, [s.cat.catId, item.mate]);
    assert.ok(!s.records.departure.witnesses.includes('mw01'));
    const bond = s.worldMemory.ledger.filter((row) => row.sourceType === 'pride_bond' && row.actor === 'mistwood');
    assert.strictEqual(bond.length, 1);
    assert.strictEqual(bond[0].delta, 20);
    assert.strictEqual(new Set(s.records.receipts).size, s.records.receipts.length);
    const historyKeys = s.records.history.map((row) => row.receiptKey).filter(Boolean);
    assert.strictEqual(new Set(historyKeys).size, historyKeys.length);
    assert.strictEqual(played.heldReject && played.heldReject.error, 'found.notWild');
    assert.strictEqual(played.heldReject.faction, 'mistwood');
    assert.strictEqual(played.heldReject.members, 0);
    for (const label of ['willingness', 'approved', 'mated', 'founded', 'day21']) {
      const snap = played.snaps[label];
      assert.ok(snap, `${item.seed} missing ${label}`);
      const loaded = E.migrate(JSON.parse(JSON.stringify(snap)));
      assert.strictEqual(JSON.stringify(loaded.records.matePair), JSON.stringify(snap.records.matePair));
      assert.strictEqual(JSON.stringify(loaded.records.departure || null), JSON.stringify(snap.records.departure || null));
      assert.strictEqual(loaded.records.receipts.length, snap.records.receipts.length);
      assert.strictEqual(loaded.npcs[item.mate].portraitId, snap.npcs[item.mate].portraitId);
      assert.deepStrictEqual(loaded.npcs[item.mate].personality, snap.npcs[item.mate].personality);
      const again = E.migrate(JSON.parse(JSON.stringify(loaded)));
      assert.strictEqual(again.records.receipts.length, loaded.records.receipts.length);
    }
    assert.strictEqual(played.snaps.willingness.records.matePair, null);
    assert.strictEqual(played.snaps.approved.npcs[item.mate].faction, 'mistwood');
    assert.strictEqual(played.snaps.mated.records.departure, undefined);
    assert.ok(played.snaps.founded.records.departure);
    assert.ok(played.ledger.length > 10);
    assert.ok(played.ledger.some((row) => row.action === 'court' && row.day <= 20));
    const keyRows = played.ledger.filter((row) => row.action === 'court' || row.action === 'askLeader' || row.action === 'found' || row.to === 'mistwood' || row.to === 'split_rock');
    const fresh = E.newRun({ mainCat: playerOf(item.sex), seed: item.seed, runId: `qual-${item.seed}` });
    const qualified = Object.values(fresh.npcs).filter((n) => n.faction === 'mistwood' && n.sex === item.sex && (n.stage === 'adult' || n.stage === 'elder') && n.id !== item.mate && ((fresh.records.catToCat[[n.id, item.mate].sort().join('|')] || {}).value >= 15));
    const fought = s.records.fights.find((row) => row.catId === item.mate);
    if (qualified.length) {
      assert.ok(fought, `${item.seed} had a seeded rival and no challenge`);
      assert.strictEqual(fought.deathRoll, false);
      assert.ok(qualified.some((n) => n.id === fought.rivalId));
    } else assert.ok(!fought, `${item.seed} fought without a qualifying adult`);
    console.log('MISTWOOD', JSON.stringify({ seed: item.seed, sex: item.sex, mate: item.mate, day: s.day, receipts: s.records.receipts.length, fights: s.records.fights.length, rows: keyRows }));
  }
});

test('ordinary Bonefield play does not finish a mate inside the court window', () => {
  const E = mk();
  const region = map.regions.find((row) => row.id === 'bonefield');
  assert.strictEqual(region.water, 'none');
  const ford = map.regions.find((row) => row.id === 'greywater_ford');
  assert.ok(E.W.neighbours('bonefield').includes('greywater_ford'));
  assert.strictEqual(ford.water, 'river');
  assert.notStrictEqual(E.W.ownership(E.W.initClaims(), 'greywater_ford').state, 'wild');
  assert.strictEqual(rules.seasonDays, 20);
  let completions = 0; let metCompatible = 0; let best = { aff: -1 };
  const deaths = {};
  for (let seed = 1; seed <= 20; seed++) {
    for (const sex of ['female', 'male']) {
      const played = play(E, seed, 'bonefield', sex);
      const s = played.s;
      if (played.target) metCompatible += 1;
      if ((played.best || 0) > best.aff) best = { seed, sex, aff: played.best, target: played.target, day: s.day, dead: played.dead, approved: played.approved };
      if (s.records.matePair && s.records.departure && s.records.departure.from === 'bonefield' && s.records.pride && s.day >= 21) completions += 1;
      deaths[played.dead || 'alive'] = (deaths[played.dead || 'alive'] || 0) + 1;
    }
  }
  assert.strictEqual(completions, 0);
  assert.ok(metCompatible > 0, 'the sample never met a compatible Bonefield adult');
  assert.ok(best.aff < 25 || best.day > 20 || best.dead, JSON.stringify(best));
  console.log('BONEFIELD BLOCK', JSON.stringify({ sample: '20 seeds x 2 sexes', metCompatible, completions, best, deaths, water: 'none', drink: 'greywater_ford contested', courtThroughDay: 20 }));
});
