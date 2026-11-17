const test = require('node:test');
const assert = require('node:assert');
const Traits = require('../src/renderer/js/cat-traits');
const Creator = require('../src/renderer/js/creator');
const Engine = require('../src/renderer/js/encounter-engine');
const Slice = require('../src/renderer/js/slice');
const fs = require('fs');
const path = require('path');

function rngOf(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
const cat = (ids, blood) => ({ traits: ids || [], bloodline: blood || {}, genes: { personality: { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 } } });

test('creator rules: points, caps, opposites, blood-only and play-only', () => {
  assert.strictEqual(Traits.ROWS.length, 57);
  assert.strictEqual(Traits.INHERIT_ONLY.length, 6);
  let picks = [];
  const add = (id, free) => { const turned = Traits.toggle(picks, id, { freeBlood: free }); assert.strictEqual(turned.ok, true, id + turned.reason); picks = turned.picks; };
  assert.strictEqual(Traits.toggle([], 'iron_jaw').ok, false);
  add('lame_paw');
  add('sickly');
  add('iron_jaw');
  add('broad_shoulders');
  assert.strictEqual(Traits.toggle(picks, 'thick_hide').reason, 'fight');
  assert.strictEqual(Traits.toggle(picks, 'runt').reason, 'opposite');
  assert.strictEqual(Traits.toggle(picks, 'giant').reason, 'blood');
  assert.strictEqual(Traits.toggle(picks, 'giant', { freeBlood: true }).reason, 'fight');
  assert.strictEqual(Traits.toggle(['lame_paw'], 'fertile').reason, 'blood');
  assert.strictEqual(Traits.toggle(['lame_paw'], 'fertile', { freeBlood: true }).ok, true);
  assert.strictEqual(Traits.toggle(picks, 'grieving').reason, 'play');
  const full = ['lame_paw', 'short_tempered', 'craven', 'iron_jaw', 'swift', 'keen_nose'];
  assert.strictEqual(Traits.toggle(full, 'hardy').reason, 'positives');
  assert.deepStrictEqual(Traits.tally(['lame_paw', 'iron_jaw']), { give: 2, spend: 2, pos: 1, neg: 1, fight: 1, covered: true, leftover: 0 });
  assert.strictEqual(Traits.tally(['sickly', 'swift']).leftover, 1);
});

test('strength stays inside the cap, and injury tiers move one step', () => {
  assert.strictEqual(Traits.strengthMult(['iron_jaw', 'broad_shoulders']), 1.1);
  assert.strictEqual(Traits.strengthMult(['lame_paw', 'elder_wisdom']), 0.95);
  assert.strictEqual(Traits.shiftTier('serious', ['hardy']), 'minor');
  assert.strictEqual(Traits.shiftTier('minor', ['sickly']), 'serious');
  assert.strictEqual(Traits.modifiers(['keen_nose']).huntBand, -1);
  assert.strictEqual(Traits.CANDIDATES.herbChance, null);
});

test('inheritance odds match the bloodline table and the 0.25 pass', () => {
  assert.strictEqual(Traits.rollBlood('shows', 'shows', rngOf([0.69])), 'shows');
  assert.strictEqual(Traits.rollBlood('shows', 'shows', rngOf([0.7])), 'carries');
  assert.strictEqual(Traits.rollBlood('shows', 'carries', rngOf([0.49])), 'shows');
  assert.strictEqual(Traits.rollBlood('shows', 'carries', rngOf([0.5])), 'carries');
  assert.strictEqual(Traits.rollBlood('shows', 'carries', rngOf([0.9])), null);
  assert.strictEqual(Traits.rollBlood('shows', null, rngOf([0.34])), 'shows');
  assert.strictEqual(Traits.rollBlood('shows', null, rngOf([0.35])), 'carries');
  assert.strictEqual(Traits.rollBlood('shows', null, rngOf([0.75])), null);
  assert.strictEqual(Traits.rollBlood('carries', 'carries', rngOf([0.24])), 'shows');
  assert.strictEqual(Traits.rollBlood('carries', null, rngOf([0.09])), 'shows');
  assert.strictEqual(Traits.rollBlood('carries', null, rngOf([0.1])), 'carries');
  assert.strictEqual(Traits.rollBlood(null, null, rngOf([0.009])), 'shows');
  assert.strictEqual(Traits.rollBlood(null, null, rngOf([0.02])), null);
  const passed = Traits.inheritTraits(cat(['keen_nose']), cat([]), rngOf([0.2]));
  assert.ok(passed.traits.includes('keen_nose'));
  const missed = Traits.inheritTraits(cat(['keen_nose']), cat([]), rngOf([0.3]));
  assert.ok(!missed.traits.includes('keen_nose'));
  const sick = Traits.inheritTraits(cat(['tainted_blood']), cat([]), rngOf([0.2]));
  assert.ok(sick.traits.includes('sickly'));
  const cub = Traits.breedCub(
    { traits: ['short_tempered'], bloodline: { giant: 'shows' }, genes: { loci: { coat: ['tawny', 'tawny'] }, personality: { aggression: 40, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 } } },
    { traits: [], bloodline: { giant: 'carries' }, genes: { loci: { coat: ['melan', 'melan'] }, personality: { aggression: 40, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 } } },
    rngOf([0, 0.2, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
  );
  assert.strictEqual(cub.bloodline.giant, 'shows');
  assert.ok(cub.genes.personality.aggression > 40);
});

test('premade slots show and carry the six bloodline traits', () => {
  const npcs = {};
  for (const id of ['bf01', 'bf08', 'mw03', 'hc03', 'hc02', 'bf03', 'hc08', 'ln01', 'mw02', 'hc06', 'hc10', 'bf04', 'mw07', 'ln06', 'bf07', 'ln03', 'ln05']) npcs[id] = { id, traits: [] };
  Traits.seedBloodlines(npcs);
  assert.ok(npcs.bf01.traits.includes('giant'));
  assert.strictEqual(npcs.bf08.bloodline.giant, 'carries');
  assert.ok(!npcs.bf08.traits.includes('giant'));
  assert.strictEqual(npcs.hc03.bloodline.long_sabers, 'shows');
  assert.strictEqual(npcs.ln03.bloodline.tainted_blood, 'carries');
  assert.ok(!npcs.ln03.traits.includes('tainted_blood'));
  const shown = {};
  for (const npc of Object.values(npcs)) for (const id of npc.traits || []) shown[id] = (shown[id] || 0) + 1;
  assert.strictEqual(shown.tainted_blood || 0, 0);
});

test('appearance extraction skips negation, bare size words, and ungated genes', () => {
  const plain = { loci: { coat: ['tawny', 'tawny'], het: ['Het', 'Het'], white: ['none', 'none'] } };
  const scar = Traits.extractTags('A small scar on the face, and a torn ear.', plain);
  assert.ok(scar.tags.includes('scarred_face'));
  assert.ok(scar.tags.includes('torn_ear'));
  assert.ok(!scar.tags.includes('small'));
  const none = Traits.extractTags('No scars and not lean.', plain);
  assert.deepStrictEqual(none.tags, []);
  const heavy = Traits.extractTags('Broad shoulders.', plain);
  assert.ok(heavy.tags.includes('heavy'));
  const blocked = Traits.extractTags('Odd eyes and a white coat.', plain);
  assert.ok(!blocked.tags.includes('odd_eyes'));
  assert.ok(blocked.geneNote);
  const odd = Traits.extractTags('Odd eyes.', { loci: { coat: ['tawny', 'tawny'], het: ['het', 'het'], white: ['none', 'none'] } });
  assert.ok(odd.tags.includes('odd_eyes'));
  const mismatch = Traits.extractTags('A black coat.', plain);
  assert.strictEqual(mismatch.colourNote, 'ui.traits.colourNote');
  const many = Traits.extractTags('Torn ear, notched ear, a limp, a scarred face, and a missing tooth.', plain);
  assert.ok(many.tags.length <= 4);
  const look = Traits.appearanceOf('Torn ear.', plain, ['broad_shoulders', 'lame_paw'], []);
  assert.ok(look.tags.includes('heavy'));
  assert.ok(look.tags.includes('limp'));
  assert.ok(look.tags.includes('torn_ear'));
  const dropped = Traits.appearanceOf('Torn ear.', plain, [], ['torn_ear']);
  assert.ok(!dropped.tags.includes('torn_ear'));
});

test('rumours bind name and subjectName, and a remark does not repeat or change affinity', () => {
  const line = Traits.rumour('iron_jaw', 'Sleetbark', 'Galestride', null, () => 0);
  assert.ok(line.text.includes('Sleetbark'));
  assert.ok(!/\{(name|subjectName)\}/.test(line.text));
  const again = Traits.rumour('iron_jaw', 'Sleetbark', 'Galestride', line.id, () => 0);
  assert.notStrictEqual(again.id, line.id);
  const first = Traits.offerRemark({
    mode: 'offline', scene: 'first', tags: ['torn_ear'], personality: { aggression: 80 }, speakerName: 'Sleetbark', catId: 'ln02', season: 1
  });
  assert.ok(first.line && !first.line.includes('[PH]'));
  assert.strictEqual(first.affinity, 0);
  const second = Traits.offerRemark({
    mode: 'offline', scene: 'repeat', tags: ['torn_ear'], personality: { aggression: 20 }, speakerName: 'Sleetbark', catId: 'ln02', season: 1, budget: first.budget
  });
  assert.strictEqual(second.line, null);
  assert.strictEqual(Traits.wrongTrait('swift', []), 'lame_paw');
});

test('an old save without traits or appearance still loads', () => {
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/map.json'), 'utf8'));
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/slice-rules.json'), 'utf8'));
  const events = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/events/slice-1.json'), 'utf8'));
  const slots = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/world-slots.json'), 'utf8'));
  const nameData = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/renderer/data/names/names.json'), 'utf8'));
  const E = Slice.create({ map, rules, events, slots, nameData, looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] } });
  const fresh = E.newRun({ mainCat: { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {}, scars: [] }, seed: 3, runId: 'old' });
  delete fresh.cat.traits;
  delete fresh.cat.appearanceText;
  delete fresh.cat.appearanceTags;
  delete fresh.cat.bloodline;
  const loaded = E.migrate(fresh);
  assert.deepStrictEqual(loaded.cat.traits, []);
  assert.strictEqual(loaded.cat.appearanceText, '');
  assert.ok(Array.isArray(loaded.cat.appearanceTags));
  assert.strictEqual(loaded.npcs.bf01.bloodline.giant, 'shows');
});

test('fight-effect traits stay inside the section 4 bands', () => {
  const foes = [
    ['equal', 10, 0.85],
    ['scarjaw', 12.5, 0.5],
    ['dire', 9, 1],
    ['clan', 12, 0.5],
    ['lion', 12, 0.5],
    ['pack', 13, 0.5]
  ];
  const ids = Object.keys(Traits.FIGHT_EFFECTS);
  const n = 400;
  function rate(strength) {
    const out = {};
    for (const [name, foe] of foes) {
      let wins = 0;
      for (let i = 0; i < n; i++) {
        const row = Engine.resolve({
          kind: 'fight', seed: 1000 + i, quick: true, policy: 'sensible', engine: true,
          player: { id: 'player', strength }, opponent: { id: name, strength: foe }
        });
        if (row.winner === 'player') wins += 1;
      }
      out[name] = wins / n;
    }
    return out;
  }
  const base = rate(10);
  for (const id of ids) {
    const got = rate(10 * Traits.strengthMult([id]));
    for (const [name, , cap] of foes) {
      assert.ok(got[name] <= cap + 0.03 || got[name] <= base[name] + 0.03, `${id} ${name} ${got[name]}`);
    }
    assert.strictEqual(Traits.FIGHT_EFFECTS[id], true);
  }
});

test('the creator trait step comes after personality and before appearance', () => {
  const names = require('../src/renderer/data/menu-copy.json').creator.defaultNames;
  let s = Creator.init({ names, rng: () => 0.2 });
  s = Creator.reduce(s, 'start').state;
  assert.strictEqual(s.step, 2);
  s = Creator.reduce(s, 'start').state;
  assert.strictEqual(s.step, 3);
  let turned = Creator.reduce(s, 'togglePick', 'lame_paw').state;
  turned = Creator.reduce(turned, 'togglePick', 'iron_jaw').state;
  assert.deepStrictEqual(turned.picks, ['lame_paw', 'iron_jaw']);
  s = Creator.reduce(turned, 'start').state;
  assert.strictEqual(s.step, 4);
  s = Creator.reduce(s, 'setAppearance', 'A torn ear and a black coat.').state;
  const started = Creator.reduce({ ...s, focus: 'start' }, 'confirm');
  assert.strictEqual(started.effect.type, 'start');
  assert.ok(started.effect.mainCat.appearanceTags.includes('torn_ear'));
  assert.ok(started.effect.mainCat.appearanceText.length <= 280);
});
