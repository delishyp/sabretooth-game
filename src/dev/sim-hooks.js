/**
 * Dev-only simulation harness. The encounter, world, and lifetime engines are not written.
 * Each adapter is a TODO stand-in: it consumes the seeded RNG and returns a fixed log shape.
 * Replace the adapter, not the runner, when that engine exists.
 *
 *   SABRETOOTH_SIM=1 node src/dev/sim-hooks.js encounter --seed 8 --kind spar
 *   SABRETOOTH_SIM=1 node src/dev/sim-hooks.js batch --seed 8 --kind spar --count 4
 *   SABRETOOTH_SIM=1 node src/dev/sim-hooks.js world --seed 8 --seasons 4
 *   SABRETOOTH_SIM=1 node src/dev/sim-hooks.js lifetime --seed 8 --days 20
 *
 * Add --csv to print CSV instead of JSON. A release build does not ship src/dev.
 */
const fs = require('fs');
const path = require('path');
const Rng = require('../renderer/js/rng');
const WorldMap = require('../renderer/js/worldmap');
const Engine = require('../renderer/js/encounter-engine');
const PassBands = require('./pass-bands');

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const STUB_PRIDES = ['highcrag', 'bonefield', 'mistwood'];

function allowed(opts) {
  const env = (opts && opts.env) || {};
  return env.SABRETOOTH_SIM === '1' && !(opts && opts.packaged);
}
function quant(roll) {
  return Math.round(roll * 1000000) / 1000000;
}
function num(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Policy names from encounters §8.1. The draft is unsigned, so these names are
 * registered only. They do not change the coin flip.
 * TODO(encounter-engine): replace this adapter. Do not copy fight rules in here.
 * Parity targets for encounter_fight_sim_v0.1.py are outlined in encounter-parity.js.
 */
const POLICIES = {
  fight: ['average', 'sensible', 'biteOnly', 'fleeAt30'],
  hunt: ['steady', 'allBold'],
  courtship: ['average', 'readTraits']
};
function policyGroup(kind) {
  if (kind === 'hunt' || kind === 'courtship' || kind === 'fight') return kind;
  return 'fight';
}
function resolvePolicy(kind, policy) {
  const group = policyGroup(kind);
  const name = typeof policy === 'string' ? policy : (policy && policy.name) || null;
  return { group, name, known: !!(name && POLICIES[group].includes(name)) };
}
function resolveEncounter({ kind, seed, player, opponent, policy, rng }) {
  const bias = policy && typeof policy.playerBias === 'number' ? policy.playerBias : 0.5;
  const roll = quant(rng());
  const named = resolvePolicy(kind, policy);
  return {
    adapter: 'todo',
    engine: 'encounter',
    kind: kind || 'spar',
    policyGroup: named.group,
    policyName: named.name,
    policyKnown: named.known,
    playerId: (player && player.id) || 'player',
    opponentId: (opponent && opponent.id) || 'opponent',
    roll,
    winner: roll < bias ? 'player' : 'opponent'
  };
}

/**
 * TODO(world-engine): replace this adapter with the territory resolver.
 * It logs real starting ownership, then applies one seeded placeholder change of hands.
 * Those changes are harness output. They are not claim rules.
 */
function stepWorld({ claims, seasonIndex, season, rng, ownership }) {
  const regionIds = Object.keys(claims).sort();
  const roll = quant(rng());
  const zoneId = regionIds.length ? regionIds[Math.floor(rng() * regionIds.length)] : null;
  const to = STUB_PRIDES[Math.floor(rng() * STUB_PRIDES.length)];
  const changes = [];
  if (zoneId) {
    const before = ownership(claims, zoneId);
    if (before.holder !== to) {
      const next = Object.assign({}, claims[zoneId]);
      next[to] = (next[to] || 0) + 1;
      claims[zoneId] = next;
      changes.push({ zoneId, from: before.holder, to, strength: next[to], todo: true });
    }
  }
  return { adapter: 'todo', engine: 'world', seasonIndex, season, roll, ownership: snapshot(claims, ownership), changes };
}

/**
 * TODO(lifetime-engine): replace this adapter with deeds, witnesses, and titles.
 * level is a seeded placeholder. title comes from policy.titles when those are passed.
 */
function stepLife({ day, policy, rng }) {
  const roll = quant(rng());
  const titles = policy && Array.isArray(policy.titles) && policy.titles.length ? policy.titles : ['unproven', 'noted', 'known'];
  const level = Math.floor(rng() * 5);
  const title = titles[Math.floor(rng() * titles.length)] || 'unproven';
  return {
    adapter: 'todo',
    engine: 'lifetime',
    day,
    roll,
    deeds: roll >= 0.5 ? [{ templateKey: 'sim.lifetime.deed' }] : [],
    witnesses: roll < 0.5 ? ['sim.witness.unset'] : [],
    level,
    title
  };
}

const engines = { encounter: { resolve: resolveEncounter }, world: { step: stepWorld }, lifetime: { step: stepLife } };

function snapshot(claims, ownership) {
  return Object.keys(claims).sort().map((zoneId) => {
    const own = ownership(claims, zoneId);
    const strength = own.holder && own.holder !== 'neutral' ? (own.claims[own.holder] || 0) : 0;
    return { zoneId, holder: own.holder, state: own.state, strength };
  });
}
function loadMap(map) {
  if (map) return map;
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../renderer/data/map.json'), 'utf8'));
}

function engineOn(opts) {
  return Engine.enabled(opts);
}
function simulateEncounter({ kind, seed, count, player, opponent, policy, engine, env, quick, size, style, courtship, spar, bands, slow, narration } = {}) {
  const s = seed >>> 0;
  if (bands || kind === 'bands') {
    const table = bandTable({ seed: s, count, engine, env, slow });
    return Object.assign({}, table, { command: 'encounter' });
  }
  const name = kind || 'spar';
  if (engineOn({ engine, env })) {
    const row = Engine.resolve({ kind: name, seed: s, player, opponent, policy, quick, size, style, courtship, spar });
    row.index = 0;
    const narrationKeys = (row.beats || []).map((item) => item.key);
    if (narration) return { command: 'encounter', seed: s, kind: name, adapter: 'engine', enabled: true, narrationKeys, rows: [row] };
    return { command: 'encounter', seed: s, kind: name, adapter: 'engine', enabled: true, rows: [row] };
  }
  const rng = Rng.stream(s, 'sim', 'encounter', name, (player && player.id) || 'player', (opponent && opponent.id) || 'opponent');
  const row = engines.encounter.resolve({ kind: name, seed: s, player, opponent, policy, rng });
  row.index = 0;
  return { command: 'encounter', seed: s, kind: name, adapter: 'todo', enabled: false, rows: [row] };
}
function simulateEncounterBatch({ kind, seed, count, player, opponent, policy, engine, env } = {}) {
  const s = seed >>> 0;
  if (engineOn({ engine, env })) return Engine.batch({ seed: s, count: num(count, 1000) });
  const name = kind || 'spar';
  const n = num(count, 1);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const rng = Rng.stream(s, 'sim', 'encounter-batch', name, i);
    const row = engines.encounter.resolve({ kind: name, seed: s, player, opponent, policy, rng });
    row.index = i;
    rows.push(row);
  }
  return { command: 'batch', seed: s, kind: name, count: n, adapter: 'todo', enabled: false, rows };
}
function bandTable({ seed, count, engine, env, slow } = {}) {
  if (!engineOn({ engine, env })) return { command: 'bands', seed: seed >>> 0, enabled: false, adapter: 'todo', bands: [] };
  const slowOn = slow === true || (env && env.SABRETOOTH_PARITY_SLOW === '1');
  return PassBands.measure({ seed, count: num(count, 4000), slow: slowOn });
}
function simulateWorld({ seed, seasons, map } = {}) {
  const s = seed >>> 0;
  const n = num(seasons, 1);
  const data = loadMap(map);
  const wm = WorldMap.create(data);
  const claims = wm.initClaims();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const rng = Rng.stream(s, 'sim', 'world', i);
    rows.push(engines.world.step({ claims, seasonIndex: i, season: SEASONS[i % SEASONS.length], rng, ownership: wm.ownership }));
  }
  return { command: 'world', seed: s, seasons: n, adapter: 'todo', rows };
}
function simulateLifetime({ seed, days, policy } = {}) {
  const s = seed >>> 0;
  const n = num(days, 1);
  const rows = [];
  for (let day = 1; day <= n; day++) {
    const rng = Rng.stream(s, 'sim', 'lifetime', day);
    rows.push(engines.lifetime.step({ day, policy, rng }));
  }
  return { command: 'lifetime', seed: s, days: n, adapter: 'todo', rows };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function csvEncounter(log) {
  const lines = ['seed,kind,index,policyName,policyKnown,playerId,opponentId,roll,winner'];
  for (const row of log.rows) lines.push([log.seed, row.kind, row.index, row.policyName || '', row.policyKnown ? 'yes' : '', row.playerId, row.opponentId, row.roll, row.winner].map(csvCell).join(','));
  return lines.join('\n');
}
function csvWorld(log) {
  const lines = ['seed,seasonIndex,season,zoneId,holder,state,strength,changeFrom,changeTo,todo'];
  for (const row of log.rows) {
    const changeBy = Object.fromEntries(row.changes.map((change) => [change.zoneId, change]));
    for (const own of row.ownership) {
      const change = changeBy[own.zoneId];
      lines.push([log.seed, row.seasonIndex, row.season, own.zoneId, own.holder, own.state, own.strength, change ? change.from : '', change ? change.to : '', change ? 'yes' : ''].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}
function csvLifetime(log) {
  const lines = ['seed,day,level,title,roll,deeds,witnesses'];
  for (const row of log.rows) {
    const deeds = row.deeds.map((deed) => deed.templateKey).join('|');
    lines.push([log.seed, row.day, row.level, row.title, row.roll, deeds, row.witnesses.join('|')].map(csvCell).join(','));
  }
  return lines.join('\n');
}
function csvBatch(log) {
  const lines = ['section,seed,kind,policy,opponent,size,n,winRate,medianRounds,fleeRate,success,meanEnergy,injuryRate,traitsReadDelta,endedAt40,serious,reason'];
  const push = (cells) => lines.push(cells.map(csvCell).join(','));
  for (const row of log.summary.fight) push(['fight', log.seed, 'fight', row.policy, row.opponent, '', row.n, row.winRate, row.medianRounds, row.fleeRate, '', '', '', '', '', '', '']);
  for (const row of log.summary.hunt) push(['hunt', log.seed, 'hunt', row.policy, '', row.size, row.n, '', '', '', row.success, row.meanEnergy, row.injuryRate, '', '', '', '']);
  for (const row of log.summary.courtship) push(['courtship', log.seed, 'courtship', row.policy, '', '', row.n, '', '', '', row.success, '', '', log.summary.traitsReadDelta, '', '', '']);
  push(['spar', log.seed, 'spar', 'average', 'matched', '', log.summary.spar.n, '', '', '', '', '', '', '', log.summary.spar.endedAt40, log.summary.spar.seriousInjuries, '']);
  push(['showdown', log.seed, 'showdown', '', '', '', '', '', '', '', '', '', '', '', '', '', log.summary.showdown.skipped ? 'skipped' : 'touched']);
  for (const fail of log.failures) push(['failure', fail.seed, fail.kind, fail.policy, fail.opponent, '', '', '', '', '', '', '', '', '', '', '', fail.reason]);
  return lines.join('\n');
}
function csvBands(log) {
  const lines = ['pace,band,result,name,target,got,seed'];
  for (const row of log.bands) lines.push(['band', row.id, row.result, row.name, row.target, row.got, log.seed].map(csvCell).join(','));
  for (const row of log.slow || []) lines.push(['slow', row.id, row.result, row.name, row.target, row.got, log.seed].map(csvCell).join(','));
  return lines.join('\n');
}
function toCsv(log) {
  if (log.command === 'world') return csvWorld(log);
  if (log.command === 'lifetime') return csvLifetime(log);
  if (log.command === 'bands') return csvBands(log);
  if (log.summary) return csvBatch(log);
  return csvEncounter(log);
}
function formatBandTable(log) {
  return PassBands.formatBandTable(log);
}
function runCommand(name, opts) {
  if (name === 'encounter') return simulateEncounter(opts);
  if (name === 'batch') return simulateEncounterBatch(opts);
  if (name === 'bands') return bandTable(opts);
  if (name === 'world') return simulateWorld(opts);
  if (name === 'lifetime') return simulateLifetime(opts);
  return null;
}

function readArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) { out._.push(token); continue; }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

if (require.main === module) {
  const args = readArgs(process.argv.slice(2));
  if (!allowed({ packaged: false, env: process.env })) {
    console.error('Sim hooks are debug-only. Set SABRETOOTH_SIM=1 outside a release build.');
    process.exit(1);
  }
  const name = args._[0];
  const log = runCommand(name, {
    seed: args.seed, kind: args.kind, count: args.count, seasons: args.seasons, days: args.days,
    bands: args.bands === true, slow: args.slow === true, narration: args.narration === true,
    player: args.player ? { id: args.player } : undefined,
    opponent: args.opponent ? { id: args.opponent } : undefined,
    policy: args.policy ? { name: args.policy } : undefined,
    env: process.env,
    quick: args.quick === 'false' ? false : undefined,
    size: args.size,
    spar: args.spar === 'true'
  });
  if (!log) {
    console.error('Use one of: encounter, batch, bands, world, lifetime');
    process.exit(1);
  }
  if (name === 'encounter' && args.narration && log.narrationKeys && !args.csv && !args.json) {
    console.log(log.narrationKeys.join('\n'));
  } else if ((name === 'bands' || (name === 'encounter' && args.bands)) && !args.csv && !args.json) {
    if (!log.enabled) {
      console.error('Encounter engine is off. Set SABRETOOTH_ENCOUNTER_ENGINE=1 to print the §8.3 band table.');
      process.exit(1);
    }
    console.log(formatBandTable(log));
    const failed = log.bands.some((row) => row.result === 'FAIL') || (log.slow || []).some((row) => row.result === 'FAIL');
    if (failed) process.exit(1);
  } else console.log(args.csv ? toCsv(log) : JSON.stringify(log));
}

module.exports = {
  allowed, POLICIES, engines, simulateEncounter, simulateEncounterBatch, bandTable, formatBandTable, simulateWorld, simulateLifetime, toCsv, runCommand
};
