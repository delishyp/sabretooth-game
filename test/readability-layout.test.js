// Layout-only readability: directory scroll, uncapped scene log, wrapping claim line.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const copy = j('menu-copy.json').strings;

test('the scene log is not capped at 140px or 64px and can scroll', () => {
  assert.ok(!/\.conversation-card \.event-scroll \{[^}]*max-height:\s*140px/.test(css));
  assert.ok(!/\.encounter-card \.event-scroll \{[^}]*max-height:\s*64px/.test(css));
  assert.ok(!/\.encounter-card \.event-scroll \{[^}]*max-height:\s*88px/.test(css));
  assert.match(css, /\.conversation-card \.event-scroll \{[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.conversation-card \.event-scroll \{[^}]*max-height:\s*none/);
  assert.match(css, /\.encounter-card \.event-scroll \{[^}]*max-height:\s*none/);
  assert.match(css, /\.event-scroll \.event-text \{[^}]*overflow:\s*visible/);
});

test('the Smilodon directory list scrolls inside the dock', () => {
  assert.match(css, /#home-panel:has\(\.home-cats\) \{[^}]*overflow-y:\s*auto/);
  assert.match(css, /#home-panel:has\(\.home-cats\) \{[^}]*min-height:\s*0/);
  const names = j('names/names.json');
  assert.ok(names.female.includes('Sunstep') || names.male.includes('Sunstep') || (names.either || []).includes('Sunstep'));
});

test('a disputed hunt territory line is the full wrapping claim', () => {
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
  const s = E.newRun({ mainCat: { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} }, seed: 8, runId: 'claim' });
  const own = E.W.ownership(s.map.claims, 'greywater_ford');
  const holder = copy[`game.faction.${own.holder}`];
  const other = copy[`game.faction.${own.disputedBy}`];
  const owner = copy['game.owner.disputed'].replace('{holder}', holder).replace('{other}', other);
  const line = `${copy['game.region.owner']} ${owner}`;
  assert.strictEqual(line, 'Claimed by Highcrag (disputed by Bonefield)');
  assert.match(css, /\.region-claim \{[^}]*white-space:\s*normal/);
  assert.match(css, /\.region-claim \{[^}]*overflow-wrap:\s*break-word/);
  assert.ok(!/\.region-claim \{[^}]*ellipsis/.test(css));
  assert.ok(!/\.region-claim \{[^}]*nowrap/.test(css));
});
