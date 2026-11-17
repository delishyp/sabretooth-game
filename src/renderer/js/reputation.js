/**
 * Reputation v0.1.2. Weights, levels and the sustained-pattern gate are the spec's numbers.
 * A missing store on an old save starts empty. Reputation does not fade.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reputation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function load(file) {
    if (typeof require === 'function') {
      try { return require('../data/' + file); } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/' + file, false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* missing copy */ }
    }
    return null;
  }
  const copy = load('reputation-copy-v2.json') || { words: {} };
  const WEIGHT = { small: 2, medium: 5, big: 10, legend: 20 };
  const THRESHOLDS = [0, 25, 90, 250, 550, 1000];
  const GATE = [0, 4, 8, 12, 20, 30];
  const AXES = ['mercy', 'courage', 'honour'];
  const TIE = ['courage', 'mercy', 'honour'];

  function empty() {
    return { schemaVersion: 1, deeds: [], totals: {}, gate: {}, levels: {}, seeded: false };
  }
  function store(state) {
    if (!state.worldMemory || typeof state.worldMemory !== 'object') state.worldMemory = {};
    if (!state.worldMemory.reputation) state.worldMemory.reputation = empty();
    return state.worldMemory.reputation;
  }
  function rawLevel(points) {
    const abs = Math.abs(points || 0);
    let level = 0;
    for (let i = 1; i < THRESHOLDS.length; i++) if (abs >= THRESHOLDS[i]) level = i;
    return level;
  }
  function spanOf(level) {
    if (level >= 5) return 450;
    return THRESHOLDS[level + 1] - THRESHOLDS[level];
  }
  function gateOf(rep, actor, axis) {
    rep.gate[actor] = rep.gate[actor] || {};
    if (!rep.gate[actor][axis]) rep.gate[actor][axis] = { deeds: 0, days: [] };
    return rep.gate[actor][axis];
  }
  function levelOf(rep, actor, axis) {
    return (rep.levels[actor] && rep.levels[actor][axis]) || 0;
  }
  function poleOf(points) {
    if (!points) return null;
    return points > 0 ? 'positive' : 'negative';
  }
  function word(axis, pole, level, name) {
    const row = copy.words && copy.words[axis] && copy.words[axis][pole];
    const text = row && row['L' + level];
    return text ? String(text).replace(/\{name\}/g, name || '') : '';
  }
  function hysteresis(level) {
    if (level <= 0) return 0;
    return Math.floor(THRESHOLDS[level] * 0.8);
  }
  function consider(rep, actor, axis, season, opposed) {
    const points = (rep.totals[actor] && rep.totals[actor][axis]) || 0;
    const gate = gateOf(rep, actor, axis);
    rep.levels[actor] = rep.levels[actor] || {};
    rep.lock = rep.lock || {};
    rep.lock[actor] = rep.lock[actor] || {};
    let level = rep.levels[actor][axis] || 0;
    const before = level;
    const abs = Math.abs(points);
    if (opposed && level > 0 && abs < hysteresis(level)) {
      while (level > 0 && abs < hysteresis(level)) {
        level -= 1;
        gate.deeds = 0;
        gate.days = [];
      }
      rep.lock[actor][axis] = season;
    }
    const cap = rawLevel(points);
    const locked = rep.lock[actor][axis];
    while (level < cap && !(locked != null && season <= locked)) {
      const days = new Set(gate.days);
      if (gate.deeds < GATE[level + 1] || days.size < 3) break;
      level += 1;
      gate.deeds = 0;
      gate.days = [];
    }
    rep.levels[actor][axis] = level;
    return { level, lost: level < before };
  }
  function add(state, spec) {
    const rep = store(state);
    const receipt = spec.receiptKey;
    if (receipt && rep.deeds.some((row) => row.receiptKey === receipt)) return { duplicate: true, rep };
    const actor = spec.actorId || 'player';
    const axis = spec.axis;
    const day = spec.day || state.day || 1;
    const season = Math.floor((day - 1) / 20);
    const weight = WEIGHT[spec.weightClass] || WEIGHT.small;
    const repeat = rep.deeds.filter((row) => row.actorId === actor && row.deedId === spec.deedId && row.seasonIndex === season).length;
    const halved = Math.max(1, Math.floor(weight * Math.pow(0.5, repeat)));
    rep.totals[actor] = rep.totals[actor] || { mercy: 0, courage: 0, honour: 0 };
    const band = spanOf(levelOf(rep, actor, axis));
    const applied = Math.min(halved, Math.max(1, Math.floor(band / 3)));
    const sign = spec.sign < 0 ? -1 : 1;
    const prior = (rep.totals[actor][axis] || 0) < 0 ? -1 : 1;
    rep.totals[actor][axis] += applied * sign;
    const gate = gateOf(rep, actor, axis);
    gate.deeds += 1;
    if (gate.days.indexOf(day) < 0) gate.days.push(day);
    const judged = consider(rep, actor, axis, season, sign !== prior);
    const level = judged.level;
    rep.deeds.push({
      receiptKey: receipt, actorId: actor, axis, sign, deedId: spec.deedId,
      weightClass: spec.weightClass, applied, day, seasonIndex: season, factId: spec.factId || null
    });
    const facts = syncFacts(state, actor);
    return { duplicate: false, applied, level, facts, rep };
  }
  function view(state, actor, name) {
    const rep = state.worldMemory && state.worldMemory.reputation;
    const who = actor || 'player';
    const totals = (rep && rep.totals && rep.totals[who]) || { mercy: 0, courage: 0, honour: 0 };
    const levels = (rep && rep.levels && rep.levels[who]) || {};
    return AXES.map((axis) => {
      const points = totals[axis] || 0;
      const level = levels[axis] || 0;
      const pole = poleOf(points);
      return { axis, points, level, pole, word: level && pole ? word(axis, pole, level, name) : '' };
    });
  }
  function titles(state, actor) {
    return view(state, actor).filter((row) => row.level >= 3);
  }
  function syncFacts(state, actor) {
    const rows = view(state, actor);
    const titled = rows.some((row) => row.level >= 3);
    const legend = rows.some((row) => row.level >= 5);
    const positive = rows.some((row) => row.level >= 3 && row.pole === 'positive');
    const negative = rows.some((row) => row.level >= 3 && row.pole === 'negative');
    const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
    if (!Deeds) return { titled, legend, twoFaces: positive && negative };
    if (titled) Deeds.note(state, 'reputation.title');
    if (legend) Deeds.note(state, 'reputation.legend');
    if (positive && negative) Deeds.note(state, 'reputation.two_faces');
    return { titled, legend, twoFaces: positive && negative };
  }
  function seed(state, actor, axis, points) {
    const rep = store(state);
    rep.seededAxes = rep.seededAxes || {};
    const key = actor + '/' + axis;
    if (rep.seededAxes[key]) return { duplicate: true, rep };
    rep.seededAxes[key] = true;
    rep.totals[actor] = rep.totals[actor] || { mercy: 0, courage: 0, honour: 0 };
    rep.totals[actor][axis] = points;
    rep.levels[actor] = rep.levels[actor] || {};
    rep.levels[actor][axis] = rawLevel(points);
    syncFacts(state, actor);
    return { duplicate: false, level: rep.levels[actor][axis], rep };
  }
  function unknownLine() { return (copy.directory && copy.directory.unknown) || ''; }
  return { WEIGHT, THRESHOLDS, GATE, AXES, TIE, empty, store, rawLevel, spanOf, hysteresis, add, seed, view, titles, word, unknownLine, syncFacts };
});
