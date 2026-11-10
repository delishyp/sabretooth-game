/**
 * Parity check for the headless engine against §8.2.
 * Quick resolve + average: fights 50/71/90/10, hunt 55/50/30, courtship §2 (37% fresh).
 * Sensible fight at equal strength is about 66%. Median spar is 5 or 6 rounds.
 * Showdown is not measured here.
 *
 *   node src/dev/encounter-parity.js
 */
const Engine = require('../renderer/js/encounter-engine');

const BANDS = {
  fight: [
    { label: 'equal', player: 10, opponent: 10, target: 0.5 },
    { label: 'edge10', player: 11, opponent: 10, target: 0.71 },
    { label: 'edge25', player: 12.5, opponent: 10, target: 0.9 },
    { label: 'weaker25', player: 10, opponent: 12.5, target: 0.1 }
  ],
  hunt: [
    { size: 'small', target: 0.55 },
    { size: 'medium', target: 0.5 },
    { size: 'large', target: 0.3 }
  ],
  courtshipFresh: { pairValue: 30, sociability: 50, compat: 0, standing: 0, style: 'standard', target: 0.37 },
  sensibleEqual: { player: 10, opponent: 10, target: 0.66 },
  medianRounds: { min: 5, max: 6 }
};

function rate(n, fn) {
  let wins = 0;
  for (let i = 0; i < n; i++) if (fn(i)) wins += 1;
  return wins / n;
}
function median(values) {
  const copy = values.slice().sort((a, b) => a - b);
  return copy[Math.floor(copy.length / 2)];
}
function fightReport(n, tolerance, seedBase) {
  const base = (seedBase || 0) >>> 0;
  const tol = tolerance == null ? Engine.config.bands.fightTolerance : tolerance;
  const fights = BANDS.fight.map((row, index) => {
    const got = rate(n, (i) => Engine.resolve({
      kind: 'fight', seed: base + i, quick: true, policy: 'average', engine: true,
      player: { id: 'player', strength: row.player },
      opponent: { id: 'foe', strength: row.opponent }
    }).winner === 'player');
    return { id: index + 1, label: row.label, target: row.target, got, n, tolerance: tol, ok: Math.abs(got - row.target) <= tol };
  });
  const sensibleGot = rate(n, (i) => Engine.resolve({
    kind: 'fight', seed: base + 100000 + i, quick: true, policy: 'sensible', engine: true,
    player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
  }).winner === 'player');
  const sensible = {
    id: 5, label: 'sensible', target: BANDS.sensibleEqual.target, got: sensibleGot, n, tolerance: tol,
    ok: Math.abs(sensibleGot - BANDS.sensibleEqual.target) <= tol
  };
  return { fights, sensible };
}
function measure(n, opts) {
  const spec = Engine.config.bands;
  const fightN = (opts && opts.fightCells) || n;
  const fightTol = opts && opts.fightTolerance != null ? opts.fightTolerance : spec.fightTolerance;
  const checked = fightReport(fightN, fightTol, opts && opts.seed);
  const fights = checked.fights;
  const sensible = checked.sensible;
  const hunts = BANDS.hunt.map((row) => {
    const got = rate(n, (i) => Engine.resolve({
      kind: 'hunt', seed: i, quick: true, policy: 'steady', size: row.size, engine: true,
      player: { id: 'player' }, opponent: { id: 'prey' }
    }).ok);
    return { size: row.size, target: row.target, got, ok: Math.abs(got - row.target) <= spec.huntTolerance };
  });
  const fresh = BANDS.courtshipFresh;
  const chance = Engine.courtshipChance(fresh, 'average');
  const gotCourt = rate(n, (i) => Engine.resolve({
    kind: 'courtship', seed: i, quick: true, policy: 'average', engine: true,
    player: { id: 'player' }, opponent: { id: 'hc05' }, courtship: fresh
  }).accepted);
  const courtship = {
    target: fresh.target, chance: chance / 100, got: gotCourt,
    ok: Math.abs(chance - fresh.target * 100) < 0.01 && Math.abs(gotCourt - fresh.target) <= spec.courtshipTolerance
  };
  const rounds = [];
  for (let i = 0; i < Math.min(n, 800); i++) {
    rounds.push(Engine.resolve({
      kind: 'spar', seed: i, quick: false, policy: 'average', engine: true,
      player: { id: 'player', strength: 10 }, opponent: { id: 'foe', strength: 10 }
    }).rounds);
  }
  const mid = median(rounds);
  return {
    fights, hunts, courtship,
    sensible,
    medianRounds: { got: mid, ok: mid >= BANDS.medianRounds.min && mid <= BANDS.medianRounds.max }
  };
}
function passed(report) {
  return report.fights.every((row) => row.ok) && report.hunts.every((row) => row.ok)
    && report.courtship.ok && report.sensible.ok && report.medianRounds.ok;
}

if (require.main === module) {
  const spec = Engine.config.bands;
  const report = measure(spec.fightCells);
  const out = { regular: report };
  let failed = !passed(report);
  if (process.env.SABRETOOTH_PARITY_SLOW === '1') {
    const slow = fightReport(spec.slowFightCells, spec.slowFightTolerance, 0);
    out.slow = slow;
    failed = failed || slow.fights.some((row) => !row.ok) || !slow.sensible.ok;
  }
  console.log(JSON.stringify(out, null, 2));
  if (failed) process.exit(1);
}

module.exports = { BANDS, measure, fightReport, passed, median };
