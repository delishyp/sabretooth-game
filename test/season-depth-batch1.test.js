// Season-1 depth batch 1: byCat speech, region-moment facts, and gossip for both listeners.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Slice = require('../src/renderer/js/slice');
const Speech = require('../src/renderer/js/speech');
const Pairing = require('../src/renderer/js/pairing');
const Pass2 = require('../src/renderer/js/pass2');
const D = path.join(__dirname, '../src/renderer/data');
const j = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const E = Slice.create({
  map: j('map.json'), rules: j('slice-rules.json'), events: j('events/slice-1.json'),
  slots: j('world-slots.json'), nameData: j('names/names.json'),
  looks: { coats: ['tan', 'black'], markings: ['none', 'spotted'], eyes: ['amber'] },
  conversation: j('events/recurring-conversation.json'),
  encounters: j('events/encounters-v0.2.json'),
  borderPolicy: j('events/faction-proof-reconciled.json'),
  firstSeason: j('events/first-season-v0.6.2.json'),
  sampleBeats: j('events/sample-beats.json')
});
const player = { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: {} };
function fresh() { return E.newRun({ mainCat: player, seed: 4, runId: 'depth-batch' }); }
const traits = { aggression: 50, sociability: 80, boldness: 50, loyalty: 50, curiosity: 50 };

test('a cat-specific close line wins, and the action cue still comes from the band', () => {
  const doc = j('events/first-season-v0.6.2.json');
  const row = doc.personalityContract.speechCoverage.find((item) => item.speechId === 'm2.close|beats.1');
  assert.ok(row.byCat && row.byCat.ln04);
  const coverage = {
    speechLocations: {
      [row.speechId]: {
        focusTrait: row.focusTrait, low: row.low, base: row.baseline, high: row.high,
        context: row.familyId, byCat: row.byCat
      }
    },
    contextActions: {
      [row.familyId]: { sociability: { high: 'trots closer', low: 'stays back', middle: 'waits' } }
    }
  };
  const named = Speech.resolve(coverage, row.speechId, traits, { catName: 'Nettle' }, 'ln04');
  assert.strictEqual(named.text, row.byCat.ln04.replace('{catName}', 'Nettle'));
  assert.strictEqual(named.action, 'trots closer');
  const other = Speech.resolve(coverage, row.speechId, traits, { catName: 'Nettle' }, 'ln09');
  assert.notStrictEqual(other.text, named.text);
  assert.strictEqual(other.action, 'trots closer');
  const P = Pairing.create(doc, j('slice-rules.json'));
  const s = fresh();
  s.records.bonds.ln04.stage = 'close';
  const ev = P.meetingEvent(s, s.npcs.ln04, {});
  const said = (ev.lines || []).map((line) => line.text).join('\n');
  assert.ok(said.includes(row.byCat.ln04.split('{catName}').join(s.npcs.ln04.name)), said);
});

test('a region-moment choice writes its fact once, and the save round-trips', () => {
  const s = fresh();
  s.region = 'split_rock';
  s.phase = 'event';
  s.pending = { eventId: 'slice.region.split_rock.hollow', day: s.day, hostile: false, choiceId: null };
  const beforeLedger = (s.worldMemory.ledger || []).length;
  const first = E.act(s, { type: 'choose', choiceId: 'lie_down' }).state;
  const factId = 'depth-batch/region_moment/split_rock.hollow/lie_down';
  const rows = first.worldMemory.facts.filter((fact) => fact.factId === factId);
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(rows[0], {
    factId, kind: 'region_moment', region: 'split_rock', scope: 'private'
  });
  assert.deepStrictEqual(first.worldMemory.knowledge[factId], {
    scope: 'private', participantIds: ['player'], witnessIds: [],
    disclosedTo: [], prideIds: [], learnedAbsDay: first.day
  });
  assert.strictEqual(first.worldMemory.ledger.length, beforeLedger);
  assert.strictEqual(E.world.knowsFact(first, 'player', factId), true);
  first.phase = 'event';
  first.pending = { eventId: 'slice.region.split_rock.hollow', day: first.day, hostile: false, choiceId: null };
  const again = E.act(first, { type: 'choose', choiceId: 'lie_down' }).state;
  assert.strictEqual(again.worldMemory.facts.filter((fact) => fact.factId === factId).length, 1);
  const loaded = E.migrate(JSON.parse(JSON.stringify(again)));
  assert.deepStrictEqual(loaded.worldMemory.facts.find((fact) => fact.factId === factId), rows[0]);
  assert.deepStrictEqual(loaded.worldMemory.knowledge[factId], again.worldMemory.knowledge[factId]);
});

test('an old save with no region-moment facts still loads', () => {
  const s = fresh();
  delete s.worldMemory.facts;
  delete s.worldMemory.knowledge;
  const loaded = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(loaded && loaded.worldMemory);
  assert.ok(!loaded.worldMemory.facts || !loaded.worldMemory.facts.some((fact) => String(fact.factId).includes('region_moment')));
});

test('every region-moment fact has a gossip phrase for both listeners', () => {
  const factId = 'depth-batch/region_moment/split_rock.hollow/lie_down';
  assert.match(Pass2.gossipPhrase(factId, 'depth-batch', {}) || '', /Split Rock/);
  assert.match(Pass2.gossipPhrase(factId, 'depth-batch', { listenerParticipated: true }) || '', /^You found that dry hollow/);
  const ids = new Set(j('events/slice-1.json').events.flatMap((e) => (e.choices || []).filter((c) => c.writes && c.writes.kind === 'region_moment').map((c) => c.writes.fact)));
  assert.strictEqual(ids.size, 22);
  for (const id of ids) {
    assert.ok(Pass2.gossipPhrase(`depth-batch/${id}`, 'depth-batch', {}), id);
    assert.ok(Pass2.gossipPhrase(`depth-batch/${id}`, 'depth-batch', { listenerParticipated: true }), id + '.knows');
  }
});
