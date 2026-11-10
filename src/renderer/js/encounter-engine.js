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
  function loadNarration() {
    if (typeof require === 'function') {
      try { return require('../data/encounter-narration-v1.json'); } catch (e) { /* browser */ }
    }
    return { foes: {}, lines: {} };
  }
  const narration = loadNarration();
  const OUTCOMES = Object.keys(narration.lines);
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

  function fillLine(text, vars) {
    return String(text || '').replace(/\{(foeName|name)\}/g, (token, key) => (vars && vars[key] != null ? String(vars[key]) : token));
  }
  function foeOf(opts) {
    const opponent = (opts && opts.opponent) || {};
    const catalog = narration.foes || {};
    const named = catalog[opponent.kind] || catalog[opponent.id] || null;
    const group = opponent.group === true || !!(named && named.group);
    const foeName = opponent.foeName || opponent.name || (named && named.foeName) || (group ? 'the wolves' : 'the stranger');
    const name = (opts && opts.player && opts.player.name) || 'you';
    return { foeName, name, group };
  }
  function beat(key, vars) {
    return { key, line: fillLine(narration.lines[key], vars) };
  }
  function telegraphKey() {
    return 'fight.telegraph';
  }
  function policyFight(rng, policy) {
    const cfg = config.proposed;
    const attacks = ['bite', 'claw'];
    let playerHits = 0;
    let foeHits = 0;
    let streak = 0;
    let last = null;
    let rounds = 0;
    const goal = cfg.hitsToWin;
    while (playerHits < goal && foeHits < goal && rounds < config.fight.maxRounds) {
      rounds += 1;
      const tele = attacks[rng() < 0.5 ? 0 : 1];
      const honest = !cfg.telegraph || rng() < cfg.honest;
      let choice = attacks[rounds % 2];
      if (policy === 'biteOnly') choice = 'bite';
      else if (policy === 'sensible' && cfg.telegraph) choice = tele;
      if (cfg.repeatPenalty) {
        if (choice === last) streak += 1;
        else { streak = 1; last = choice; }
      }
      let hit = cfg.baseHit;
      if (cfg.repeatPenalty && streak === 2) hit += cfg.repeatSecond;
      if (cfg.repeatPenalty && streak >= 3) hit += cfg.repeatFromThird;
      if (policy === 'sensible' && cfg.telegraph) hit += honest ? cfg.honestBonus : cfg.feintPenalty;
      if (rng() < clamp(hit, 0.05, 0.95)) playerHits += 1;
      if (rng() < cfg.baseHit) foeHits += 1;
    }
    const timeout = playerHits < goal && foeHits < goal;
    let winner = 'opponent';
    if (!timeout && playerHits > foeHits) winner = 'player';
    return { winner, rounds, timeout, playerHits, foeHits, policy };
  }
  function policySample(n, seed) {
    const totals = { sensible: 0, biteOnly: 0, average: 0, timeouts: 0 };
    const names = ['sensible', 'biteOnly', 'average'];
    for (let i = 0; i < n; i++) {
      for (const policy of names) {
        const row = policyFight(Rng.stream((seed || 1) >>> 0, 'policy-fight', policy, i), policy);
        if (row.winner === 'player') totals[policy] += 1;
        if (row.timeout) totals.timeouts += 1;
      }
    }
    return {
      sensible: totals.sensible / n,
      biteOnly: totals.biteOnly / n,
      average: totals.average / n,
      timeoutRate: totals.timeouts / (n * names.length),
      n
    };
  }
  function quickFight(rng, playerStrength, opponentStrength, policy) {
    const cfg = config.fight;
    let ps = playerStrength;
    if (policy === 'sensible') ps *= cfg.sensibleStrength;
    if (policy === 'biteOnly') ps *= cfg.biteStrength;
    const as = ps * unit(rng, cfg);
    const bs = opponentStrength * unit(rng, cfg);
    const winner = as === bs ? 'opponent' : (as > bs ? 'player' : 'opponent');
    return { winner, playerScore: as, opponentScore: bs, rounds: 1, quick: true, timeout: false };
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
    const injury = null;
    const injuryRolls = spar ? cfg.sparInjuryRolls : 0;
    if (spar) {
      if (playerHp <= cfg.sparStop) playerHp = cfg.sparStop;
      if (opponentHp <= cfg.sparStop) opponentHp = cfg.sparStop;
    }
    const timeout = !fled && rounds >= cfg.maxRounds && playerHp > stop && opponentHp > stop;
    let winner = 'opponent';
    if (fled) winner = 'opponent';
    else if (playerHp === opponentHp) winner = 'opponent';
    else winner = playerHp > opponentHp ? 'player' : 'opponent';
    return {
      winner, rounds, fled, timeout, injury, injuryRolls, quick: false, spar: !!spar,
      hp: { player: Math.max(0, playerHp), opponent: Math.max(0, opponentHp) },
      stoppedAt: spar ? cfg.sparStop : 0,
      serious: injury === 'serious' || injury === 'crippling'
    };
  }

  function resolve(opts) {
    const kind = opts.kind || 'fight';
    const who = foeOf(opts);
    if (kind === 'showdown') {
      return {
        adapter: 'engine', kind, skipped: true, reason: 'showdown-untouched', rounds: null,
        beats: [beat('showdown.untouched', who)]
      };
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
      const ok = roll * 100 < chance;
      const energyBase = policy === 'allBold' ? config.hunt.energy.allBold : config.hunt.energy.steady;
      const energy = energyBase * (config.hunt.energy.size[size] || 1);
      let injuryP = (config.hunt.injury[size] || 0) * (ok ? 1 : config.hunt.injury.failMult);
      if (policy === 'allBold') injuryP *= config.hunt.injury.boldMult;
      const injured = rng() < injuryP;
      let injury = null;
      if (injured) {
        injury = 'minor';
        if (size === 'large') {
          const tier = rng();
          injury = tier < 0.7 ? 'minor' : tier < 0.95 ? 'serious' : 'crippling';
        }
      }
      let stamina = config.hunt.stamina;
      let rounds = 0;
      if (!quick) {
        const cost = config.hunt.cost[size] * (policy === 'allBold' ? 0.85 : 1);
        while (stamina > 0 && rounds < 8) {
          rounds += 1;
          stamina -= cost * (0.8 + rng() * 0.4);
        }
      }
      const huntBeats = [beat(ok ? 'hunt.success' : 'hunt.fail', who)];
      if (injury) huntBeats.push(beat(`hunt.injury.${injury}`, who));
      return {
        adapter: 'engine', kind, policy, policyKnown: known, quick, size,
        chance, roll, ok, energy, injury, injuryRate: injuryP,
        rounds: quick ? 1 : rounds, stamina: quick ? null : stamina,
        beats: huntBeats
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
      const court = opts.courtship || opts.player || {};
      const accepted = roll * 100 < chance;
      const sociability = court.sociability != null ? court.sociability : 50;
      const reaction = court.repeat ? 'courtship.repeat'
        : sociability >= 70 ? 'courtship.reaction.high'
          : sociability <= 30 ? 'courtship.reaction.low'
            : 'courtship.reaction.baseline';
      return {
        adapter: 'engine', kind, policy, policyKnown: known, quick,
        chance, roll, accepted, rounds: quick ? 1 : rounds,
        beats: [beat('courtship.open', who), beat(reaction, who), beat(accepted ? 'courtship.accepted' : 'courtship.declined', who)]
      };
    }
    const spar = kind === 'spar' || opts.spar === true;
    const ps = opts.player && Number.isFinite(opts.player.strength) ? opts.player.strength : 10;
    const os = opts.opponent && Number.isFinite(opts.opponent.strength) ? opts.opponent.strength : 10;
    const fight = quick ? quickFight(rng, ps, os, policy) : turnFight(rng, ps, os, policy, spar);
    const fightBeats = [];
    if (spar) fightBeats.push(beat('spar.open', who), beat('spar.stop', who));
    else {
      fightBeats.push(beat('fight.open', who));
      fightBeats.push(beat(who.group ? 'fight.warning.group' : 'fight.warning', who));
      fightBeats.push(beat(telegraphKey(), who));
      if (fight.fled) fightBeats.push(beat('fight.flee', who));
      else if (fight.timeout) fightBeats.push(beat('fight.timeout', who));
      else fightBeats.push(beat(fight.winner === 'player' ? 'fight.hit' : 'fight.miss', who), beat(fight.winner === 'player' ? 'fight.win' : 'fight.lose', who));
    }
    return Object.assign({
      adapter: 'engine', kind: spar ? 'spar' : 'fight', policy, policyKnown: known,
      lethal: !spar, playerStrength: ps, opponentStrength: os, beats: fightBeats
    }, fight);
  }

  function trialSeed(base, kind, policy, opponent, index) {
    return Rng.hash(`${base >>> 0}|${kind}|${policy}|${opponent}|${index}`) >>> 0;
  }
  function median(values) {
    if (!values.length) return null;
    const copy = values.slice().sort((a, b) => a - b);
    return copy[Math.floor(copy.length / 2)];
  }
  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }
  /**
   * Thousands of seeded trials. Rows are aggregated. Only failing seeds are kept.
   * The game flag stays off; pass engine:true from the dev runner.
   */
  function batch(opts) {
    const spec = config.batch;
    const count = opts.count || 1000;
    const base = (opts.seed || 1) >>> 0;
    const playerStrength = spec.playerStrength;
    const failures = [];
    const fight = [];
    for (const policy of spec.fightPolicies) {
      for (const opponent of spec.opponents) {
        let wins = 0;
        let flees = 0;
        const rounds = [];
        for (let i = 0; i < count; i++) {
          const seed = trialSeed(base, 'fight', policy, opponent.id, i);
          const row = resolve({
            kind: 'fight', seed, quick: false, policy,
            player: { id: 'player', strength: playerStrength },
            opponent: { id: opponent.id, strength: opponent.strength }
          });
          if (row.winner === 'player') wins += 1;
          if (row.fled) flees += 1;
          rounds.push(row.rounds);
        }
        fight.push({
          policy, opponent: opponent.id, n: count,
          winRate: round3(wins / count),
          medianRounds: median(rounds),
          fleeRate: round3(flees / count)
        });
      }
    }
    const hunt = [];
    for (const policy of spec.huntPolicies) {
      let ok = 0;
      let energy = 0;
      let injured = 0;
      let n = 0;
      for (const size of spec.huntSizes) {
        let sizeOk = 0;
        let sizeEnergy = 0;
        let sizeHurt = 0;
        for (let i = 0; i < count; i++) {
          const seed = trialSeed(base, 'hunt', policy, size, i);
          const row = resolve({ kind: 'hunt', seed, quick: true, policy, size, player: { id: 'player' }, opponent: { id: 'prey' } });
          if (row.ok) sizeOk += 1;
          sizeEnergy += row.energy;
          if (row.injury) sizeHurt += 1;
        }
        n += count;
        ok += sizeOk;
        energy += sizeEnergy;
        injured += sizeHurt;
        hunt.push({
          policy, size, n: count,
          success: round3(sizeOk / count),
          meanEnergy: round3(sizeEnergy / count),
          injuryRate: round3(sizeHurt / count)
        });
      }
      hunt.push({
        policy, size: 'all', n,
        success: round3(ok / n),
        meanEnergy: round3(energy / n),
        injuryRate: round3(injured / n)
      });
    }
    const courtship = [];
    let averageSuccess = null;
    let readSuccess = null;
    for (const policy of spec.courtshipPolicies) {
      let accepted = 0;
      for (let i = 0; i < count; i++) {
        const seed = trialSeed(base, 'courtship', policy, 'sample', i);
        const row = resolve({
          kind: 'courtship', seed, quick: true, policy,
          player: { id: 'player' }, opponent: { id: 'cat' },
          courtship: spec.courtship
        });
        if (row.accepted) accepted += 1;
      }
      const success = round3(accepted / count);
      if (policy === 'average') averageSuccess = success;
      if (policy === 'readTraits') readSuccess = success;
      courtship.push({ policy, n: count, success });
    }
    let sparBad = 0;
    for (let i = 0; i < count; i++) {
      const seed = trialSeed(base, 'spar', 'average', 'matched', i);
      const row = resolve({
        kind: 'spar', seed, quick: false, policy: 'average',
        player: { id: 'player', strength: playerStrength },
        opponent: { id: 'matched', strength: playerStrength }
      });
      const low = Math.min(row.hp.player, row.hp.opponent);
      if (low !== config.fight.sparStop || row.serious || row.injury === 'serious' || row.injury === 'crippling') {
        sparBad += 1;
        failures.push({ seed, kind: 'spar', policy: 'average', opponent: 'matched', reason: 'spar-floor-or-injury' });
      }
    }
    const show = resolve({ kind: 'showdown', seed: base, player: { id: 'player' }, opponent: { id: 'rival' } });
    if (!show.skipped) failures.push({ seed: base, kind: 'showdown', policy: null, opponent: 'rival', reason: 'showdown-touched' });
    return {
      command: 'batch', seed: base, count, adapter: 'engine', enabled: true,
      summary: {
        fight,
        hunt,
        courtship,
        traitsReadDelta: round3((readSuccess || 0) - (averageSuccess || 0)),
        spar: { n: count, endedAt40: count - sparBad, seriousInjuries: sparBad, failSeeds: failures.filter((row) => row.kind === 'spar').map((row) => row.seed) },
        showdown: { skipped: !!show.skipped, reason: show.reason || null }
      },
      failures
    };
  }

  return { config, narration, OUTCOMES, POLICIES, enabled, resolve, huntChance, courtshipChance, relationshipBonus, batch, trialSeed, median, policyFight, policySample, foeOf, telegraphKey, fillLine };
});
