// Every biome and prey size plays Saga's four hunt beats. Numbers stay off the prose.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const prose = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/hunt-prose-v1.json'), 'utf8'));
const map = j('map.json');
const E = Slice.create({
  map, rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };
const SIZES = ['small', 'medium', 'large'];

function joined(beats) {
  return beats.map((b) => b.text).join('\n');
}

test('hunt prose keys match the map biomes and the three prey sizes', () => {
  const mapIds = map.biomes.map((b) => b.id).sort();
  const fileIds = Object.keys(prose.open).sort();
  assert.deepStrictEqual(fileIds, mapIds);
  assert.deepStrictEqual(Object.keys(prose.middle).sort(), [...SIZES].sort());
  assert.deepStrictEqual(Object.keys(prose.close).sort(), mapIds);
});

test('every biome and size renders four beats, and a hit differs from a miss', () => {
  for (const biome of map.biomes.map((b) => b.id)) {
    for (const size of SIZES) {
      const hit = E.huntBeats(biome, size, true);
      const miss = E.huntBeats(biome, size, false);
      assert.strictEqual(hit.length, 4, `${biome} ${size} hit`);
      assert.strictEqual(miss.length, 4, `${biome} ${size} miss`);
      const hitText = joined(hit);
      const missText = joined(miss);
      assert.notStrictEqual(hitText, missText);
      for (const text of [hitText, missText]) {
        assert.ok(!/\{[a-zA-Z]+\}/.test(text), text);
        assert.ok(!/[0-9]/.test(text), text);
        assert.ok(!text.includes('%'), text);
      }
      assert.ok(!/injur/i.test(missText), missText);
      assert.strictEqual(hit[0].text, prose.open[biome][size]);
      assert.strictEqual(miss[0].text, prose.open[biome][size]);
      assert.deepStrictEqual([hit[1].text, hit[2].text], prose.middle[size].ok);
      assert.deepStrictEqual([miss[1].text, miss[2].text], prose.middle[size].fail);
      assert.strictEqual(hit[3].text, prose.close[biome].ok);
      assert.strictEqual(miss[3].text, prose.close[biome].fail);
    }
  }
});

test('a played hunt shows the four beats, and the number stays on the result line', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'hunt-prose' });
  s.region = 'bonefield';
  s.needs.energy = 90;
  const hunted = E.act(s, { type: 'hunt', size: 'small' }).state;
  assert.strictEqual(hunted.pending.beats.length, 4);
  const text = joined(hunted.pending.beats);
  assert.ok(text.includes(prose.open.steppe.small));
  assert.ok(!/[0-9]/.test(text));
  assert.ok(!text.includes('%'));
  assert.ok(!/\{[a-zA-Z]+\}/.test(text));
  const line = hunted.pending.resultLine || '';
  assert.ok(!/(?:Hunger|Energy|Health|Thirst)\s*[+\-−]\s*\d+/.test(line), line);
  if (line === 'The prey escaped') assert.ok(!/injur/i.test(text));
  else assert.ok(line === 'Your belly is fuller.' || line === "You've eaten well." || line === "You've taken the edge off your hunger.");
  assert.ok(!text.includes(line));
});
