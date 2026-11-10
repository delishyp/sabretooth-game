/**
 * Encounters v0.1.1 §8.3 (Tundra 65a73c1). Fifteen pass bands.
 * Fight cells use the eng4 turn model. Targets live in encounter-engine.json.
 * The engine flag stays off.
 */
const Engine = require('../renderer/js/encounter-engine');
const Eng4 = require('../renderer/js/eng4-fight');
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
function line(id, ok, got, extra) {
  const spec = rowSpec(id);
  return {
    id,
    name: (extra && extra.name) || spec.name,
    result: ok ? 'PASS' : 'FAIL',
    target: extra && extra.target != null ? extra.target : spec.target,
    got
  };
}
function huntStats(n, seed, policy, size) {
  let ok = 0;
  let energy = 0;
  let hurt = 0;
  for (let i = 0; i < n; i++) {
    const row = Engine.resolve({
      kind: 'hunt', seed: seed + i, quick: true, policy, size: size || 'small', style: 'standard',
      player: { id: 'player' }, opponent: { id: 'prey' }
    });
    if (row.ok) ok += 1;
    energy += row.energy;
    if (row.injury) hurt += 1;
  }
  return { success: ok / n, meanEnergy: energy / n, injuryRate: hurt / n };
}
function eng4Win(n, seed, pol, sA, sB, foe, opts) {
  const rng = new Eng4.Random(seed);
  const other = Eng4.ai(foe[0], foe[1]);
  let wins = 0;
  let timeouts = 0;
  const rounds = [];
  for (let i = 0; i < n; i++) {
    const row = Eng4.fight(sA, sB, pol, other, rng, null, 13, opts);
    if (row.winner === 'A') wins += 1;
    if (row.timeout) timeouts += 1;
    rounds.push(row.rounds);
  }
  rounds.sort((a, b) => a - b);
  return { win: wins / n, timeout: timeouts / n, median: rounds[Math.floor(rounds.length / 2)] };
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
  const ratios = [1, 1.1, 1.25, 0.8];
  const targets = [0.5, 0.71, 0.9, 0.1];
  const quick = Parity.fightReport(fightN, tol.fightTolerance, seed);
  const turn = ratios.map((ratio, index) => eng4Win(fightN, seed, Eng4.ai(50, 50), 10 * ratio, 10, [50, 50]));
  const averageOk = turn.every((row, index) => near(row.win, targets[index], tol.fightTolerance))
    && quick.fights.every((row) => row.ok);
  const bands = [line(1, averageOk, turn.map((row) => pct(row.win)).join(' / ') + ` ±${tol.fightTolerance * 100}pp n=${fightN}`)];

  const sensibleEqual = eng4Win(fightN, seed + 11, Eng4.sensible, 10, 10, [50, 50]);
  const sensibleWeak = eng4Win(fightN, seed + 12, Eng4.sensible, 8, 10, [50, 50]);
  const biteEqual = eng4Win(fightN, seed + 13, Eng4.biteOnly, 10, 10, [50, 50]);
  const averageEqual = turn[0];
  const biteGap = sensibleEqual.win - biteEqual.win;
  const nobodyBeats = sensibleEqual.win + 0.05 >= averageEqual.win && sensibleEqual.win + 0.05 >= biteEqual.win;
  const policies = { sensible: sensibleEqual.win, biteOnly: biteEqual.win, average: averageEqual.win };
  bands.push(line(
    2,
    near(sensibleEqual.win, 0.63, tol.sensibleTolerance) && near(sensibleWeak.win, 0.16, tol.sensibleTolerance) && biteGap >= 0.06 && nobodyBeats,
    `sensible ${pct(sensibleEqual.win)} / ${pct(sensibleWeak.win)} biteOnly ${pct(biteEqual.win)} average ${pct(averageEqual.win)}`
  ));

  const lengthOk = averageEqual.median >= 5 && averageEqual.median <= 6 && averageEqual.timeout < tol.timeoutLimit;
  bands.push(line(3, lengthOk, `median ${averageEqual.median}, timeouts ${pct(averageEqual.timeout)}`));

  const hot = eng4Win(fightN, seed + 21, Eng4.ai(50, 50), 10, 10, [85, 70]);
  const calm = eng4Win(fightN, seed + 22, Eng4.ai(50, 50), 10, 10, [20, 30]);
  bands.push(line(4, hot.win >= 0.47 && hot.win <= 0.53 && calm.win >= 0.47 && calm.win <= 0.53, `${pct(hot.win)} and ${pct(calm.win)}`));

  const wilds = [
    ['hyena', 7, 40, 30, false, 0.98, 0.99],
    ['dire wolf', 9, 55, 50, false, 0.72, 0.86],
    ['hyena clan', 12, 70, 50, true, 0.15, 0.25],
    ['lion', 12, 65, 80, false, 0.16, 0.26],
    ['wolf pack', 13, 55, 60, true, 0.07, 0.13]
  ];
  const wildGot = [];
  let wildOk = true;
  wilds.forEach((row, index) => {
    const optsWild = { bold: { A: 50, B: row[3] }, neverFlee: { B: row[4] } };
    const avg = eng4Win(fightN, seed + 30 + index, Eng4.ai(50, 50), 10, row[1], [row[2], row[3]], optsWild);
    const sen = eng4Win(fightN, seed + 40 + index, Eng4.sensible, 10, row[1], [row[2], row[3]], optsWild);
    if (!near(avg.win, row[5], tol.wildTolerance) || !near(sen.win, row[6], tol.wildTolerance)) wildOk = false;
    wildGot.push(`${pct(avg.win)}/${pct(sen.win)}`);
  });
  bands.push(line(5, wildOk, wildGot.join(', ')));

  const evenFlee = Eng4.fleeChance(100, 100, 0);
  let fleeBounded = true;
  for (let hp = 0; hp <= 100; hp += 10) {
    const chance = Eng4.fleeChance(hp, 100 - hp, 0);
    if (chance < 0.1 || chance > 0.9) fleeBounded = false;
  }
  const fled = Eng4.fight(10, 7, Eng4.ai(50, 50), Eng4.ai(40, 30), new Eng4.Random(seed), null, 13, { bold: { A: 50, B: 30 } });
  const fleeOk = Math.abs(evenFlee - 0.5) < 1e-9 && fleeBounded && (fled.fled !== true || fled.deathRoll === false);
  bands.push(line(6, fleeOk, `${pct(evenFlee)} first try, clamped 10-90`));

  const sparN = Math.min(n, 400);
  let sparBad = 0;
  let sparRolls = 0;
  let sparDeaths = 0;
  const sparRng = new Eng4.Random(seed + 70);
  for (let i = 0; i < sparN; i++) {
    const row = Eng4.fight(10, 10, Eng4.ai(50, 50), Eng4.ai(50, 50), sparRng, null, 13, { stop: 40 });
    if (Math.min(row.hp.A, row.hp.B) > 40) sparBad += 1;
    sparRolls += row.injuryRolls || 0;
    if (row.deathRoll) sparDeaths += 1;
  }
  const grantOnce = Eng4.sparGrant(null, 1) === 5 && Eng4.sparGrant(1, 5) === 0 && Eng4.sparGrant(1, 6) === 5;
  bands.push(line(7, sparBad === 0 && sparRolls === 0 && sparDeaths === 0 && grantOnce, `40 HP, ${sparRolls} injury rolls`));

  let slow = [];
  if (opts.slow) {
    const slowChecked = Parity.fightReport(tol.slowFightCells, tol.slowFightTolerance, seed);
    slow = slowChecked.fights.concat([slowChecked.sensible]).map((row) => line(row.id, row.ok, `${pct(row.got)} ±${tol.slowFightTolerance * 100}pp n=${tol.slowFightCells}`, { name: row.label, target: row.target }));
  }


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

  const sizes = ['small', 'medium', 'large'];
  const steadyTargets = [0.55, 0.5, 0.3];
  const boldTargets = [0.64, 0.59, 0.41];
  const steadyRows = sizes.map((size, index) => huntStats(n, seed + 600000 + index * 1000, 'steady', size));
  const boldRows = sizes.map((size, index) => huntStats(n, seed + 700000 + index * 1000, 'allBold', size));
  const steadyOk = steadyRows.every((row, index) => near(row.success, steadyTargets[index], tol.huntSteadyTolerance));
  bands.push(line(9, steadyOk, steadyRows.map((row) => pct(row.success)).join(' / ')));
  const energyDelta = Engine.config.hunt.energy.allBold - Engine.config.hunt.energy.steady;
  const boldOk = boldRows.every((row, index) => near(row.success, boldTargets[index], tol.huntTolerance))
    && energyDelta === 15
    && Engine.config.hunt.injury.boldMult === 1.5
    && boldRows[1].meanEnergy - steadyRows[1].meanEnergy === 15;
  bands.push(line(10, boldOk, `${boldRows.map((row) => pct(row.success)).join(' / ')}, energy -${energyDelta}`));

  const plain = Engine.huntSpecial({ prey: 'fawn', roll: 0.2, partner: false, trailReadingM: 0 });
  const deer = Engine.huntSpecial({ prey: 'deer', roll: 0.3, partner: false, trailReadingM: 1 });
  const withPartner = Engine.huntSpecial({ prey: 'horse', roll: 0.1, partner: true, trailReadingM: 0 });
  const withTrail = Engine.huntSpecial({ prey: 'horse', roll: 0.1, partner: false, trailReadingM: 2 });
  const specialOk = plain.drift === 0.25 && plain.drifted && deer.drift === 0.35 && deer.drifted
    && !deer.cutOff && withPartner.cutOff && withTrail.cutOff;
  bands.push(line(11, specialOk, 'freeze 25% (deer 35%), cut off only with a partner or Trail Reading M2'));

  const at25 = { pairValue: 25, sociability: 50, compat: 0, standing: 0, style: 'standard' };
  const at50 = { pairValue: 50, sociability: 50, compat: 0, standing: 0, style: 'standard' };
  const chance25 = Engine.courtshipChance(at25, 'average');
  const chance50 = Engine.courtshipChance(at50, 'average');
  const got25 = rate(n, (i) => Engine.resolve({
    kind: 'courtship', seed: seed + 1100000 + i, quick: true, policy: 'average',
    player: { id: 'player' }, opponent: { id: 'cat' }, courtship: at25
  }).accepted);
  const got50 = rate(Math.min(n, 2000), (i) => Engine.resolve({
    kind: 'courtship', seed: seed + 1200000 + i, quick: true, policy: 'average',
    player: { id: 'player' }, opponent: { id: 'cat' }, courtship: at50
  }).accepted);
  bands.push(line(12, near(chance25 / 100, 0.35, 0.001) && near(chance50 / 100, 0.5, 0.001) && near(got25, 0.35, tol.courtshipTolerance) && near(got50, 0.5, tol.courtshipTolerance), `${pct(got25)} and ${pct(got50)}`));

  const readProfile = { pairValue: 30, sociability: 50, compat: 0, standing: 0, style: 'standard', curiosity: 100 };
  const delta = Engine.courtshipChance(readProfile, 'readTraits') - Engine.courtshipChance(readProfile, 'average');
  const capped = Engine.courtshipChance({ pairValue: 200, curiosity: 100 }, 'readTraits') <= 90;
  const backed = Engine.backOff(25);
  bands.push(line(13, delta > 0 && delta <= tol.courtshipReadMax && capped && backed.delta === 0 && backed.pairValue === 25, `+${Math.round(delta * 10) / 10} points`));

  function bundle(trial) {
    return JSON.stringify([
      Engine.resolve({ kind: 'spar', seed: trial, quick: false, policy: 'average', player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 } }),
      Engine.resolve({ kind: 'hunt', seed: trial, policy: 'steady', size: 'small', player: { id: 'player' }, opponent: { id: 'prey' } }),
      Engine.resolve({ kind: 'showdown', seed: trial })
    ]);
  }
  const reloadDiffs = bundle(seed) === bundle(seed) ? 0 : 1;
  bands.push(line(14, reloadDiffs === 0, `${reloadDiffs} differences`));

  const shown = Engine.resolve({
    kind: 'spar', seed, quick: false, policy: 'average',
    player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
  });
  bands.push(line(15, hpOnly(shown), 'HP only'));

  const timeouts = { rate: averageEqual.timeout, limit: tol.timeoutLimit, ok: averageEqual.timeout < tol.timeoutLimit };

  return {
    command: 'bands', seed, count: n, adapter: 'engine', enabled: true,
    spec: tol.spec, revision: tol.revision, bands, slow, timeouts, policies
  };
}

function formatBandTable(log) {
  const lines = log.bands.map((row) => `band ${String(row.id).padStart(2, ' ')}  ${row.result}  ${row.name}  target ${row.target}  got ${row.got}`);
  for (const row of log.slow || []) lines.push(`slow ${String(row.id).padStart(2, ' ')}  ${row.result}  ${row.name}  target ${row.target}  got ${row.got}`);
  if (log.timeouts) lines.push(`timeouts  ${log.timeouts.ok ? 'PASS' : 'FAIL'}  encounter timeouts  target <${log.timeouts.limit * 100}%  got ${pct(log.timeouts.rate)}`);
  return lines.join('\n');
}

module.exports = { measure, formatBandTable, expose };
