// Scene log tones: plain strings, mixed parts, and byCat.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SceneLog = require('../src/renderer/js/scene-log');

const ctx = { catId: 'bf06', playerId: 'player-1', playerName: 'Ravenmark' };

test('a plain string is narrator cream only', () => {
  const row = SceneLog.tone('The grass is quiet.', ctx);
  assert.deepStrictEqual(row.pieces, [{ role: 'narration', text: 'The grass is quiet.', voice: 'narrator' }]);
});

test('a mixed block colours beat as narrator and say as the speaker, with curly quotes added', () => {
  const row = SceneLog.tone({
    speaker: 'bf06',
    parts: [{ beat: 'She looks up.' }, { say: 'You came back.' }]
  }, ctx);
  assert.deepStrictEqual(row.pieces, [
    { role: 'narration', text: 'She looks up.', voice: 'narrator' },
    { role: 'say', text: '\u201CYou came back.\u201D', voice: 'npc' }
  ]);
});

test('the player\'s say parts use the player voice', () => {
  const row = SceneLog.tone({ speaker: 'player', parts: [{ say: 'I will.' }] }, ctx);
  assert.strictEqual(row.pieces[0].voice, 'player');
});

test('the stylesheet keeps NPC gold and the ten-line fade on the scene log', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');
  assert.match(css, /\.event-text\.tone-npc \{ color: #f8cc6e;/);
  assert.match(css, /\.event-beat\.scene-log \{ max-height: calc\(10 \* 1\.45em\)/);
  assert.match(css, /mask-image: linear-gradient/);
});

test('byCat wins over the default parts, then a missing cat falls back', () => {
  const line = {
    speaker: 'bf06',
    parts: [{ say: 'Default.' }],
    byCat: { bf06: { speaker: 'bf06', parts: [{ beat: 'Only for this cat.' }, { say: 'Override.' }] } }
  };
  const hit = SceneLog.tone(line, ctx);
  assert.strictEqual(hit.pieces[0].text, 'Only for this cat.');
  assert.strictEqual(hit.pieces[1].text, '\u201COverride.\u201D');
  const miss = SceneLog.tone(line, { catId: 'ln01', playerId: 'player-1' });
  assert.strictEqual(miss.pieces[0].text, '\u201CDefault.\u201D');
  assert.strictEqual(miss.pieces[0].voice, 'npc');
});
