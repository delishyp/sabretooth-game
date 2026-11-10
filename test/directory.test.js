// Directory save bag, history keys, favourites, and query helpers. No directory screen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Directory = require('../src/renderer/js/directory');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const rules = j('slice-rules.json');
const slots = j('world-slots.json');
const E = Slice.create({
  map: j('map.json'), rules, events: j('events/slice-1.json'), slots,
  nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const PROSE = ['text', 'summary', 'line', 'prose', 'label'];

function fresh(seed = 8) {
  return E.newRun({ mainCat: player, seed, runId: 'directory' });
}
function kinds(row) {
  return (row.history || []).map((item) => item.kind);
}
function assertNoProse(state) {
  const cats = state.directory && state.directory.cats || {};
  for (const row of Object.values(cats)) {
    for (const item of row.history.concat(row.heard)) {
      for (const key of PROSE) assert.strictEqual(Object.prototype.hasOwnProperty.call(item, key), false, key);
      if (item.templateKey) assert.match(item.templateKey, /^[a-zA-Z.]+$/);
      if (item.kind) assert.match(item.kind, /^[a-zA-Z]+$/);
    }
  }
}

test('a new run copies ageSeasons and starts an empty directory bag', () => {
  const s = fresh();
  assert.strictEqual(rules.saveVersion, 1);
  assert.strictEqual(s.saveVersion, 1);
  assert.deepStrictEqual(s.directory.favorites, []);
  assert.strictEqual(s.npcs.hc01.ageSeasons, 36);
  assert.strictEqual(s.npcs.hc11.ageSeasons, 0);
  const bag = s.directory.cats.hc01;
  assert.strictEqual(bag.gone, false);
  assert.strictEqual(bag.meetCount, 0);
  assert.deepStrictEqual(bag.traitSeen, {});
  assert.strictEqual(bag.lastSeen, null);
  assert.deepStrictEqual(bag.heard, []);
  assert.deepStrictEqual(bag.history, []);
  assert.strictEqual(bag.favorite, false);
  assert.strictEqual(bag.ageSeasons, 36);
  assert.strictEqual(Object.keys(s.directory.cats).length, Object.keys(s.npcs).length);
});

test('a v1 save with no directory loads, keeps saveVersion 1, and does not invent history', () => {
  const legacy = fresh(3);
  delete legacy.directory;
  for (const npc of Object.values(legacy.npcs)) delete npc.ageSeasons;
  legacy.npcs.ln05.met = true;
  legacy.npcs.ln05.lastRegion = 'wind_scree';
  legacy.npcs.ln04.dead = true;
  legacy.records.departure = { catId: 'hc02', from: 'highcrag', day: 4 };
  legacy.saveVersion = 1;
  const loaded = E.migrate(JSON.parse(JSON.stringify(legacy)));
  assert.strictEqual(loaded.saveVersion, 1);
  assert.strictEqual(loaded.npcs.hc01.ageSeasons, 36);
  assert.strictEqual(loaded.npcs.hc11.ageSeasons, 0);
  assert.strictEqual(loaded.directory.cats.ln05.meetCount, 1);
  assert.deepStrictEqual(loaded.directory.cats.ln05.lastSeen, { zoneId: 'wind_scree', day: loaded.day });
  assert.deepStrictEqual(loaded.directory.cats.ln05.history, []);
  assert.deepStrictEqual(loaded.directory.favorites, []);
  assert.strictEqual(loaded.directory.cats.ln04.gone, true);
  assert.deepStrictEqual(kinds(loaded.directory.cats.ln04), ['death']);
  assert.strictEqual(loaded.directory.cats.hc02.gone, true);
  assert.strictEqual(loaded.directory.cats.hc02.history[0].day, 4);
  assert.strictEqual(loaded.directory.cats.hc02.history[0].kind, 'departure');
  assert.strictEqual(loaded.directory.cats.hc02.history[0].templateKey, 'directory.history.departure');
  const again = E.migrate(JSON.parse(JSON.stringify(loaded)));
  assert.strictEqual(again.directory.cats.ln04.history.filter((item) => item.kind === 'death').length, 1);
  assert.strictEqual(again.directory.cats.hc02.history.filter((item) => item.kind === 'departure').length, 1);
  assert.throws(() => E.migrate({ ...fresh(), saveVersion: 2 }), /newer/);
  assertNoProse(again);
});

test('favourites toggle and survive save and load', () => {
  const s = fresh();
  assert.strictEqual(Directory.isFavorite(s, 'hc01'), false);
  assert.strictEqual(Directory.toggleFavorite(s, 'hc01'), true);
  assert.strictEqual(Directory.isFavorite(s, 'hc01'), true);
  assert.deepStrictEqual(s.directory.favorites, ['hc01']);
  s.npcs.ln04.dead = true;
  E.sceneBeats(Object.assign(s, { pending: { eventId: 'day.quiet', beats: [{ kind: 'narration', text: 'A quiet day.' }] } }));
  assert.strictEqual(Directory.toggleFavorite(s, 'ln04'), true);
  assert.strictEqual(s.directory.cats.ln04.gone, true);
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(Directory.isFavorite(loaded, 'hc01'), true);
  assert.strictEqual(Directory.isFavorite(loaded, 'ln04'), true);
  assert.deepStrictEqual(loaded.directory.favorites, ['hc01', 'ln04']);
  assert.strictEqual(Directory.toggleFavorite(loaded, 'hc01'), false);
  assert.strictEqual(Directory.isFavorite(loaded, 'hc01'), false);
  assert.deepStrictEqual(loaded.directory.favorites, ['ln04']);
});

test('history is appended from meet, talk, share, warn, let-watch, spar, hunt, and gossip', () => {
  const meetRules = JSON.parse(JSON.stringify(rules));
  meetRules.meetings = Object.assign({}, meetRules.meetings, { lonerHomePct: 100, lonerAdjacentPct: 0 });
  const Meet = Slice.create({
    map: j('map.json'), rules: meetRules, events: j('events/slice-1.json'), slots,
    nameData: j('names/names.json'),
    looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
    conversation: j('events/recurring-conversation.json'),
    encounters: j('events/encounters-v0.2.json'),
    borderPolicy: j('events/faction-proof-reconciled.json'),
    firstSeason: j('events/first-season-v0.6.2.json')
  });
  const meeting = Meet.newRun({ mainCat: player, seed: 4, runId: 'meet-log' });
  for (const npc of Object.values(meeting.npcs)) npc.homeZones = npc.id === 'ln05' ? [meeting.region] : [];
  const met = Meet.act(meeting, { type: 'rest' }).state;
  assert.ok(kinds(met.directory.cats.ln05).includes('meet'), kinds(met.directory.cats.ln05).join(','));
  assert.ok(met.directory.cats.ln05.meetCount >= 1);
  assert.strictEqual(met.directory.cats.ln05.lastSeen.zoneId, meeting.region);

  const talk = fresh();
  talk.npcs.ln05.met = true;
  talk.phase = 'event';
  talk.pending = { eventId: 'slice.meeting.loner', kind: 'first_meeting', catId: 'ln05', catName: talk.npcs.ln05.name, day: talk.day, hostile: false, choiceId: null };
  const greeted = E.act(talk, { type: 'choose', choiceId: 'greet' }).state;
  assert.ok(kinds(greeted.directory.cats.ln05).includes('talk'));

  const home = fresh();
  const cat = home.npcs.ln05;
  home.region = cat.homeZones[0];
  cat.met = true;
  cat.affinity = 30;
  home.needs.energy = 80;
  E.lone.noteKill(home, null);
  const shared = E.act(home, { type: 'shareKill', catId: cat.id }).state;
  assert.ok(kinds(shared.directory.cats.ln05).includes('share'), kinds(shared.directory.cats.ln05).join(','));

  const warned = fresh();
  const other = warned.npcs.ln05;
  warned.region = other.homeZones[0];
  other.met = true;
  E.lone.noteKill(warned, null);
  warned.pending = E.lone.killPresence(warned, other, { ownership: () => ({ state: 'wild' }) });
  warned.phase = 'event';
  const toldOff = E.act(warned, { type: 'sceneChoose', choiceId: 'warn_off' }).state;
  assert.ok(kinds(toldOff.directory.cats.ln05).includes('warn'));

  const watched = fresh();
  const third = watched.npcs.ln05;
  watched.region = third.homeZones[0];
  third.met = true;
  E.lone.noteKill(watched, null);
  watched.pending = E.lone.killPresence(watched, third, { ownership: () => ({ state: 'wild' }) });
  watched.phase = 'event';
  const allowed = E.act(watched, { type: 'sceneChoose', choiceId: 'let_watch' }).state;
  assert.ok(kinds(allowed.directory.cats.ln05).includes('letWatch'));

  const sparring = fresh();
  const foe = sparring.npcs.ln05;
  sparring.region = foe.homeZones[0];
  foe.met = true;
  foe.affinity = 40;
  foe.stage = 'adult';
  sparring.needs.energy = 90;
  const fought = E.act(sparring, { type: 'spar', catId: foe.id });
  assert.ok(!fought.error, fought.error);
  assert.ok(kinds(fought.state.directory.cats.ln05).includes('spar'));

  const hunt = fresh();
  hunt.npcs.ln05.met = true;
  hunt.npcs.ln05.homeZones = [hunt.region];
  hunt.records._huntOk = true;
  hunt.worldMemory.facts.push({ factId: 'foal', kind: 'test' });
  hunt.worldMemory.knowledge.foal = { scope: 'witnessed', participantIds: ['player'], witnessIds: [], disclosedTo: [], prideIds: [], learnedAbsDay: hunt.day };
  hunt.followups.push({ sourceEventId: 'meadow', choiceId: 'hit', catId: 'ln05', kind: 'foal_hit', factId: 'foal', fired: false });
  const opened = E.act(hunt, { type: 'talk', catId: 'ln05' }).state;
  assert.strictEqual(opened.pending.huntReady, true);
  const together = E.act(opened, { type: 'choose', choiceId: 'share' }).state;
  assert.ok(kinds(together.directory.cats.ln05).includes('huntTogether'), kinds(together.directory.cats.ln05).join(','));

  const gossip = fresh();
  gossip.phase = 'event';
  gossip.pending = {
    eventId: 'payoff.1.4', catId: 'hc02', day: gossip.day, gossipSourceId: 'heard-name',
    beats: [{ kind: 'narration', text: 'A quiet hill.' }]
  };
  E.sceneBeats(gossip);
  E.sceneBeats(gossip);
  const heard = gossip.directory.cats.hc02;
  assert.deepStrictEqual(kinds(heard), ['gossip']);
  assert.strictEqual(heard.heard.length, 1);
  assert.strictEqual(heard.heard[0].templateKey, 'directory.heard.gossip');
  assert.strictEqual(heard.history[0].templateKey, 'directory.history.gossip');
  assertNoProse(gossip);
});

test('a played trait band is kept, and a later band does not replace it', () => {
  const s = fresh();
  s.npcs.ln05.personality = { aggression: 10, sociability: 10, boldness: 10, loyalty: 10, curiosity: 90 };
  s.pending = {
    eventId: 'slice.meeting.loner', catId: 'ln05', day: s.day,
    beats: [{ kind: 'speech', text: 'You came alone.', when: { trait: 'curiosity', band: 'high', who: 'npc' } }]
  };
  E.sceneBeats(s);
  assert.strictEqual(s.directory.cats.ln05.traitSeen.curiosity, 'high');
  s.npcs.ln05.personality.curiosity = 10;
  s.pending.beats = [{ kind: 'speech', text: 'You came alone.', when: { trait: 'curiosity', band: 'low', who: 'npc' } }];
  E.sceneBeats(s);
  assert.strictEqual(s.directory.cats.ln05.traitSeen.curiosity, 'high');
  s.npcs.ln05.personality.boldness = 50;
  s.pending.beats = [{ kind: 'speech', text: 'You came alone.', when: { trait: 'boldness', band: 'baseline', who: 'npc' } }];
  E.sceneBeats(s);
  assert.strictEqual(s.directory.cats.ln05.traitSeen.boldness, undefined);
});

test('history keeps the newest 200 lines and drops the oldest', () => {
  const s = { day: 1, region: 'split_rock', npcs: { hc01: { id: 'hc01' } } };
  for (let day = 1; day <= Directory.HISTORY_CAP + 5; day++) {
    Directory.note(s, { day, kind: 'talk', catId: 'hc01', zoneId: 'split_rock', sourceId: `talk-${day}` });
  }
  const history = s.directory.cats.hc01.history;
  assert.strictEqual(history.length, 200);
  assert.strictEqual(history[0].day, 6);
  assert.strictEqual(history[history.length - 1].day, 205);
  assert.strictEqual(history[0].templateKey, Directory.TEMPLATE.talk);
});

test('filters combine, and unmet cats stay out of a met list', () => {
  const s = fresh();
  s.npcs.hc01.met = true;
  s.npcs.bf01.met = true;
  s.npcs.ln05.met = false;
  Directory.toggleFavorite(s, 'hc01');
  Directory.toggleFavorite(s, 'ln05');
  s.directory.cats.bf01.gone = true;
  const met = Directory.filterCats(s, { met: true });
  assert.ok(met.every((cat) => cat.met));
  assert.ok(!met.some((cat) => cat.id === 'ln05'));
  const pride = Directory.filterCats(s, { pride: 'highcrag' });
  assert.ok(pride.every((cat) => cat.pride === 'highcrag'));
  assert.ok(pride.some((cat) => cat.id === 'hc01'));
  const gone = Directory.filterCats(s, { gone: true });
  assert.deepStrictEqual(gone.map((cat) => cat.id), ['bf01']);
  const favorite = Directory.filterCats(s, { favorite: true });
  assert.ok(favorite.some((cat) => cat.id === 'hc01'));
  const both = Directory.filterCats(s, { pride: 'highcrag', met: true, favorite: true, gone: false });
  assert.deepStrictEqual(both.map((cat) => cat.id), ['hc01']);
  const hidden = Directory.filterCats(s, { met: true, favorite: true, pride: 'loner' });
  assert.ok(!hidden.some((cat) => cat.id === 'ln05'));
});

test('sort by last seen and by name', () => {
  const rows = [
    { id: 'b', name: 'Bramble', lastSeen: { zoneId: 'wind_scree', day: 2 } },
    { id: 'a', name: 'Ash', lastSeen: { zoneId: 'wind_scree', day: 9 } },
    { id: 'c', name: 'Ash', lastSeen: null }
  ];
  assert.deepStrictEqual(Directory.sortCats(rows, 'name').map((cat) => cat.id), ['a', 'c', 'b']);
  const seen = Directory.sortCats(rows, 'lastSeen');
  assert.deepStrictEqual(seen.map((cat) => cat.id), ['a', 'b', 'c']);
  assert.strictEqual(seen[0].lastSeen.when, 'Today');
  assert.strictEqual(seen[1].lastSeen.when, 'Earlier this season');
  assert.strictEqual(Object.hasOwn(seen[0].lastSeen, 'day'), false);
  assert.strictEqual(Directory.lastSeenWord(20, 21), 'Yesterday');
  assert.strictEqual(Directory.lastSeenWord(18, 21), 'A few days ago');
  assert.strictEqual(Directory.lastSeenWord(10, 20), 'Earlier this season');
  assert.strictEqual(Directory.lastSeenWord(1, 21), 'Last season');
  assert.strictEqual(Directory.lastSeenWord(1, 41), 'Long ago');
});

test('age words follow the directory bands', () => {
  assert.strictEqual(Directory.ageWord(0), 'cub');
  assert.strictEqual(Directory.ageWord(3), 'cub');
  assert.strictEqual(Directory.ageWord(4), 'half-grown');
  assert.strictEqual(Directory.ageWord(11), 'half-grown');
  assert.strictEqual(Directory.ageWord(12), 'young adult');
  assert.strictEqual(Directory.ageWord(19), 'young adult');
  assert.strictEqual(Directory.ageWord(20), 'prime');
  assert.strictEqual(Directory.ageWord(31), 'prime');
  assert.strictEqual(Directory.ageWord(32), 'grey');
  assert.strictEqual(Directory.ageWord(39), 'grey');
  assert.strictEqual(Directory.ageWord(40), 'elder');
  assert.strictEqual(Directory.ageWord(51), 'elder');
  assert.strictEqual(Directory.ageWord(-1), null);
  assert.strictEqual(Directory.ageWord(1.5), null);
});
