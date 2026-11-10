/**
 * Parity outline only. encounters-v0.1 is an unsigned draft, so this file does not
 * implement fight or hunt rules and does not call encounter_fight_sim_v0.1.py.
 *
 * TODO(encounter-engine): when that engine exists, run a fixed trial count for each
 * row below and compare the rate to the python sim. Until then compare() does not run.
 *
 * Fight policy targets: average 50%, sensible 71%, biteOnly 90%, fleeAt30 10%.
 * Hunt size targets (Standard solo): small 55%, medium 50%, large 30%.
 */
const TARGETS = {
  fight: [
    { policy: 'average', target: 0.5 },
    { policy: 'sensible', target: 0.71 },
    { policy: 'biteOnly', target: 0.9 },
    { policy: 'fleeAt30', target: 0.1 }
  ],
  hunt: [
    { size: 'small', target: 0.55 },
    { size: 'medium', target: 0.5 },
    { size: 'large', target: 0.3 }
  ]
};

function compare() {
  return {
    compared: false,
    reason: 'engine-unsigned',
    todo: 'encounter_fight_sim_v0.1.py',
    targets: TARGETS
  };
}

if (require.main === module) {
  const result = compare();
  console.log('Encounter parity is not run. The engine spec is unsigned and the fight rules are not implemented.');
  console.log(JSON.stringify(result));
}

module.exports = { TARGETS, compare };
