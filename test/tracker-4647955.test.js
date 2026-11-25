// Tracker 4647955 replay fixes: one speaker name, card words, spar under More, greet variants.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Screen = require('../src/renderer/js/game-screen');
const Slice = require('../src/renderer/js/slice');
const Fixtures = require('../src/dev/payoff-fixtures');

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
const pass6 = j('events/pass-6-tracker-4647955.json');

test('a speech line that already starts with the name is not prefixed again', () => {
  const line = Screen.speechLine({ kind: 'speech', speaker: 'Sleetbark', text: "Sleetbark's ears flatten. “Keep walking, stranger.”" });
  assert.strictEqual(line, "Sleetbark's ears flatten. “Keep walking, stranger.”");
  assert.strictEqual((line.match(/Sleetbark/g) || []).length, 1);
  assert.strictEqual(Screen.speechLine({ kind: 'speech', speaker: 'Sleetbark', text: 'Keep walking.' }), 'Sleetbark: Keep walking.');
});

test('the deer card uses energy words, and stacked result lines do not double the period', () => {
  const cost = Screen.deerCostText(j('slice-rules.json'));
  assert.ok(cost.includes('That took a little out of you.'));
  assert.ok(cost.includes('Your legs feel heavy.'));
  assert.ok(!/Energy\s*[+\-−]\s*\d+/.test(cost), cost);
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'quiet-period' });
  s.needs = { health: 80, hunger: 0, thirst: 100, energy: 40 };
  s.counters.starving = 2;
  const worn = E.act(s, { type: 'rest' }).state;
  const line = worn.pending && (worn.pending.resultLine || worn.pending.summary) || '';
  assert.ok(line.includes("You're starving."));
  assert.ok(!line.includes('..'), line);
});

test('locked spar is one More row, not one line per cat', () => {
  const rows = ['Sleet', 'Cragward', 'Greyfall', 'Sunstep', 'Ashmane'].map((name) => ({
    name, locked: true, line: `${name} doesn't know you well enough to wrestle with you yet.`
  }));
  const shown = Screen.sparLockDisplay(rows);
  assert.deepStrictEqual(shown.open, []);
  assert.strictEqual(shown.more.label, 'Spar');
  assert.strictEqual((shown.more.reason.match(/doesn't know you/g) || []).length, 0);
  assert.ok(!shown.more.reason.includes('Sleet'));
  const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');
  assert.match(css, /\.region-facts dt, \.region-facts dd \{[^}]*overflow-wrap:\s*anywhere/);
  assert.ok(!/\.region-facts[^{]*\{[^}]*ellipsis/.test(css));
});

test('prey size is lowercase inside a sentence and stays capital on the hunt button', () => {
  assert.strictEqual(Screen.sizeInSentence('Small'), 'small');
  assert.strictEqual(Screen.sizeInSentence('Medium'), 'medium');
  assert.strictEqual(Screen.sizeInSentence('Large'), 'large');
  assert.strictEqual(j('menu-copy.json').strings['game.size.small'], 'Small');
  const said = E.huntReportText({ k: 'hunt', ok: true, size: 'medium', ate: 50 }, 'bonefield');
  assert.ok(said && said.includes('medium prey'), said);
  assert.ok(!/Medium prey/.test(said || ''));
});

test('seed-8 Sleetbark and Cragward get different Just me replies', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'greet-pair' });
  const sleet = Object.values(s.npcs).find((npc) => npc.name === 'Sleetbark');
  const crag = Object.values(s.npcs).find((npc) => npc.name === 'Cragward');
  const a = E.lonerGreetText(sleet);
  const b = E.lonerGreetText(crag);
  assert.notStrictEqual(a, b);
  assert.ok(a.includes('Sleetbark'));
  assert.ok(b.includes('Cragward'));
  assert.ok(!/\{catName\}/.test(a + b));
  assert.strictEqual(pass6.key, 'slice.meeting.loner/greet.text');
  assert.strictEqual(pass6.variants.length, 6);
  assert.strictEqual(pass6.variants.filter((row) => row.when).length, 5);
});

test('payoff fixtures stay out of a release build', () => {
  assert.strictEqual(Fixtures.allowed({ packaged: true, env: { SABRETOOTH_PAYOFF_FIXTURES: '1' } }), false);
  assert.strictEqual(Fixtures.allowed({ packaged: false, env: {} }), false);
  assert.strictEqual(Fixtures.allowed({ packaged: false, env: { SABRETOOTH_PAYOFF_FIXTURES: '1' } }), true);
  const { minimatch } = require('minimatch');
  const files = require('../package.json').build.files;
  const ships = (rel) => files.reduce((inc, pattern) => (pattern.startsWith('!') ? (minimatch(rel, pattern.slice(1), { dot: true }) ? false : inc) : (inc || minimatch(rel, pattern, { dot: true }))), false);
  assert.ok(!ships('src/dev/payoff-fixtures.js'));
  assert.ok(!ships('docs/dev/payoff-fixtures.md'));
  const day = Fixtures.day10();
  assert.ok(day.text.includes('Meet me'));
  assert.ok(Fixtures.youCame().text.includes('You came'));
  assert.ok(Fixtures.iWaited().text.includes('I waited'));
  assert.ok(Fixtures.letWatch().text.includes('ate that whole kill'));
  assert.ok(Fixtures.gossip().text.includes('Greyfall'));
  assert.ok(Fixtures.gossip().text.includes('told me about'));
});
