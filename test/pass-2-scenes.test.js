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
    'src/renderer/js/pass2.js', 'src/renderer/js/followups.js', 'src/renderer/js/lone-actions.js', 'src/renderer/js/slice.js', 'src/renderer/js/game-screen.js'
  ].map((rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')).join('\n');
  assert.ok(!/PLACEHOLDER/.test(covered));
  const filed = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/narrative/placeholder-fill-72888e7.json'), 'utf8'));
  delete filed._readme;
  assert.deepStrictEqual(Pass2.lines(), filed);
});

test('leader meetings replace only that pride\'s leader, and appearance clauses follow the saved look', () => {
  const s = E.newRun({ mainCat: player, seed: 8, runId: 'leaders' });
  const leader = s.npcs.hc01;
  const other = Object.values(s.npcs).find((n) => n.faction === 'highcrag' && n.id !== 'hc01');
  s.pending = { eventId: 'slice.meeting.highcrag', catId: other.id, catName: other.name, beatIndex: 0 };
  const ordinaryBeats = E.sceneBeats(s);
  const ordinary = ordinaryBeats ? ordinaryBeats.map((b) => b.text).join(' ') : E.eventById('slice.meeting.highcrag').text;
  assert.ok(!/leader of Highcrag/.test(ordinary));
  leader.look = Object.assign({}, leader.look, { muzzle: 'silver', silverMuzzle: true });
  leader.scars = [];
  s.pending = { eventId: 'slice.meeting.highcrag', catId: 'hc01', catName: leader.name, beatIndex: 0 };
  const plain = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(plain, /leader of Highcrag/);
  assert.ok(!/silver at the muzzle/.test(plain), 'hc01 portrait has no silver mane');
  leader.portraitPresentation = { phenotypeMatch: false, mismatchFlags: [], details: ['silverMuzzle'] };
  const silver = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(silver, /silver at the muzzle/);

  const bone = s.npcs.bf01;
  bone.look = Object.assign({}, bone.look, { tornLip: true });
  bone.scars = ['foreleg scar', 'torn lip'];
  s.pending = { eventId: 'slice.meeting.bonefield', catId: 'bf01', catName: bone.name, beatIndex: 0 };
  const current = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(current, /heavy-shouldered,/);
  assert.ok(!/and scarred/.test(current));
  assert.ok(!/torn lip/.test(current), 'bf01 portrait has no torn lip');
  bone.portraitPresentation = { phenotypeMatch: false, mismatchFlags: [], details: ['scarred', 'tornLip'] };
  const marked = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(marked, /heavy-shouldered and scarred/);
  assert.match(marked, /torn lip/);

  const mist = s.npcs.mw01;
  mist.stage = 'elder';
  s.pending = { eventId: 'slice.meeting.mistwood', catId: 'mw01', catName: mist.name, beatIndex: 0 };
  assert.ok(!/old and thin/.test(E.sceneBeats(s).map((b) => b.text).join(' ')));
  mist.portraitPresentation = { phenotypeMatch: false, mismatchFlags: [], details: ['elder'] };
  assert.match(E.sceneBeats(s).map((b) => b.text).join(' '), /old and thin/);
});

test('Ashmane and Scarjaw use the neutral leader lines, and no player line names a saber colour', () => {
  const s = E.newRun({ mainCat: player, seed: 4, runId: 'roles' });
  assert.strictEqual(s.npcs.hc01.portraitPresentation.mismatchFlags.some((f) => /silver mane not present/.test(f)), true);
  assert.strictEqual(s.npcs.bf01.portraitPresentation.mismatchFlags.some((f) => /torn lip absent/.test(f)), true);
  s.npcs.hc01.look = Object.assign({}, s.npcs.hc01.look, { muzzle: 'silver' });
  s.pending = { eventId: 'slice.meeting.highcrag', catId: 'hc01', catName: s.npcs.hc01.name, beatIndex: 0 };
  assert.ok(!/silver/.test(E.sceneBeats(s).map((b) => b.text).join(' ')));
  s.npcs.bf01.look = Object.assign({}, s.npcs.bf01.look, { tornLip: true });
  s.npcs.bf01.scars = ['torn lip'];
  s.pending = { eventId: 'slice.meeting.bonefield', catId: 'bf01', catName: s.npcs.bf01.name, beatIndex: 0 };
  const bone = E.sceneBeats(s).map((b) => b.text).join(' ');
  assert.match(bone, /heavy-shouldered/);
  assert.ok(!/torn lip/.test(bone));
  const colours = 'ivory|creamy|cream-yellow|stained|gold|amber|copper|black|white|yellow|brown|grey|gray|red|russet|blue|green|silver';
  const named = new RegExp(`\\b(${colours})\\b[^.]{0,40}\\bsabers?\\b|\\bsabers?\\b[^.]{0,40}\\b(${colours})\\b`, 'i');
  const files = [
    'src/renderer/js/pass2.js', 'src/renderer/js/followups.js', 'src/renderer/js/lone-actions.js', 'src/renderer/js/slice.js', 'src/renderer/js/game-screen.js',
    'src/renderer/data/events/sample-beats.json', 'src/renderer/data/events/recurring-conversation.json', 'src/renderer/data/events/first-season-v0.6.2.json', 'src/renderer/data/events/encounters-v0.2.json', 'src/renderer/data/menu-copy.json'
  ];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!named.test(text), rel);
  }
});
