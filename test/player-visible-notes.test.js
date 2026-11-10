// Player-visible copy must not carry spec, implementation, or author notes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'src/renderer/data');
const VISIBLE = new Set(['text', 'label', 'summary', 'title', 'hostileText', 'hostileSummary', 'low', 'baseline', 'high', 'middle', 'base', 'reason', 'prompt', 'report', 'heading']);
const PHRASES = [
  /uses the existing/i,
  /formula/i,
  /§/,
  /PROPOSED/i,
  /does not close/i,
  /receipt/i,
  /ledger/i,
  /whether the limit/i,
  /states the limit/i,
  /lets you leave if/i,
  /the limit is/i,
  /% chance/i,
  /relationship:\s*-?\d+/i,
  /Faction\s*·\s*.+→\s*you\s*[+\-]?\d+/,
  /cost you\s+\d+/i,
  /[A-Za-z0-9_.]*_[A-Za-z0-9_.]*(?:\/[A-Za-z0-9_.]+){2,}|[A-Za-z0-9_.]+\/[A-Za-z0-9_.]*_[A-Za-z0-9_.]*(?:\/[A-Za-z0-9_.]+)+/
];

function files(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith('.json')) out.push(p);
  }
  return out;
}

function walk(node, trail, hits) {
  if (typeof node === 'string') {
    const key = trail[trail.length - 1];
    if (VISIBLE.has(key)) hits.push({ at: trail.join('.'), text: node });
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((value, i) => walk(value, trail.concat(String(i)), hits));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'devNote' || key === 'notes' || key === 'note' || key === 'mappingNote' || key === '_note') continue;
    if (key === 'uiHints' && value && typeof value === 'object') {
      for (const [hint, line] of Object.entries(value)) {
        if (hint.startsWith('_') || typeof line !== 'string') continue;
        hits.push({ at: trail.concat('uiHints', hint).join('.'), text: line });
      }
      continue;
    }
    walk(value, trail.concat(key), hits);
  }
}

function stringsIn(source) {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const noNotes = noComments.replace(/const devNote = \{[\s\S]*?\};/g, '');
  const found = [];
  const re = /'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"|`((?:\\`|[^`])*)`/g;
  let match;
  while ((match = re.exec(noNotes))) found.push(match[1] ?? match[2] ?? match[3]);
  return found;
}

test('player-visible text does not contain spec or author notes', () => {
  const hits = [];
  for (const file of files(DATA)) {
    const rel = path.relative(ROOT, file);
    walk(JSON.parse(fs.readFileSync(file, 'utf8')), [rel], hits);
  }
  const copy = JSON.parse(fs.readFileSync(path.join(DATA, 'menu-copy.json'), 'utf8'));
  for (const [key, value] of Object.entries(copy.strings || {})) {
    if (typeof value === 'string') hits.push({ at: `menu-copy.strings.${key}`, text: value });
  }
  for (const rel of ['src/renderer/js/game-screen.js', 'src/renderer/js/pairing.js', 'src/renderer/js/encounter.js', 'src/renderer/js/conversation.js', 'src/renderer/js/lone-actions.js']) {
    for (const text of stringsIn(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) {
      hits.push({ at: rel, text });
    }
  }
  const bad = hits.filter((row) => PHRASES.some((phrase) => phrase.test(row.text)));
  assert.deepStrictEqual(bad.map((row) => `${row.at}: ${row.text}`), []);
});

test('the wolf card cost is Saga\'s line, and the ford boundary actions use her cues', () => {
  const pass3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/narrative/pass-3-loner-meeting-and-nits.json'), 'utf8'));
  const screen = fs.readFileSync(path.join(ROOT, 'src/renderer/js/game-screen.js'), 'utf8');
  const wolf = pass3['B_encounterCost.wolf'];
  assert.ok(screen.includes(wolf));
  assert.ok(!screen.includes('The pack lets you leave if you give ground.'));
  assert.ok(!screen.includes("If you withdraw, the wolves may still give chase."));
  const tree = fs.readFileSync(path.join(ROOT, 'src/renderer/js/encounter.js'), 'utf8')
    + fs.readFileSync(path.join(DATA, 'events/encounters-v0.2.json'), 'utf8')
    + fs.readFileSync(path.join(DATA, 'menu-copy.json'), 'utf8');
  assert.ok(!tree.includes('The pack lets you leave if you give ground.'));

  const Speech = require('../src/renderer/js/speech');
  const conv = JSON.parse(fs.readFileSync(path.join(DATA, 'events/recurring-conversation.json'), 'utf8'));
  const ford = JSON.parse(fs.readFileSync(path.join(DATA, 'events/faction-proof-reconciled.json'), 'utf8')).fordStory.speechLocations;
  const cues = conv.personalityCoverage.contextActions.boundary;
  const authored = pass3['C_recurring-conversation.json.contextActions.boundary'];
  assert.deepStrictEqual(cues, authored);
  for (const [id, row] of Object.entries(ford)) {
    if (row.context !== 'boundary') continue;
    for (const band of ['high', 'low']) {
      const traits = { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50, [row.focusTrait]: band === 'high' ? 80 : 20 };
      const spoken = Speech.resolve({ speechLocations: { [id]: { focusTrait: row.focusTrait, base: row.base, low: row.low, high: row.high, context: row.context } }, contextActions: { boundary: cues } }, id, traits, { catName: 'Ash' });
      const cue = cues[row.focusTrait][band === 'high' ? 0 : 1].replaceAll('{catName}', 'Ash');
      assert.strictEqual(spoken.action, cue, `${id} ${band}`);
    }
  }
});
