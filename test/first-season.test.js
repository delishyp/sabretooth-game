// First season with the v0.6.2 handoff loaded. Ordinary play is unlabeled.
// Blocks marked FIXTURE set state on purpose and are not acceptance of a played run.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path'); const os = require('os');
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
  map, rules, events, slots, nameData, looks, encounters,
  conversation: graph, borderPolicy: border, firstSeason
});
const cat = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const male = { ...cat, catId: 'c2', name: 'Tester', sex: 'male' };

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
    const leave = (view.choices || []).find((c) => c.id === 'leave' || c.id === 'pause' || c.pause);
    return leave ? { type: 'choose', choiceId: leave.id } : { type: 'continue' };
  }
  return null;
}

function bondChoice(s) {
  const prefer = ['found_here', 'court', 'open_close', 'open_acquainted', 'talk_warm', 'acknowledge', 'continue', 'route_alone', 'route_pride'];
  const choices = s.pending.choices || [];
  for (const id of prefer) {
    const row = choices.find((c) => c.id === id && !c.disabled);
    if (row) return row;
  }
  return choices.find((c) => !c.disabled) || null;
}

function actOk(E, s, action) {
  const r = E.act(s, action);
  if (r.error) {
    const err = new Error(`${r.error} on day ${s.day} phase ${s.phase} action ${JSON.stringify(action)}`);
    err.code = r.error;
    throw err;
  }
  return r.state;
}

/** Legal days at Split Rock: drink, hunt, seek the cat already met. No stat writes. */
function dayAction(E, s, targetId) {
  const av = E.available(s);
  if (av.forced) return { type: 'forced' };
  const water = (id) => E.W.hasWater(id, s.season);
  if ((s.needs.thirst < 30 || (s.needs.thirst < 50 && s.counters.parched)) && !water(s.region)) {
    const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && water(t.to));
    if (to) return { type: 'travel', to: to.to };
  }
  if (targetId && s.region !== 'split_rock' && s.needs.thirst >= 30) {
    const back = (av.travel || []).find((t) => t.allowed && t.to === 'split_rock');
    if (back) return { type: 'travel', to: 'split_rock' };
  }
  if (s.records.matePair && !s.records.pride && av.found && av.found.allowed) return { type: 'found', name: av.found.name };
  if (targetId && s.needs.hunger > 20 && s.needs.energy >= 5) {
    const seek = (av.seekMate || []).find((row) => row.catId === targetId && row.allowed);
    if (seek && !s.records.matePair) return { type: 'seekMate', catId: targetId };
    const court = (av.court || []).find((row) => row.catId === targetId && row.allowed);
    if (court) return { type: 'court', catId: targetId };
  }
  if (s.needs.hunger < 40 && av.hunt && av.hunt.allowed) return { type: 'hunt', size: 'small' };
  return { type: 'rest' };
}

function playSeed(E, seed, player) {
  let s = E.newRun({ mainCat: player || cat, seed, runId: `run-${seed}` });
  const portraits = Object.fromEntries(Object.values(s.npcs).map((n) => [n.id, n.portraitId]));
  const personalities = Object.fromEntries(Object.values(s.npcs).map((n) => [n.id, n.personality]));
  let target = null;
  let declined = 0;
  let courtSnapshot = null;
  for (let i = 0; i < 240 && !s.over && !(s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown); i++) {
    let action;
    const special = leaveSpecial(E, s);
    if (special) action = special;
    else if (s.phase === 'event' && s.pending && s.pending.bond) {
      const choice = bondChoice(s);
      if (!choice) throw new Error('no bond choice');
      if (choice.id === 'court') {
        const before = s.npcs[s.pending.catId].affinity;
        action = { type: 'choose', choiceId: 'court' };
        s = actOk(E, s, action);
        if (s.pending && s.pending.court && !s.pending.court.accept) {
          declined += 1;
          assert.strictEqual(s.records.matePair, null);
          assert.strictEqual(s.npcs[s.pending.catId].affinity, before - 5);
        }
        if (s.pending && s.pending.court) {
          courtSnapshot = JSON.parse(JSON.stringify(s.pending.court));
          const reloaded = E.migrate(JSON.parse(JSON.stringify(s)));
          assert.deepStrictEqual(reloaded.pending.court, courtSnapshot);
          s = reloaded;
        }
        continue;
      }
      action = { type: 'choose', choiceId: choice.id };
    } else if (s.phase === 'event') {
      const e = E.eventById(s.pending.eventId);
      const pass = e && e.choices.find((c) => c.id === 'pass' || c.id === 'withdraw' || c.id === 'leave');
      action = { type: 'choose', choiceId: (pass || e.choices[0]).id };
      if (s.pending.catId && s.npcs[s.pending.catId] && s.npcs[s.pending.catId].faction === 'loner') target = s.pending.catId;
    } else if (s.phase === 'eventResult') action = { type: 'continue' };
    else action = dayAction(E, s, target);
    s = actOk(E, s, action);
  }
  return { s, target, declined, portraits, personalities, courtSnapshot };
}

test('the handoff keeps scene ids and does not invent a year length', () => {
  const ids = firstSeason.families.map((f) => f.id);
  for (const id of ['m2.repeat_meeting', 'm2.acquainted', 'm2.close', 'm2.courtship', 'm2.mates_confirmed', 'm2.pride_founded', 'm2.season_end']) {
    assert.ok(ids.includes(id), id);
  }
  assert.strictEqual(rules.seasonDays, 20);
  assert.ok(!Object.prototype.hasOwnProperty.call(rules, 'yearLengthDays'));
});

test('every premade keeps sex, unknown skills, and no fabricated history', () => {
  const E = mk();
  const s = E.newRun({ mainCat: cat, seed: 3, runId: 'census' });
  assert.strictEqual(Object.keys(s.npcs).length, 39);
  assert.strictEqual(slots.slots.length, 39);
  for (const slot of slots.slots) {
    const npc = s.npcs[slot.slot];
    const row = s.records.cats[slot.slot];
    assert.strictEqual(npc.sex, slot.sex);
    assert.strictEqual(row.sex, slot.sex);
    assert.strictEqual(row.skills, null);
    assert.deepStrictEqual(row.history, []);
    assert.strictEqual(row.historyUnknown, false);
    const gate = E.pairing ? null : null;
    assert.ok(npc.stage === 'cub' || npc.stage === 'adolescent' || npc.stage === 'adult' || npc.stage === 'elder');
    if (npc.stage === 'cub' || npc.stage === 'adolescent') {
      const Pair = require('../src/renderer/js/pairing').create(firstSeason, rules);
      s.records.bonds[npc.id] = { stage: 'close', originPrideId: null };
      assert.strictEqual(Pair.courtGate(s, npc).code, 'court.ineligible.young');
    }
  }
  assert.strictEqual(s.records.yearLengthDays, null);
  assert.ok(!s.pregnancy && !s.cubs);
  assert.strictEqual(s.cat.sex, 'female');
});

test('same-sex attraction is not a season-1 ban', () => {
  const E = mk();
  const s = E.newRun({ mainCat: cat, seed: 4, runId: 'sex' });
  const female = Object.values(s.npcs).find((n) => n.sex === 'female' && n.stage === 'adult' && n.faction === 'loner');
  const maleNpc = Object.values(s.npcs).find((n) => n.sex === 'male' && n.stage === 'adult' && n.faction === 'loner');
  s.records.bonds[female.id].stage = 'close';
  s.records.bonds[maleNpc.id].stage = 'close';
  s.records.attraction[female.id] = 'same';
  s.records.attraction[maleNpc.id] = 'opposite';
  assert.strictEqual(E.world && female.sex, 'female');
  const Pair = require('../src/renderer/js/pairing').create(firstSeason, rules);
  assert.strictEqual(Pair.courtGate(s, female), null);
  assert.strictEqual(Pair.courtGate(s, maleNpc), null);
  s.records.attraction[female.id] = 'opposite';
  assert.strictEqual(Pair.courtGate(s, female).code, 'court.ineligible');
  const before = JSON.stringify(s);
  const refused = E.act(JSON.parse(before), { type: 'court', catId: female.id });
  assert.strictEqual(refused.error, 'court.ineligible');
  assert.strictEqual(JSON.stringify(refused.state), before);
});

test('FIXTURE: ineligible court and held-land founding change nothing', () => {
  const E = mk();
  const s = E.newRun({ mainCat: cat, seed: 8, runId: 'neg' });
  const loner = Object.values(s.npcs).find((n) => n.faction === 'loner' && n.stage === 'adult');
  loner.met = true;
  s.records.bonds[loner.id].stage = 'close';
  s.records.attraction[loner.id] = 'either';
  loner.affinity = -20;
  const before = JSON.stringify(s);
  const low = E.act(JSON.parse(before), { type: 'court', catId: loner.id });
  assert.strictEqual(low.error, 'court.ineligible.dislike');
  assert.strictEqual(JSON.stringify(low.state), before);
  const day21 = JSON.parse(before);
  day21.day = 21;
  day21.records.seasonEndShown = true;
  day21.records.bonds[loner.id].stage = 'close';
  day21.npcs[loner.id].affinity = 40;
  const late = E.act(day21, { type: 'court', catId: loner.id });
  assert.strictEqual(late.error, 'court.ineligible');
  assert.strictEqual(late.state.day, 21);
  assert.strictEqual(late.state.records.matePair, null);
  const held = E.newRun({ mainCat: cat, seed: 8, runId: 'held' });
  const mate = Object.values(held.npcs).find((n) => n.faction === 'loner' && n.stage === 'adult');
  held.records.matePair = { id: 'pair-held', playerId: held.cat.catId, mateId: mate.id, playerSex: 'female', mateSex: mate.sex, bondedDay: 3, foundingDay: null };
  held.region = 'highcrag';
  const snap = JSON.stringify(held);
  const founded = E.act(JSON.parse(snap), { type: 'found', name: 'Nowhere' });
  assert.strictEqual(founded.error, 'found.notWild');
  assert.strictEqual(JSON.stringify(founded.state), snap);
});

test('FIXTURE: a pride cat accepting courtship does not become a mate or a member', () => {
  const E = mk();
  const Pair = require('../src/renderer/js/pairing').create(firstSeason, rules);
  let found = null;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const s = E.newRun({ mainCat: cat, seed, runId: `pride-${seed}` });
    const npc = s.npcs.hc05;
    npc.met = true;
    npc.affinity = 80;
    npc.homeZones = ['highcrag'];
    s.records.bonds.hc05.stage = 'close';
    s.records.attraction.hc05 = 'either';
    s.region = 'highcrag';
    const gate = Pair.courtGate(s, npc);
    if (gate) continue;
    const r = E.act(s, { type: 'court', catId: 'hc05' });
    if (r.error || !r.state.pending || !r.state.pending.court) continue;
    if (r.state.pending.court.accept) found = r.state;
  }
  assert.ok(found, 'no accepting pride-cat roll in the fixture seeds');
  assert.strictEqual(found.records.matePair, null);
  assert.deepStrictEqual(found.records.members, []);
  assert.strictEqual(found.records.pride, null);
  assert.notStrictEqual(found.records.bonds.hc05.stage, 'mates');
  assert.strictEqual(found.npcs.hc05.faction, 'highcrag');
});

test('an old day-20 ending reopens; a death save stays ended; attraction is not rerolled', () => {
  const E = mk();
  const fresh = E.newRun({ mainCat: cat, seed: 11, runId: 'old' });
  const personalities = JSON.parse(JSON.stringify(fresh.npcs.ln05.personality));
  const portrait = fresh.npcs.ln05.portraitId;
  const attraction = JSON.parse(JSON.stringify(fresh.records.attraction));
  const ended = JSON.parse(JSON.stringify(fresh));
  delete ended.records;
  ended.over = true; ended.phase = 'over'; ended.day = 20; ended.dead = null;
  const reopened = E.migrate(ended);
  assert.strictEqual(reopened.over, false);
  assert.strictEqual(reopened.pending.seasonEnd, true);
  assert.strictEqual(reopened.pending.variant, 'unmated');
  assert.strictEqual(reopened.records.cats.ln05.skills, null);
  assert.strictEqual(reopened.records.cats.ln05.history, null);
  assert.strictEqual(reopened.records.cats.ln05.historyUnknown, true);
  assert.strictEqual(reopened.records.cats.ln05.sex, fresh.npcs.ln05.sex);
  assert.strictEqual(reopened.records.attractionRolled, false);
  assert.deepStrictEqual(reopened.records.attraction, {});
  assert.deepStrictEqual(reopened.npcs.ln05.personality, personalities);
  assert.strictEqual(reopened.npcs.ln05.portraitId, portrait);
  assert.strictEqual(reopened.records.yearLengthDays, null);
  const kept = E.migrate(JSON.parse(JSON.stringify(fresh)));
  assert.deepStrictEqual(kept.records.attraction, attraction);
  assert.deepStrictEqual(kept.npcs.ln05.personality, personalities);
  const dead = JSON.parse(JSON.stringify(fresh));
  dead.over = true; dead.phase = 'over'; dead.dead = { cause: 'starvation', day: 4 }; dead.day = 4;
  const stayed = E.migrate(dead);
  assert.strictEqual(stayed.over, true);
  assert.strictEqual(stayed.dead.cause, 'starvation');
});

test('ordinary loner courtship can pair, found, and reach day 21 without a scripted affinity', () => {
  const E = mk();
  let win = null;
  const notes = [];
  for (let seed = 1; seed <= 40 && !win; seed++) {
    try {
      const played = playSeed(E, seed, seed % 2 ? cat : male);
      const s = played.s;
      notes.push(`${seed}:${played.target}:${s.day}:${s.records.matePair ? 'mate' : '-'}:${s.records.pride ? 'pride' : '-'}:${played.declined}`);
      if (!s.records.matePair || !s.records.pride || s.day < 21 || s.over) continue;
      win = played;
    } catch (e) {
      notes.push(`${seed}:err:${e.message}`);
    }
  }
  assert.ok(win, `no ordinary pair/found/day21 in 40 seeds\n${notes.join('\n')}`);
  const s = win.s;
  const mate = s.npcs[s.records.matePair.mateId];
  assert.strictEqual(s.records.matePair.playerSex, s.cat.sex);
  assert.strictEqual(s.records.matePair.mateSex, mate.sex);
  assert.strictEqual(typeof s.records.matePair.bondedDay, 'number');
  assert.strictEqual(s.records.matePair.foundingDay, s.records.pride.foundedDay);
  assert.strictEqual(s.records.pride.territory.claim, 60);
  assert.strictEqual(s.records.pride.territory.size, 60);
  assert.strictEqual(s.records.pride.territory.regionId, s.records.pride.denRegionId);
  assert.strictEqual(s.records.members.length, 2);
  assert.strictEqual(new Set(s.records.members.map((m) => m.catId)).size, 2);
  assert.strictEqual(Object.keys(s.npcs).length, 39);
  assert.strictEqual(mate.portraitId, win.portraits[mate.id]);
  assert.deepStrictEqual(mate.personality, win.personalities[mate.id]);
  assert.strictEqual(s.records.cats[mate.id].skills, null);
  assert.ok(s.records.history.some((row) => row.kind === 'mates'));
  assert.ok(s.records.history.some((row) => row.kind === 'founded'));
  assert.ok(!s.records.history.some((row) => /born|cub|pregnant/i.test(row.text)));
  assert.strictEqual(s.records.seasonEndShown, true);
  assert.strictEqual(s.year, 1);
  assert.strictEqual(s.records.yearLengthDays, null);
  assert.ok(!s.pregnancy && !s.cubs);
  const ids = new Set(s.records.receipts);
  assert.strictEqual(ids.size, s.records.receipts.length);
  const again = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(again.day, s.day);
  assert.strictEqual(again.records.seasonEndShown, true);
  assert.deepStrictEqual(again.records.matePair, s.records.matePair);
  assert.deepStrictEqual(again.npcs[mate.id].personality, mate.personality);
  fs.writeFileSync(path.join(os.tmpdir(), 'first-season-win.json'), JSON.stringify({ seed: s.seed, sex: s.cat.sex, mateId: mate.id, day: s.day }));
});
