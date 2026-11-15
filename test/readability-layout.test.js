// Layout-only readability: directory scroll, uncapped scene log, wrapping claim line.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Screen = require('../src/renderer/js/game-screen');

const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const copy = j('menu-copy.json').strings;

test('the talk log is capped so choices stay on the card', () => {
  assert.ok(!/\.conversation-card \.event-scroll \{[^}]*max-height:\s*140px/.test(css));
  assert.ok(!/\.encounter-card \.event-scroll \{[^}]*max-height:\s*64px/.test(css));
  assert.ok(!/\.encounter-card \.event-scroll \{[^}]*max-height:\s*88px/.test(css));
  const talk = css.match(/\.conversation-card \.event-scroll \{[^}]*\}/);
  assert.ok(talk, 'conversation scroll rule');
  assert.match(talk[0], /overflow-y:\s*auto/);
  assert.match(talk[0], /max-height:\s*min\(240px,\s*32cqh\)/);
  assert.ok(!/max-height:\s*none/.test(talk[0]), talk[0]);
  assert.match(css, /\.encounter-card \.event-scroll \{[^}]*max-height:\s*none/);
  assert.match(css, /\.event-scroll \.event-text \{[^}]*overflow:\s*visible/);
  assert.match(css, /\.conversation-card \{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.conversation-card \.event-choices \{[^}]*flex:\s*0 0 auto/);
  const screen = fs.readFileSync(path.join(__dirname, '../src/renderer/js/game-screen.js'), 'utf8');
  const talkFn = screen.slice(screen.indexOf('function renderTalk'), screen.indexOf('function renderFord'));
  const scrollAt = talkFn.indexOf('card.append(scroll)');
  const choicesAt = talkFn.indexOf('card.append(ch)');
  assert.ok(scrollAt > 0 && choicesAt > scrollAt, 'choices sit on the card, after the scroll pane');
  assert.ok(!talkFn.includes('scroll.append(ch)'));
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
  assert.strictEqual(Screen.territoryLine(own, {
    claimedBy: copy['game.region.owner'],
    unclaimed: copy['game.owner.wild'],
    holder, other,
    disputed: copy['game.owner.disputed']
  }), 'Claimed by Highcrag (disputed by Bonefield)');
});

test('wild land reads Unclaimed, with or without a dispute', () => {
  const words = {
    claimedBy: copy['game.region.owner'],
    unclaimed: copy['game.owner.wild'],
    other: 'Bonefield',
    disputed: copy['game.owner.disputed']
  };
  assert.strictEqual(Screen.territoryLine({ state: 'wild', holder: 'neutral', disputedBy: null }, words), 'Unclaimed');
  const disputed = Screen.territoryLine({ state: 'wild', holder: 'neutral', disputedBy: 'bonefield' }, words);
  assert.strictEqual(disputed, 'Unclaimed (disputed by Bonefield)');
  assert.ok(!disputed.startsWith('Claimed by'));
  assert.match(css, /\.region-claim \{[^}]*white-space:\s*normal/);
  assert.match(css, /\.region-claim \{[^}]*overflow-wrap:\s*break-word/);
  assert.ok(!/\.region-claim \{[^}]*ellipsis/.test(css));
  assert.ok(!/\.region-claim \{[^}]*nowrap/.test(css));
});
