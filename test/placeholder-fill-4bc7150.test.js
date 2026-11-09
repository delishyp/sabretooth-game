// Saga's prose for the twelve lone-action lines. Tokens resolve. No devNote remains.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const fill = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/placeholder-fill-4bc7150.json'), 'utf8'));
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

function prose(event) {
  assert.ok(event && !Object.prototype.hasOwnProperty.call(event, 'devNote'), 'devNote still on the event');
  const text = (event.beats || []).map((b) => b.text).join('\n');
  assert.ok(!/placeholder/i.test(text), text);
  assert.ok(!text.includes('{name}') && !text.includes('{pride}') && !text.includes('{mother}'), text);
  return text;
}
function expectLine(text, key, vars) {
  const line = fill[key].replace(/\{(name|pride|mother)\}/g, (m, k) => vars[k]);
  assert.ok(text.includes(line), `${key}\n${text}`);
}

test('each lone action renders Saga\'s line for a real cat, with no placeholder left', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'ravenmark' });
  const cat = s.npcs.ln02;
  assert.strictEqual(cat.name, 'Sleet');
  s.region = cat.homeZones[0];
  cat.met = true;
  cat.affinity = 25;
  s.needs.energy = 90;
  s.injuries = [];
  const opts = {
    neighbours: E.W.neighbours(s.region),
    ownership: (id) => E.W.ownership(s.map.claims, id),
    regionName: (id) => E.W.region(id).name,
    preyValue: () => 2,
    standing: () => 0,
    leaderIds: ['hc01', 'bf01', 'mw01'],
    den: () => 'bonefield',
    feud: () => null,
    huntChance: () => 80,
    trailReadingM: 0,
    fight: () => ({ won: true })
  };

  const shadow = { success: false, caught: false };
  for (let day = 1; day <= 40 && (!shadow.success || !shadow.caught); day++) {
    s.day = day;
    s.needs.energy = 90;
    s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/shadow/'));
    const opened = E.lone.beginShadow(s, cat.id, opts);
    assert.ok(!opened.error, opened.error);
    const text = prose(opened.event);
    assert.ok(text.includes('Sleet'));
    if (text.includes('never looks back')) { expectLine(text, 'devNote.shadow.success', { name: 'Sleet' }); shadow.success = true; }
    if (text.includes('furious') || text.includes('hiding place')) { expectLine(text, 'devNote.shadow.caught', { name: 'Sleet' }); shadow.caught = true; }
  }
  assert.ok(shadow.success && shadow.caught);

  s.day = 3;
  s.needs.energy = 90;
  s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/spar/'));
  opts.fight = () => ({ won: true });
  const win = E.lone.beginSpar(s, cat.id, opts);
  expectLine(prose(win.event), 'devNote.spar.win', { name: 'Sleet' });
  s.day = 4;
  s.needs.energy = 90;
  s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/spar/'));
  opts.fight = () => ({ won: false });
  const lose = E.lone.beginSpar(s, cat.id, opts);
  expectLine(prose(lose.event), 'devNote.spar.lose', { name: 'Sleet' });

  s.day = 5;
  s.needs.energy = 90;
  s.region = 'split_rock';
  s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/scout/'));
  const scout = E.lone.beginScout(s, 'bonefield', opts);
  expectLine(prose(scout.event), 'devNote.scout', { pride: 'Bonefield' });

  const steal = { success: false, caught: false };
  for (let day = 1; day <= 20 && (!steal.success || !steal.caught); day++) {
    s.day = day;
    s.needs.energy = 90;
    s.region = 'split_rock';
    E.lone.noteKill(s, 'bonefield');
    s.records.freshKill.stolen = false;
    s.records.receipts = (s.records.receipts || []).filter((key) => !key.includes('/steal/'));
    const opened = E.lone.beginSteal(s, opts);
    assert.ok(!opened.error, opened.error);
    const text = prose(opened.event);
    if (opened.ok) {
      expectLine(text, 'devNote.steal.success', {});
      assert.strictEqual(opened.event.resultLine, 'Hunger +25');
      steal.success = true;
    } else {
      expectLine(text, 'devNote.steal.caught', {});
      assert.strictEqual(opened.event.resultLine, '');
      assert.ok(!/injury|scuffle|hurt/i.test(text));
      steal.caught = true;
    }
  }
  assert.ok(steal.success && steal.caught);

  s.day = 1;
  s.needs.energy = 90;
  s.region = 'split_rock';
  s.records.cubPrideDay = {};
  s.records.cubs = {};
  const cub = E.lone.beginCub(s, opts);
  const intro = prose(cub.event);
  const prideName = intro.match(/A (\w+) cub/)[1];
  expectLine(intro, 'devNote.cub.intro', { pride: prideName });
  s.pending = cub.event;
  s.phase = 'event';
  const helped = E.act(s, { type: 'choose', choiceId: 'guide' }).state;
  const helpText = (helped.pending.beats || []).map((b) => b.text).join('\n');
  expectLine(helpText, 'devNote.cub.help', { mother: s.npcs[cub.event.motherId].name });
  assert.ok(!helpText.includes('{mother}'));
  assert.ok(!helped.pending.devNote);

  const left = E.newRun({ mainCat: player, seed: 8, runId: 'leave-cub' });
  left.needs.energy = 90;
  left.region = 'split_rock';
  const again = E.lone.beginCub(left, opts);
  left.pending = again.event;
  left.phase = 'event';
  const ignored = E.act(left, { type: 'choose', choiceId: 'ignore' }).state;
  const leaveText = (ignored.pending.beats || []).map((b) => b.text).join('\n');
  expectLine(leaveText, 'devNote.cub.leave', {});

  const shareRun = E.newRun({ mainCat: player, seed: 8, runId: 'share' });
  shareRun.region = cat.homeZones[0];
  shareRun.npcs.ln02.met = true;
  E.lone.noteKill(shareRun, null);
  const shared = E.lone.shareKill(shareRun, 'ln02');
  expectLine(prose(shared.event), 'devNote.share', { name: shareRun.npcs.ln02.name });

  const watch = E.act(E.newRun({ mainCat: player, seed: 8, runId: 'watch' }), { type: 'watch' }).state;
  expectLine(prose(watch.pending), 'devNote.watch', {});
  assert.strictEqual(watch.pending.resultLine, 'Energy +20');
});
