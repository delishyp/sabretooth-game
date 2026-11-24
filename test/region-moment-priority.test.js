const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const map = j('map.json');
const rules = j('slice-rules.json');
const slots = j('world-slots.json');
const nameData = j('names/names.json');
const events = j('events/slice-1.json');
const looks = { coats: ['tan'], markings: ['none'], eyes: ['amber'] };
const encounters = j('events/encounters-v0.2.json');
const cat = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };

function engine(over = {}) {
  return Slice.create({
    map: over.map || map,
    rules: over.rules || rules,
    events, slots, nameData, looks, encounters
  });
}
function at(E, region, seed) {
  const s = E.newRun({ mainCat: cat, seed, runId: `rm-${region}-${seed}` });
  s.region = region;
  if (!s.map.visited.includes(region)) s.map.visited.push(region);
  return s;
}
function finishEvent(E, s) {
  let guard = 0;
  while (s.phase !== 'day' && !s.over && guard++ < 12) {
    let a;
    if (s.phase === 'event') a = { type: 'choose', choiceId: E.eventById(s.pending.eventId).choices[0].id };
    else if (s.phase === 'encounter') {
      const v = E.encounterView(s);
      if (!v || v.terminal) a = { type: 'continue' };
      else {
        const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
        const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
        a = { type: 'encounterChoose', choiceId: c.id };
      }
    } else a = { type: 'continue' };
    const r = E.act(s, a);
    assert.ok(!r.error, r.error);
    s = r.state;
  }
  return s;
}

test('an unshown moment takes the day ahead of a certain meeting roll', () => {
  const tuned = JSON.parse(JSON.stringify(map));
  tuned.tunables.trespassMeetPct = 100;
  const E = engine({ map: tuned });
  const s0 = at(E, 'split_rock', 7);
  s0.map.claims.split_rock = { highcrag: 40 };
  const s = E.act(s0, { type: 'rest' }).state;
  assert.strictEqual(s.pending && s.pending.eventId, 'slice.region.split_rock');
  assert.ok(s.usedEvents.includes('slice.region.split_rock'));
  assert.ok(!s.usedEvents.includes('slice.region.split_rock.hollow'));
});

test('a scripted wolf encounter still takes the day ahead of the moment', () => {
  const E = engine();
  const s = E.act(at(E, 'wolf_run', 3), { type: 'rest' }).state;
  assert.strictEqual(s.phase, 'encounter');
  assert.ok(!s.usedEvents.includes('slice.region.wolf_run'));
});

test('a hazard still takes the day and does not spend the moment', () => {
  const tuned = JSON.parse(JSON.stringify(map));
  const region = tuned.regions.find((r) => r.id === 'split_rock');
  region.hazards = [{ id: 'rockfall', pct: 100, seasons: null }];
  const E = engine({ map: tuned });
  const s = E.act(at(E, 'split_rock', 4), { type: 'rest' }).state;
  assert.ok(s.report.lines.some((line) => line.k === 'hazard' && line.id === 'rockfall'));
  assert.ok(!s.usedEvents.includes('slice.region.split_rock'));
  assert.notStrictEqual(s.pending && s.pending.eventId, 'slice.region.split_rock');
});

test('a forced cub scene still takes the day ahead of the moment', () => {
  const E = engine();
  const s0 = at(E, 'split_rock', 5);
  s0.needs.energy = 40;
  const s = E.act(s0, { type: 'helpCub' }).state;
  assert.ok(s.pending);
  assert.notStrictEqual(s.pending.eventId, 'slice.region.split_rock');
  assert.ok(!s.usedEvents.includes('slice.region.split_rock'));
});

test('a travel day still takes the day ahead of the moment', () => {
  const E = engine();
  const s0 = at(E, 'ice_wall', 6);
  const s = E.act(s0, { type: 'travel', to: 'north_pass' }).state;
  assert.ok(s.travel);
  assert.strictEqual(s.travel.to, 'north_pass');
  assert.ok(!s.usedEvents.includes('slice.region.ice_wall'));
  assert.notStrictEqual(s.pending && s.pending.eventId, 'slice.region.ice_wall');
});

test('each region moment fires once per run', () => {
  const E = engine();
  let s = E.act(at(E, 'split_rock', 11), { type: 'rest' }).state;
  assert.strictEqual(s.pending.eventId, 'slice.region.split_rock');
  s = finishEvent(E, s);
  s = E.act(s, { type: 'rest' }).state;
  assert.strictEqual(s.pending && s.pending.eventId, 'slice.region.split_rock.hollow');
  s = finishEvent(E, s);
  s = E.act(s, { type: 'rest' }).state;
  assert.notStrictEqual(s.pending && s.pending.eventId, 'slice.region.split_rock');
  assert.notStrictEqual(s.pending && s.pending.eventId, 'slice.region.split_rock.hollow');
  assert.strictEqual(s.usedEvents.filter((id) => id === 'slice.region.split_rock').length, 1);
  assert.strictEqual(s.usedEvents.filter((id) => id === 'slice.region.split_rock.hollow').length, 1);
});

test('save and continue keeps a shown moment from playing again', () => {
  const E = engine();
  let s = E.act(at(E, 'south_range', 9), { type: 'rest' }).state;
  if (s.phase === 'encounter') s = finishEvent(E, s);
  if (s.phase === 'day') s = E.act(s, { type: 'rest' }).state;
  assert.strictEqual(s.pending && s.pending.eventId, 'slice.region.south_range');
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(loaded.usedEvents.includes('slice.region.south_range'));
  let cont = finishEvent(E, loaded);
  cont = E.act(cont, { type: 'rest' }).state;
  assert.notStrictEqual(cont.pending && cont.pending.eventId, 'slice.region.south_range');
  assert.ok(cont.usedEvents.includes('slice.region.south_range'));
});
