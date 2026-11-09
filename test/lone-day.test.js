// Seed 8, Ravenmark: the missing lone-cat actions, a real visitor, and a hyena follow-up.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const WIND = 'No cat comes to you today, only the wind';

function act(s, action) {
  const r = E.act(s, action);
  assert.ok(!r.error, `${r.error} on day ${s.day} ${s.phase} ${action.type}`);
  return r.state;
}

function advance(s) {
  if (s.phase === 'encounter') {
    const v = E.encounterView(s);
    if (!v || v.terminal) return act(s, { type: 'continue' });
    const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
    const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
    return act(s, { type: 'encounterChoose', choiceId: c.id });
  }
  if (s.phase === 'ford') return act(s, s.ford && s.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' });
  if (s.phase === 'border') {
    const v = E.world.borderView(s);
    const c = (v.choices || []).find((x) => x.id === 'withdraw' || x.id === 'leave_request') || (v.choices || [])[0];
    return act(s, c ? { type: 'borderChoose', choiceId: c.id } : { type: 'continue' });
  }
  if (s.phase === 'conversation') {
    const v = E.talkView(s);
    if (v.terminal) return act(s, { type: 'continue' });
    const c = (v.choices || []).find((x) => x.id === 'leave' || x.pause) || (v.choices || [])[0];
    return act(s, { type: 'choose', choiceId: c.id, nodeId: v.nodeId, instanceId: v.instanceId });
  }
  if (s.phase === 'event') {
    if (s.pending && s.pending.cub) return act(s, { type: 'choose', choiceId: 'guide' });
    if (s.pending && s.pending.bond) {
      const c = (s.pending.choices || []).find((x) => !x.disabled);
      if (c) return act(s, { type: 'choose', choiceId: c.id });
    }
    const beats = E.sceneBeats(s);
    if (s.pending && (s.pending.filler || s.pending.voice || s.pending.lone) && !(s.pending.choices || []).length) return act(s, { type: 'choose', choiceId: 'continue' });
    if (beats && (s.pending.beatIndex || 0) < beats.length - 1 && !(s.pending.filler || s.pending.lone || s.pending.voice)) return act(s, { type: 'advanceBeat' });
    const e = E.eventById(s.pending && s.pending.eventId);
    if (e && (e.choices || []).length) {
      const improve = e.choices.find((c) => c.affinityIntent === 'improve');
      const pass = e.choices.find((c) => c.id === 'pass' || c.id === 'withdraw' || c.id === 'leave' || c.id === 'continue');
      return act(s, { type: 'choose', choiceId: (improve || pass || e.choices[0]).id });
    }
    return act(s, { type: 'continue' });
  }
  if (s.phase === 'eventResult') return act(s, { type: 'continue' });
  return null;
}

test('seed 8 starts with several real choices, including watch and a border scout', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const av = E.available(s);
  assert.ok(av.lone.watch);
  assert.ok(av.lone.scout.some((row) => row.pride === 'bonefield'));
  assert.ok(av.lone.cub);
  assert.ok(av.scent.allowed);
  assert.strictEqual(av.approach, null);
  const meaningful = [av.hunt, av.lone.watch, av.lone.scout[0], av.lone.cub, av.scent].filter(Boolean);
  assert.ok(meaningful.length >= 4);
});

test('seed 8 Ravenmark: two approaches, a hyena or its follow-up, and the empty wait does not repeat', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const visits = new Set();
  let wind = 0;
  let hyena = false;
  let follow = false;
  const reports = [];
  for (let i = 0; i < 160 && s.day <= 10 && !s.over; i++) {
    const text = ((s.pending && s.pending.beats) || []).map((b) => b.text).filter(Boolean).join(' ');
    if (text.includes(WIND)) wind += 1;
    if (s.pending && s.pending.eventId === 'lone.approach' && s.pending.catId) visits.add(s.day);
    if (s.phase === 'encounter' && E.encounterView(s) && E.encounterView(s).encounterId === 'encounter.cave_hyena.v1') hyena = true;
    if (s.pending && String(s.pending.eventId || '').startsWith('followup.')) follow = true;
    if (s.report && s.report.lines) {
      for (const line of s.report.lines) if (line.k === 'hunt') reports.push(E.huntReportText(line, s.report.region) || '');
    }
    const stepped = advance(s);
    if (stepped) { s = stepped; continue; }
    const av = E.available(s);
    if (av.forced) { s = act(s, { type: 'forced' }); continue; }
    const mother = s.npcs.bf04;
    if ((av.lone.share || []).some((row) => row.id === 'bf04') && mother.affinity < 20) {
      s = act(s, { type: 'shareKill', catId: 'bf04' });
      continue;
    }
    // Her own approach roll on this seed succeeds on days 6 and 9 once she is known and at 20.
    if ((s.day === 6 || s.day === 9) && !visits.has(s.day) && av.lone.approach && (av.lone.approach.ids || []).includes('bf04')) {
      s = act(s, { type: 'approach' });
      continue;
    }
    if (visits.size >= 2 && s.region !== 'twin_forks' && (av.travel || []).some((t) => t.to === 'twin_forks' && t.allowed)) {
      s = act(s, { type: 'travel', to: 'twin_forks' });
      continue;
    }
    if (s.day === 1 && av.lone.cub) { s = act(s, { type: 'helpCub' }); continue; }
    if (av.hunt && av.hunt.allowed && s.needs.hunger < 90) { s = act(s, { type: 'hunt', size: 'small' }); continue; }
    if (av.lone.watch) { s = act(s, { type: 'watch' }); continue; }
    s = act(s, { type: 'rest' });
  }
  assert.ok(visits.size >= 2, `approaches ${[...visits].join(',')}`);
  assert.ok(hyena || follow, 'hyena or a follow-up');
  assert.ok(wind < 2, `empty wait showed ${wind} times`);
  for (const line of reports) {
    assert.ok(!/% chance/.test(line), line);
    assert.ok(!/Hunger \+/.test(line), line);
  }
});
