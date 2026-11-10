/**
 * Encounters v0.1.1 §8.3 (Tundra 39fabd7). Fifteen pass bands.
 * Targets live in data/encounter-engine.json. The engine flag stays off.
 */
const Engine = require('../renderer/js/encounter-engine');
const Parity = require('./encounter-parity');
const Fight = require('../renderer/js/fight');
const Rng = require('../renderer/js/rng');

function rate(n, fn) {
  let hits = 0;
  for (let i = 0; i < n; i++) if (fn(i)) hits += 1;
  return hits / n;
}
function pct(n) {
  return `${Math.round(n * 1000) / 10}%`;
}
function near(got, target, tolerance) {
  return Math.abs(got - target) <= tolerance;
}
function rowSpec(id) {
  return Engine.config.bands.rows.find((row) => row.id === id);
}
function line(id, ok, got) {
  const spec = rowSpec(id);
  return { id, name: spec.name, result: ok ? 'PASS' : 'FAIL', target: spec.target, got };
}
function huntStats(n, seed, policy) {
  let ok = 0;
  let energy = 0;
  let hurt = 0;
  for (let i = 0; i < n; i++) {
    const row = Engine.resolve({
      kind: 'hunt', seed: seed + i, quick: true, policy, size: 'small', style: 'standard',
      player: { id: 'player' }, opponent: { id: 'prey' }
    });
    if (row.ok) ok += 1;
    energy += row.energy;
    if (row.injury) hurt += 1;
  }
  return { success: ok / n, meanEnergy: energy / n, injuryRate: hurt / n };
}
function expose(row) {
  return { hp: row.hp };
}
function hpOnly(row) {
  const shown = expose(row);
  if (Object.keys(shown).join() !== 'hp') return false;
  const bad = [];
  JSON.stringify(shown, (key, value) => {
    if (typeof value === 'number' && key !== 'player' && key !== 'opponent') bad.push(key);
    return value;
  });
  return bad.length === 0 && typeof shown.hp.player === 'number' && typeof shown.hp.opponent === 'number';
}

function measure(opts) {
  const n = opts.count || 4000;
  const seed = (opts.seed || 1) >>> 0;
  const tol = Engine.config.bands;
  const fightN = tol.fightCells;
  const checked = Parity.fightReport(fightN, tol.fightTolerance, seed);
  const fightRows = checked.fights.concat([checked.sensible]);
  const bands = fightRows.map((row) => line(row.id, row.ok, `${pct(row.got)} ±${tol.fightTolerance * 100}pp n=${fightN}`));
  let slow = [];
  if (opts.slow) {
    const slowChecked = Parity.fightReport(tol.slowFightCells, tol.slowFightTolerance, seed);
    slow = slowChecked.fights.concat([slowChecked.sensible]).map((row) => line(row.id, row.ok, `${pct(row.got)} ±${tol.slowFightTolerance * 100}pp n=${tol.slowFightCells}`));
  }

  const steady = huntStats(n, seed + 600000, 'steady');
  const bold = huntStats(n, seed + 700000, 'allBold');
  bands.push(line(6, near(steady.success, rowSpec(6).target, tol.huntTolerance) && steady.meanEnergy > 0, `${pct(steady.success)} energy ${Math.round(steady.meanEnergy * 10) / 10} injury ${pct(steady.injuryRate)}`));
  bands.push(line(7, near(bold.success, rowSpec(7).target, tol.huntTolerance) && bold.meanEnergy > steady.meanEnergy && bold.injuryRate > steady.injuryRate, `${pct(bold.success)} energy ${Math.round(bold.meanEnergy * 10) / 10} injury ${pct(bold.injuryRate)}`));

  let showdownDiffs = 0;
  const showN = Math.min(n, 1000);
  for (let i = 0; i < showN; i++) {
    const trial = seed + i;
    const live = Fight.resolve({ showdown: true, suitorDisplayM: 2, rivalDisplayM: 1, rng: Rng.stream(trial, 'band8') });
    const again = Fight.resolve({ showdown: true, suitorDisplayM: 2, rivalDisplayM: 1, rng: Rng.stream(trial, 'band8') });
    const chance = Fight.showdownChance(2, 1);
    const roll = Rng.stream(trial, 'band8')();
    const matched = live.won === again.won && live.chance === again.chance && live.chance === chance
      && live.injuries.loser == null && live.injuries.winner == null
      && again.injuries.loser == null && again.injuries.winner == null
      && (roll * 100 < chance) === live.won;
    const skipped = Engine.resolve({ kind: 'showdown', seed: trial });
    const skippedAgain = Engine.resolve({ kind: 'showdown', seed: trial });
    if (!matched || JSON.stringify(skipped) !== JSON.stringify(skippedAgain) || skipped.skipped !== true) showdownDiffs += 1;
  }
  bands.push(line(8, showdownDiffs === tol.showdownDiffs, `${showdownDiffs} differences`));

  const sparN = Math.min(n, 400);
  let floor = 0;
  let rolls = 0;
  for (let i = 0; i < sparN; i++) {
    const row = Engine.resolve({
      kind: 'spar', seed: seed + i, quick: false, policy: 'average',
      player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
    });
    const low = Math.min(row.hp.player, row.hp.opponent);
    if (low === Engine.config.fight.sparStop) floor += 1;
    rolls += row.injuryRolls || 0;
    if (row.injury) rolls += 1;
  }
  bands.push(line(9, floor === sparN && rolls === Engine.config.fight.sparInjuryRolls, `${Engine.config.fight.sparStop} HP, ${rolls} injury rolls`));

  const readProfile = { pairValue: 30, sociability: 50, compat: 0, standing: 0, style: 'standard', curiosity: 100 };
  const delta = Engine.courtshipChance(readProfile, 'readTraits') - Engine.courtshipChance(readProfile, 'average');
  bands.push(line(10, delta <= tol.courtshipReadMax && delta > 0, `+${Math.round(delta * 10) / 10} points`));

  const fresh = { pairValue: 30, sociability: 50, compat: 0, standing: 0, style: 'standard' };
  const freshChance = Engine.courtshipChance(fresh, 'average') / 100;
  const freshGot = rate(n, (i) => Engine.resolve({
    kind: 'courtship', seed: seed + 1100000 + i, quick: true, policy: 'average',
    player: { id: 'player' }, opponent: { id: 'cat' }, courtship: fresh
  }).accepted);
  bands.push(line(11, Math.abs(freshChance - rowSpec(11).target) < 0.001 && near(freshGot, rowSpec(11).target, tol.courtshipTolerance), pct(freshGot)));

  function bundle(trial) {
    return JSON.stringify([
      Engine.resolve({ kind: 'spar', seed: trial, quick: false, policy: 'average', player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 } }),
      Engine.resolve({ kind: 'hunt', seed: trial, policy: 'steady', size: 'small', player: { id: 'player' }, opponent: { id: 'prey' } }),
      Engine.resolve({ kind: 'showdown', seed: trial })
    ]);
  }
  const reloadDiffs = bundle(seed) === bundle(seed) ? 0 : 1;
  bands.push(line(12, reloadDiffs === rowSpec(12).target, `${reloadDiffs} differences`));

  const shown = Engine.resolve({
    kind: 'spar', seed, quick: false, policy: 'average',
    player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
  });
  bands.push(line(13, hpOnly(shown), 'HP only'));

  const rounds = [];
  const roundN = Math.min(n, 800);
  for (let i = 0; i < roundN; i++) {
    rounds.push(Engine.resolve({
      kind: 'spar', seed: i, quick: false, policy: 'average',
      player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
    }).rounds);
  }
  rounds.sort((a, b) => a - b);
  const mid = rounds[Math.floor(rounds.length / 2)];
  bands.push(line(14, mid >= tol.sparRounds[0] && mid <= tol.sparRounds[1], String(mid)));

  let fled = 0;
  let alive = 0;
  const fleeN = Math.min(n, 200);
  for (let i = 0; i < fleeN; i++) {
    const row = Engine.resolve({
      kind: 'fight', seed: seed + 1500000 + i, quick: false, policy: 'fleeAt30',
      player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
    });
    if (row.fled) fled += 1;
    if (row.hp.player > 0) alive += 1;
  }
  bands.push(line(15, fled === fleeN && alive === fleeN, pct(fled / fleeN)));

  let timedOut = 0;
  const timeoutN = Math.min(n, 400);
  for (let i = 0; i < timeoutN; i++) {
    const fight = Engine.resolve({
      kind: 'fight', seed: seed + 1600000 + i, quick: false, policy: 'average',
      player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
    });
    const spar = Engine.resolve({
      kind: 'spar', seed: seed + 1700000 + i, quick: false, policy: 'average',
      player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
    });
    if (fight.timeout) timedOut += 1;
    if (spar.timeout) timedOut += 1;
  }
  const timeoutRate = timedOut / (timeoutN * 2);
  const timeouts = { rate: timeoutRate, limit: tol.timeoutLimit, ok: timeoutRate < tol.timeoutLimit };

  return {
    command: 'bands', seed, count: n, adapter: 'engine', enabled: true,
    spec: tol.spec, revision: tol.revision, bands, slow, timeouts
  };
}

function formatBandTable(log) {
  const lines = log.bands.map((row) => `band ${String(row.id).padStart(2, ' ')}  ${row.result}  ${row.name}  target ${row.target}  got ${row.got}`);
  for (const row of log.slow || []) lines.push(`slow ${String(row.id).padStart(2, ' ')}  ${row.result}  ${row.name}  target ${row.target}  got ${row.got}`);
  if (log.timeouts) lines.push(`timeouts  ${log.timeouts.ok ? 'PASS' : 'FAIL'}  encounter timeouts  target <${log.timeouts.limit * 100}%  got ${pct(log.timeouts.rate)}`);
  return lines.join('\n');
}

module.exports = { measure, formatBandTable, expose };
