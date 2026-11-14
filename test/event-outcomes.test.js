const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Followups = require('../src/renderer/js/followups');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const eventsDir = path.join(D, 'events');
const slice1 = j('events/slice-1.json');
const conversation = j('events/recurring-conversation.json');
const season = j('events/first-season-v0.6.2.json');
const producer = j('events/faction-proof-reconciled.json');
const encounters = j('events/encounters-v0.2.json');
const rules = j('slice-rules.json');
const graph = conversation;
const E = Slice.create({
  map: j('map.json'), rules, events: slice1, slots: j('world-slots.json'),
  nameData: j('names/names.json'), looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: graph, borderPolicy: producer, encounters
});
const cat = { catId: 'player-1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: { coat: 'D/D' }, portraitId: 'cat-6e2d788dd48ff440' };

function resultText(choice) {
  return [choice.summary, choice.text, choice.resultLine, choice.B, choice.narration, choice.resultText]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .find((v) => v);
}

function outcomeId(choice) {
  return choice.outcome || choice.result || choice.outcomeId || null;
}

function gaps() {
  const missing = [];
  for (const event of slice1.events || []) {
    for (const choice of event.choices || []) {
      const line = resultText(choice) || (typeof event.summary === 'string' ? event.summary.trim() : '');
      const id = outcomeId(choice) || choice.id;
      if (!line || !id) missing.push(`${event.id}/${choice.id || '?'}`);
    }
    if (!(event.choices || []).length && !(event.summary || event.text)) missing.push(event.id);
  }
  const nodes = conversation.nodes || {};
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!node || node.removed) continue;
    for (const choice of node.choices || []) {
      if (choice.next) continue;
      const line = resultText(choice) || (typeof node.B === 'string' ? node.B.trim() : '') || (typeof node.narration === 'string' ? node.narration.trim() : '');
      const id = outcomeId(choice);
      if (!line || !id) missing.push(`conversation.${nodeId}.${choice.id}`);
    }
  }
  const fordChoices = (producer.fordStory && producer.fordStory.choices) || [];
  const results = (producer.fordStory && producer.fordStory.results) || {};
  for (const choice of fordChoices) {
    const row = results[choice.id];
    if (!row || !row.outcome || !String(row.text || '').trim()) missing.push(`m2.ford_prey_dispute/${choice.id}`);
  }
  return missing;
}

function playerOutcomeLines(node, trail, out) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const next = `${trail}.${key}`;
    if (typeof value === 'string') {
      if (/Requires$/.test(key) || key === 'death' || key === 'requires') continue;
      out.push({ path: next, text: value });
    } else playerOutcomeLines(value, next, out);
  }
}

test('every played path ends on a result line and an outcome id', () => {
  const missing = gaps();
  assert.deepStrictEqual(missing, [], `paths with no result line or outcome id:\n${missing.join('\n')}`);

  const company = conversation.nodes.company;
  const walk = Object.fromEntries((company.choices || []).map((choice) => [choice.id, choice]));
  assert.strictEqual(walk.quiet.label, '“Yes, let\'s walk.”');
  assert.strictEqual(walk.ask_first.label, '“Not today, sorry.”');
  assert.strictEqual(walk.press.label, '“I\'ll walk, but I want to talk.”');
  const repeat = season.families.find((family) => family.id === 'm2.repeat_meeting');
  const acquainted = season.families.find((family) => family.id === 'm2.acquainted');
  for (const family of [repeat, acquainted]) {
    const plain = family.choices.find((choice) => choice.id === 'talk_plain');
    assert.strictEqual(plain.label, '“I can stop for a few words, but I can\'t walk today.”');
  }
  const courting = season.families.find((family) => family.id === 'm2.season_end').results.unmated.recapByBestStage.courting.beats[0].text;
  assert.match(courting, /didn't become mates this season/);
  assert.doesNotMatch(courting, /still unsettled/);
  const locs = producer.policy.personalityCoverage.speechLocations;
  for (const id of ['leader_defer_caution', 'leader_defer_cause', 'leader_defer_standing']) {
    for (const band of ['low', 'base', 'high']) assert.match(locs[id][band], /on hold/, `${id}.${band}`);
  }
  assert.match(locs.leader_defer_caution.base, /after a wait/);
  assert.match(locs.leader_defer_cause.base, /until the trouble with Bonefield is settled/);
  assert.match(locs.leader_defer_standing.base, /thinks better of you/);
  const joined = [courting, walk.quiet.label, walk.ask_first.label, walk.press.label].concat(
    ['leader_defer_caution', 'leader_defer_cause', 'leader_defer_standing'].flatMap((id) => ['low', 'base', 'high'].map((band) => locs[id][band]))
  ).join('\n');
  assert.doesNotMatch(joined, /TODO/);
});

test('encounter results shown to the player are concrete lines', () => {
  const lines = [];
  for (const encounter of encounters.encounters || []) playerOutcomeLines(encounter.outcomeRendering, encounter.id, lines);
  assert.ok(lines.length >= 9);
  for (const row of lines) {
    assert.ok(row.text.trim(), row.path);
    assert.doesNotMatch(row.text, /Show this only|authoring|effectRule|\*Requires/i, row.path);
  }
});

function toFord(s) {
  let cur = s;
  for (let i = 0; i < 12 && cur.phase !== 'day' && cur.phase !== 'ford' && !cur.over; i++) {
    if (cur.phase === 'encounter') {
      const v = E.encounterView(cur);
      if (!v || v.terminal) cur = E.act(cur, { type: 'continue' }).state;
      else {
        const ids = ['give_ground', 'leave', 'break_off', 'retreat', 'yield_kill', 'finish', 'withdraw'];
        const c = v.choices.find((x) => ids.includes(x.id) && !x.disabled) || v.choices.find((x) => !x.disabled);
        cur = E.act(cur, { type: 'encounterChoose', choiceId: c.id }).state;
      }
    } else if (cur.phase === 'event') {
      const ev = E.eventById(cur.pending.eventId);
      const pass = ev && (ev.choices || []).find((c) => c.id === 'pass');
      cur = E.act(cur, { type: 'choose', choiceId: cur.pending.hostile ? 'flee' : (pass || ev.choices[0]).id }).state;
    } else if (cur.phase === 'conversation') {
      const view = E.talkView(cur);
      const leave = (view.choices || []).find((c) => c.id === 'leave' || c.id === 'pause') || (view.choices || [])[0];
      if (!leave) break;
      cur = E.act(cur, { type: 'choose', choiceId: leave.id, nodeId: view.nodeId, instanceId: view.instanceId }).state;
    } else cur = E.act(cur, { type: 'continue' }).state;
  }
  return cur;
}
function openFord(seed, runId) {
  let s = E.newRun({ mainCat: cat, seed, runId });
  s = toFord(E.act(s, { type: 'travel', to: 'greywater_ford' }).state);
  assert.strictEqual(s.phase, 'ford');
  return s;
}

test('Greywater Ford has one result per choice and the same deltas', () => {
  const expect = {
    help_bonefield_cat: {
      outcome: 'ford_bonefield_keeps',
      line: /drags the carcass out of the water/,
      who: 'bf',
      keeper: 'bonefield'
    },
    side_with_highcrag: {
      outcome: 'ford_highcrag_keeps',
      line: /lets go and wades back/,
      keeps: /hauls the carcass/,
      who: 'hc',
      keeper: 'highcrag'
    },
    stay_out: {
      outcome: 'ford_river_takes',
      line: /carries it downstream/,
      empty: /leave with nothing/,
      who: null,
      keeper: 'river'
    }
  };
  for (const [choiceId, spec] of Object.entries(expect)) {
    const s0 = openFord(4, 'ford-result-' + choiceId);
    const hc = s0.npcs[s0.ford.hcId];
    const bf = s0.npcs[s0.ford.bfId];
    const hcBefore = hc.affinity || 0;
    const bfBefore = bf.affinity || 0;
    const s = E.act(s0, { type: 'fordChoose', choiceId }).state;
    assert.strictEqual(s.ford.outcome, spec.outcome, choiceId);
    assert.match(s.ford.resultLine, spec.line, choiceId);
    if (spec.keeps) assert.match(s.ford.resultLine, spec.keeps, choiceId);
    if (spec.empty) assert.match(s.ford.resultLine, spec.empty, choiceId);
    assert.doesNotMatch(s.ford.resultLine, /unsettled|argument remains/i, choiceId);
    const last = s.ford.lines[s.ford.lines.length - 1];
    assert.strictEqual(last.kind, 'narration');
    assert.strictEqual(last.text, s.ford.resultLine);
    assert.strictEqual(s.worldMemory.prideToPride['highcrag->bonefield'].value, -20);
    assert.strictEqual(s.worldMemory.prideToPride['bonefield->highcrag'].value, -10);
    assert.strictEqual(s.npcs[s.ford.hcId].affinity || 0, hcBefore + (spec.who === 'hc' ? 5 : 0));
    assert.strictEqual(s.npcs[s.ford.bfId].affinity || 0, bfBefore + (spec.who === 'bf' ? 5 : 0));
    const dispute = s.worldMemory.knowledge[`${s.runId}/ford_dispute/highcrag/bonefield`];
    assert.strictEqual(dispute.preyKeeper, spec.keeper);
    const closed = E.act(s, { type: 'continue' }).state;
    assert.notStrictEqual(closed.phase, 'ford');
  }
});

test('a cat who was at the ford does not tell it back as news', () => {
  const Pass2 = require('../src/renderer/js/pass2');
  let s = openFord(4, 'ford-knows');
  s = E.act(s, { type: 'fordChoose', choiceId: 'side_with_highcrag' }).state;
  const scene = Followups.create(rules).scene(s, s.ford.hcId, {});
  assert.ok(scene);
  const text = scene.beats.map((beat) => beat.text || '').join('\n');
  assert.match(text, /You stood with me at the ford/);
  assert.doesNotMatch(text, /There was trouble at Greywater Ford|Word is some loner/);
  const dispute = `${s.runId}/ford_dispute/highcrag/bonefield`;
  const knows = String(Pass2.gossipPhrase(dispute, s.runId, { listenerParticipated: true }));
  const plain = String(Pass2.gossipPhrase(dispute, s.runId, { listenerParticipated: false }));
  assert.match(knows, /You were at Greywater Ford/);
  assert.match(plain, /There was trouble at Greywater Ford/);
  const gossipChoices = Pass2.choices('ford_friend', { catName: 'Shalemark', gossip: true });
  const told = gossipChoices.find((choice) => choice.id === 'honest_limit');
  assert.ok(told);
  assert.match(told.label, /I already know\. I was there/);
  assert.match(told.reply.parts[0].say, /wasn't telling it like news/);
  const help = Pass2.choices('ford_friend', { catName: 'Shalemark' }).find((choice) => choice.id === 'honest_limit');
  assert.match(help.label, /glad to help/);
});
