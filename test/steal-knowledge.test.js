// A clean steal stays private. The owner learns only when someone saw it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');

const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] }
});

function prepared() {
  const s = E.newRun({ mainCat: { catId: 'c1', name: 'Ravenmark', sex: 'female', lifeStage: 'adult', genes: {} }, seed: 8, runId: 'steal-knowledge' });
  const owner = s.npcs.ln05;
  s.region = 'split_rock';
  for (const npc of Object.values(s.npcs)) {
    if (!npc) continue;
    npc.homeZones = npc.id === owner.id ? ['split_rock'] : [];
    npc.lastRegion = npc.id === owner.id ? 'split_rock' : 'ice_wall';
    npc.visit = null;
  }
  owner.affinity = 12;
  owner.met = true;
  return { s, owner };
}
function stealFact(s) {
  return (s.worldMemory.facts || []).filter((fact) => fact.kind === 'steal').pop() || null;
}

test('an unseen steal stays private and a witnessed steal teaches the owner', () => {
  let s = prepared().s;
  const owner = s.npcs.ln05;
  let unseen = null;
  let witnessed = null;
  for (let day = 1; day <= 40 && (!unseen || !witnessed); day++) {
    s.day = day;
    s.phase = 'day';
    s.pending = null;
    s.needs.energy = 90;
    s.needs.hunger = 40;
    E.lone.noteKill(s, owner.id);
    s.records.freshKill.stolen = false;
    const before = s.npcs[owner.id].affinity;
    const result = E.act(s, { type: 'steal' });
    assert.ok(!result.error, result.error);
    s = result.state;
    const fact = stealFact(s);
    assert.ok(fact);
    const knowledge = s.worldMemory.knowledge[fact.factId];
    const knows = E.world.knowsFact(s, owner.id, fact.factId);
    if (fact.summary.startsWith('You took')) {
      assert.strictEqual(knows, false);
      assert.strictEqual(s.npcs[owner.id].affinity, before);
      assert.strictEqual(knowledge.scope, 'private');
      assert.ok(!(knowledge.participantIds || []).includes(owner.id));
      assert.deepStrictEqual(knowledge.prideIds, []);
      unseen = fact.factId;
    } else {
      assert.strictEqual(knows, true);
      assert.strictEqual(s.npcs[owner.id].affinity, before - 5);
      assert.ok((knowledge.witnessIds || []).includes(owner.id));
      witnessed = fact.factId;
    }
  }
  assert.ok(unseen && witnessed);
});
