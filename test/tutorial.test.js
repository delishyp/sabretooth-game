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

test('the first Rest on day 3 shows after the result beat, on that same day', () => {
  const state = {};
  const during = base({ day: 3, inScene: true, flags: { rest: true } });
  const shownDuring = Tutorial.sync(state, during);
  assert.strictEqual(shownDuring.card, null);
  assert.ok(state.tutorial.queue.includes('tip.rest'));
  const after = base({ day: 3, inScene: false, flags: { rest: true } });
  const shown = Tutorial.sync(state, after);
  assert.strictEqual(shown.card && shown.card.id, 'tip.rest');
  assert.notStrictEqual(state.tutorial.shownTipDay, 3);
});

test('an action tip and one system tip both show the same day, and a second system tip stays queued', () => {
  const state = {};
  const facts = base({ day: 3, flags: { lowNeed: true, injured: true, rest: true } });
  const ids = [];
  Tutorial.sync(state, facts);
  for (let i = 0; i < 6 && state.tutorial.active; i++) {
    ids.push(state.tutorial.active.id);
    Tutorial.dismiss(state, facts);
  }
  assert.ok(ids.includes('tip.needs'), ids.join(','));
  assert.ok(ids.includes('tip.rest'), ids.join(','));
  assert.ok(!ids.includes('tip.injury'), ids.join(','));
  assert.ok(state.tutorial.queue.includes('tip.injury'));
  assert.strictEqual(state.tutorial.shownTipDay, 3);
});

test('Home is not tipped on the opening day screen, and is tipped the first time it is selected after leaving', () => {
  const state = {};
  Tutorial.sync(state, base({ day: 3, view: 'home' }));
  const held = () => state.tutorial.seen.concat(state.tutorial.queue, state.tutorial.active ? [state.tutorial.active.id] : []);
  assert.ok(!held().includes('tip.place.home'));
  Tutorial.sync(state, base({ day: 3, view: 'wilderness' }));
  if (state.tutorial.active) Tutorial.dismiss(state, base({ day: 3, view: 'home' }));
  Tutorial.sync(state, base({ day: 3, view: 'home' }));
  assert.ok(held().includes('tip.place.home'), held().join(','));
});

test('tips do not change the saved game, on or off', () => {
  const game = { day: 3, seed: 9, region: 'split_rock', needs: { energy: 40, hunger: 80 } };
  const on = JSON.parse(JSON.stringify(game));
  const off = JSON.parse(JSON.stringify(game));
  Tutorial.sync(on, base({ day: 3, enabled: true, flags: { rest: true } }));
  Tutorial.sync(off, base({ day: 3, enabled: false, flags: { rest: true } }));
  const strip = (s) => { const copy = JSON.parse(JSON.stringify(s)); delete copy.tutorial; return copy; };
  assert.deepStrictEqual(strip(on), game);
  assert.deepStrictEqual(strip(off), game);
  assert.strictEqual(on.tutorial.active && on.tutorial.active.id, 'tip.rest');
  assert.strictEqual(off.tutorial.active, null);
});

test('a places screen with no written tip does not open a blank card', () => {
  const state = {};
  const shown = Tutorial.sync(state, base({ day: 3, view: 'map' }));
  assert.notStrictEqual(state.tutorial.active && state.tutorial.active.id, 'tip.place.map');
  assert.ok(!shown.card || shown.card.id !== 'tip.place.map');
});

test('the Day 1 report continues steps 5–9 after the clock has rolled, and the action tips are offered', () => {
  const state = {};
  let facts = base();
  Tutorial.sync(state, facts);
  for (let i = 0; i < 12 && state.tutorial.active; i++) Tutorial.dismiss(state, facts);
  assert.strictEqual(state.tutorial.guidedIndex, 4);
  const report = { day: 1, region: 'split_rock', lines: [{ k: 'hunt', ok: true }, { k: 'watch' }] };
  const parsed = Tutorial.actionFrom(report);
  assert.strictEqual(parsed.lastAction, 'hunt');
  assert.strictEqual(parsed.reportDay, 1);
  facts = base({
    day: 2, reportDay: parsed.reportDay, lastAction: parsed.lastAction, huntMiss: parsed.huntMiss,
    showReport: parsed.showReport, metCat: { name: 'Darkclaw' },
    flags: { huntResult: true, watch: true, scent: true }
  });
  const ids = [];
  Tutorial.sync(state, facts);
  for (let i = 0; i < 12 && state.tutorial.active; i++) {
    ids.push(state.tutorial.active.id);
    Tutorial.dismiss(state, facts);
  }
  for (const id of ['guided.after.huntOk', 'guided.places', 'guided.cats', 'guided.lore', 'guided.closing']) {
    assert.ok(ids.includes(id), `${id} missing from ${ids.join(',')}`);
  }
  assert.strictEqual(state.tutorial.guidedDone, true);
  const held = new Set(state.tutorial.seen.concat(state.tutorial.queue, state.tutorial.active ? [state.tutorial.active.id] : []));
  for (const id of ['tip.hunt', 'tip.watch', 'tip.scent']) assert.ok(held.has(id), id);
  Tutorial.sync(state, base({ day: 3, view: 'wilderness' }));
  if (state.tutorial.active) Tutorial.dismiss(state, base({ day: 3, view: 'home' }));
  Tutorial.sync(state, base({ day: 3, view: 'home', flags: { unavailable: true } }));
  const places = new Set(state.tutorial.seen.concat(state.tutorial.queue, state.tutorial.active ? [state.tutorial.active.id] : []));
  assert.ok(places.has('tip.place.home'), [...places].join(','));
  assert.ok(places.has('tip.place.unavailable') || places.has('tip.place.wilderness'), [...places].join(','));
});

test('a real new game hunt writes a Day 1 report object and the guided day can read it', () => {
  const Slice = require('../src/renderer/js/slice');
  const path = require('path');
  const D = path.join(__dirname, '../src/renderer/data');
  const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
  const E = Slice.create({
    map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
    slots: j('world-slots.json'), nameData: j('names/names.json'),
    looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
    conversation: j('events/recurring-conversation.json'),
    encounters: j('events/encounters-v0.2.json'),
    borderPolicy: j('events/faction-proof-reconciled.json'),
    firstSeason: j('events/first-season-v0.6.2.json')
  });
  function untilDay(s) {
    for (let i = 0; i < 24 && s.phase !== 'day' && s.phase !== 'over'; i++) {
      let next;
      if (s.phase === 'encounter') {
        const v = E.encounterView(s);
        if (!v || v.terminal) next = E.act(s, { type: 'continue' });
        else {
          const ids = ['give_ground', 'leave', 'break_off', 'retreat', 'yield_kill', 'finish', 'withdraw'];
          const c = (v.choices || []).find((x) => ids.includes(x.id) && !x.disabled) || (v.choices || []).find((x) => !x.disabled);
          next = E.act(s, { type: 'encounterChoose', choiceId: c && c.id });
        }
      } else if (s.phase === 'event' || s.phase === 'eventResult') {
        const beats = E.sceneBeats(s);
        const idx = (s.pending && s.pending.beatIndex) || 0;
        const choices = (s.pending && s.pending.choices) || [];
        if (s.phase === 'event' && beats && !choices.length) next = E.act(s, { type: 'advanceBeat' });
        else if (s.phase === 'event' && choices.length) next = E.act(s, { type: 'choose', choiceId: choices[0].id });
        else next = E.act(s, { type: 'continue' });
      } else if (s.phase === 'conversation') {
        const view = E.talkView(s);
        const leave = (view.choices || []).find((c) => c.id === 'leave' || c.id === 'pause') || (view.choices || [])[0];
        next = E.act(s, { type: 'choose', choiceId: leave && leave.id, nodeId: view.nodeId, instanceId: view.instanceId });
      } else next = E.act(s, { type: 'continue' });
      assert.ok(next && !next.error, `${s.phase} ${next && next.error}`);
      s = next.state;
    }
    return s;
  }
  function played(s, facts) {
    const ids = [];
    Tutorial.sync(s, facts);
    for (let i = 0; i < 16 && s.tutorial.active; i++) {
      ids.push(s.tutorial.active.id);
      Tutorial.dismiss(s, facts);
    }
    return ids;
  }
  let s = E.newRun({ mainCat: { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} }, seed: 4, runId: 'guided' });
  Tutorial.ensure(s, true);
  s = untilDay(E.act(s, { type: 'hunt', size: 'small' }).state);
  assert.strictEqual(s.phase, 'day');
  assert.ok(s.report && Array.isArray(s.report.lines), 'report is {day, region, lines}');
  assert.strictEqual(s.report.day, 1);
  assert.ok(s.day > 1);
  assert.strictEqual(s.report.action, 'hunt');
  const parsed = Tutorial.actionFrom(s.report);
  assert.strictEqual(parsed.lastAction, 'hunt');
  assert.strictEqual(parsed.reportDay, 1);
  const met = Object.values(s.npcs || {}).find((n) => n && n.met);
  const facts = base({
    day: s.day, reportDay: parsed.reportDay, lastAction: parsed.lastAction, huntMiss: parsed.huntMiss,
    showReport: parsed.showReport, metCat: met ? { name: met.name } : null,
    flags: { huntResult: true }
  });
  const opened = played(s, base()).concat(played(s, facts));
  assert.ok(opened.includes('guided.after.huntOk') || opened.includes('guided.after.huntMiss'), opened.join(','));
  for (const id of ['guided.places', 'guided.lore', 'guided.closing']) assert.ok(opened.includes(id), `${id} missing from ${opened.join(',')}`);
  if (met) assert.ok(opened.includes('guided.cats'), opened.join(','));
  const held = new Set(s.tutorial.seen.concat(s.tutorial.queue, s.tutorial.active ? [s.tutorial.active.id] : []));
  assert.ok(held.has('tip.hunt'));
  s = untilDay(E.act(s, { type: 'watch' }).state);
  const watched = Tutorial.actionFrom(s.report);
  assert.strictEqual(watched.lastAction, 'watch');
  Tutorial.sync(s, base({ day: s.day, reportDay: watched.reportDay, lastAction: 'watch', showReport: true, flags: { watch: true } }));
  const afterWatch = new Set(s.tutorial.seen.concat(s.tutorial.queue, s.tutorial.active ? [s.tutorial.active.id] : []));
  assert.ok(afterWatch.has('tip.watch'), [...afterWatch].join(','));
  const scent = E.act(s, { type: 'scent' });
  assert.ok(!scent.error, scent.error);
  assert.strictEqual(scent.state.pending && scent.state.pending.eventId, 'lone.scent');
  const receipts = (scent.state.records && scent.state.records.receipts) || [];
  assert.ok(receipts.some((key) => String(key).includes('/scent/')));
  Tutorial.sync(scent.state, base({ day: scent.state.day, flags: { scent: true }, inScene: true }));
  const afterScent = new Set(scent.state.tutorial.seen.concat(scent.state.tutorial.queue, scent.state.tutorial.active ? [scent.state.tutorial.active.id] : []));
  assert.ok(afterScent.has('tip.scent'), [...afterScent].join(','));
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
