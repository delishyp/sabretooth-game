// Tracker's seed-8 bugs: spoken gossip, scout standing, and loner greetings.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const pass4 = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/pass-4-tracker-1cacba9.json'), 'utf8'));
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
const FACT_PATH = /[A-Za-z0-9_.]*_[A-Za-z0-9_.]*(?:\/[A-Za-z0-9_.]+){2,}|[A-Za-z0-9_.]+\/[A-Za-z0-9_.]*_[A-Za-z0-9_.]*(?:\/[A-Za-z0-9_.]+)+/;

function act(s, action) {
  const r = E.act(s, action);
  assert.ok(!r.error, `${r.error} ${action.type} day ${s.day} ${s.phase}`);
  return r.state;
}

function rendered(s, catId) {
  s.pending = { eventId: 'slice.meeting.loner', catId, beatIndex: 0, hostile: false };
  s.phase = 'event';
  const beats = E.sceneBeats(s);
  assert.ok(beats && beats.length);
  return beats.map((beat) => E.beats.line(beat, E.beatContext(s)).text);
}

test('gossip uses Saga\'s line and drops an unmatched fact', () => {
  assert.strictEqual(
    E.pass2.gossipPhrase('ravenmark/ford_dispute/highcrag/bonefield', 'ravenmark'),
    pass4.bug1_gossipPhrases['ford_dispute/*']
  );
  assert.strictEqual(E.pass2.gossipPhrase('ravenmark/known-only', 'ravenmark'), null);
  assert.strictEqual(E.pass2.gossipPhrase('ravenmark/cub/bf-cub', 'ravenmark'), null);

  let s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  s = act(s, { type: 'travel', to: 'greywater_ford' });
  for (let i = 0; i < 40 && s.phase !== 'ford'; i++) {
    if (s.phase === 'encounter') {
      const v = E.encounterView(s);
      if (!v || v.terminal) s = act(s, { type: 'continue' });
      else {
        const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
        const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
        s = act(s, { type: 'encounterChoose', choiceId: c.id });
      }
    } else if (s.phase === 'event' || s.phase === 'eventResult') s = act(s, { type: 'continue' });
    else if (s.phase === 'day' && s.region === 'greywater_ford') s = act(s, { type: 'rest' });
    else break;
  }
  assert.strictEqual(s.phase, 'ford');
  s = act(s, { type: 'fordChoose', choiceId: 'help_bonefield_cat' });
  const friend = s.npcs[s.ford.bfId];
  s = act(s, { type: 'continue' });
  for (let i = 0; i < 12 && s.phase !== 'day'; i++) s = act(s, { type: 'continue' });
  s = act(s, { type: 'travel', to: 'horse_meadows' });
  let gossip = null;
  for (let i = 0; i < 40 && !gossip; i++) {
    const beats = (s.pending && s.pending.beats) || [];
    if (s.pending && String(s.pending.eventId || '').startsWith('followup.') && s.pending.catId === s.ford.bfId) {
      gossip = { speaker: s.npcs[s.pending.catId].name, line: beats.map((b) => b.text).join('\n'), eventId: s.pending.eventId };
      break;
    }
    if (s.phase === 'encounter') {
      const v = E.encounterView(s);
      if (!v || v.terminal) s = act(s, { type: 'continue' });
      else {
        const ids = ['leave', 'break_off', 'give_ground', 'retreat', 'yield_kill', 'finish', 'withdraw'];
        const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
        s = act(s, { type: 'encounterChoose', choiceId: c.id });
      }
    } else if (s.phase === 'ford') s = act(s, { type: 'continue' });
    else if (s.phase === 'event') {
      if (s.pending && s.pending.meadow) s = act(s, { type: 'sceneChoose', choiceId: 'move_on' });
      else if ((s.pending.choices || []).length) s = act(s, { type: 'sceneChoose', choiceId: s.pending.choices[0].id });
      else s = act(s, { type: 'continue' });
    } else if (s.phase === 'eventResult') s = act(s, { type: 'continue' });
    else if (s.phase === 'day') s = act(s, { type: 'rest' });
    else break;
  }
  assert.ok(gossip, 'the ford friend never spoke on the horse meadows morning');
  assert.strictEqual(gossip.speaker, friend.name);
  assert.ok(!gossip.line.includes(pass4.bug1_gossipPhrases['ford_dispute/*']), gossip.line);
  assert.ok(!FACT_PATH.test(gossip.line), gossip.line);
});

test('scout standing is a spoken band, with no affinity on the result line', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const opts = {
    neighbours: E.W.neighbours(s.region),
    ownership: (id) => E.W.ownership(s.map.claims, id),
    regionName: (id) => E.W.region(id).name,
    preyValue: () => 2,
    leaderIds: [],
    den: () => null,
    feud: () => null
  };
  for (const [standing, key] of [[0, 'middle'], [15, 'high_ge_15'], [-15, 'low_le_minus_15']]) {
    s.day += 1;
    s.needs.energy = 90;
    s.records.receipts = (s.records.receipts || []).filter((row) => !row.includes('/scout/'));
    const opened = E.lone.beginScout(s, 'bonefield', Object.assign({}, opts, { standing: () => standing }));
    const text = opened.event.beats.map((b) => b.text).join('\n');
    const line = pass4.bug3_scoutStanding[key].replaceAll('{pride}', 'Bonefield');
    assert.ok(text.includes(line), text);
    assert.ok(!/\d/.test(text), text);
    assert.strictEqual(opened.event.resultLine, '');
  }
});

test('seed 8 Sleet and Cragward get different baseline greetings, and the fallback stays unused', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const sleet = s.npcs.ln02;
  const crag = s.npcs.ln01;
  assert.strictEqual(sleet.name, 'Sleet');
  assert.strictEqual(crag.name, 'Cragward');
  assert.strictEqual(sleet.personality.aggression, 58);
  assert.strictEqual(crag.personality.aggression, 28);
  assert.strictEqual(E.beats.band(sleet.personality.aggression), 'baseline');
  assert.strictEqual(E.beats.band(crag.personality.aggression), 'low');
  const event = E.eventById('slice.meeting.loner');
  const authored = pass4['bug4_slice.meeting.loner'].beats;
  const stored = event.beats.filter((beat) => Array.isArray(beat.when) && beat.when.some((cond) => cond.trait === 'boldness'));
  assert.deepStrictEqual(stored, authored);
  const tail = pass4.bug4_curiosity_tail;
  assert.deepStrictEqual(event.beats.find((beat) => beat.text === tail.text), { kind: tail.kind, when: tail.when, text: tail.text });
  const fallback = 'stops where your paths cross';
  assert.ok(event.text.includes(fallback));
  const a = rendered(s, sleet.id);
  const b = rendered(s, crag.id);
  const greet = (lines) => lines.filter((line) => line.includes('Just you') || line.includes('Are you'));
  assert.strictEqual(greet(a).length, 1);
  assert.strictEqual(greet(b).length, 1);
  assert.ok(greet(a)[0].includes('Or is someone following you?'));
  assert.ok(greet(b)[0].includes('There\'s room on this trail for two'));
  assert.notStrictEqual(greet(a)[0], greet(b)[0]);
  assert.ok(a.some((line) => line.includes('Where did you come from, anyway?')));
  assert.ok(!b.join('\n').includes('Where did you come from, anyway?'));
  assert.ok(!a.join('\n').includes(fallback));
  assert.ok(!b.join('\n').includes(fallback));
});

test('each gossip alias renders only for a cat who knows the stored fact', () => {
  const phrases = pass4.bug1_gossipPhrases;
  const cases = [
    { id: 'player_aided_bonefield', line: phrases['ford_choice/help_bonefield_cat'] },
    { id: 'player_sided_highcrag', line: phrases['ford_choice/side_with_highcrag'] },
    { id: 'player_stayed_out_ford', line: phrases['ford_choice/stay_out'] },
    { id: 'steal/horse_meadows/3', line: phrases['hunt_steal/{pride}'].replaceAll('{pride}', 'Highcrag') },
    { id: 'cub/hc10', line: phrases['pride_aid/{pride}'].replaceAll('{pride}', 'Highcrag') }
  ];
  function approach(runId, factPath, knows) {
    const s = E.newRun({ mainCat: player, seed: 8, runId });
    const cat = s.npcs.ln05;
    const factId = `${runId}/${factPath}`;
    s.region = cat.homeZones[0];
    for (const npc of Object.values(s.npcs)) {
      npc.met = npc.id === cat.id;
      npc.affinity = npc.id === cat.id ? 25 : 0;
    }
    cat.personality = Object.assign({}, cat.personality, { sociability: 40, aggression: 40, loyalty: 40, curiosity: 40 });
    s.worldMemory.facts.push({ factId, kind: 'note' });
    s.worldMemory.knowledge[factId] = {
      scope: 'private',
      participantIds: knows ? [cat.id] : ['player'],
      witnessIds: [],
      disclosedTo: [],
      prideIds: [],
      learnedAbsDay: 1
    };
    const opened = E.lone.beginApproach(s, {
      neighbours: E.W.neighbours(s.region),
      lonerHomePct: 100,
      lonerAdjacentPct: 0,
      knowsFact: (id, knownId) => E.world.knowsFact(s, id, knownId),
      ownership: (id) => E.W.ownership(s.map.claims, id)
    });
    assert.strictEqual(opened.event.catId, cat.id);
    return opened.event.beats.map((beat) => beat.text).join('\n');
  }
  for (const row of cases) {
    const slug = row.id.replace(/[^A-Za-z0-9]+/g, '-');
    const heard = approach(`alias-${slug}`, row.id, true);
    assert.ok(heard.includes(row.line), `${row.id}\n${heard}`);
    assert.ok(!FACT_PATH.test(heard), heard);
    const silent = approach(`silent-${slug}`, row.id, false);
    assert.ok(!silent.includes(row.line), row.id);
  }
  const wild = approach('wild-steal', 'steal/split_rock/3', true);
  assert.ok(!wild.includes('stealing from'), wild);
});

test('a held-land watch counts pride adults, and the cub help scene shows before the day ends', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'watch-cub' });
  s.region = 'horse_meadows';
  s.usedEvents.push('slice.region.horse_meadows');
  const watched = act(s, { type: 'watch' });
  const cats = (watched.report.lines.find((line) => line.k === 'watch') || {}).cats || [];
  assert.ok(cats.some((cat) => watched.npcs[cat.id] && watched.npcs[cat.id].faction === 'highcrag'));

  let cub = E.newRun({ mainCat: player, seed: 8, runId: 'cub-scene' });
  cub = act(cub, { type: 'helpCub' });
  assert.strictEqual(cub.phase, 'event');
  assert.strictEqual(cub.day, 1);
  cub = act(cub, { type: 'sceneChoose', choiceId: 'guide' });
  assert.strictEqual(cub.phase, 'eventResult');
  const help = (cub.pending.beats || []).map((b) => b.text).join('\n');
  assert.ok(help.includes('walk beside it'));
  assert.strictEqual(cub.pending.resultLine, '');
  assert.ok(!/Affinity/.test(help));
  const after = act(cub, { type: 'continue' });
  assert.ok(after.day > 1);
});
