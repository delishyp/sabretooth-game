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
  /ledger/i
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
