// Seed 8 replay: every card that shows a speaking cat uses the same head.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Screen = require('../src/renderer/js/game-screen');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const data = {
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'),
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
};
const names = j('names/names.json');
const looks = { coats: ['tan'], markings: ['none'], eyes: ['amber'] };
const E = Slice.create(Object.assign({ nameData: names, looks }, data));
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };

function matchSimple(node, sel) {
  if (sel.endsWith(':not(:disabled)')) {
    if (node.disabled) return false;
    sel = sel.slice(0, -':not(:disabled)'.length);
  }
  if (sel.startsWith('#')) return node.id === sel.slice(1);
  const attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/);
  if (attr) return node.dataset[attr[1].replace(/^data-/, '')] === attr[2];
  if (/^[a-z0-9]+$/i.test(sel)) return String(node.tagName || '').toLowerCase() === sel.toLowerCase();
  return false;
}
function matchChain(node, chain) {
  if (!matchSimple(node, chain[chain.length - 1])) return false;
  if (chain.length === 1) return true;
  let parent = node.parentNode;
  while (parent) {
    if (matchChain(parent, chain.slice(0, -1))) return true;
    parent = parent.parentNode;
  }
  return false;
}
function queryAll(root, selector) {
  const out = [];
  for (const part of selector.split(',').map((item) => item.trim()).filter(Boolean)) {
    const chain = part.split(/\s+/);
    const walk = (node) => {
      if (node !== root && matchChain(node, chain)) out.push(node);
      for (const child of node.children || []) walk(child);
    };
    walk(root);
  }
  return out;
}
class El {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.className = '';
    this.id = '';
    this.hidden = true;
    this.dataset = {};
    this._text = '';
    this.style = {};
    this.disabled = false;
    this.title = '';
    this.parentNode = null;
    this.clientWidth = 1280;
    this.clientHeight = 720;
    this.classList = { toggle: () => {} };
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = value == null ? '' : String(value); this.children = []; }
  get firstChild() { return this.children[0] || null; }
  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      node.parentNode = this;
      this.children.push(node);
    }
  }
  setAttribute() {}
  removeAttribute() {}
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(this, sel); }
}
function installDocument() {
  const nodes = {};
  const body = new El('div');
  const ids = ['game-main', 'home-cat', 'home-pride-name', 'home-player-name', 'home-head', 'home-expand', 'hotspot-den', 'hotspot-wild', 'home-nav', 'game-hud', 'home-panel', 'game-region', 'game-actions', 'dock-locked', 'game-report', 'game-event', 'cat-viewer', 'summary-body'];
  for (const id of ids) {
    const node = new El('div');
    node.id = id;
    body.append(node);
    nodes[id] = node;
  }
  nodes['cat-viewer'].hidden = true;
  global.document = {
    createElement: (tag) => new El(tag),
    body,
    getElementById: (id) => nodes[id] || null,
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel)
  };
}

function act(s, action) {
  const result = E.act(s, action);
  if (result.error) return null;
  return result.state;
}
function hooks() {
  return {
    talkView: (s) => E.talkView(s),
    fordView: (s) => E.world.fordView(s),
    borderView: (s) => E.world.borderView(s),
    encounterView: (s) => E.encounterView(s),
    sceneBeats: (s) => E.sceneBeats(s)
  };
}
function paintCard(screen, s) {
  screen.setState(s);
  screen.render();
  const head = document.getElementById('game-event').querySelector('#event-head');
  return head;
}

test('seed 8 cards that name a speaker all draw that cat\'s head', () => {
  installDocument();
  const painted = [];
  const t = (id) => String(id);
  t.has = () => false;
  t.plural = (id) => String(id);
  const screen = Screen.create({
    t, $: (sel) => document.querySelector(sel), show() {}, focus() {}, toast() {},
    portrait(spec, canvas) { painted.push({ name: spec.name, frame: arguments[2] && arguments[2].frame, canvas }); return Promise.resolve(); },
    creatorLooks: looks,
    api: { game: { save() { return Promise.resolve({ ok: true }); } } }
  }, data, names);

  const seen = new Map();
  function check(s, label) {
    const speaker = Screen.sceneHead(s, hooks());
    if (!speaker) return;
    const key = `${s.phase}:${(s.pending && s.pending.eventId) || label}`;
    if (seen.has(key)) return;
    painted.length = 0;
    const head = paintCard(screen, s);
    assert.ok(head, `${key} has no speaker head`);
    assert.strictEqual(head.id, 'event-head');
    assert.strictEqual(head.dataset.speaker, speaker.name, key);
    assert.ok(painted.some((row) => row.name === speaker.name && row.frame === 'head'), key);
    seen.set(key, speaker.name);
  }

  let s = E.newRun({ mainCat: player, seed: 8, runId: 'seed-8-heads' });
  const home = Object.values(s.npcs).find((npc) => npc && (npc.homeZones || []).length);
  s.region = home.homeZones[0];
  home.met = true;
  const scent = act(s, { type: 'scent' });
  assert.ok(scent && scent.pending && scent.pending.eventId === 'lone.scent');
  const catBeat = (scent.pending.beats || []).findIndex((beat) => beat.speakerId);
  assert.ok(catBeat >= 0, 'the scent card never names a cat');
  scent.pending.beatIndex = catBeat;
  assert.strictEqual(Screen.sceneHead(scent, hooks()).id, scent.pending.beats[catBeat].speakerId);
  check(scent, 'lone.scent');

  let cub = E.newRun({ mainCat: player, seed: 8, runId: 'seed-8-cub' });
  cub.needs.energy = 90;
  cub = act(cub, { type: 'helpCub' });
  assert.strictEqual(cub.pending.eventId, 'lone.cub');
  check(cub, 'lone.cub');
  cub = act(cub, { type: 'sceneChoose', choiceId: 'guide' });
  assert.ok((cub.pending.beats || []).some((beat) => beat.text && beat.text.includes('walk beside')));
  assert.strictEqual(Screen.sceneHead(cub, hooks()).id, cub.pending.motherId);
  check(cub, 'lone.cub');

  let walk = E.newRun({ mainCat: player, seed: 8, runId: 'seed-8-replay' });
  for (let step = 0; step < 40 && walk && walk.day <= 8; step++) {
    check(walk, walk.phase);
    if (walk.phase === 'day') {
      const next = act(walk, { type: 'rest' });
      if (!next) break;
      walk = next;
      continue;
    }
    if (walk.phase === 'event') {
      const beats = E.sceneBeats(walk) || [];
      if ((walk.pending.beatIndex || 0) < beats.length - 1) { walk = act(walk, { type: 'advanceBeat' }) || walk; continue; }
      if (walk.pending.cub) { walk = act(walk, { type: 'sceneChoose', choiceId: 'guide' }) || walk; continue; }
      walk = act(walk, { type: 'continue' }) || act(walk, { type: 'choose', choiceId: 'continue' }) || walk;
      continue;
    }
    const next = act(walk, { type: 'continue' });
    if (!next || next === walk) break;
    walk = next;
  }

  assert.ok(seen.has('event:lone.scent'), [...seen.keys()].join(','));
  assert.ok([...seen.keys()].some((key) => key.includes('lone.cub')), [...seen.keys()].join(','));
  assert.ok(seen.size >= 2, [...seen.keys()].join(','));
});
