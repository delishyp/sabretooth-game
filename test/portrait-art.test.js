const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Modes = require('../src/renderer/js/portrait-modes');
const Art = require('../src/renderer/js/encounter-art');
const Screen = require('../src/renderer/js/encounter-screen');

const css = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/menu.css'), 'utf8');
const game = fs.readFileSync(path.join(__dirname, '../src/renderer/js/game-screen.js'), 'utf8');

test('cat art is contained or kept in ratio, and a cover crop fails the lint', () => {
  assert.deepStrictEqual(Modes.cssViolations(css), []);
  const cropped = '.portrait-frame canvas { height: 160px; object-fit: cover; }';
  const hits = Modes.cssViolations(cropped);
  assert.ok(hits.some((line) => line.startsWith('cover')));
  assert.ok(hits.some((line) => line.startsWith('fixed height')));
  assert.ok(!/object-fit\s*:\s*cover/.test(game));
});

test('headshots use Ochre\'s one square box for every base, portrait and age', () => {
  const View = require('../src/renderer/js/portrait-view');
  const box = { x: 0.5856, y: 0.0, w: 0.4144, h: 0.5525 };
  assert.deepStrictEqual(Modes.HEAD, box);
  assert.deepStrictEqual(Modes.cropFor('female'), box);
  assert.deepStrictEqual(Modes.cropFor('male', 'elder'), box);
  for (const age of Modes.AGES) {
    assert.deepStrictEqual(Modes.cropFor('female', age), box);
    assert.deepStrictEqual(Modes.cropFor('male', age), box);
  }
  assert.deepStrictEqual(View.sourceRect(1152, 864, box), { sx: 675, sy: 0, sw: 477, sh: 477 });
  assert.deepStrictEqual(View.sourceRect(1448, 1086, box), { sx: 848, sy: 0, sw: 600, sh: 600 });
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/portraits/registry.json'), 'utf8'));
  assert.deepStrictEqual(raw.defaultHead, box);
  assert.deepStrictEqual(raw.staticHead, box);
  for (const row of raw.portraits) assert.deepStrictEqual(row.head, box, row.id);
  for (const place of ['dialogue', 'event', 'talk', 'directory', 'profile', 'head', 'council', 'heir', 'lore']) {
    assert.strictEqual(Modes.modeFor(place), 'headshot', place);
  }
  for (const place of ['den', 'creator', 'encounter', 'home']) {
    assert.strictEqual(Modes.modeFor(place), 'full', place);
  }
  assert.strictEqual(Modes.speakerOpts().mode, 'headshot');
  assert.strictEqual(Modes.speakerOpts().place, 'dialogue');
  assert.match(game, /PortraitModes\.speakerOpts\(\)/);
  assert.match(game, /place: 'den'/);
  assert.match(game, /place: 'directory'/);
});

test('each foe maps to its own art, or to text when that art is missing', () => {
  const table = [
    ['deer', 'encounters/giant-deer.png'],
    ['giant_deer', 'encounters/giant-deer.png'],
    ['wolf', 'encounters/old-pack-enemy.png'],
    ['wolves', 'encounters/old-pack-enemy.png'],
    ['wolf_pack', 'encounters/old-pack-enemy.png'],
    ['hyena', 'encounters/cave-hyena.png'],
    ['cave_hyena', 'encounters/cave-hyena.png'],
    ['bear', null],
    ['lion', null],
    ['human', null],
    ['mammoth', null],
    ['mammoth_calf', null],
    ['wolf_pup', null],
    ['antlerless_deer', null],
    ['horse', null],
    ['camel', null],
    ['bison', null],
    ['hare', null],
    ['goose', null],
    ['marmot', null]
  ];
  const files = new Set(Object.values(Art.FILES));
  for (const [species, expect] of table) {
    const got = Art.resolve({ species, assetId: 'giant-deer.png' });
    assert.strictEqual(got.art, expect, species);
    if (!expect) {
      assert.strictEqual(got.portrait, false, species);
      assert.ok(got.fallback, species);
      for (const file of files) assert.notStrictEqual(got.art, file);
    }
  }
  const ash = Art.resolve({ kind: 'spar', cat: { id: 'ash', name: 'Ash', genes: { coat: 'tan' } } });
  const briar = Art.resolve({ kind: 'spar', cat: { id: 'briar', name: 'Briar', genes: { coat: 'grey' } } });
  assert.strictEqual(ash.art, null);
  assert.strictEqual(ash.portrait, true);
  assert.strictEqual(ash.catId, 'ash');
  assert.notStrictEqual(ash.catId, briar.catId);
  assert.strictEqual(ash.cat.genes.coat, 'tan');
  assert.ok(!ash.cat.portraitId);
  const court = Screen.screen({ kind: 'courtship', cat: { id: 'mate', name: 'Moth' } });
  assert.strictEqual(court.art, null);
  assert.strictEqual(court.portrait, true);
  assert.strictEqual(court.cat.id, 'mate');
  const fight = Screen.screen({ kind: 'fight' });
  assert.strictEqual(fight.art, null);
  assert.ok(!fight.art || !/giant-deer/.test(String(fight.art)));
  assert.notStrictEqual(fight.art, 'encounters/giant-deer.png');
  const sleet = Screen.screen({ kind: 'fight', cat: { id: 'hc07', name: 'Sleetbark', portraitId: 'cat-7c5ab14d9e51320a' } });
  assert.strictEqual(sleet.art, null);
  assert.strictEqual(sleet.portrait, true);
  assert.strictEqual(sleet.cat.portraitId, 'cat-7c5ab14d9e51320a');
  assert.notStrictEqual(sleet.cat.portraitId, 'cat-eec858c7a583cdc6');
  const gale = Screen.screen({ kind: 'courtship', cat: { id: 'bf01', name: 'Galestride', portraitId: 'cat-e67924de1f224fd0' } });
  assert.strictEqual(gale.art, null);
  assert.strictEqual(gale.portrait, true);
  assert.strictEqual(gale.cat.portraitId, 'cat-e67924de1f224fd0');
  const summer = Art.resolve({ kind: 'spar', cat: { id: 'mw04', name: 'Summercloud', portraitId: 'cat-f70f52f0f22da7fc' } });
  assert.strictEqual(summer.art, null);
  assert.strictEqual(summer.cat.portraitId, 'cat-f70f52f0f22da7fc');
  assert.ok(fight.fallback);
  const wolfFight = Screen.screen({ kind: 'fight', species: 'wolf' });
  assert.match(wolfFight.art, /old-pack-enemy/);
  const deerHunt = Screen.screen({ kind: 'hunt', species: 'deer' });
  assert.match(deerHunt.art, /giant-deer/);
  const horseHunt = Screen.screen({ kind: 'hunt', species: 'horse' });
  assert.strictEqual(horseHunt.art, null);
  assert.strictEqual(horseHunt.fallback, 'The horse');
  const bareHunt = Screen.screen({ kind: 'hunt' });
  assert.strictEqual(bareHunt.art, null);
  const human = Screen.screen({ kind: 'human', asset: 'encounters/giant-deer.png' });
  assert.strictEqual(human.art, null);
  const shot = fs.readFileSync(path.join(__dirname, '../scripts/ui-groups-shot.js'), 'utf8');
  assert.ok(!shot.includes('eec858'));
  assert.ok(!shot.includes("'Hyena'"));
  assert.match(shot, /s\.npcs\.hc07/);
  assert.match(shot, /s\.npcs\.bf01/);
  const hyena = Screen.screen({ kind: 'hyena' });
  assert.match(hyena.art, /cave-hyena/);
  const bearNamedHyena = Screen.screen({ kind: 'hyena', species: 'bear' });
  assert.strictEqual(bearNamedHyena.art, null);
});
