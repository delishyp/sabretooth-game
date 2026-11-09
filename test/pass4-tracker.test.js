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
    const line = beats.map((b) => b.text).find((text) => text && text.includes('Greywater Ford'));
    if (line) gossip = { speaker: s.pending.catName || s.pending.title, line, eventId: s.pending.eventId };
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
  assert.ok(gossip, 'no ford gossip on the horse meadows morning');
  assert.strictEqual(gossip.speaker, friend.name);
  assert.ok(gossip.line.includes(pass4.bug1_gossipPhrases['ford_dispute/*']));
  assert.ok(!FACT_PATH.test(gossip.line), gossip.line);
  assert.ok(!/standing toward you is|you helped|you stood/i.test(gossip.line));
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

test('seed 8 Sleet and Cragward share the baseline greeting and drop the fallback while beats play', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const sleet = s.npcs.ln02;
  const crag = s.npcs.ln01;
  assert.strictEqual(sleet.name, 'Sleet');
  assert.strictEqual(crag.name, 'Cragward');
  assert.deepStrictEqual(
    { sociability: sleet.personality.sociability, boldness: sleet.personality.boldness },
    { sociability: 58, boldness: 45 }
  );
  assert.deepStrictEqual(
    { sociability: crag.personality.sociability, boldness: crag.personality.boldness },
    { sociability: 57, boldness: 52 }
  );
  const event = E.eventById('slice.meeting.loner');
  const authored = pass4['bug4_slice.meeting.loner'].beats;
  const stored = event.beats.filter((beat) => Array.isArray(beat.when) && beat.when.some((cond) => cond.trait === 'boldness'));
  assert.deepStrictEqual(stored, authored);
  const fallback = 'stops where your paths cross';
  assert.ok(event.text.includes(fallback));
  const a = rendered(s, sleet.id);
  const b = rendered(s, crag.id);
  const greet = (lines, name) => lines.find((line) => line.includes('Just you') || line.includes('Are you')).replaceAll(name, 'Cat');
  assert.strictEqual(greet(a, 'Sleet'), greet(b, 'Cragward'));
  assert.ok(greet(a, 'Sleet').includes('Or is someone following you?'));
  assert.ok(!a.join('\n').includes(fallback));
  assert.ok(!b.join('\n').includes(fallback));
  assert.notStrictEqual(a.join('\n'), b.join('\n'));
  const quiet = { player: s.cat, npc: Object.assign({}, sleet, { personality: { aggression: 50, sociability: 10, boldness: 10, loyalty: 50, curiosity: 50 } }) };
  assert.strictEqual(E.beats.visible([
    { kind: 'speech', when: [{ trait: 'sociability', band: 'baseline', who: 'npc' }, { trait: 'boldness', band: 'baseline', who: 'npc' }], text: 'no' }
  ], quiet), null);
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
