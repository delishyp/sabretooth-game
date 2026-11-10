/**
 * Debug-only payoff scenes for Tracker. Not loaded by the game window.
 * A release build does not ship this file, and allowed() stays false when packaged.
 *
 *   SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js day10
 *   SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js you-came
 *   SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js i-waited
 *   SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js let-watch
 *   SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js gossip
 */
const fs = require('fs');
const path = require('path');
const Slice = require('../renderer/js/slice');

const D = path.join(__dirname, '../renderer/data');
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

function allowed(opts) {
  const env = (opts && opts.env) || {};
  const packaged = !!(opts && opts.packaged);
  return env.SABRETOOTH_PAYOFF_FIXTURES === '1' && !packaged;
}
function fresh() {
  return E.newRun({ mainCat: player, seed: 8, runId: 'payoff-fixture' });
}
function named(s, name) {
  return Object.values(s.npcs).find((npc) => npc && npc.name === name);
}
function meetKnown(s, npc) {
  const cat = s.npcs[npc.id];
  if (!cat.homeZones || !cat.homeZones.length) cat.homeZones = [s.region];
  s.region = cat.homeZones[0];
  cat.met = true;
  cat.lastRegion = s.region;
  s.day = s.day || 1;
  s.records.presenceFirst = { day: s.day, catId: cat.id };
  s.phase = 'day';
  s.pending = null;
  s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/approach/'));
  const opened = E.act(s, { type: 'approach' });
  if (opened.error) throw new Error(opened.error);
  return opened.state;
}
function textOf(s) {
  const p = s.pending || {};
  const beats = (p.beats || []).map((beat) => beat.text).join('\n');
  const choices = (p.choices || []).map((row) => row.label).join('\n');
  return [p.summary || '', beats, choices].filter(Boolean).join('\n');
}
function day10() {
  const s = fresh();
  s.day = 10;
  const cat = named(s, 'Sleet') || Object.values(s.npcs).find((npc) => npc.homeZones && npc.homeZones.length);
  const opened = meetKnown(s, cat);
  return { id: 'day10', day: opened.day, cat: opened.npcs[cat.id].name, text: textOf(opened), state: opened };
}
function youCame() {
  const offered = day10();
  const asked = E.act(offered.state, { type: 'choose', choiceId: 'ask_meet' }).state;
  asked.phase = 'day';
  asked.pending = null;
  asked.day = 11;
  asked.region = asked.records.rendezvous.zoneId;
  asked.records.receipts = (asked.records.receipts || []).filter((key) => !key.endsWith('/11'));
  const came = E.act(asked, { type: 'approach' }).state;
  return { id: 'you-came', day: came.day, text: textOf(came), state: came };
}
function iWaited() {
  const offered = day10();
  const asked = E.act(offered.state, { type: 'choose', choiceId: 'ask_meet' }).state;
  const away = j('map.json').regions.map((row) => row.id).find((id) => id !== asked.records.rendezvous.zoneId);
  asked.phase = 'day';
  asked.pending = null;
  asked.day = 11;
  asked.region = away;
  const ended = E.act(asked, { type: 'rest' }).state;
  const cat = named(ended, offered.cat) || ended.npcs[Object.keys(ended.npcs).find((id) => ended.npcs[id].name === offered.cat)];
  const later = meetKnown(ended, cat);
  return { id: 'i-waited', day: later.day, text: textOf(later), state: later };
}
function letWatch() {
  const s = fresh();
  const cat = named(s, 'Sleet');
  s.region = cat.homeZones[0];
  cat.met = true;
  E.lone.noteKill(s, null);
  s.pending = E.lone.killPresence(s, cat, { ownership: () => ({ state: 'wild' }) });
  s.phase = 'event';
  const watched = E.act(s, { type: 'sceneChoose', choiceId: 'let_watch' }).state;
  const next = meetKnown(watched, watched.npcs[cat.id]);
  return { id: 'let-watch', day: next.day, text: textOf(next), state: next };
}
function gossip() {
  const s = fresh();
  const speaker = named(s, 'Greyfall');
  const mate = s.npcs.hc02;
  s.pending = { eventId: 'slice.meeting.highcrag', catId: speaker.id, catName: speaker.name, day: s.day, choiceId: null };
  s.phase = 'event';
  let heard = E.act(s, { type: 'choose', choiceId: 'introduce' }).state;
  const factId = `${heard.runId}/knows_player_name/${speaker.id}`;
  heard.day = heard.worldMemory.knowledge[factId].rumorDay;
  heard.phase = 'day';
  heard.pending = null;
  heard = E.act(heard, { type: 'rest' }).state;
  const opener = meetKnown(heard, heard.npcs[mate.id]);
  return { id: 'gossip', day: opener.day, cat: mate.name, source: speaker.name, text: textOf(opener), state: opener };
}

const scenes = { day10, 'you-came': youCame, 'i-waited': iWaited, 'let-watch': letWatch, gossip };

if (require.main === module) {
  const name = process.argv[2];
  if (!allowed({ packaged: false, env: process.env })) {
    console.error('Payoff fixtures are debug-only. Set SABRETOOTH_PAYOFF_FIXTURES=1 outside a release build.');
    process.exit(1);
  }
  const run = scenes[name];
  if (!run) {
    console.error('Use one of: day10, you-came, i-waited, let-watch, gossip');
    process.exit(1);
  }
  const scene = run();
  console.log(scene.id, 'day', scene.day);
  console.log(scene.text);
}

module.exports = { allowed, scenes, day10, youCame, iWaited, letWatch, gossip };
