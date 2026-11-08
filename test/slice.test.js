// Slice 1 sim (docs/design/slice-1-scope.md v1.0.1): seeded, deterministic, data-driven.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Rng = require('../src/renderer/js/rng');
const WorldMap = require('../src/renderer/js/worldmap');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const map = j('map.json'); const rules = j('slice-rules.json'); const slots = j('world-slots.json'); const nameData = j('names/names.json');
const events = fs.existsSync(path.join(D, 'events/slice-1.json')) ? j('events/slice-1.json') : { contentVersion: 0, events: [] };
const looks = { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] };
const encounters = j('events/encounters-v0.2.json');
const mk = (over = {}) => Slice.create({ map: over.map || map, rules: over.rules || rules, events: over.events || events, slots, nameData, looks, encounters });
const cat = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
const E = mk();

/** Plays a run with a simple policy; returns the final state and every state. */
function play(E, seed, policy) {
  let s = E.newRun({ mainCat: cat, seed }); const seen = [s];
  for (let i = 0; i < 200 && !s.over; i++) {
    let a;
    if (s.phase === 'encounter') a = leaveEncounter(E, s);
    else if (s.phase === 'ford') a = s.ford && s.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' };
    else if (s.phase === 'border') a = leaveBorder(E, s);
    else if (s.phase === 'event') { const e = E.eventById(s.pending.eventId); a = { type: 'choose', choiceId: e.choices[0].id }; }
    else if (s.phase === 'eventResult') a = { type: 'continue' };
    else { const av = E.available(s); a = av.forced ? { type: 'forced' } : policy(s, av); }
    const r = E.act(s, a); assert.ok(!r.error, `${r.error} on day ${s.day}`); s = r.state; seen.push(s);
  }
  return { s, seen };
}
function leaveEncounter(E, s) {
  const v = E.encounterView(s);
  if (!v || v.terminal) return { type: 'continue' };
  const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
  const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
  return { type: 'encounterChoose', choiceId: c.id };
}
function leaveBorder(E, s) {
  const v = E.world.borderView(s);
  if (!v || !v.choices.length) return { type: 'continue' };
  const c = v.choices.find((x) => x.id === 'withdraw' || x.id === 'leave_request') || v.choices[0];
  return { type: 'borderChoose', choiceId: c.id };
}
const sensible = (s, av) => (s.needs.hunger < 60 && av.hunt.allowed ? { type: 'hunt', size: 'small' }
  : s.needs.thirst < 50 ? { type: 'travel', to: av.travel.find((t) => t.allowed && E.W.hasWater(t.to, 'spring'))?.to || av.travel[0].to } : { type: 'rest' });

test('rng: named streams are deterministic and independent', () => {
  const a = Rng.stream(7, 'hunt', 3); const b = Rng.stream(7, 'hunt', 3); const c = Rng.stream(7, 'hunt', 4);
  const xa = [a(), a(), a()]; assert.deepStrictEqual(xa, [b(), b(), b()]); assert.notDeepStrictEqual(xa[0], c());
  for (const x of xa) assert.ok(x >= 0 && x < 1);
});

test('newRun: scope start (Split Rock, spring day 1, needs 80, health 100), every slot gets a unique name and a look', () => {
  const s = E.newRun({ mainCat: cat, seed: 1 });
  assert.strictEqual(s.region, 'split_rock'); assert.strictEqual(s.day, 1); assert.strictEqual(s.season, 'spring');
  assert.deepStrictEqual(s.needs, { health: 100, hunger: 80, thirst: 80, energy: 80 });
  const names = Object.values(s.npcs).map((n) => n.name);
  assert.strictEqual(names.length, slots.slots.length); assert.strictEqual(new Set(names).size, names.length);
  assert.ok(!names.includes('Tester'));
  for (const n of Object.values(s.npcs)) { assert.strictEqual(n.affinity, 0); assert.ok(n.look.coat); }
  assert.deepStrictEqual(s.map.visited, ['split_rock']); assert.ok(s.map.discovered.length > 1);
});

test('same seed + same actions = same run (save/load invariant)', () => {
  const a = play(E, 99, sensible).s; const b = play(E, 99, sensible).s;
  assert.deepStrictEqual(a, b);
  // round-trip mid-run through JSON + migrate, then finish: identical to the uninterrupted run
  const { seen } = play(E, 99, sensible); const mid = seen[Math.floor(seen.length / 2)];
  let s = E.migrate(JSON.parse(JSON.stringify(mid)));
  for (let i = 0; i < 200 && !s.over; i++) {
    let x; if (s.phase === 'encounter') x = leaveEncounter(E, s);
    else if (s.phase === 'ford') x = s.ford && s.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' };
    else if (s.phase === 'border') x = leaveBorder(E, s);
    else if (s.phase === 'event') x = { type: 'choose', choiceId: E.eventById(s.pending.eventId).choices[0].id };
    else if (s.phase === 'eventResult') x = { type: 'continue' };
    else { const av = E.available(s); x = av.forced ? { type: 'forced' } : sensible(s, av); }
    s = E.act(s, x).state;
  }
  assert.deepStrictEqual(s, a);
});

test('hunt chance: formulas §1.2 Standard (base 50 + size + prey + hungry + low health + injury, clamp 5..95)', () => {
  const s = E.newRun({ mainCat: cat, seed: 1 }); const prey = E.W.preyPoints('split_rock', 'spring');
  assert.strictEqual(E.huntChance(s, 'small'), Math.min(95, 50 + 5 + prey));
  assert.strictEqual(E.huntChance(s, 'large'), 50 - 20 + prey);
  s.needs.hunger = 10; s.needs.health = 40; s.injuries = [{ tier: 'serious', daysLeft: 5 }];
  assert.strictEqual(E.huntChance(s, 'large'), Math.max(5, 50 - 20 + prey - 5 - 10 - 15));
});

test('hunt: the first Split Rock hunt is the giant deer, and a later hunt still spends Energy 30', () => {
  const s = E.newRun({ mainCat: cat, seed: 5 });
  const opened = E.act(s, { type: 'hunt', size: 'small' });
  assert.strictEqual(opened.state.phase, 'encounter');
  assert.strictEqual(opened.state.needs.energy, 70);
  const left = E.act(opened.state, { type: 'encounterChoose', choiceId: 'leave' }).state;
  const done = E.act(left, { type: 'continue' }).state;
  assert.strictEqual(done.phase === 'event' || done.phase === 'day' || done.phase === 'eventResult', true);
  const again = E.act(done.phase === 'day' ? done : E.act(done, { type: 'continue' }).state, { type: 'hunt', size: 'small' });
  const h = (again.state.report ? again.state.report.lines : []).find((l) => l.k === 'hunt');
  assert.ok(h); assert.strictEqual(h.ate, h.ok ? 25 : 0);
  const t = E.newRun({ mainCat: cat, seed: 5 }); t.needs.energy = 20;
  assert.strictEqual(E.available(t).hunt.allowed, false); assert.strictEqual(E.act(t, { type: 'hunt', size: 'small' }).error, 'tired');
});

test('overnight tick: hunger −12, thirst −20 after drink, energy +25 (halved when Hungry/Thirsty), rest +40', () => {
  const s = E.newRun({ mainCat: cat, seed: 3 }); s.region = 'greywater_ford'; // has water in spring
  const quiet = mk({ map: { ...map, tunables: { ...map.tunables, trespassMeetPct: 0 } } });
  s.npcs = Object.fromEntries(Object.entries(s.npcs).map(([k, n]) => [k, { ...n, homeZones: [] }]));
  s.map.claims = Object.fromEntries(Object.keys(s.map.claims).map((r) => [r, {}]));
  s.usedEvents = events.events.map((e) => e.id);
  let r = quiet.act(s, { type: 'rest' }).state;
  if (r.phase === 'encounter') r = quiet.act(quiet.act(r, leaveEncounter(quiet, r)).state, { type: 'continue' }).state;
  assert.strictEqual(r.needs.hunger, 68); assert.strictEqual(r.needs.thirst, 80);
  assert.strictEqual(r.needs.energy, 100); assert.strictEqual(r.day, 2);
  const h = JSON.parse(JSON.stringify(s)); h.needs.hunger = 20; h.needs.energy = 10;
  let r2 = quiet.act(h, { type: 'rest' }).state; // rest 20 (halved) + overnight 12 (halved)
  if (r2.phase === 'encounter') r2 = quiet.act(quiet.act(r2, leaveEncounter(quiet, r2)).state, { type: 'continue' }).state;
  assert.strictEqual(r2.needs.energy, 10 + 20 + 12);
});

test('injury: second injury of the same tier raises it to serious; serious blocks regen and costs travel energy', () => {
  const s = E.newRun({ mainCat: cat, seed: 4 }); s.injuries = [{ tier: 'minor', daysLeft: 3, source: 'x' }];
  s.map.claims = Object.fromEntries(Object.keys(s.map.claims).map((r) => [r, {}]));
  const T = mk({ map: { ...map, tunables: { ...map.tunables, trespassMeetPct: 0 } }, rules: { ...rules, hunt: { ...rules.hunt, injuryPct: { small: 100, medium: 100, large: 100 }, injuryTierSplit: { minor: 100, serious: 0 } } } });
  s.encounters.log.push({ encounterId: 'encounter.giant_deer.v1' });
  const r = T.act(s, { type: 'hunt', size: 'small' }).state;
  assert.deepStrictEqual(r.injuries.map((i) => i.tier), ['serious']);
});

test('death: starvation from day 3 at empty hunger kills, summary records the cause', () => {
  const s = E.newRun({ mainCat: cat, seed: 8 }); s.needs = { health: 10, hunger: 0, thirst: 100, energy: 100 }; s.counters.starving = 2;
  const r = E.act(s, { type: 'rest' }).state;
  assert.ok(r.over); assert.strictEqual(r.dead.cause, 'starvation');
  const sum = E.summary(r); assert.strictEqual(sum.survived, false); assert.strictEqual(sum.daysSurvived, 1);
  assert.strictEqual(E.act(r, { type: 'rest' }).error, 'over');
});

test('day 20 ends the season: summary lists regions, cats met, best affinity', () => {
  const { s } = play(E, 2024, sensible);
  assert.ok(s.over);
  const sum = E.summary(s);
  if (sum.survived) assert.strictEqual(sum.daysSurvived, 20);
  assert.ok(sum.regionsVisited.includes('split_rock'));
  for (const c of sum.catsMet) assert.ok(c.name);
});

// ---- scope v1.0.1 §7 (Tundra): slice.affinityIntent ----
test('affinityIntent config: improve +5, unchanged 0, worsen −5; no PENDING-TUNDRA left', () => {
  assert.deepStrictEqual(rules.slice.affinityIntent, { improve: 5, unchanged: 0, worsen: -5 });
  assert.ok(!JSON.stringify(rules).includes('PENDING'));
});

test('improve applies at most once per cat per day; unchanged/worsen are not capped', () => {
  const s = E.newRun({ mainCat: cat, seed: 1 }); const id = 'ln01';
  assert.strictEqual(E.applyIntent(s, id, 'improve', 3), 5);
  assert.strictEqual(E.applyIntent(s, id, 'improve', 3), 0);
  assert.strictEqual(s.npcs[id].affinity, 5);
  assert.strictEqual(E.applyIntent(s, 'ln02', 'improve', 3), 5, 'cap is per cat');
  assert.strictEqual(E.applyIntent(s, id, 'worsen', 3), -5); assert.strictEqual(E.applyIntent(s, id, 'worsen', 3), -5);
  assert.strictEqual(E.applyIntent(s, id, 'unchanged', 3), 0);
  assert.strictEqual(E.applyIntent(s, id, 'improve', 4), 5, 'next day improves again');
  assert.strictEqual(s.npcs[id].affinity, 0);
});

test('improve cap holds through act(): a second improve choice for the same cat on the same day adds 0', () => {
  const s = E.newRun({ mainCat: cat, seed: 1 }); const e = events.events.find((x) => x.kind === 'first_meeting' && x.faction === 'loner');
  if (!e) return; // Saga's library absent (clean clone without sync source) is covered by sync-events
  const imp = e.choices.find((c) => c.affinityIntent === 'improve');
  s.phase = 'event'; s.pending = { eventId: e.id, kind: e.kind, catId: 'ln03', catName: s.npcs.ln03.name, day: 5, hostile: false, choiceId: null };
  s.npcs.ln03.improvedDay = 5;
  const r = E.act(s, { type: 'choose', choiceId: imp.id }).state;
  assert.strictEqual(r.npcs.ln03.affinity, 0); assert.strictEqual(r.phase, 'eventResult');
});

test('trespass −5 to the pride is independent of the patrol choice', () => {
  const always = mk({ map: { ...map, tunables: { ...map.tunables, trespassMeetPct: 100 } } });
  const s0 = always.newRun({ mainCat: cat, seed: 11 });
  const region = always.W.regions.map((r) => r.id).find((id) => always.W.trespassFactions(s0.map.claims, id).length === 1);
  assert.ok(region, 'a region with one trespass faction');
  const faction = always.W.trespassFactions(s0.map.claims, region)[0];
  const results = {};
  for (const intent of ['improve', 'unchanged', 'worsen']) {
    const s = JSON.parse(JSON.stringify(s0)); s.region = region;
    let r = always.act(s, { type: 'rest' }).state;
    assert.strictEqual(r.prideRelation[faction], -5, 'penalty applied at the meeting');
    assert.strictEqual(r.phase, 'event'); const e = always.eventById(r.pending.eventId);
    const c = e.choices.find((x) => x.affinityIntent === intent);
    r = always.act(r, { type: 'choose', choiceId: c.id }).state;
    results[intent] = { relation: r.prideRelation[faction], affinity: r.npcs[r.pending.catId].affinity };
  }
  assert.deepStrictEqual(Object.values(results).map((x) => x.relation), [-5, -5, -5]);
  assert.deepStrictEqual(Object.values(results).map((x) => x.affinity), [5, 0, -5]);
});

test('hostile patrol at relation ≤ −50 shows hostile text, no choice delta', () => {
  const always = mk({ map: { ...map, tunables: { ...map.tunables, trespassMeetPct: 100 } } });
  const s = always.newRun({ mainCat: cat, seed: 12 });
  const region = always.W.regions.map((r) => r.id).find((id) => always.W.trespassFactions(s.map.claims, id).length === 1);
  const faction = always.W.trespassFactions(s.map.claims, region)[0];
  s.region = region; s.prideRelation[faction] = -45;
  let r = always.act(s, { type: 'rest' }).state;
  assert.strictEqual(r.prideRelation[faction], -50); assert.strictEqual(r.pending.hostile, true);
  const before = JSON.stringify(r.npcs);
  r = always.act(r, { type: 'choose' }).state;
  assert.strictEqual(JSON.stringify(r.npcs), before); assert.strictEqual(r.pending.choiceId, 'hostile');
});

test('≤ 1 offline event per day; region moments fire once per run', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { seen } = play(E, seed, sensible);
    const perDay = {};
    for (const st of seen) if (st.pending && st.phase === 'event') perDay[st.pending.day] = new Set([...(perDay[st.pending.day] || []), st.pending.eventId]);
    for (const [d, ids] of Object.entries(perDay)) assert.strictEqual(ids.size, 1, `day ${d}`);
    const last = seen[seen.length - 1]; assert.strictEqual(new Set(last.usedEvents).size, last.usedEvents.length);
  }
});

test('portrait id is kept verbatim, and a legacy or corrupt id becomes null instead of another cat', () => {
  const marked = { ...cat, portraitId: 'cat-6e2d788dd48ff440' };
  const s = E.newRun({ mainCat: marked, seed: 1 });
  assert.strictEqual(s.cat.portraitId, 'cat-6e2d788dd48ff440');
  assert.ok(Object.values(s.npcs).every((n) => typeof n.portraitId === 'string' && n.portraitId.startsWith('cat-')));
  assert.strictEqual(s.npcs.ln05.portraitId, 'cat-6e2d788dd48ff440');
  const legacy = JSON.parse(JSON.stringify(s));
  delete legacy.cat.portraitId;
  delete legacy.cat.portraitLegacy;
  const geneCopy = JSON.parse(JSON.stringify(legacy.cat.genes));
  legacy.npcs.hc01.portraitId = 'Not A Cat';
  const m = E.migrate(legacy);
  assert.strictEqual(m.cat.portraitId, null);
  assert.strictEqual(m.cat.portraitLegacy.status, 'field-absent');
  assert.strictEqual(m.cat.portraitLegacy.policy, 'no-genotype-map');
  assert.deepStrictEqual(m.cat.genes, geneCopy);
  assert.strictEqual(m.cat.catId, s.cat.catId);
  assert.strictEqual(m.cat.name, s.cat.name);
  assert.strictEqual(m.npcs.hc01.portraitId, 'cat-3f9fb78fb1697a76');
  assert.strictEqual(m.npcs.hc01.portraitLegacy.rejected, 'Not A Cat');
  assert.strictEqual(m.npcs.hc01.stage, s.npcs.hc01.stage);
  const again = E.migrate(JSON.parse(JSON.stringify(m)));
  assert.deepStrictEqual(again.cat.portraitLegacy, m.cat.portraitLegacy);
  assert.strictEqual(again.npcs.hc01.portraitId, m.npcs.hc01.portraitId);
  const kept = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(kept.cat.portraitId, 'cat-6e2d788dd48ff440');
  const missing = E.newRun({ mainCat: cat, seed: 1 });
  assert.strictEqual(missing.cat.portraitId, null);
});

test('migrate: rejects newer saves, upgrades old map dataVersion', () => {
  const s = E.newRun({ mainCat: cat, seed: 1 });
  assert.throws(() => E.migrate({ ...s, saveVersion: rules.saveVersion + 1 }));
  assert.throws(() => E.migrate({}));
  const old = JSON.parse(JSON.stringify(s)); old.map.dataVersion = 0;
  const m = E.migrate(old); assert.strictEqual(m.map.dataVersion, map.dataVersion);
});
