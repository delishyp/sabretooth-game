// Cub help stays on screen, stat numbers leave the prose, and quiet-day presence follows the spec.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const scent = j('events/scent-sign-v1.json');
const presence = j('events/cat-presence-v0.1.json');
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

function act(s, action) {
  const r = E.act(s, action);
  assert.ok(!r.error, `${r.error} ${action.type || ''} ${action.choiceId || ''}`);
  return r.state;
}
function opts(s) {
  return {
    neighbours: E.W.neighbours(s.region),
    ownership: (id) => E.W.ownership(s.map.claims, id),
    zoneHolder: null,
    priorityIds: []
  };
}

test('cub help beats stay up when the result line is empty, and the quiet filler does not replace them', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'cub-hold' });
  s.needs.energy = 90;
  s = act(s, { type: 'helpCub' });
  s = act(s, { type: 'sceneChoose', choiceId: 'guide' });
  assert.strictEqual(s.phase, 'eventResult');
  assert.strictEqual(s.pending.resultLine, '');
  assert.strictEqual(E.shouldHoldResult(s), true);
  const help = (s.pending.beats || []).map((b) => b.text).join('\n');
  assert.ok(help.includes('walk beside it'), help);
  s = act(s, { type: 'continue' });
  const quiet = ((s.pending && s.pending.beats) || []).map((b) => b.text).join('\n');
  assert.ok(!quiet.includes('Nothing else disturbed your day'), quiet);
  assert.notStrictEqual(s.pending && s.pending.eventId, 'day.quiet');
});

test('report prose does not carry relationship or health-cost numbers', () => {
  const copy = j('menu-copy.json').strings;
  assert.strictEqual(copy['game.report.patrol'], 'You crossed {faction} territory.');
  assert.ok(!/relationship:\s*-?\d+/i.test(copy['game.report.starving']));
  assert.ok(!/cost you\s+\d+/i.test(copy['game.report.starving']));
  assert.ok(!/cost you\s+\d+/i.test(copy['game.report.parched']));
  assert.ok(!/Energy \+/.test(copy['game.report.rest']));
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'rest-line' });
  s = act(s, { type: 'rest' });
  const beats = ((s.pending && s.pending.beats) || []).map((b) => b.text).join('\n');
  assert.ok(!/Energy \+/.test(beats), beats);
  assert.match(s.pending.resultLine || '', /Energy \+/);
});

test('scent lines use Saga\'s keys and leave no push without one', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'scent-keys' });
  const cat = s.npcs.ln05;
  s.region = cat.homeZones[0];
  cat.met = true;
  cat.personality = Object.assign({}, cat.personality, { aggression: 80 });
  cat.affinity = -20;
  const read = E.lone.scentLines(s, {
    holder: 'bonefield', metPride: true, preyValue: 2,
    hazards: ['tar', 'wolves'],
    report: { region: s.region, day: s.day, lines: [{ k: 'hunt', ok: true }] }
  });
  const text = read.lines.join('\n');
  assert.ok(text.startsWith(scent.opener));
  assert.ok(text.includes(scent.catKnown.replaceAll('{name}', cat.name)));
  assert.ok(text.includes(scent.rivalKnown.replaceAll('{name}', cat.name)));
  assert.ok(text.includes(scent.prideMarked.bonefield));
  assert.ok(text.includes(scent.ownKill));
  assert.ok(text.includes(scent.prey.fair));
  assert.ok(text.includes(scent.hazard.tar));
  assert.ok(text.includes(scent.hazard.wolves));
  const bare = E.newRun({ mainCat: player, seed: 2, runId: 'scent-empty' });
  bare.region = 'wind_scree';
  for (const npc of Object.values(bare.npcs)) npc.homeZones = [];
  const empty = E.lone.scentLines(bare, { holder: 'neutral', preyValue: null, hazards: [] });
  assert.ok(empty.lines.includes(scent.nothing));
  assert.ok(empty.lines.includes(scent.opener));
  const mapHazards = j('map.json').hazards.map((h) => h.id);
  const missing = mapHazards.filter((id) => !scent.hazard[id]);
  assert.deepStrictEqual(missing, []);
});

test('a vantage sighting uses the present cat, and an empty zone invents nobody', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'vantage' });
  const cat = s.npcs.ln05;
  s.region = cat.homeZones[0];
  for (const npc of Object.values(s.npcs)) {
    npc.met = npc.id === cat.id;
    npc.affinity = 0;
  }
  s.needs.energy = 40;
  s = act(s, { type: 'watch' });
  const beats = (s.pending.beats || []).map((b) => b.text).join('\n');
  assert.strictEqual(s.pending.presence, 'watch');
  assert.ok(beats.includes(cat.name), beats);
  assert.ok(s.records.receipts.some((key) => key.includes('/approach/')));
  const down = act(s, { type: 'sceneChoose', choiceId: 'go_down' });
  assert.ok(down.pending && down.pending.catId === cat.id);
  assert.notStrictEqual(down.pending.presence, 'watch');

  let empty = E.newRun({ mainCat: player, seed: 3, runId: 'empty-stone' });
  for (const npc of Object.values(empty.npcs)) { npc.met = false; npc.homeZones = []; }
  empty.region = 'wind_scree';
  let stone = null;
  for (let i = 0; i < 30 && empty.day <= 20 && !stone; i++) {
    if (empty.phase === 'event' || empty.phase === 'eventResult') empty = act(empty, { type: 'continue' });
    else if (empty.phase === 'day') empty = act(empty, { type: 'rest' });
    else break;
    if (empty.pending && empty.pending.eventId === 'slice.region.wind_scree') stone = empty;
  }
  assert.ok(stone, 'the loose stone did not open');
  assert.ok(!stone.pending.presence);
  assert.ok(!stone.pending.catId);
  assert.ok(E.eventById('slice.region.wind_scree').text.includes('small shape'));
});

test('spar below 20 is shown locked, and the gate still refuses the action', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'spar-lock' });
  const cat = s.npcs.ln02;
  s.region = cat.homeZones[0];
  cat.met = true;
  cat.affinity = 5;
  s.needs.energy = 90;
  s.injuries = [];
  const row = E.lone.menu(s, opts(s)).spar.find((item) => item.id === cat.id);
  assert.ok(row && row.locked);
  assert.strictEqual(row.line, presence['presence.spar.locked'].text.replaceAll('{name}', cat.name));
  assert.strictEqual(E.lone.beginSpar(s, cat.id, Object.assign(opts(s), { fight: () => ({ won: true }) })).error, 'target');
  cat.affinity = 20;
  const open = E.lone.menu(s, opts(s)).spar.find((item) => item.id === cat.id);
  assert.ok(open && !open.locked);
});

test('a small hunt with nobody present does not invent a cat', () => {
  let s = E.newRun({ mainCat: player, seed: 8, runId: 'hunt-empty' });
  for (const npc of Object.values(s.npcs)) npc.met = false;
  s.needs.hunger = 10;
  s.needs.energy = 90;
  s = act(s, { type: 'hunt', size: 'small' });
  const walk = (ev) => {
    if (!ev) return false;
    return !!ev.presence || walk(ev.next);
  };
  assert.ok(!walk(s.pending));
});
