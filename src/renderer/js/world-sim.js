/**
 * AI-only territory and council season loop.
 * Numbers are the ones map-v1, world-map-territory and councils already cite.
 * Patrol days use the /3 change. Ambition figures are the councils §9 candidate defaults.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorldSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function load(file) {
    return require('../data/' + file);
  }
  const map = load('map.json');
  const slots = load('world-slots.json').slots;
  const T = map.tunables;
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  const AMBITION = { chance: 0.25, temperament: { bonefield: 1.2, highcrag: 1.0, mistwood: 0.8 }, pressSeasons: 4, breakPct: 0.10, skirmishBreakPct: 0.15 };
  const ADULTS = {};
  for (const id of PRIDES) ADULTS[id] = slots.filter((row) => row.faction === id && (row.stage === 'adult' || row.stage === 'elder')).length;
  const FACTION = Object.fromEntries(map.factions.map((row) => [row.id, row]));
  const REGION = Object.fromEntries(map.regions.map((row) => [row.id, row]));
  const NEI = {};
  for (const region of map.regions) NEI[region.id] = [];
  for (const edge of map.edges) { NEI[edge.a].push(edge.b); NEI[edge.b].push(edge.a); }

  function rngOf(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function blankClaims() {
    const claims = {};
    for (const region of map.regions) claims[region.id] = {};
    for (const row of map.startClaims) claims[row.regionId][row.prideId] = row.claim;
    return claims;
  }
  function owner(claims, id) {
    const list = Object.entries(claims[id] || {}).sort((a, b) => b[1] - a[1]);
    const lead = list[0];
    const second = list[1];
    const holder = lead && lead[1] >= T.holdMin ? lead[0] : 'neutral';
    const disputedBy = holder !== 'neutral' && second && second[1] >= T.contestMin && lead[1] - second[1] <= T.contestGap ? second[0] : null;
    return { holder, disputedBy, lead: lead ? lead[1] : 0, second: second ? second[1] : 0, leadId: lead && lead[0], secondId: second && second[0] };
  }
  function heldBy(claims, pride) {
    return map.regions.filter((region) => owner(claims, region.id).holder === pride).map((region) => region.id);
  }
  function prey(region) {
    const row = REGION[region];
    return (row.preyBySeason && row.preyBySeason.summer != null) ? row.preyBySeason.summer : row.prey;
  }
  function hazardPenalty(region) {
    const rows = REGION[region].hazards || [];
    const peak = rows.reduce((best, row) => Math.max(best, row.pct || 0), 0);
    return peak / 5;
  }
  function liveDeal(deals, a, b, kind, regionId) {
    return deals.find((row) => row.state === 'active' && row.parties.indexOf(a) >= 0 && row.parties.indexOf(b) >= 0 && (!kind || row.kind === kind) && (regionId == null || row.regionId === regionId));
  }
  function blocksMark(deals, marker, holder, regionId) {
    return deals.some((row) => row.state === 'active' && row.parties.indexOf(marker) >= 0 && row.parties.indexOf(holder) >= 0 && (
      row.kind === 'truce' || row.kind === 'alliance' || (row.kind === 'border' && row.regionId === regionId)
    ));
  }

  function touch(claims, a, b) {
    for (const id of heldBy(claims, a)) {
      for (const next of NEI[id]) if (owner(claims, next).holder === b) return next;
    }
    return null;
  }
  function season(claims, rel, deals, press, rng, stats) {
    const contested = map.regions.map((region) => region.id).filter((id) => owner(claims, id).disputedBy);
    const items = [];
    for (let i = 0; i < PRIDES.length; i++) {
      for (let j = i + 1; j < PRIDES.length; j++) {
        const a = PRIDES[i];
        const b = PRIDES[j];
        const already = deals.some((row) => row.kind === 'truce' && row.parties.indexOf(a) >= 0 && row.parties.indexOf(b) >= 0);
        if (!already && Math.min(rel[a + '>' + b] || 0, rel[b + '>' + a] || 0) <= -30) items.push({ kind: 'truce', parties: [a, b], afterBlood: true });
        const zone = touch(claims, a, b);
        const mouths = ADULTS[a] * 40;
        const store = heldBy(claims, a).reduce((sum, id) => sum + prey(id) * 20, 0);
        const foodNeed = clamp((mouths - store) / 40, 0, 3);
        if (zone && foodNeed >= 2) items.push({ kind: 'shared_hunting_ground', parties: [a, b], regionId: zone });
        const recent = (stats.recent || []).filter((row) => row.season >= stats.season - 2);
        const fought = (x, y) => recent.some((row) => row.parties.indexOf(x) >= 0 && row.parties.indexOf(y) >= 0);
        if (!already && fought(a, 'highcrag') && fought(b, 'highcrag') && a !== 'highcrag' && b !== 'highcrag') items.push({ kind: 'truce', parties: [a, b], afterBlood: true });
        if (!already && fought(a, 'bonefield') && fought(b, 'bonefield') && a !== 'bonefield' && b !== 'bonefield') items.push({ kind: 'truce', parties: [a, b], afterBlood: true });
        if (!already && fought(a, 'mistwood') && fought(b, 'mistwood') && a !== 'mistwood' && b !== 'mistwood') items.push({ kind: 'truce', parties: [a, b], afterBlood: true });
      }
    }
    const agenda = items.slice(0, 3);
    if (agenda.length) {
      stats.councils += 1;
      for (const item of agenda) {
        const [a, b] = item.parties;
        const relation = rel[b + '>' + a] || 0;
        const base = item.afterBlood && item.kind === 'truce' ? 50 : 30 + relation / 2;
        const strength = ADULTS[a] === ADULTS[b] ? 0 : (ADULTS[b] < ADULTS[a] ? 1 : -1);
        let temper = b === 'highcrag' ? -10 : b === 'bonefield' && item.kind !== 'alliance' ? -10 : b === 'mistwood' ? 10 : 0;
        const chance = clamp(base + 10 * strength + temper, 5, 90);
        if (rng() * 100 < chance && !liveDeal(deals, a, b)) {
          deals.push({ kind: item.kind, parties: [a, b], regionId: item.regionId || null, startSeason: stats.season, endSeason: stats.season + (item.kind === 'border' ? 2 : 1), state: 'active' });
          stats.pairs[a + b] = (stats.pairs[a + b] || 0) + 1;
        }
      }
    }
    for (const pride of PRIDES) {
      if (!press[pride] && rng() < AMBITION.chance * AMBITION.temperament[pride]) {
        const mine = heldBy(claims, pride);
        let best = null;
        let score = -1e9;
        for (const id of mine) {
          for (const next of NEI[id]) {
            const row = REGION[next];
            if (row.coreDen) continue;
            const who = owner(claims, next);
            if (!PRIDES.includes(who.holder) || who.holder === pride) continue;
            const value = prey(next) - hazardPenalty(next) - who.lead / 100;
            if (value > score) { score = value; best = { regionId: next, holder: who.holder }; }
          }
        }
        if (best) press[pride] = { regionId: best.regionId, holder: best.holder, left: AMBITION.pressSeasons };
      }
      let marked = false;
      const pushing = press[pride];
      if (pushing) {
        const who = owner(claims, pushing.regionId);
        if (who.holder === pride || who.holder === 'neutral' || pushing.left <= 0) press[pride] = null;
        else if (blocksMark(deals, pride, who.holder, pushing.regionId) && !who.disputedBy) {
          if (!pushing.rolled) {
          pushing.rolled = true;
          stats.blockRolls = (stats.blockRolls || 0) + 1;
          if (rng() < AMBITION.breakPct) {
            const row = deals.find((deal) => deal.state === 'active' && blocksMark([deal], pride, who.holder, pushing.regionId));
            if (row) { row.state = 'broken'; stats.broken = true; rel[pride + '>' + who.holder] = (rel[pride + '>' + who.holder] || 0) - 15; rel[who.holder + '>' + pride] = (rel[who.holder + '>' + pride] || 0) - 10; }
          }
          }
        } else {
          claims[pushing.regionId][pride] = Math.min(100, (claims[pushing.regionId][pride] || 0) + T.markGain);
          marked = true;
          pushing.left -= 1;
        }
      }
      if (!marked && heldBy(claims, pride).length < (FACTION[pride].targetRegions || 4)) {
        const mine = heldBy(claims, pride);
        let best = null;
        let score = -1e9;
        const pool = mine.length ? mine : [FACTION[pride].coreDen];
        for (const id of pool) {
          for (const next of NEI[id] || []) {
            const who = owner(claims, next);
            if (who.holder !== 'neutral' && who.lead >= T.trespassClaimMin) continue;
            const value = prey(next) - hazardPenalty(next);
            if (value > score) { score = value; best = next; }
          }
        }
        if (best) claims[best][pride] = Math.min(100, (claims[best][pride] || 0) + T.markGain);
      }
    }
    const rolledBreak = {};
    for (const id of map.regions.map((region) => region.id)) {
      const who = owner(claims, id);
      if (!who.disputedBy) continue;
      const a = who.holder;
      const b = who.disputedBy;
      if (!PRIDES.includes(a) || !PRIDES.includes(b)) continue;
      const key = a < b ? a + b : b + a;
      const shielded = deals.some((row) => row.state === 'active' && (row.kind === 'truce' || row.kind === 'alliance' || row.kind === 'border') && row.parties.indexOf(a) >= 0 && row.parties.indexOf(b) >= 0);
      if (shielded) {
        if (rolledBreak[key] || stats.oncePair[key]) continue;
        rolledBreak[key] = true;
        stats.oncePair[key] = true;
        stats.skirmishRolls = (stats.skirmishRolls || 0) + 1;
        if (rng() >= AMBITION.skirmishBreakPct) continue;
        const row = deals.find((deal) => deal.state === 'active' && deal.parties.indexOf(a) >= 0 && deal.parties.indexOf(b) >= 0);
        if (row) { row.state = 'broken'; stats.broken = true; }
      }
      const chance = clamp(T.skirmishBase + (who.lead - who.second), 10, 80);
      if (rng() * 100 >= chance) continue;
      stats.fights += 1;
      const winA = rng() < ADULTS[a] / (ADULTS[a] + ADULTS[b]);
      const winner = winA ? a : b;
      const loser = winA ? b : a;
      claims[id][winner] = Math.min(100, (claims[id][winner] || 0) + T.skirmishWin);
      claims[id][loser] = Math.max(0, (claims[id][loser] || 0) - T.skirmishLose);
      rel[a + '>' + b] = (rel[a + '>' + b] || 0) - 5;
      rel[b + '>' + a] = (rel[b + '>' + a] || 0) - 5;
      stats.recent = stats.recent || [];
      stats.recent.push({ season: stats.season, parties: [a, b] });
    }
    for (const pride of PRIDES) {
      const mine = map.regions.map((region) => region.id).filter((id) => {
        const who = owner(claims, id);
        return who.holder === pride || who.disputedBy === pride;
      });
      const days = Math.ceil(ADULTS[pride] / 3);
      const order = mine.slice().sort((a, b) => (claims[a][pride] || 0) - (claims[b][pride] || 0));
      const paid = new Set(order.slice(0, days));
      for (const id of mine) {
        const gain = paid.has(id) ? T.patrolGain - T.decayUpkept : -T.decayMissed;
        claims[id][pride] = clamp((claims[id][pride] || 0) + gain, 0, 100);
        const den = FACTION[pride].coreDen;
        if (id === den) claims[id][pride] = Math.max(T.holdMin, claims[id][pride]);
      }
    }
    for (const id of map.regions.map((region) => region.id)) {
      const who = owner(claims, id);
      for (const pride of Object.keys(claims[id])) {
        if (who.holder === 'neutral' && pride !== who.leadId) claims[id][pride] = Math.max(0, claims[id][pride] - T.decayWild);
      }
    }
    for (const row of deals) {
      if (row.state === 'active' && row.endSeason <= stats.season) row.state = 'kept';
      if (row.kind === 'border' && row.state === 'active') {
        row.run = (row.run || 0) + 1;
        stats.borderRun = Math.max(stats.borderRun, row.run);
      }
    }
  }

  function run(seed, seasons) {
    const rng = rngOf(seed);
    const claims = blankClaims();
    const rel = {};
    const deals = [];
    const press = {};
    const before = {};
    for (const id of map.regions.map((region) => region.id)) before[id] = owner(claims, id).holder;
    let changes = 0;
    let freeze = 0;
    let longest = 0;
    let fights = 0;
    let broken = false;
    let borderRun = 0;
    let councils = 0;
    let blockRolls = 0;
    let skirmishRolls = 0;
    const pairHits = {};
    const recent = [];
    const oncePair = {};
    for (let i = 0; i < seasons; i++) {
      const stats = { season: i, fights: 0, broken: false, borderRun: 0, councils: 0, pairs: pairHits, recent, oncePair };
      season(claims, rel, deals, press, rng, stats);
      fights += stats.fights;
      if (stats.broken) broken = true;
      borderRun = Math.max(borderRun, stats.borderRun);
      councils += stats.councils;
      blockRolls += stats.blockRolls || 0;
      skirmishRolls += stats.skirmishRolls || 0;
      let changed = 0;
      for (const id of map.regions.map((region) => region.id)) {
        const holder = owner(claims, id).holder;
        if (holder !== before[id]) { changed += 1; before[id] = holder; }
      }
      changes += changed;
      if (changed === 0) { freeze += 1; longest = Math.max(longest, freeze); }
      else freeze = 0;
    }
    const held = {};
    let most = 0;
    for (const pride of PRIDES) {
      held[pride] = heldBy(claims, pride).length;
      most = Math.max(most, held[pride]);
    }
    return { changes: changes / seasons, most, longest, held, fights, broken, borderRun, councils, pairHits, blockRolls, skirmishRolls };
  }

  function percentile(values, p) {
    const sorted = values.slice().sort((a, b) => a - b);
    const at = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[at];
  }
  function summarise(seeds, seasons) {
    const rows = [];
    for (let seed = 1; seed <= seeds; seed++) rows.push(run(seed, seasons || 40));
    const mean = (key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
    const heldMean = {};
    for (const pride of PRIDES) heldMean[pride] = rows.reduce((sum, row) => sum + row.held[pride], 0) / rows.length;
    const pair = (a, b) => rows.filter((row) => row.pairHits[a + b] || row.pairHits[b + a]).length / rows.length;
    return {
      seeds: rows.length,
      seasons: seasons || 40,
      holderChanges: mean('changes'),
      mostP95: percentile(rows.map((row) => row.most), 0.95),
      freezeP95: percentile(rows.map((row) => row.longest), 0.95),
      held: heldMean,
      fights: mean('fights'),
      broken: rows.filter((row) => row.broken).length / rows.length,
      borderRun: Math.max(...rows.map((row) => row.borderRun)),
      councilsPerSeason: rows.reduce((sum, row) => sum + row.councils, 0) / rows.length / (seasons || 40),
      blockRolls: rows.reduce((sum, row) => sum + row.blockRolls, 0) / rows.length,
      skirmishRolls: rows.reduce((sum, row) => sum + row.skirmishRolls, 0) / rows.length,
      bonefieldHighcrag: pair('bonefield', 'highcrag'),
      bonefieldMistwood: pair('bonefield', 'mistwood'),
      highcragMistwood: pair('highcrag', 'mistwood')
    };
  }
  return { ADULTS, AMBITION, run, summarise, owner, blankClaims };
});
