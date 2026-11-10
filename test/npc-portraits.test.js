// Ochre 39 presentation defaults. Names and genes stay per-run. A valid saved id is not replaced.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const Slice = require('../src/renderer/js/slice');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const defaults = j('npc-portrait-defaults.json');
const slots = j('world-slots.json').slots;
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/portraits/registry.json'), 'utf8'));
const mk = () => Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  npcPortraits: defaults
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: { v: 1, loci: { coat: ['tawny', 'tawny'] } } };

test('the roster is 11 Highcrag, 10 Bonefield, 9 Mistwood and 9 loners, and every slot has a file', () => {
  const byFaction = {};
  for (const s of slots) byFaction[s.faction] = (byFaction[s.faction] || 0) + 1;
  assert.deepStrictEqual(byFaction, { highcrag: 11, bonefield: 10, mistwood: 9, loner: 9 });
  assert.strictEqual(Object.keys(defaults.assignments).length, 39);
  const files = new Set(registry.portraits.map((p) => p.id));
  for (const [id, spec] of Object.entries(defaults.assignments)) {
    assert.ok(files.has(spec.id), id);
    const slot = slots.find((s) => s.slot === id);
    assert.strictEqual(spec.adultArtOnly, slot.stage !== 'adult');
  }
  assert.strictEqual(defaults.assignments.ln05.id, 'cat-6e2d788dd48ff440');
});

test('new games use the presentation default without rewriting the run name, stage, or genes', () => {
  const E = mk();
  const s = E.newRun({ mainCat: player, seed: 4, runId: 'portraits' });
  assert.strictEqual(s.npcs.ln05.name, 'Bitterwatch');
  assert.notStrictEqual(s.npcs.hc01.name, 'Ashmane');
  for (const slot of slots) {
    const npc = s.npcs[slot.slot];
    assert.strictEqual(npc.portraitId, defaults.assignments[slot.slot].id);
    assert.strictEqual(npc.stage, slot.stage);
    assert.strictEqual(npc.sex, slot.sex);
    assert.strictEqual(npc.portraitPresentation.phenotypeMatch, false);
    if (slot.stage !== 'adult') assert.strictEqual(npc.portraitPresentation.adultArtOnly, true);
  }
  const reloaded = E.migrate(JSON.parse(JSON.stringify(s)));
  for (const slot of slots) {
    assert.strictEqual(reloaded.npcs[slot.slot].portraitId, s.npcs[slot.slot].portraitId);
    assert.deepStrictEqual(reloaded.npcs[slot.slot].personality, s.npcs[slot.slot].personality);
    assert.strictEqual(reloaded.npcs[slot.slot].name, s.npcs[slot.slot].name);
    assert.strictEqual(reloaded.npcs[slot.slot].stage, s.npcs[slot.slot].stage);
  }
});

test('a legacy player blank gets the creator default, and a saved id stays', () => {
  const E = mk();
  const DEFAULT = 'cat-6e2d788dd48ff440';
  for (const sex of ['female', 'male']) {
    const s = E.newRun({ mainCat: { ...player, sex }, seed: 4, runId: `keep-${sex}` });
    const genes = JSON.parse(JSON.stringify(s.cat.genes));
    const name = s.cat.name;
    const stage = s.cat.lifeStage;
    s.npcs.hc08.portraitId = 'cat-6477d01534355420';
    delete s.cat.portraitId;
    delete s.cat.portraitLegacy;
    const absent = E.migrate(JSON.parse(JSON.stringify(s)));
    assert.strictEqual(absent.cat.portraitId, DEFAULT);
    assert.strictEqual(absent.cat.portraitLegacy.status, 'presentation-default');
    assert.strictEqual(absent.cat.portraitLegacy.case, 'field-absent');
    assert.strictEqual(absent.cat.portraitLegacy.source, 'new-creator-default');
    assert.strictEqual(absent.cat.portraitLegacy.phenotypeMatch, false);
    assert.strictEqual(absent.cat.sex, sex);
    assert.strictEqual(absent.cat.name, name);
    assert.strictEqual(absent.cat.lifeStage, stage);
    assert.strictEqual(absent.cat.catId, 'c1');
    assert.deepStrictEqual(absent.cat.genes, genes);
    assert.strictEqual(absent.npcs.hc08.portraitId, 'cat-6477d01534355420');
    assert.strictEqual(absent.npcs.hc08.stage, 'elder');
    const twice = E.migrate(JSON.parse(JSON.stringify(absent)));
    assert.deepStrictEqual(twice.cat.portraitLegacy, absent.cat.portraitLegacy);
    assert.strictEqual(twice.cat.portraitId, DEFAULT);
    s.cat.portraitId = null;
    delete s.cat.portraitLegacy;
    const storedNull = E.migrate(JSON.parse(JSON.stringify(s)));
    assert.strictEqual(storedNull.cat.portraitLegacy.case, 'stored-null');
    assert.strictEqual(storedNull.cat.portraitId, DEFAULT);
    s.cat.portraitId = 'Not A Cat';
    delete s.cat.portraitLegacy;
    const invalid = E.migrate(JSON.parse(JSON.stringify(s)));
    assert.strictEqual(invalid.cat.portraitLegacy.case, 'invalid');
    assert.strictEqual(invalid.cat.portraitLegacy.rejected, 'Not A Cat');
    assert.strictEqual(invalid.cat.portraitId, DEFAULT);
    assert.deepStrictEqual(invalid.cat.genes, genes);
    const again = E.migrate(JSON.parse(JSON.stringify(invalid)));
    assert.deepStrictEqual(again.cat.portraitLegacy, invalid.cat.portraitLegacy);
    s.cat.portraitId = 'cat-96beb4613b169dfd';
    delete s.cat.portraitLegacy;
    const kept = E.migrate(JSON.parse(JSON.stringify(s)));
    assert.strictEqual(kept.cat.portraitId, 'cat-96beb4613b169dfd');
    assert.strictEqual(kept.cat.portraitLegacy.status, 'kept');
    assert.strictEqual(kept.cat.sex, sex);
    const still = E.migrate(JSON.parse(JSON.stringify(kept)));
    assert.strictEqual(still.cat.portraitId, 'cat-96beb4613b169dfd');
    assert.deepStrictEqual(still.cat.portraitLegacy, kept.cat.portraitLegacy);
    s.cat.portraitId = 'cat-not-in-the-registry';
    delete s.cat.portraitLegacy;
    s.npcs.hc01.portraitId = 'cat-also-not-registered';
    delete s.npcs.hc01.portraitLegacy;
    const npcName = s.npcs.hc01.name;
    const npcStage = s.npcs.hc01.stage;
    const missingSlug = E.migrate(JSON.parse(JSON.stringify(s)));
    assert.strictEqual(missingSlug.cat.portraitId, DEFAULT);
    assert.strictEqual(missingSlug.cat.portraitLegacy.case, 'unregistered');
    assert.strictEqual(missingSlug.cat.portraitLegacy.rejected, 'cat-not-in-the-registry');
    assert.strictEqual(missingSlug.cat.portraitLegacy.phenotypeMatch, false);
    assert.strictEqual(missingSlug.cat.sex, sex);
    assert.deepStrictEqual(missingSlug.cat.genes, genes);
    assert.strictEqual(missingSlug.npcs.hc01.portraitId, defaults.assignments.hc01.id);
    assert.notStrictEqual(missingSlug.npcs.hc01.portraitId, 'cat-also-not-registered');
    assert.strictEqual(missingSlug.npcs.hc01.name, npcName);
    assert.strictEqual(missingSlug.npcs.hc01.stage, npcStage);
    const slugAgain = E.migrate(JSON.parse(JSON.stringify(missingSlug)));
    assert.deepStrictEqual(slugAgain.cat.portraitLegacy, missingSlug.cat.portraitLegacy);
    assert.strictEqual(slugAgain.npcs.hc01.portraitId, missingSlug.npcs.hc01.portraitId);
  }
});
