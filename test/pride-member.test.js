// Pride-member courtship. Ordinary play is unlabeled. FIXTURE blocks set state on purpose.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Speech = require('../src/renderer/js/speech');
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
  map, rules, events, slots, nameData, looks, encounters,
  conversation: graph, borderPolicy: border, firstSeason
});
const female = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const male = { catId: 'c2', name: 'Tester', sex: 'male', lifeStage: 'adult', genes: {} };
const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
const HOME = { highcrag: 'highcrag', bonefield: 'bonefield', mistwood: 'mistwood' };

function leaveSpecial(E, s) {
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
    const leave = (view.choices || []).find((c) => !c.disabled && (c.id === 'leave' || c.id === 'pause' || c.pause));
    return leave ? { type: 'choose', choiceId: leave.id, nodeId: view.nodeId, instanceId: view.instanceId } : { type: 'continue' };
  }
  return null;
}
function actOk(E, s, action) {
  const r = E.act(s, action);
  if (r.error) throw new Error(`${r.error} day ${s.day} ${s.phase} ${JSON.stringify(action)}`);
  return r.state;
}
function compatible(s, npc) {
  const kind = s.records.attraction[npc.id];
  if (kind === 'either') return true;
  if (kind === 'same') return s.cat.sex === npc.sex;
  if (kind === 'opposite') return s.cat.sex !== npc.sex;
  return false;
}
function pickTarget(s, faction) {
  const leader = { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' }[faction];
  return Object.values(s.npcs).find((n) => n.id !== leader && n.met && n.faction === faction && (n.stage === 'adult' || n.stage === 'elder') && compatible(s, n) && !n.dead);
}
function stepToward(E, s, dest) {
  if (s.region === dest) return null;
  const prev = new Map();
  const seen = new Set([dest]);
  const queue = [dest];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of E.W.neighbours(cur)) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === s.region) {
        const hop = prev.get(s.region);
        return hop ? { type: 'travel', to: hop } : null;
      }
      queue.push(next);
    }
  }
  return null;
}

function playPride(E, seed, faction, player) {
  let s = E.newRun({ mainCat: player, seed, runId: `pride-${faction}-${seed}` });
  const started = {
    ids: Object.keys(s.npcs).slice(),
    sex: Object.fromEntries(Object.values(s.npcs).map((n) => [n.id, n.sex])),
    traits: Object.fromEntries(Object.values(s.npcs).map((n) => [n.id, n.personality])),
    portraits: Object.fromEntries(Object.values(s.npcs).map((n) => [n.id, n.portraitId]))
  };
  let target = null;
  const home = HOME[faction];
  for (let i = 0; i < 900 && !s.over && !(s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown && s.records.pride); i++) {
    const special = leaveSpecial(E, s);
    if (special) { s = actOk(E, s, special); continue; }
    if (s.phase === 'event' && s.pending && s.pending.bond) {
      const prefer = ['found_here', 'acknowledge', 'court', 'open_close', 'open_acquainted', 'talk_warm', 'continue', 'route_alone'];
      const choice = prefer.map((id) => (s.pending.choices || []).find((c) => c.id === id && !c.disabled)).find(Boolean)
        || (s.pending.choices || []).find((c) => !c.disabled);
      if (!choice) { s = actOk(E, s, { type: 'continue' }); continue; }
      s = actOk(E, s, { type: 'choose', choiceId: choice.id });
      continue;
    }
    if (s.phase === 'event') {
      const e = E.eventById(s.pending.eventId);
      const improve = e && e.choices.find((c) => c.affinityIntent === 'improve');
      const pass = e && e.choices.find((c) => c.id === 'pass' || c.id === 'withdraw' || c.id === 'leave');
      s = actOk(E, s, { type: 'choose', choiceId: (improve || pass || e.choices[0]).id });
      continue;
    }
    if (s.phase === 'eventResult') { s = actOk(E, s, { type: 'continue' }); continue; }
    target = pickTarget(s, faction) || target;
    const av = E.available(s);
    const water = (id) => E.W.hasWater(id, s.season);
    let action;
    if (av.forced) action = { type: 'forced' };
    else if (s.needs.thirst < 30 && !water(s.region)) {
      const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && water(t.to));
      action = to ? { type: 'travel', to: to.to } : { type: 'rest' };
    } else if (s.records.matePair && !s.records.pride && av.found && av.found.allowed) action = { type: 'found', name: av.found.name };
    else if (s.records.matePair && !s.records.pride && s.region !== 'split_rock') {
      const back = (av.travel || []).find((t) => t.allowed && t.to === 'split_rock')
        || (av.travel || []).find((t) => t.allowed && E.W.ownership(s.map.claims, t.to).state === 'wild');
      action = back ? { type: 'travel', to: back.to } : { type: 'rest' };
    }     else if (!s.records.matePair && s.region !== home && s.needs.thirst >= 30) {
      const hop = stepToward(E, s, home);
      const allowed = hop && (av.travel || []).find((t) => t.allowed && t.to === hop.to);
      action = allowed ? hop : { type: 'rest' };
    } else if (target && (av.audience || []).find((row) => row.catId === target.id && row.allowed)) action = { type: 'askLeader', catId: target.id };
    else if (target && s.needs.energy >= 5 && s.needs.hunger > 15) {
      const court = (av.court || []).find((row) => row.catId === target.id && row.allowed);
      const seek = (av.seekMate || []).find((row) => row.catId === target.id && row.allowed);
      if (court) action = { type: 'court', catId: target.id };
      else if (seek && !s.records.matePair) action = { type: 'seekMate', catId: target.id };
      else if (s.needs.hunger < 40 && av.hunt && av.hunt.allowed) action = { type: 'hunt', size: 'small' };
      else action = { type: 'rest' };
    } else if (s.needs.hunger < 40 && av.hunt && av.hunt.allowed) action = { type: 'hunt', size: 'small' };
    else action = { type: 'rest' };
    s = actOk(E, s, action);
  }
  return { s, target, started, seed, faction };
}

test('the three pride contracts stay distinct and the known gaps are explicit', () => {
  const E = mk();
  const Pair = require('../src/renderer/js/pairing').create(firstSeason, rules);
  assert.deepStrictEqual(Pair.gaps.map((g) => g.id), ['mistwood-range-held-land', 'showdown-skill-text', 'premade-milestones-unstored']);
  const s = E.newRun({ mainCat: female, seed: 2, runId: 'gaps' });
  assert.ok(Object.keys(s.records.catToCat).length > 0);
  assert.deepStrictEqual(s.records.gaps, Pair.gaps.map((g) => g.id));
  for (const pride of PRIDES) {
    const leader = s.npcs[Pair.leaders[pride]];
    assert.strictEqual(leader.faction, pride);
    assert.ok(leader.personality && Number.isInteger(leader.personality.sociability));
  }
  const texts = {};
  for (const pride of PRIDES) {
    const leader = s.npcs[Pair.leaders[pride]];
    const line = Speech.resolve(firstSeason.personalityContract && { speechLocations: Object.fromEntries((firstSeason.personalityContract.speechCoverage || []).map((row) => [row.speechId, { focusTrait: row.focusTrait, low: row.low, base: row.baseline, high: row.high, context: row.familyId }])), contextActions: {} }, 'm2.leader_approval|beats.1', leader.personality, { catName: 'C', leaderName: leader.name });
    texts[pride] = `${leader.name}:${line.text}`;
    assert.ok(line.text);
    assert.notStrictEqual(line.characterization, 'unresolved');
  }
  assert.strictEqual(new Set(Object.values(texts).map((row) => row.split(':')[0])).size, 3);
});

test('fresh approval points differ by pride and do not invent Mistwood seasons', () => {
  const E = mk();
  const expected = { highcrag: 20, bonefield: 25, mistwood: 30 };
  for (const pride of PRIDES) {
    const s = E.newRun({ mainCat: female, seed: 5, runId: `pts-${pride}` });
    const cat = Object.values(s.npcs).find((n) => n.faction === pride && n.stage === 'adult' && n.id !== { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' }[pride]);
    s.records.willingness[cat.id] = { accepted: true, pride, day: s.day };
    s.region = HOME[pride];
    const r = E.act(s, { type: 'askLeader', catId: cat.id });
    assert.ok(!r.error, r.error);
    const scored = r.state.records.approval[pride].scored;
    assert.strictEqual(scored.points, expected[pride]);
    if (pride === 'mistwood') {
      assert.strictEqual(scored.mistwoodRangeSeasons, 0);
      assert.strictEqual(scored.mistwoodTerm, 0);
    }
    assert.strictEqual(r.state.records.matePair, null);
    assert.strictEqual(r.state.npcs[cat.id].faction, pride);
    const audience = r.state.records.audience[0];
    assert.deepStrictEqual(audience.witnesses.sort(), [cat.id, r.state.cat.catId, { highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' }[pride]].sort());
  }
});

test('FIXTURE: approval refusal and a held-land Found leave the old membership in place', () => {
  const E = mk();
  let refused = null;
  for (let seed = 1; seed < 40 && !refused; seed++) {
    const s = E.newRun({ mainCat: female, seed, runId: `no-${seed}` });
    const cat = s.npcs.hc02;
    s.records.willingness.hc02 = { accepted: true, pride: 'highcrag', day: 1 };
    s.region = 'highcrag';
    s.prideRelation.highcrag = -80;
    const r = E.act(s, { type: 'askLeader', catId: 'hc02' });
    if (!r.error && r.state.records.approval.highcrag && !r.state.records.approval.highcrag.approved) refused = { before: cat.faction, state: r.state };
  }
  assert.ok(refused, 'no refusal in the fixture seeds');
  assert.strictEqual(refused.state.npcs.hc02.faction, 'highcrag');
  assert.strictEqual(refused.state.records.matePair, null);
  assert.strictEqual(refused.state.records.members.length, 0);
  assert.strictEqual(refused.state.prideRelation.highcrag, -85);
  assert.strictEqual(refused.state.records.departure, undefined);
  let back = refused.state;
  if (back.phase !== 'day') back = E.act(back, { type: 'continue' }).state;
  const again = E.act(back, { type: 'askLeader', catId: 'hc02' });
  assert.strictEqual(again.error, 'duplicate');
  assert.strictEqual(again.state.prideRelation.highcrag, -85);
  const held = E.newRun({ mainCat: female, seed: 3, runId: 'held-pride' });
  held.records.matePair = { id: 'pair-h', playerId: held.cat.catId, mateId: 'hc02', playerSex: 'female', mateSex: held.npcs.hc02.sex, bondedDay: 4, foundingDay: null };
  held.region = 'highcrag';
  const snap = JSON.stringify(held);
  const founded = E.act(JSON.parse(snap), { type: 'found', name: 'Nowhere' });
  assert.strictEqual(founded.error, 'found.notWild');
  assert.strictEqual(founded.state.npcs.hc02.faction, 'highcrag');
  assert.strictEqual(founded.state.records.pride, null);
});

test('FIXTURE: a stored cat-to-cat edge can start a rival challenge; a missing edge cannot', () => {
  const E = mk();
  const plain = E.newRun({ mainCat: male, seed: 6, runId: 'no-edge' });
  const cat = Object.values(plain.npcs).find((n) => n.faction === 'bonefield' && n.stage === 'adult' && n.sex !== 'male' && n.id !== 'bf01');
  plain.records.willingness[cat.id] = { accepted: true, pride: 'bonefield', day: 1 };
  plain.region = 'bonefield';
  plain.prideRelation.bonefield = 80;
  cat.affinity = 80;
  for (const row of Object.values(plain.records.catToCat)) if (row && typeof row.value === 'number' && row.value >= 15) row.value = 14;
  const noEdge = E.act(plain, { type: 'askLeader', catId: cat.id });
  assert.ok(!noEdge.error);
  if (noEdge.state.records.approval.bonefield.approved) {
    const pending = noEdge.state.pending;
    const chained = pending && pending.next;
    assert.ok(!chained || chained.eventId !== 'm2.mate_rival');
    assert.strictEqual(noEdge.state.records.fights.length, 0);
  }
  let fought = null;
  for (let seed = 1; seed < 25 && !fought; seed++) {
    const s = E.newRun({ mainCat: male, seed, runId: `edge-${seed}` });
    const target = Object.values(s.npcs).find((n) => n.faction === 'mistwood' && n.stage === 'adult' && n.sex === 'female' && n.id !== 'mw01');
    const rival = Object.values(s.npcs).find((n) => n.faction === 'mistwood' && n.stage === 'adult' && n.sex === 'male' && n.id !== target.id && (s.records.catToCat[[n.id, target.id].sort().join('|')] || {}).value >= 15);
    if (!rival) continue;
    s.records.willingness[target.id] = { accepted: true, pride: 'mistwood', day: 1 };
    target.affinity = 80;
    s.prideRelation.mistwood = 80;
    s.region = 'mistwood';
    const r = E.act(s, { type: 'askLeader', catId: target.id });
    if (r.error || !r.state.records.approval.mistwood.approved) continue;
    let cur = r.state;
    for (let n = 0; n < 4 && cur.phase !== 'day'; n++) {
      if (cur.pending && cur.pending.eventId === 'm2.mate_rival') { fought = { cur, rival, target }; break; }
      if (cur.phase === 'eventResult') cur = E.act(cur, { type: 'continue' }).state;
      else if (cur.phase === 'event' && cur.pending && cur.pending.bond) {
        const choice = (cur.pending.choices || []).find((c) => !c.disabled);
        cur = E.act(cur, { type: 'choose', choiceId: choice.id }).state;
      } else break;
    }
    if (fought) fought.cur = cur.pending && cur.pending.eventId === 'm2.mate_rival' ? cur : fought.cur;
  }
  assert.ok(fought, 'approved audience with an edge did not reach the rival');
  assert.strictEqual(fought.cur.npcs[fought.target.id].faction, 'mistwood');
  assert.strictEqual(fought.cur.records.matePair, null);
  assert.ok(fought.cur.records.fights.length >= 1);
  assert.strictEqual(fought.cur.records.fights[0].lethal, false);
});

test('ordinary play can take one pride cat from consent through departure, founding, and day 21', () => {
  const E = mk();
  let win = null;
  const notes = [];
  for (const faction of PRIDES) {
    for (let seed = 1; seed <= 24 && !win; seed++) {
      const player = seed % 2 ? female : male;
      try {
        const played = playPride(E, seed, faction, player);
        const s = played.s;
        const ok = s.records.matePair && s.records.pride && s.day >= 21 && !s.over && s.records.departure;
        notes.push(`${faction}:${seed}:${played.target && played.target.id}:${s.day}:${ok ? 'yes' : 'no'}`);
        if (ok && s.records.departure.from === faction) win = played;
      } catch (e) { notes.push(`${faction}:${seed}:err:${e.message}`); }
    }
  }
  assert.ok(win, `no ordinary pride path\n${notes.join('\n')}`);
  const s = win.s;
  const mate = s.npcs[s.records.matePair.mateId];
  assert.strictEqual(mate.id, s.records.matePair.mateId);
  assert.strictEqual(mate.sex, win.started.sex[mate.id]);
  assert.deepStrictEqual(mate.personality, win.started.traits[mate.id]);
  assert.strictEqual(mate.portraitId, win.started.portraits[mate.id]);
  assert.strictEqual(s.records.cats[mate.id].skills, null);
  assert.strictEqual(Object.keys(s.npcs).length, 39);
  assert.strictEqual(Object.values(s.npcs).filter((n) => n.id === mate.id).length, 1);
  assert.strictEqual(s.records.members.length, 2);
  assert.notStrictEqual(mate.faction, s.records.departure.from);
  assert.strictEqual(s.records.departure.fromName, { highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' }[s.records.departure.from]);
  assert.deepStrictEqual(s.records.departure.witnesses, [s.cat.catId, mate.id]);
  assert.ok(!s.records.departure.witnesses.includes({ highcrag: 'hc01', bonefield: 'bf01', mistwood: 'mw01' }[s.records.departure.from]));
  const bondRows = s.worldMemory.ledger.filter((row) => row.sourceType === 'pride_bond' && row.actor === s.records.departure.from);
  assert.strictEqual(bondRows.length, 1);
  assert.strictEqual(bondRows[0].delta, 20);
  assert.strictEqual(s.records.pride.territory.claim, 60);
  assert.strictEqual(s.records.pride.territory.size, 60);
  assert.strictEqual(new Set(s.records.receipts).size, s.records.receipts.length);
  const historyKeys = s.records.history.map((row) => row.receiptKey).filter(Boolean);
  assert.strictEqual(new Set(historyKeys).size, historyKeys.length);
  const reloaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(reloaded.records.members.length, 2);
  assert.strictEqual(reloaded.worldMemory.ledger.filter((row) => row.sourceType === 'pride_bond' && row.actor === s.records.departure.from).length, 1);
  assert.deepStrictEqual(reloaded.npcs[mate.id].personality, mate.personality);
  const second = E.act(reloaded, { type: 'found', name: 'Again' });
  assert.ok(second.error);
  assert.strictEqual(second.state.records.members.length, 2);
  const fresh = E.newRun({ mainCat: s.cat.sex === 'female' ? female : male, seed: win.seed, runId: 'qual-check' });
  const qualified = Object.values(fresh.npcs).filter((n) => n.faction === win.faction && n.sex === fresh.cat.sex && n.id !== mate.id && ((fresh.records.catToCat[[n.id, mate.id].sort().join('|')] || {}).value >= 15));
  if (qualified.length) {
    const fought = s.records.fights.find((row) => row.catId === mate.id);
    assert.ok(fought, 'a seeded qualifier did not produce a challenge');
    assert.strictEqual(fought.deathRoll, false);
    assert.strictEqual(fought.lethal, false);
    assert.ok(qualified.some((n) => n.id === fought.rivalId));
  }
  fs.writeFileSync('/tmp/pride-path.json', JSON.stringify({ seed: s.seed, faction: s.records.departure.from, mateId: mate.id, sex: s.cat.sex, day: s.day, fights: s.records.fights.length }));
  console.log('PRIDE PATH', fs.readFileSync('/tmp/pride-path.json', 'utf8'));
});
