// Tutorial state machine (docs/design/tutorial-v0.1.md) and the Found-hint wording.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Tutorial = require('../src/renderer/js/tutorial');
const season = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/events/first-season-v0.6.2.json'), 'utf8'));

const base = (over = {}) => ({ day: 1, inScene: false, thirstShown: true, low: {}, inWindow: true, seasonOver: false, founded: false, mate: null, routeIntent: null, courtCat: null, bondEligible: false, eligibleMet: false, approval: null, metCat: null, lastAction: null, huntMiss: false, showReport: false, leftPath: false, enabled: true, flags: {}, ...over });

function walk(facts) {
  const state = {};
  const ids = [];
  Tutorial.sync(state, facts);
  for (let i = 0; i < 20 && state.tutorial.active; i++) {
    ids.push(state.tutorial.active.id);
    Tutorial.dismiss(state, facts);
  }
  return { state, ids };
}

test('guided beats follow the copy order, including thirst when it is shown', () => {
  const { ids } = walk(base());
  assert.deepStrictEqual(ids, [
    'guided.needs.place', 'guided.needs.needs', 'guided.needs.thirst', 'guided.needs.health',
    'guided.goal', 'guided.land', 'guided.choice.row', 'guided.choice.suggestHunt'
  ]);
});

test('story style skips the thirst beat and the thirst sentence', () => {
  const { ids, state } = walk(base({ thirstShown: false }));
  assert.ok(!ids.includes('guided.needs.thirst'));
  assert.ok(ids.includes('guided.needs.health'));
  assert.ok(state.tutorial.seen.includes('tip.needs'));
  assert.ok(state.tutorial.seen.includes('tip.health'));
  const hidden = Tutorial.copy.tips.find((tip) => tip.id === 'tip.needs').variants.thirstHidden;
  const card = Tutorial.sync({ tutorial: { ...state.tutorial, seen: state.tutorial.seen.filter((id) => id !== 'tip.needs'), active: null, guidedDone: true } }, base({ thirstShown: false, day: 2, flags: { lowNeed: true } })).card;
  assert.strictEqual(card && card.body, hidden);
});

test('tips off still shows the goal line and the urgent line, and shows no tip', () => {
  const state = {};
  const facts = base({ enabled: false, low: { hunger: true } });
  const shown = Tutorial.sync(state, facts);
  assert.strictEqual(shown.card, null);
  assert.strictEqual(shown.goal.line, 'Get your bearings. Eat, and look at the land.');
  assert.strictEqual(shown.urgent, 'Eat before you go on.');
  Tutorial.ensure(state, true);
  state.tutorial.off = true;
  const off = Tutorial.sync(state, base({ enabled: true, low: { health: true, hunger: true }, inScene: false }));
  assert.strictEqual(off.card, null);
  assert.strictEqual(off.urgent, 'Rest and recover before you go on.');
  assert.strictEqual(Tutorial.urgent(base({ inScene: true, low: { health: true } })), null);
});

test('a dismissed tip is not shown again, and the dismissal survives a save round-trip', () => {
  const state = {};
  const facts = base({ day: 2, flags: { lowNeed: true } });
  Tutorial.ensure(state, true);
  state.tutorial.guidedDone = true;
  const first = Tutorial.sync(state, facts);
  assert.strictEqual(first.card && first.card.id, 'tip.needs');
  Tutorial.dismiss(state, facts);
  assert.strictEqual(Tutorial.sync(state, facts).card, null);
  const restored = JSON.parse(JSON.stringify(state));
  assert.ok(restored.tutorial.seen.includes('tip.needs'));
  assert.strictEqual(Tutorial.sync(restored, facts).card, null);
  assert.strictEqual(restored.tutorial.off, false);
});

test('turn off tips keeps the goal and drops the card', () => {
  const state = {};
  Tutorial.sync(state, base());
  assert.ok(state.tutorial.active);
  const shown = Tutorial.turnOff(state, base({ low: { energy: true } }));
  assert.strictEqual(shown.card, null);
  assert.strictEqual(state.tutorial.off, true);
  assert.strictEqual(shown.goal.id, 'goal.first_day');
  assert.strictEqual(shown.urgent, 'Rest before you go on.');
});

test('goal states follow the spec order and never name an unmet cat', () => {
  assert.strictEqual(Tutorial.goal(base({ day: 3, founded: true, mate: { name: 'Ash', met: true } })).id, 'goal.found_set');
  assert.strictEqual(Tutorial.goal(base({ day: 4, mate: { name: 'Ash', met: true } })).line, 'Found a pride with Ash on Unclaimed land.');
  assert.strictEqual(Tutorial.goal(base({ day: 4, mate: { name: 'Ash', met: false } })).id, 'goal.meet');
  assert.strictEqual(Tutorial.goal(base({ day: 5, inWindow: true, courtCat: { name: 'Briar' } })).line, 'Court Briar.');
  assert.strictEqual(Tutorial.goal(base({ day: 6, inWindow: true, bondEligible: true })).id, 'goal.bond');
  assert.strictEqual(Tutorial.goal(base({ day: 8, inWindow: false, seasonOver: true, routeIntent: null })).line, 'Choose your path. You can ask to join a pride, look for other loners, or go on alone.');
  assert.strictEqual(Tutorial.goal(base({ day: 9, inWindow: false, seasonOver: true, routeIntent: 'alone' })).id, 'goal.route_alone');
  assert.strictEqual(Tutorial.goal(base({ day: 3, inWindow: false, seasonOver: false, founded: false, mate: null })).line, 'Stay alive.');
});

test('player-facing Found hints no longer say wild land', () => {
  const notWild = season.uiHints['found.notWild'];
  const find = (obj, key) => {
    if (!obj || typeof obj !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    for (const value of Object.values(obj)) { const hit = find(value, key); if (hit) return hit; }
    return null;
  };
  const beat = find(season, 'mated_unfounded').beats[0].text;
  assert.strictEqual(notWild, 'This land is already Claimed by a pride. Travel to Unclaimed land to Found a pride.');
  assert.strictEqual(beat, '{catName} is still your mate. You have no pride of your own yet, but you can still find Unclaimed land and Found a pride together.');
  const foundHints = Object.entries(season.uiHints).filter(([key]) => key.startsWith('found.')).map(([, text]) => text);
  for (const text of foundHints.concat(beat)) assert.ok(!/wild land/i.test(text), text);
});
