// Every day of a standard seed-8 run shows a scene. Rolls and needs stay as they are.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
function engine(extra) {
  return Slice.create(Object.assign({
    map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
    slots: j('world-slots.json'), nameData: j('names/names.json'),
    looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
    conversation: j('events/recurring-conversation.json'),
    encounters: j('events/encounters-v0.2.json'),
    borderPolicy: j('events/faction-proof-reconciled.json'),
    firstSeason: j('events/first-season-v0.6.2.json'),
    sampleBeats: j('events/sample-beats.json')
  }, extra || {}));
}
const E = engine();
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };

function step(E, s) {
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
    const v = E.talkView(s);
    if (v.terminal) return { type: 'continue' };
    const c = (v.choices || []).find((x) => x.id === 'leave' || x.pause) || (v.choices || [])[0];
    return c ? { type: 'choose', choiceId: c.id, nodeId: v.nodeId, instanceId: v.instanceId } : { type: 'continue' };
  }
  if (s.phase === 'event') {
    const beats = E.sceneBeats(s);
    if (s.pending && (s.pending.filler || s.pending.voice || s.pending.lone) && !(s.pending.choices || []).length) return { type: 'choose', choiceId: 'continue' };
    if (beats && (s.pending.beatIndex || 0) < beats.length - 1 && !(s.pending.filler || s.pending.lone || s.pending.voice)) return { type: 'advanceBeat' };
    if (s.pending && s.pending.bond) {
      const c = (s.pending.choices || []).find((x) => !x.disabled);
      if (c) return { type: 'choose', choiceId: c.id };
    }
    const e = E.eventById(s.pending && s.pending.eventId);
    if (e && (e.choices || []).length) {
      const pass = e.choices.find((c) => c.id === 'pass' || c.id === 'withdraw' || c.id === 'leave' || c.id === 'continue');
      return { type: 'choose', choiceId: (pass || e.choices[0]).id };
    }
    return { type: 'continue' };
  }
  if (s.phase === 'eventResult') return { type: 'continue' };
  const av = E.available(s);
  if (av.forced) return { type: 'forced' };
  if (s.needs.hunger < 70 && av.hunt && av.hunt.allowed) return { type: 'hunt', size: 'small' };
  return { type: 'rest' };
}

test('seed 8 Ravenmark has a scene on every one of the first 10 days', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  assert.strictEqual(s.cat.name, 'Ravenmark');
  const shown = new Set();
  for (let i = 0; i < 250 && s.day <= 10 && !s.over; i++) {
    const day = s.day;
    const phase = s.phase;
    const action = step(E, s);
    const r = E.act(s, action);
    assert.ok(!r.error, `${r.error} on day ${day} ${phase}`);
    s = r.state;
    if (phase === 'day' && s.phase !== 'day') shown.add(day);
  }
  assert.deepStrictEqual([...shown].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('a quiet arrival uses the reached-and-drank line until a biome scene exists', () => {
  const quiet = engine({ map: Object.assign({}, j('map.json'), { tunables: Object.assign({}, j('map.json').tunables, { trespassMeetPct: 0 }) }) });
  const s = quiet.newRun({ mainCat: player, seed: 3, runId: 'arrive' });
  s.npcs = Object.fromEntries(Object.entries(s.npcs).map(([k, n]) => [k, Object.assign({}, n, { homeZones: [] })]));
  s.usedEvents = j('events/slice-1.json').events.map((e) => e.id);
  s.map.claims = Object.fromEntries(Object.keys(s.map.claims).map((r) => [r, {}]));
  const dest = quiet.available(s).travel.find((t) => t.allowed && t.to === 'tallgrass');
  const arrived = quiet.act(s, { type: 'travel', to: dest.to }).state;
  assert.strictEqual(arrived.pending.eventId, `travel.arrive.${quiet.W.region(dest.to).biome}`);
  const text = arrived.pending.beats.map((b) => b.text).join(' ');
  assert.match(text, /Grass runs to the horizon in /);
  assert.match(text, /hoof-churned waterhole/);
  const beats = JSON.parse(JSON.stringify(j('events/sample-beats.json')));
  beats['travel.arrive.steppe'] = { beats: [{ kind: 'narration', text: 'The grass opens in front of you.' }] };
  const voiced = engine({
    map: Object.assign({}, j('map.json'), { tunables: Object.assign({}, j('map.json').tunables, { trespassMeetPct: 0 }) }),
    sampleBeats: beats
  });
  const start = voiced.newRun({ mainCat: player, seed: 3, runId: 'arrive-beats' });
  start.npcs = Object.fromEntries(Object.entries(start.npcs).map(([k, n]) => [k, Object.assign({}, n, { homeZones: [] })]));
  start.usedEvents = j('events/slice-1.json').events.map((e) => e.id);
  start.map.claims = Object.fromEntries(Object.keys(start.map.claims).map((r) => [r, {}]));
  const steppe = voiced.available(start).travel.find((t) => t.allowed && t.to === 'tallgrass');
  const scene = voiced.act(start, { type: 'travel', to: steppe.to }).state;
  assert.strictEqual(scene.pending.beats[0].text, 'The grass opens in front of you.');
  assert.match(scene.pending.resultLine, /hoof-churned waterhole/);
});
