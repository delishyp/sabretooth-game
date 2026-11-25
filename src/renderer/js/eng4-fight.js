/**
 * Fight engine matching sim/eng4.py, including the 75% honest telegraph
 * and the repetition penalty. Uses the same random stream as CPython.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./py-random'));
  else root.Eng4Fight = factory(root.PyRandom);
})(typeof self !== 'undefined' ? self : this, function (PyRandom) {
  const MOVES = {
    swipe: [18, 0.95, 1],
    bite: [30, 0.75, 2],
    pounce: [45, 0.55, 3],
    defend: [0, 0, 0],
    intimidate: [0, 0, 1]
  };
  const MOVE_NAMES = Object.keys(MOVES);
  const K = 1.35;
  const COUNTER = 9;
  const FEINT = 0.25;
  const REP = [0, 0.10, 0.20];

  function weights(aggr, bold) {
    const a = (aggr - 50) / 50;
    const b = (bold - 50) / 50;
    const raw = {
      bite: 3,
      swipe: 3 - a,
      pounce: 2 + 1.5 * a + 0.5 * b,
      defend: 1.5 - a - 0.5 * b,
      intimidate: 1 + 0.5 * b
    };
    const w = {};
    for (const name of MOVE_NAMES) w[name] = Math.max(0.1, raw[name]);
    return w;
  }

  function pick(w, rng, af) {
    const opts = af.filter((name) => w[name] != null);
    let total = 0;
    for (const name of opts) total += w[name];
    let roll = rng.random() * total;
    let acc = 0;
    for (const name of opts) {
      acc += w[name];
      if (roll < acc) return name;
    }
    return opts[opts.length - 1];
  }

  function affordable(m) {
    return MOVE_NAMES.filter((name) => MOVES[name][2] <= m.st);
  }

  function ai(aggr, bold) {
    const w = weights(aggr, bold);
    function policy(m, o, rng, af) {
      return pick(w, rng, af);
    }
    policy.reader = false;
    policy.label = 'ai';
    return policy;
  }

  function biteOnly(m, o, rng, af) {
    for (const name of ['bite', 'swipe', 'defend']) {
      if (af.indexOf(name) !== -1) return name;
    }
  }
  biteOnly.reader = false;
  biteOnly.label = 'biteOnly';

  function feintTell(rng, intent) {
    if (intent == null) return null;
    if (rng.random() >= FEINT) return intent;
    return rng.choice(MOVE_NAMES.filter((name) => name !== intent));
  }
  function hitChance(move, rep, shaken) {
    let hit = MOVES[move][1] - REP[Math.min(rep, 2)];
    if (shaken > 0) hit -= 0.15;
    return hit;
  }
  function sensible(m, o, rng, af, tel) {
    if (tel === 'pounce' && af.indexOf('defend') !== -1) return 'defend';
    if ((o.open || o.shaken) && af.indexOf('pounce') !== -1) return 'pounce';
    if (m.last === 'bite' && m.rep >= 1 && af.indexOf('swipe') !== -1) return 'swipe';
    if (af.indexOf('bite') !== -1) return 'bite';
    return af.indexOf('swipe') !== -1 ? 'swipe' : 'defend';
  }
  sensible.reader = true;
  sensible.label = 'sensible';

  function reader(m, o, rng, af, tel) {
    if ((tel === 'pounce' || tel === 'bite') && m.hp <= 100) return 'defend';
    if ((o.open || o.shaken) && af.indexOf('pounce') !== -1) return 'pounce';
    if (tel === 'defend' && af.indexOf('intimidate') !== -1) return 'intimidate';
    if (m.last === 'bite' && m.rep >= 1) return af.indexOf('swipe') !== -1 ? 'swipe' : 'defend';
    if (af.indexOf('bite') !== -1) return 'bite';
    return af.indexOf('swipe') !== -1 ? 'swipe' : 'defend';
  }
  reader.reader = true;
  reader.label = 'reader';

  function blank(s) {
    return { hp: 100, st: 5, guard: false, open: false, shaken: 0, last: null, rep: 0, intent: null, s: s };
  }

  function fleeChance(yourHp, theirHp, endurance) {
    const raw = 50 + 5 * (endurance || 0) + ((yourHp - theirHp) / 4);
    return Math.max(10, Math.min(90, raw)) / 100;
  }

  function sparGrant(lastDay, day) {
    if (lastDay == null || day - lastDay >= 5) return 5;
    return 0;
  }

  function fight(sA, sB, polA, polB, rng, k, maxr, opts) {
    const exp = k == null ? K : k;
    const cap = maxr == null ? 13 : maxr;
    const rules = opts || {};
    const st = { A: blank(sA), B: blank(sB) };
    const pol = { A: polA, B: polB };
    const order = rng.random() < 0.5 ? ['A', 'B'] : ['B', 'A'];
    for (const side of ['A', 'B']) {
      const other = side === 'A' ? 'B' : 'A';
      st[side].intent = pol[side](st[side], st[other], rng, affordable(st[side]), null);
    }
    for (let r = 0; r < cap; r++) {
      for (const me of order) {
        const op = me === 'A' ? 'B' : 'A';
        const m = st[me];
        const o = st[op];
        if (rules.bold) {
          const bold = rules.bold[me];
          const never = rules.neverFlee && rules.neverFlee[me];
          if (!never && bold <= 30 && m.hp <= 30) {
            if (rng.random() < fleeChance(m.hp, o.hp, rules.endurance || 0)) {
              return { winner: op, rounds: r + 1, fled: true, deathRoll: false, hp: { A: st.A.hp, B: st.B.hp } };
            }
            continue;
          }
        }
        const af = affordable(m);
        const mv = af.indexOf(m.intent) !== -1 ? m.intent : pol[me](m, o, rng, af, null);
        m.st -= MOVES[mv][2];
        m.guard = false;
        m.st = Math.min(5, m.st + 1 + (mv === 'defend' ? 1 : 0));
        if (mv === 'swipe' || mv === 'bite' || mv === 'pounce') {
          m.rep = m.last === mv ? m.rep + 1 : 0;
          m.last = mv;
        }
        if (mv === 'defend') m.guard = true;
        else if (mv === 'intimidate') {
          if (rng.random() < Math.min(0.9, 0.5 * (m.s / o.s))) o.shaken = 2;
        } else {
          let base = MOVES[mv][0];
          const hit = hitChance(mv, m.rep, m.shaken);
          if (m.shaken > 0) {
            base *= 0.8;
            m.shaken -= 1;
          }
          if (rng.random() < hit) {
            let d = base * Math.pow(m.s / o.s, exp) * rng.uniform(0.85, 1.15);
            if (o.guard) {
              d *= 0.5;
              m.hp -= COUNTER * Math.pow(o.s / m.s, exp);
            }
            if (o.open) d *= 1.25;
            o.hp -= d;
            o.open = false;
            const hpNow = { A: st.A.hp, B: st.B.hp };
            if (rules.stop > 0) {
              if (o.hp <= rules.stop) return { winner: me, rounds: r + 1, yielded: true, injuryRolls: 0, deathRoll: false, hp: hpNow };
              if (m.hp <= rules.stop) return { winner: op, rounds: r + 1, yielded: true, injuryRolls: 0, deathRoll: false, hp: hpNow };
            } else {
              if (o.hp <= 0) return { winner: me, rounds: r + 1, hp: hpNow };
              if (m.hp <= 0) return { winner: op, rounds: r + 1, hp: hpNow };
            }
          } else if (mv === 'pounce') m.open = true;
        }
        const naf = affordable(m);
        m.intent = pol[me].reader ? null : pol[me](m, o, rng, naf, null);
        const tel = feintTell(rng, m.intent);
        o.tel = tel;
        if (pol[op].reader) o.intent = pol[op](o, m, rng, affordable(o), tel);
      }
    }
    const tied = st.A.hp === st.B.hp;
    let winner = st.A.hp > st.B.hp ? 'A' : 'B';
    let breakOff = false;
    if (tied && rules.defender === 'A') winner = 'A';
    else if (tied && rules.defender === 'B') winner = 'B';
    else if (tied && rules.defender === 'none') { winner = null; breakOff = true; }
    return {
      winner, rounds: cap, timeout: true, breakOff,
      hp: { A: st.A.hp, B: st.B.hp }
    };
  }

  function cell(sA, sB, pol, personality, n, seed) {
    const rng = new PyRandom.Random(seed);
    const foe = ai(personality[0], personality[1]);
    let wins = 0;
    let capped = 0;
    const rounds = [];
    for (let i = 0; i < n; i++) {
      const row = fight(sA, sB, pol, foe, rng);
      if (row.winner === 'A') wins += 1;
      if (row.rounds === 13) capped += 1;
      rounds.push(row.rounds);
    }
    rounds.sort((a, b) => a - b);
    const mid = Math.floor((rounds.length - 1) / 2);
    const median = rounds.length % 2 ? rounds[mid] : (rounds[mid] + rounds[mid + 1]) / 2;
    return { win: wins / n, median, cap: capped / n };
  }

  return { MOVES, K, FEINT, REP, weights, pick, ai, biteOnly, reader, sensible, fight, cell, feintTell, hitChance, fleeChance, sparGrant, Random: PyRandom.Random };
});
