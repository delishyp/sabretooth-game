// Saga pass 2: prose in place of placeholders, leaders only, appearance clauses gated.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Pass2 = require('../src/renderer/js/pass2');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
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
const player = { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} };

test('every biome has an arrival and a drink, and the covered scenes have no placeholder', () => {
  const mapBiomes = new Set(j('map.json').regions.map((r) => r.biome));
  for (const biome of Pass2.BIOMES) {
    assert.ok(mapBiomes.has(biome), biome);
    const line = Pass2.arrival(biome, 'The Place', true);
    assert.ok(line.arrive.includes('The Place') || !Pass2.ARRIVE[biome].includes('{region}'));
    assert.ok(line.drink);
    assert.ok(!/PLACEHOLDER/.test(line.arrive + line.drink));
  }
  const covered = [
    fs.readFileSync(path.join(__dirname, '../src/renderer/js/pass2.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../src/renderer/js/followups.js'), 'utf8')
  ].join('\n');
  assert.ok(!/PLACEHOLDER/.test(covered));
});

test('leader meetings replace only that pride\'s leader, and appearance clauses follow the saved look', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'leaders' });
  const leader = s.npcs.hc01;
  const other = Object.values(s.npcs).find((n) => n.faction === 'highcrag' && n.id !== 'hc01');
  s.pending = { eventId: 'slice.meeting.highcrag', catId: other.id, catName: other.name, beatIndex: 0 };
  const ordinaryBeats = E.sceneBeats(s);
  const ordinary = ordinaryBeats ? ordinaryBeats.map((b) => b.text).join(' ') : E.eventById('slice.meeting.highcrag').text;
  assert.ok(!/leader of Highcrag/.test(ordinary));
  leader.look = Object.assign({}, leader.look, { muzzle: 'tan' });
  leader.scars = [];
  s.pending = { eventId: 'slice.meeting.highcrag', catId: 'hc01', catName: leader.name, beatIndex: 0 };
  const plain = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(plain, /leader of Highcrag/);
  assert.ok(!/silver at the muzzle/.test(plain));
  leader.look.muzzle = 'silver';
  const silver = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(silver, /silver at the muzzle/);

  const bone = s.npcs.bf01;
  bone.look = Object.assign({}, bone.look);
  bone.scars = [];
  s.pending = { eventId: 'slice.meeting.bonefield', catId: 'bf01', catName: bone.name, beatIndex: 0 };
  const unscarred = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(unscarred, /heavy-shouldered,/);
  assert.ok(!/scarred/.test(unscarred));
  assert.ok(!/torn lip/.test(unscarred));
  bone.scars = ['foreleg scar', 'torn lip'];
  const marked = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(marked, /heavy-shouldered and scarred/);
  assert.match(marked, /torn lip/);

  const mist = s.npcs.mw01;
  mist.stage = 'adult';
  s.pending = { eventId: 'slice.meeting.mistwood', catId: 'mw01', catName: mist.name, beatIndex: 0 };
  assert.ok(!/old and thin/.test(E.sceneBeats(s).map((b) => b.text).join(' ')));
  mist.stage = 'elder';
  assert.match(E.sceneBeats(s).map((b) => b.text).join(' '), /old and thin/);
});
