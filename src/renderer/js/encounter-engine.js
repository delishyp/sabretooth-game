/**
 * Headless encounter engine. Off unless the caller passes engine:true or
 * SABRETOOTH_ENCOUNTER_ENGINE=1. Showdown pacing is not simulated here.
 * Every number comes from data/encounter-engine.json.
 *
 * Quick resolve uses the current odds: fight edges 50/71/90/10, hunt 55/50/30,
 * courtship from the §2 point roll. Sensible fight is a separate strength
 * multiplier. Turn fights stop a spar at the configured HP.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.EncounterEngine = factory(root.Rng);
})(typeof self !== 'undefined' ? self : this, function (Rng) {
  function loadConfig() {
    if (typeof require === 'function') {
      try { return require('../data/encounter-engine.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/encounter-engine.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing file */ }
    }
    throw new Error('encounter engine config missing');
  }
  const config = loadConfig();
  const POLICIES = {
    fight: ['average', 'sensible', 'biteOnly', 'fleeAt30'],
    hunt: ['steady', 'allBold'],
    courtship: ['average', 'readTraits']
  };

  function enabled(opts) {
    if (opts && opts.engine === true) return true;
    if (opts && opts.engine === false) return false;
    const env = (opts && opts.env) || {};
    return env.SABRETOOTH_ENCOUNTER_ENGINE === '1';
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function unit(rng, cfg) {
    return cfg.randomMin + rng() * (cfg.randomMax - cfg.randomMin);
  }
  function policyName(policy) {
    if (typeof policy === 'string') return policy;
    return (policy && policy.name) || 'average';
  }
  function groupOf(kind) {
    if (kind === 'hunt' || kind === 'courtship') return kind;
    return 'fight';
  }

  function huntChance(size, style, policy) {
    const hunt = config.hunt;
    let points = hunt.base + (hunt.prey[size] || 0) + (hunt.style[style || 'standard'] || 0);
    if (policy === 'allBold') points += hunt.allBold;
    return clamp(points, hunt.clamp[0], hunt.clamp[1]);
  }
  function relationshipBonus(value, crush) {
    let bonus = 0;
    if (value >= 50) bonus += 10;
    else if (value >= 25) bonus += 5;
    else if (value <= -15) bonus += -10;
    if (crush) bonus += 10;
    return bonus;
  }
  function courtshipChance(input, policy) {
    const row = input || {};
    const cfg = config.courtship;
    let points = cfg.base;
    points += cfg.pair * (row.pairValue || 0);
    points += row.relationshipBonus != null ? row.relationshipBonus : relationshipBonus(row.pairValue || 0, row.crush);
    points += (row.displayM || 0) * cfg.displayPerM;
    points += ((row.sociability != null ? row.sociability : 50) - 50) / 5;
    points += (row.compat || 0) / 2;
    points += (row.standing || 0) / 10;
    if (row.mood === 'high') points += 5;
    if (row.mood === 'low') points += -5;
    points += cfg.style[row.style || 'standard'] || 0;
    if (policy === 'readTraits') points += ((row.curiosity != null ? row.curiosity : 50) - 50) * cfg.readTraits;
    return clamp(points, cfg.clamp[0], cfg.clamp[1]);
  }

  function quickFight(rng, playerStrength, opponentStrength, policy) {
    const cfg = config.fight;
    let ps = playerStrength;
    if (policy === 'sensible') ps *= cfg.sensibleStrength;
    if (policy === 'biteOnly') ps *= cfg.biteStrength;
    const as = ps * unit(rng, cfg);
    const bs = opponentStrength * unit(rng, cfg);
    const winner = as === bs ? 'opponent' : (as > bs ? 'player' : 'opponent');
    return { winner, playerScore: as, opponentScore: bs, rounds: 1, quick: true };
  }
  function turnFight(rng, playerStrength, opponentStrength, policy, spar) {
    const cfg = config.fight;
    let playerHp = cfg.hp;
    let opponentHp = cfg.hp;
    let rounds = 0;
    let fled = false;
    const stop = spar ? cfg.sparStop : 0;
    while (playerHp > stop && opponentHp > stop && rounds < cfg.maxRounds) {
      rounds += 1;
      let pDam = playerStrength * cfg.damagePerStrength * unit(rng, cfg);
      let oDam = opponentStrength * cfg.damagePerStrength * unit(rng, cfg);
      if (policy === 'biteOnly') pDam *= cfg.biteDamage;
      if (policy === 'sensible') pDam *= cfg.sensibleStrength;
      playerHp -= oDam;
      opponentHp -= pDam;
      if (!spar && policy === 'fleeAt30' && playerHp <= cfg.fleeAt && playerHp > 0) {
        fled = true;
        break;
      }
    }
    let winner = 'opponent';
    if (fled) winner = 'opponent';
    else if (playerHp === opponentHp) winner = 'opponent';
    else winner = playerHp > opponentHp ? 'player' : 'opponent';
    return {
      winner, rounds, fled, quick: false, spar: !!spar,
      hp: { player: Math.max(0, playerHp), opponent: Math.max(0, opponentHp) },
      stoppedAt: spar ? cfg.sparStop : 0
    };
  }

  function resolve(opts) {
    const kind = opts.kind || 'fight';
    if (kind === 'showdown') {
      return { adapter: 'engine', kind, skipped: true, reason: 'showdown-untouched', rounds: null };
    }
    const policy = policyName(opts.policy);
    const group = groupOf(kind === 'spar' ? 'fight' : kind);
    const known = POLICIES[group].includes(policy);
    const rng = Rng.stream((opts.seed >>> 0), 'encounter-engine', kind, policy, (opts.player && opts.player.id) || 'player', (opts.opponent && opts.opponent.id) || 'opponent');
    const quick = opts.quick !== false;
    if (kind === 'hunt') {
      const size = opts.size || 'medium';
      const chance = huntChance(size, opts.style, policy);
      const roll = rng();
      let stamina = config.hunt.stamina;
      let rounds = 0;
      if (!quick) {
        const cost = config.hunt.cost[size] * (policy === 'allBold' ? 0.85 : 1);
        while (stamina > 0 && rounds < 8) {
          rounds += 1;
          stamina -= cost * (0.8 + rng() * 0.4);
        }
      }
      return {
        adapter: 'engine', kind, policy, policyKnown: known, quick, size,
        chance, roll, ok: roll * 100 < chance, rounds: quick ? 1 : rounds, stamina: quick ? null : stamina
      };
    }
    if (kind === 'courtship') {
      const chance = courtshipChance(opts.courtship || opts.player, policy);
      const roll = rng();
      let interest = 0;
      let rounds = 0;
      if (!quick) {
        while (interest < config.courtship.interestGoal && rounds < 20) {
          rounds += 1;
          interest += (chance / 100) * config.courtship.interestPerPoint * (0.8 + rng() * 0.4);
        }
      }
      return {
        adapter: 'engine', kind, policy, policyKnown: known, quick,
        chance, roll, accepted: roll * 100 < chance, rounds: quick ? 1 : rounds
      };
    }
    const spar = kind === 'spar' || opts.spar === true;
    const ps = opts.player && Number.isFinite(opts.player.strength) ? opts.player.strength : 10;
    const os = opts.opponent && Number.isFinite(opts.opponent.strength) ? opts.opponent.strength : 10;
    const fight = quick ? quickFight(rng, ps, os, policy) : turnFight(rng, ps, os, policy, spar);
    return Object.assign({
      adapter: 'engine', kind: spar ? 'spar' : 'fight', policy, policyKnown: known,
      lethal: !spar, playerStrength: ps, opponentStrength: os
    }, fight);
  }

  return { config, POLICIES, enabled, resolve, huntChance, courtshipChance, relationshipBonus };
});
