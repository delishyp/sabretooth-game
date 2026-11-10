// Gossip told to someone who lived the fact uses `<id>.knows`, or the next item.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pass2 = require('../src/renderer/js/pass2');

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
const CUB_NEWS = 'A loner walked a lost Bonefield cub all the way home.';

test('a knows variant is used when the listener lived the fact, including a parts block', () => {
  const phrases = {
    'pride_aid/{pride}': 'A loner walked a lost {pride} cub all the way home.',
    'pride_aid/{pride}.knows': 'You walked that {pride} cub home. The pride is still talking about you.',
    'encounter/encounter.wolf_pack.v1/first_sighting': 'The wolves are on the move again.',
    'encounter/encounter.wolf_pack.v1/first_sighting.knows': {
      speaker: 'bf01',
      parts: [{ beat: 'You were there when the wolves passed.' }, { say: 'I will not tell it as news.' }]
    }
  };
  assert.strictEqual(
    Pass2.gossipLineFor(phrases, 'pride_aid/{pride}', 'Bonefield', false),
    'A loner walked a lost Bonefield cub all the way home.'
  );
  assert.strictEqual(
    Pass2.gossipLineFor(phrases, 'pride_aid/{pride}', 'Bonefield', true),
    'You walked that Bonefield cub home. The pride is still talking about you.'
  );
  const parts = Pass2.gossipLineFor(phrases, 'encounter/encounter.wolf_pack.v1/first_sighting', '', true);
  assert.deepStrictEqual(parts.parts.map((part) => part.say || part.beat), [
    'You were there when the wolves passed.',
    'I will not tell it as news.'
  ]);
  assert.strictEqual(Pass2.gossipLineFor(phrases, 'pride_aid/{pride}', 'Bonefield', true) !== phrases['pride_aid/{pride}'], true);
});

test('the shipped cub line is kept for a stranger and dropped for the cat who did it', () => {
  const stranger = { cubPride: () => 'bonefield' };
  const lived = { cubPride: () => 'bonefield', listenerParticipated: true };
  assert.strictEqual(Pass2.gossipPhrase('ravenmark/cub/bf09', 'ravenmark', lived), null);
  assert.ok(String(Pass2.gossipPhrase('ravenmark/cub/bf09', 'ravenmark', stranger)).includes('Bonefield cub'));
});

test('with no knows variant the lived fact is skipped and the next eligible item is told', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'gossip-next' });
  const cat = s.npcs.ln05;
  s.region = cat.homeZones[0];
  for (const npc of Object.values(s.npcs)) {
    npc.met = npc.id === cat.id;
    npc.affinity = npc.id === cat.id ? 25 : 0;
  }
  const cubId = `${s.runId}/cub/bf09`;
  const wolfId = `${s.runId}/encounter/encounter.wolf_pack.v1/first_sighting`;
  s.worldMemory.facts.push({ factId: cubId, kind: 'pride_aid' }, { factId: wolfId, kind: 'sighting' });
  s.worldMemory.knowledge[cubId] = {
    scope: 'witnessed', participantIds: ['player', cat.id], witnessIds: [],
    disclosedTo: [], prideIds: ['bonefield'], learnedAbsDay: 1
  };
  s.worldMemory.knowledge[wolfId] = {
    scope: 'witnessed', participantIds: [], witnessIds: [cat.id],
    disclosedTo: [], prideIds: [], learnedAbsDay: 2
  };
  const opened = E.lone.beginApproach(s, {
    neighbours: E.W.neighbours(s.region),
    lonerHomePct: 100,
    lonerAdjacentPct: 0,
    knowsFact: (id, knownId) => E.world.knowsFact(s, id, knownId),
    ownership: (id) => E.W.ownership(s.map.claims, id),
    cubPride: (id) => (s.npcs[id] && s.npcs[id].faction) || null
  });
  const text = opened.event.beats.map((beat) => beat.text).join('\n');
  assert.ok(!text.includes('walked a lost'), text);
  assert.ok(text.includes('The wolves are on the move again'), text);
  assert.strictEqual(opened.event.gossipSourceId, wolfId);
});

test('seed 8 day 6 does not tell the player about the cub walk they did', () => {
  function act(s, action) {
    const result = E.act(s, action);
    assert.ok(!result.error, `${result.error} day ${s.day} ${action.type}`);
    return result.state;
  }
  function advance(s) {
    if (s.phase === 'encounter') {
      const view = E.encounterView(s);
      if (!view || view.terminal) return act(s, { type: 'continue' });
      const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
      const choice = view.choices.find((row) => ids.includes(row.id) && !row.disabled) || view.choices.find((row) => !row.disabled);
      return act(s, { type: 'encounterChoose', choiceId: choice.id });
    }
    if (s.phase === 'ford') return act(s, s.ford && s.ford.node === 'open' ? { type: 'fordChoose', choiceId: 'stay_out' } : { type: 'continue' });
    if (s.phase === 'border') {
      const view = E.world.borderView(s);
      const choice = (view.choices || []).find((row) => row.id === 'withdraw' || row.id === 'leave_request') || (view.choices || [])[0];
      return act(s, choice ? { type: 'borderChoose', choiceId: choice.id } : { type: 'continue' });
    }
    if (s.phase === 'conversation') {
      const view = E.talkView(s);
      if (!view || view.terminal) return act(s, { type: 'continue' });
      const choice = (view.choices || []).find((row) => row.id === 'leave' || row.pause) || (view.choices || [])[0];
      return act(s, { type: 'choose', choiceId: choice.id, nodeId: view.nodeId, instanceId: view.instanceId });
    }
    if (s.phase === 'event') {
      if (s.pending.cub) return act(s, { type: 'sceneChoose', choiceId: 'guide' });
      if (s.pending.bond) {
        const choice = (s.pending.choices || []).find((row) => !row.disabled);
        if (choice) return act(s, { type: 'choose', choiceId: choice.id });
      }
      const beats = E.sceneBeats(s);
      if ((s.pending.filler || s.pending.voice || s.pending.lone) && !(s.pending.choices || []).length) return act(s, { type: 'choose', choiceId: 'continue' });
      if (beats && (s.pending.beatIndex || 0) < beats.length - 1 && !(s.pending.filler || s.pending.lone || s.pending.voice)) return act(s, { type: 'advanceBeat' });
      const event = E.eventById(s.pending.eventId);
      if (event && (event.choices || []).length) {
        const improve = event.choices.find((row) => row.affinityIntent === 'improve');
        const pass = event.choices.find((row) => row.id === 'pass' || row.id === 'withdraw' || row.id === 'leave' || row.id === 'continue');
        return act(s, { type: 'choose', choiceId: (improve || pass || event.choices[0]).id });
      }
      return act(s, { type: 'continue' });
    }
    if (s.phase === 'eventResult') return act(s, { type: 'continue' });
    return null;
  }
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  let day6 = null;
  const visits = new Set();
  for (let i = 0; i < 300 && s.day <= 6 && !s.over; i++) {
    if (s.phase === 'event' && s.pending && s.pending.eventId === 'lone.approach' && s.day === 6) day6 = s.pending;
    if (s.pending && s.pending.eventId === 'lone.approach' && s.pending.catId) visits.add(s.day);
    const stepped = advance(s);
    if (stepped) { s = stepped; continue; }
    const av = E.available(s);
    const mother = s.npcs.bf04;
    let action = { type: 'rest' };
    if (av.forced) action = { type: 'forced' };
    else if ((av.lone.share || []).some((row) => row.id === 'bf04') && mother.affinity < 20) action = { type: 'shareKill', catId: 'bf04' };
    else if (s.day === 6 && !visits.has(6) && av.lone.approach && (av.lone.approach.ids || []).includes('bf04')) action = { type: 'approach' };
    else if (s.day === 1 && av.lone.cub) action = { type: 'helpCub' };
    else if (av.hunt && av.hunt.allowed && s.needs.hunger < 90) action = { type: 'hunt', size: 'small' };
    else if (av.lone.watch) action = { type: 'watch' };
    s = act(s, action);
  }
  assert.ok(day6, 'seed 8 day 6 never opened the approach');
  const text = (day6.beats || []).map((beat) => beat.text).join('\n');
  assert.ok(!text.includes(CUB_NEWS), text);
  assert.ok(!text.includes('walked a lost'), text);
});
