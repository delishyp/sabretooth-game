// Presentation only. Stored pride relation, receipts, and formulas stay as they are.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Screen = require('../src/renderer/js/game-screen');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json')
});
const label = (id) => ({ highcrag: 'Highcrag', bonefield: 'Bonefield', mistwood: 'Mistwood' }[id] || id);
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };

function fresh() {
  return E.newRun({ mainCat: player, seed: 4, runId: 'present' });
}

test('the header names a joined pride, keeps a founded name, and leaves a loner unnamed', () => {
  assert.strictEqual(Screen.presentationPrideName({ cat: {}, records: { pride: null } }, 'Nameless pride', label), 'Nameless pride');
  assert.strictEqual(Screen.presentationPrideName({
    cat: { status: 'member', prideId: 'highcrag' },
    records: { pride: { name: 'Stone Pride' } }
  }, 'Nameless pride', label), 'Stone Pride');
  assert.strictEqual(Screen.presentationPrideName({
    cat: { status: 'member', prideId: 'highcrag' }, records: { pride: null }
  }, 'Nameless pride', label), 'Highcrag');
});

test('the home route says membership after an accepted ask, and the card shows the saved relation', () => {
  const s = fresh();
  s.day = 21;
  s.region = 'highcrag';
  s.records.seasonEndShown = true;
  s.records.routeIntent = 'pride';
  s.npcs.hc01.met = true;
  s.cat.status = 'member';
  s.cat.prideId = 'highcrag';
  s.records.joinAsk.highcrag = { approved: true, season: 1, joined: true };
  s.prideRelation.highcrag = -15;
  s.worldMemory.prideToPlayer['highcrag->player'].value = 0;
  const reason = E.available(s).route.reason;
  assert.ok(reason.includes('You are a member of Highcrag'));
  assert.ok(!reason.includes('already asked'));
  assert.strictEqual(Screen.factionStandingText(s, 'highcrag', label), 'Faction · Highcrag → you -15');
  assert.strictEqual(s.prideRelation.highcrag, -15);
  assert.strictEqual(s.worldMemory.prideToPlayer['highcrag->player'].value, 0);
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(E.available(loaded).route.reason, reason);
  assert.strictEqual(loaded.prideRelation.highcrag, -15);
  assert.strictEqual(loaded.worldMemory.prideToPlayer['highcrag->player'].value, 0);
  assert.strictEqual(Screen.presentationPrideName(loaded, 'Nameless pride', label), 'Highcrag');
});

test('the day report shows the saved kill share once, and reload does not add another', () => {
  const s = fresh();
  s.region = 'highcrag';
  s.cat.status = 'member';
  s.cat.prideId = 'highcrag';
  s.prideRelation.highcrag = -15;
  const before = s.records.receipts.filter((key) => key.includes('/kill-share/')).length;
  const rested = E.act(s, { type: 'rest' }).state;
  const lines = rested.report.lines.filter((line) => line.k === 'killShare');
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].hunger, 20);
  assert.strictEqual(lines[0].pride, 'highcrag');
  assert.strictEqual(Screen.killShareText('Highcrag', lines[0].hunger), 'Highcrag shares a kill with you.');
  const shown = [rested.pending && rested.pending.resultLine, ...(rested.pending && rested.pending.beats || []).map((b) => b.text)].filter(Boolean).join('\n');
  assert.ok(shown.includes('Hunger +20'));
  assert.ok(!(rested.pending.beats || []).some((b) => /Hunger \+/.test(b.text)));
  assert.strictEqual(rested.records.receipts.filter((key) => key.includes('/kill-share/')).length, before + 1);
  assert.strictEqual(rested.prideRelation.highcrag, -15);
  const loaded = E.migrate(JSON.parse(JSON.stringify(rested)));
  assert.strictEqual(loaded.report.lines.filter((line) => line.k === 'killShare').length, 1);
  assert.strictEqual(loaded.records.receipts.filter((key) => key.includes('/kill-share/')).length, before + 1);
  let day = loaded;
  for (let i = 0; i < 4 && day.phase !== 'day'; i++) day = E.act(day, { type: 'continue' }).state;
  const again = E.migrate(JSON.parse(JSON.stringify(day)));
  assert.strictEqual(again.records.receipts.filter((key) => key.includes('/kill-share/')).length, before + 1);
  assert.strictEqual(again.report.lines.filter((line) => line.k === 'killShare').length, 1);
  assert.strictEqual(again.cat.prideId, 'highcrag');
});
