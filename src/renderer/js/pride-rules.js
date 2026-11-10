/**
 * My Pride rules (v0.1.1). Pure functions only: no screen and no buttons.
 * Every id in `actions` is an effect. There is no state-only setter.
 * Numbers live in data/pride-rules.json.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.PrideRules = factory(root.Rng);
})(typeof self !== 'undefined' ? self : this, function (Rng) {
  function loadConfig() {
    if (typeof require === 'function') {
      try { return require('../data/pride-rules.json'); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/pride-rules.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing file */ }
    }
    throw new Error('pride rules config missing');
  }
  const config = loadConfig();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function emptyPride(food) {
    return {
      id: null,
      food: Number.isFinite(food) && food > 0 ? food : 0,
      roles: {},
      orders: {},
      feedingOrder: [],
      heirId: null,
      exiles: []
    };
  }
  function migrate(s) {
    if (!s) return null;
    const prior = s.pride && typeof s.pride === 'object' && !Array.isArray(s.pride) ? s.pride : {};
    let food = prior.food;
    const nested = s.records && s.records.pride && s.records.pride.food;
    if (!Number.isFinite(food) && Number.isFinite(nested)) food = nested;
    if (typeof food !== 'number' || !Number.isFinite(food) || food < 0) food = 0;
    s.pride = {
      id: prior.id || (s.records && s.records.pride && s.records.pride.id) || null,
      food,
      roles: prior.roles && typeof prior.roles === 'object' && !Array.isArray(prior.roles) ? prior.roles : {},
      orders: prior.orders && typeof prior.orders === 'object' && !Array.isArray(prior.orders) ? prior.orders : {},
      feedingOrder: Array.isArray(prior.feedingOrder) ? prior.feedingOrder.slice() : [],
      heirId: prior.heirId || null,
      exiles: Array.isArray(prior.exiles) ? prior.exiles.slice() : []
    };
    return s.pride;
  }

  function roster(state) {
    return (state.roster || []).filter((cat) => cat && cat.status !== 'loner' && cat.status !== 'exiled');
  }
  function catBy(state, id) {
    return (state.roster || []).find((cat) => cat.id === id) || null;
  }
  function duty(state, cat) {
    const order = state.pride.orders[cat.id];
    if (order === 'hunt' || order === 'patrol' || order === 'rest') return order;
    return state.pride.roles[cat.id] || null;
  }
  function rngFor(state, name) {
    return Rng.stream(state.seed >>> 0, 'pride', name, state.day || 1);
  }
  function huntChance(roleBonus) {
    const points = config.hunt.base + config.hunt.prey.medium + (roleBonus ? config.hunt.role : 0);
    return clamp(points, config.hunt.clamp[0], config.hunt.clamp[1]);
  }
  function livingDefenders(state) {
    return roster(state).filter((cat) => cat.stage !== 'cub' && duty(state, cat) !== 'hunt' && duty(state, cat) !== 'patrol' && duty(state, cat) !== 'rest');
  }
  function sitterOnDuty(state) {
    return roster(state).some((cat) => duty(state, cat) === 'cubSitter');
  }

  function performHunt(state, cat) {
    const chance = huntChance(state.pride.roles[cat.id] === 'hunter');
    const roll = rngFor(state, `hunt:${cat.id}`)();
    const ok = roll * 100 < chance;
    const once = config.pride.hunterKillFood;
    const mouths = config.pride.hunterKillPerMember ? Math.max(1, roster(state).length) : 1;
    const gained = ok ? once * mouths : 0;
    state.pride.food += gained;
    state.lastHunt = { catId: cat.id, chance, ok, gained, prey: 'medium' };
    return state.lastHunt;
  }
  function runScout(state) {
    const prideId = state.scoutTarget || 'bonefield';
    const standing = state.relations && Number.isFinite(state.relations[prideId]) ? state.relations[prideId] : 0;
    const warning = standing <= config.scout.warningAt;
    const report = { prideId, standing, warning, known: true, kind: 'scout' };
    if (!state.knownFacts) state.knownFacts = [];
    state.knownFacts.push(report);
    state.lastScout = report;
    return report;
  }
  function resting(state, cat) {
    state.pride.orders[cat.id] = 'rest';
    state.lastRest = { catId: cat.id, hunted: false, defended: false };
    return state.lastRest;
  }

  function defendStrength(state) {
    let sum = 0;
    let usedGuard = false;
    for (const cat of livingDefenders(state)) {
      const stat = Number.isFinite(cat.fight) ? cat.fight : 10;
      let mult = 1;
      if (state.pride.roles[cat.id] === 'guard' && (config.pride.guardStacks || !usedGuard)) {
        mult = config.guard.multiplier;
        usedGuard = true;
      }
      sum += stat * mult;
    }
    return sum;
  }
  function starvingCubExtra(state) {
    if (sitterOnDuty(state) && state.pride.food > 0) return 0;
    return config.cub.starvingExtra;
  }
  function heirRanking(state) {
    const ranked = roster(state).slice().sort((a, b) => (b.blood || 0) - (a.blood || 0) || (b.age || 0) - (a.age || 0) || String(a.id).localeCompare(String(b.id)));
    const heirId = state.pride.heirId;
    if (!heirId) return ranked;
    const at = ranked.findIndex((cat) => cat.id === heirId);
    if (at < 0) return ranked;
    const [heir] = ranked.splice(at, 1);
    ranked.unshift(heir);
    return ranked;
  }
  function eatOrder(state) {
    if (state.pride.feedingOrder.length) {
      return state.pride.feedingOrder.map((id) => catBy(state, id)).filter((cat) => cat && cat.status !== 'loner' && cat.status !== 'exiled');
    }
    if (state.deathRule === 'heir') return heirRanking(state);
    return roster(state).slice().sort((a, b) => (b.age || 0) - (a.age || 0) || String(a.id).localeCompare(String(b.id)));
  }
  function applyFeed(state) {
    const order = eatOrder(state);
    const ate = [];
    const hungry = [];
    for (const cat of order) {
      if (state.pride.food >= config.feed.meal) {
        state.pride.food -= config.feed.meal;
        ate.push(cat.id);
      } else hungry.push(cat.id);
    }
    state.lastFeed = { ate, hungry, food: state.pride.food };
    return state.lastFeed;
  }

  function targetAdult(state) {
    return roster(state).find((cat) => cat.id === 'briar') || roster(state).find((cat) => cat.stage === 'adult');
  }

  function assignHunter(state) {
    const cat = targetAdult(state);
    state.pride.roles[cat.id] = 'hunter';
    const hunt = performHunt(state, cat);
    return { state, delta: { role: 'hunter', hunt } };
  }
  function assignGuard(state) {
    const cat = targetAdult(state);
    state.pride.roles[cat.id] = 'guard';
    delete state.pride.orders[cat.id];
    const strength = defendStrength(state);
    state.lastDefense = { strength, guard: cat.id };
    return { state, delta: { role: 'guard', strength } };
  }
  function assignCubSitter(state) {
    const cat = targetAdult(state);
    state.pride.roles[cat.id] = 'cubSitter';
    delete state.pride.orders[cat.id];
    const extra = starvingCubExtra(state);
    state.lastCubCare = { extra, sitter: cat.id };
    return { state, delta: { role: 'cubSitter', starvingExtra: extra } };
  }
  function assignScout(state) {
    const cat = targetAdult(state);
    state.pride.roles[cat.id] = 'scout';
    const report = runScout(state);
    return { state, delta: { role: 'scout', report } };
  }
  function orderHunt(state) {
    const cat = targetAdult(state);
    state.pride.orders[cat.id] = 'hunt';
    const hunt = performHunt(state, cat);
    return { state, delta: { order: 'hunt', hunt } };
  }
  function orderPatrol(state) {
    const cat = targetAdult(state);
    state.pride.orders[cat.id] = 'patrol';
    const report = runScout(state);
    return { state, delta: { order: 'patrol', report } };
  }
  function orderRest(state) {
    const cat = targetAdult(state);
    const rest = resting(state, cat);
    const strength = defendStrength(state);
    state.lastDefense = { strength, rested: cat.id };
    return { state, delta: { order: 'rest', rest, strength } };
  }
  function setFeedingOrder(state) {
    const ids = roster(state).map((cat) => cat.id);
    const cub = ids.find((id) => catBy(state, id).stage === 'cub');
    state.pride.feedingOrder = cub ? [cub].concat(ids.filter((id) => id !== cub)) : ids;
    const feed = applyFeed(state);
    return { state, delta: { feedingOrder: state.pride.feedingOrder.slice(), feed } };
  }
  function designateHeir(state) {
    const pick = roster(state).slice().sort((a, b) => (a.blood || 0) - (b.blood || 0))[0];
    state.pride.heirId = pick.id;
    state.deathRule = state.deathRule || 'heir';
    const ranking = heirRanking(state).map((cat) => cat.id);
    state.lastHeirRank = ranking;
    return { state, delta: { heirId: pick.id, ranking } };
  }
  function exile(state) {
    const cat = targetAdult(state);
    cat.status = 'exiled';
    cat.departure = 'exiled';
    cat.originPrideId = state.pride.id;
    delete state.pride.roles[cat.id];
    delete state.pride.orders[cat.id];
    state.pride.feedingOrder = state.pride.feedingOrder.filter((id) => id !== cat.id);
    if (state.pride.heirId === cat.id) {
      const next = heirRanking(state)[0];
      state.pride.heirId = next ? next.id : null;
    }
    state.pride.exiles.push({ catId: cat.id, day: state.day || 1 });
    return { state, delta: { exiled: cat.id, heirId: state.pride.heirId } };
  }
  function feed(state) {
    return { state, delta: { feed: applyFeed(state) } };
  }
  function runHunt(state) {
    const cat = roster(state).find((row) => duty(state, row) === 'hunter' || duty(state, row) === 'hunt') || targetAdult(state);
    return { state, delta: { hunt: performHunt(state, cat) } };
  }
  function defendBand(state) {
    const strength = defendStrength(state);
    const band = Number.isFinite(state.bandStrength) ? state.bandStrength : 0;
    const canChallenge = band >= strength * config.band.minStrengthRatio;
    state.lastDefense = { strength, band, canChallenge };
    return { state, delta: { strength, canChallenge } };
  }
  function scoutBorder(state) {
    return { state, delta: { report: runScout(state) } };
  }
  function resolveLostChallenge(state) {
    const safe = sitterOnDuty(state);
    const harms = roster(state).filter((cat) => cat.stage === 'cub').map((cat) => ({ id: cat.id, harmed: !safe }));
    state.lastChallenge = { harms, cubsSafe: safe };
    return { state, delta: { harms, cubsSafe: safe } };
  }

  const builders = {
    assignHunter, assignGuard, assignCubSitter, assignScout,
    orderHunt, orderPatrol, orderRest,
    setFeedingOrder, designateHeir, exile,
    feed, runHunt, defendBand, scoutBorder, resolveLostChallenge
  };
  const actions = {};
  for (const id of Object.keys(builders)) {
    const run = builders[id];
    const wrapped = (state) => {
      const next = clone(state);
      const out = run(next);
      out.effect = id;
      out.stateOnly = false;
      return out;
    };
    wrapped.effectId = id;
    actions[id] = wrapped;
  }
  const actionIds = Object.keys(actions);

  function sample() {
    return {
      day: 3,
      seed: 8,
      deathRule: 'heir',
      scoutTarget: 'bonefield',
      bandStrength: 30,
      relations: { bonefield: -20 },
      pride: emptyPride(12),
      roster: [
        { id: 'ash', stage: 'adult', fight: 10, blood: 0.5, age: 30, status: 'pride' },
        { id: 'briar', stage: 'adult', fight: 10, blood: 0.1, age: 14, status: 'pride' },
        { id: 'cub', stage: 'cub', fight: 2, blood: 0.5, age: 1, status: 'pride' }
      ]
    };
  }

  return {
    config, actionIds, actions, migrate, emptyPride, sample, clone,
    defendStrength, starvingCubExtra, heirRanking, eatOrder, huntChance, duty
  };
});
