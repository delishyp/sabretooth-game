const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Breeding = require('../src/renderer/js/breeding');
const Slice = require('../src/renderer/js/slice');

const root = path.join(__dirname, '..');
const lines = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/events/breeding-lines-v0.1b.json'), 'utf8'));
const slots = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/world-slots.json'), 'utf8'));

test('stages count from birth, and the two lore adolescents stay at 7', () => {
  assert.strictEqual(Breeding.lifeStage(0), 'cub');
  assert.strictEqual(Breeding.lifeStage(3), 'cub');
  assert.strictEqual(Breeding.lifeStage(4), 'adolescent');
  assert.strictEqual(Breeding.lifeStage(7), 'adolescent');
  assert.strictEqual(Breeding.lifeStage(8), 'adult');
  assert.strictEqual(Breeding.lifeStage(12), 'adult');
  assert.strictEqual(Breeding.RULES.yearLengthDays, 80);
  assert.strictEqual(slots.slots.find((row) => row.slot === 'hc09').ageSeasons, 7);
  assert.strictEqual(slots.slots.find((row) => row.slot === 'mw08').ageSeasons, 7);
  assert.strictEqual(Breeding.lifeStage(slots.slots.find((row) => row.slot === 'hc09').ageSeasons), 'adolescent');
});

test('conception in spring is due 20 days later, in summer, and a female can conceive each spring', () => {
  assert.strictEqual(Breeding.dueAbsDay(1), 21);
  assert.strictEqual(Breeding.dueAbsDay(20), 40);
  assert.strictEqual(Breeding.seasonName(1), 'spring');
  assert.strictEqual(Breeding.seasonName(21), 'summer');
  assert.strictEqual(Breeding.seasonName(40), 'summer');
  assert.strictEqual(Breeding.inSpring(20), true);
  assert.strictEqual(Breeding.inSpring(21), false);
  assert.strictEqual(Breeding.playerMayConceive(8, 2), true);
  assert.strictEqual(Breeding.playerMayConceive(9, 2), false);
  assert.strictEqual(Breeding.aiLitterFits(14, 0, 2, 4), true);
  assert.strictEqual(Breeding.aiLitterFits(14, 0, 3, 4), false);
});

test('litter words follow the size bands and never print a count', () => {
  assert.strictEqual(Breeding.litterWord(1), 'a cub');
  assert.strictEqual(Breeding.litterWord(2), 'a few cubs');
  assert.strictEqual(Breeding.litterWord(3), 'a few cubs');
  assert.strictEqual(Breeding.litterWord(5), 'several cubs');
  assert.strictEqual(Breeding.litterWord(7), 'many cubs');
  const counts = {};
  const rng = () => 0.5;
  for (let i = 0; i < 20; i++) counts[Breeding.litterSize(() => (i + 0.5) / 20)] = true;
  for (const size of Object.keys(counts)) assert.ok(Number(size) >= 1 && Number(size) <= 7);
});

test('overcrowding stacks and then holds, and a contested hold still counts', () => {
  let row = { seasonsOver: 0, lastCheck: null };
  row = Breeding.bumpOvercrowding(row, 9, 2);
  assert.strictEqual(row.seasonsOver, 1);
  assert.strictEqual(row.penalty, -5);
  row = Breeding.bumpOvercrowding(row, 9, 2);
  assert.strictEqual(row.penalty, -10);
  row.seasonsOver = 6;
  assert.strictEqual(Breeding.contentmentPenalty(6), -20);
  assert.strictEqual(Breeding.capacity(4), 16);
  assert.strictEqual(Breeding.bumpOvercrowding({ seasonsOver: 3 }, 8, 2).seasonsOver, 0);
});

test('needs words follow the worst critical need, and a marking label follows the drawn layer', () => {
  assert.strictEqual(Breeding.needsWord({ health: 'fine', thirst: 'critical', hunger: 'empty' }), 'thirsty');
  assert.strictEqual(Breeding.needsWord({ health: 'critical' }), 'worn');
  assert.strictEqual(Breeding.needsWord({}), 'well enough');
  assert.deepStrictEqual(Breeding.markingDrawn('spotted', () => false), { layer: 'tiger', label: 'Tiger' });
  assert.deepStrictEqual(Breeding.markingDrawn('spotted', (layer) => layer === 'spotted'), { layer: 'spotted', label: 'Spotted' });
  assert.strictEqual(Breeding.markingDrawn('plain').label, 'Plain');
});

test('a v1 save loads as v2 with birth days counted back and no allele change', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/slice-rules.json'), 'utf8'));
  const E = Slice.create({
    map: JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/map.json'), 'utf8')),
    rules, events: JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/events/slice-1.json'), 'utf8')),
    slots, nameData: JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/names/names.json'), 'utf8')),
    looks: { coats: ['tan'], markings: ['none'], eyes: ['amber'] },
    encounters: JSON.parse(fs.readFileSync(path.join(root, 'src/renderer/data/events/encounters-v0.2.json'), 'utf8'))
  });
  const fresh = E.newRun({ mainCat: { catId: 'c1', name: 'Tester', sex: 'female', lifeStage: 'adult', genes: { v: 1, loci: { coat: ['tawny', 'tawny'] } } }, seed: 3 });
  fresh.absDay = 50;
  fresh.cat.ageSeasons = 12;
  fresh.cat.genes.v = 1;
  delete fresh.cat.birthAbsDay;
  delete fresh.cat.aptitude;
  delete fresh.records.overcrowding;
  const loaded = E.migrate(JSON.parse(JSON.stringify(fresh)));
  assert.strictEqual(loaded.saveVersion, 2);
  assert.strictEqual(loaded.cat.genes.v, 2);
  assert.deepStrictEqual(loaded.cat.genes.loci.coat, ['tawny', 'tawny']);
  assert.strictEqual(loaded.cat.birthAbsDay, 41 - 240);
  assert.strictEqual(loaded.cat.frail, false);
  assert.deepStrictEqual(loaded.cat.inheritOnly, {});
  assert.strictEqual(loaded.cat.aptitudeTaught.hunting, 0);
  assert.strictEqual(loaded.records.overcrowding.seasonsOver, 0);
  assert.strictEqual(loaded.cat.ageSeasons, 12);
  assert.strictEqual(Breeding.lifeStage(loaded.cat.ageSeasons), 'adult');
});

test('personality stays near the parents average and aptitude stays inside its band', () => {
  const rng = Breeding.gaussian;
  let calls = 0;
  const flat = () => {
    calls += 1;
    return 0.5;
  };
  const personality = Breeding.inheritPersonality({ aggression: 89 }, { aggression: 50, sociability: 40, boldness: 40, loyalty: 40, curiosity: 40 }, flat);
  assert.ok(personality.aggression >= 60 && personality.aggression <= 80);
  const aptitude = Breeding.inheritAptitude({ hunting: 100 }, { hunting: 100 }, flat);
  for (const value of Object.values(aptitude)) assert.ok(value >= 80 && value <= 120);
  assert.ok(calls > 0 && rng);
});

test('every breeding line can be filled, and no sentence starts with a token', () => {
  const vars = {
    playerName: 'Ash', mateName: 'Birch', damName: 'Ash', sireName: 'Birch', cubName: 'Pebble',
    catName: 'Pebble', litterWord: 'a few cubs', suggestedName: 'Pebble', needsWord: 'thirsty',
    standoutLook: 'a rare coat', sexWord: 'a daughter', teacherName: 'Birch', branchWord: 'hunting',
    heirName: 'Pebble', regionWord: 'the Split Rock'
  };
  const seen = [];
  const walk = (node, key) => {
    if (String(key || '').startsWith('_')) return;
    if (typeof node === 'string') seen.push(node);
    else if (Array.isArray(node)) node.forEach((row) => walk(row, key));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([child, value]) => walk(value, child));
  };
  walk(lines.moments || lines, '');
  const raw = [];
  for (const text of seen) {
    if (/(?:^|[.!?]\s+)\{(litterWord|needsWord)\}/.test(text)) raw.push(text);
    const filled = Breeding.fill(text, vars);
    if (Breeding.rawToken(filled)) raw.push(filled);
  }
  assert.deepStrictEqual(raw, []);
  const born = Breeding.momentLines('litter_born', ['offlineFallback', 'playerDam'], Object.assign({}, vars, { litterWord: 'a cub' }), 0);
  assert.ok(born.some((line) => line.includes('a cub')));
  assert.ok(born.every((line) => !Breeding.rawToken(line)));
  const lost = Breeding.momentLines('litter_lost', ['offlineFallback', 'playerDam'], vars, 0);
  assert.ok(lost.some((line) => /lost/i.test(line)));
});

test('the overcrowding sim stays near the published figures', () => {
  const out = fs.readFileSync(path.join(root, 'sim/overcrowding_sim_v0.1.out'), 'utf8');
  assert.match(out, /recommended, fixed\s+y5 11\/9-13\s+y10 11\/9-14/);
  assert.match(out, /warn<=y10\s+91%/);
  assert.match(out, /highcrag\s+y5 15\/13-16\s+y10 14\/12-16/);
  assert.match(out, /max 21/);
  const script = `
import importlib.machinery
loader = importlib.machinery.SourceFileLoader('ocsim', 'sim/overcrowding_sim_v0.1.py')
mod = loader.load_module()
mod.SLOTS = mod.load_slots()
def med(rows):
    rows = sorted(rows)
    return rows[min(len(rows)-1, int(0.5*len(rows)))]
held = [mod.run_player(dict(regions=2, cpr=4, pen=('esc', 5, 20), expand=False, pgate='proposed'), i) for i in range(60)]
sizes = [row['yr']['size'][9] for row in held]
warns = sum(1 for row in held if row['first_warn'] is not None and row['first_warn'] < 40) / len(held)
wild = [mod.run_player(dict(regions=2, cpr=4, pen=('flat', 5, 0), expand=True), i) for i in range(40)]
wild_sizes = [row['yr']['size'][9] for row in wild]
ai = [mod.run_world(dict(cpr=4, gate='room', mode='pairs', xmate=0.5), i) for i in range(30)]
def y10(name):
    return med([row['sizes'][name][9] for row in ai])
print(med(sizes), round(warns, 3), med(wild_sizes), y10('highcrag'), y10('bonefield'), y10('mistwood'), max(row['peak']['highcrag'] for row in ai))
`;
  const ran = spawnSync('python3', ['-c', script], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(ran.status, 0, ran.stderr);
  const [size, warn, runaway, hc, bf, mw, peak] = ran.stdout.trim().split(/\s+/).map(Number);
  assert.ok(size >= 8 && size <= 16, 'player ' + size);
  assert.ok(warn >= 0.7, 'warn ' + warn);
  assert.ok(runaway >= 40, 'ungated ' + runaway);
  assert.ok(hc >= 10 && hc <= 18, 'hc ' + hc);
  assert.ok(bf >= 7 && bf <= 14, 'bf ' + bf);
  assert.ok(mw >= 7 && mw <= 14, 'mw ' + mw);
  assert.ok(peak <= 30, 'peak ' + peak);
});

test('an old save ages hc09 and mw08 back to 7 and the tiger marking has a layer', () => {
  const cat = { id: 'hc09', ageSeasons: 8, birthAbsDay: Breeding.seasonStart(50) - 160, stage: 'adult', genes: { v: 1, loci: {} } };
  Breeding.migrateCat(cat, 50, 'premade');
  assert.strictEqual(cat.ageSeasons, 7);
  assert.strictEqual(cat.birthAbsDay, Breeding.seasonStart(50) - 140);
  assert.strictEqual(cat.stage, 'adolescent');
  assert.strictEqual(Breeding.markingEntry('tiger').layer, 'tiger');
  assert.strictEqual(Breeding.markingDrawn('tiger', () => false).label, 'Tiger');
});

test('a founded pair conceives in spring, gives birth in summer, and warns when over capacity', () => {
  const state = {
    day: 1, seed: 3, dead: null,
    cat: { catId: 'c1', name: 'Ash', sex: 'female', ageSeasons: 12, lifeStage: 'adult', genes: { v: 2, personality: { sociability: 50 } } },
    npcs: { birch: { id: 'birch', name: 'Birch', sex: 'male', ageSeasons: 12, lifeStage: 'adult', met: true, faction: 'pride-1', genes: { v: 2, personality: { sociability: 40 } } } },
    records: { pride: { id: 'pride-1', name: 'Ash' }, matePair: { mateId: 'birch', bondedDay: 1 }, members: [{ catId: 'birch' }] },
    map: { claims: { split: { 'pride-1': 60 } } },
    needs: { health: 80, hunger: 80, thirst: 80, energy: 80 }
  };
  const known = Breeding.onDay(state);
  assert.strictEqual(known.eventId, 'breeding.pregnancy_known');
  assert.match(known.beats[0].text, /a few cubs|a cub|several cubs|many cubs/);
  assert.ok(state.cat.pregnancy.dueAbsDay === state.cat.pregnancy.conceivedAbsDay + 20);
  state.day = state.cat.pregnancy.dueAbsDay;
  const born = Breeding.onDay(state);
  assert.strictEqual(born.eventId, 'breeding.litter_born');
  assert.ok(Breeding.view(state).cubs.length >= 1);
  state.day = 41;
  for (let i = 0; i < 12; i++) state.npcs['extra' + i] = { id: 'extra' + i, faction: 'pride-1', ageSeasons: 10, dead: false };
  const warning = Breeding.onDay(state);
  assert.strictEqual(warning.eventId, 'breeding.overcrowded');
  assert.match(warning.beats[0].text, /press/);
  const lostState = JSON.parse(JSON.stringify(state));
  lostState.cat.pregnancy = { conceivedAbsDay: 1, dueAbsDay: 21, litterSize: 2, litterWord: 'a few cubs' };
  lostState.dead = { cause: 'starvation' };
  const lost = Breeding.litterLostEvent(lostState);
  const ending = Breeding.noHeirEvent(lostState);
  assert.match(lost.beats[0].text, /cubs you were carrying are lost/);
  assert.match(ending.beats[0].text, /no heir/);
  const retired = Breeding.retireEvent(state, 'Pebble');
  assert.ok(!/no heir/.test(retired.beats.map((beat) => beat.text).join(' ')));
  for (const style of ['story', 'standard', 'sim']) {
    const again = {
      day: 81, seed: 4, dead: null,
      cat: { catId: 'c1', name: 'Ash', sex: 'female', ageSeasons: 13, lifeStage: 'adult', genes: { v: 2, personality: {} } },
      npcs: { birch: { id: 'birch', name: 'Birch', sex: 'male', ageSeasons: 13, lifeStage: 'adult', faction: 'pride-1', genes: { v: 2, personality: {} } } },
      records: { style, pride: { id: 'pride-1', name: 'Ash' }, matePair: { mateId: 'birch', bondedDay: 1 }, members: [{ catId: 'birch' }] },
      map: { claims: { split: { 'pride-1': 60 } } },
      needs: {}
    };
    const card = Breeding.onDay(again);
    assert.ok(card && card.eventId === 'breeding.pregnancy_known', style);
  }
});
