/**
 * Relationships §1.5 and world-gen §6.4.
 * Kin and mates are fixed. Other same-pride values come from round-half-up(Normal(10, 12))
 * on the new `pairs` stream, stored only when |value| ≥ 15. Seed flags apply after that, in table order.
 * The stream is not `names`, `personality`, `attraction`, or `het`, so those rolls stay put.
 * Old saves are not seeded here. A missing history is not filled in later.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'), require('./personality'));
  else root.Pairs = factory(root.Rng, root.Personality);
})(typeof self !== 'undefined' ? self : this, function (Rng, Personality) {
  const MATES = [['hc01', 'hc03'], ['hc02', 'hc06'], ['bf01', 'bf04'], ['mw02', 'mw04']];
  const PRIDES = ['highcrag', 'bonefield', 'mistwood'];
  const FLAGS = [
    { holder: 'ln03', target: 'bf01', kind: 'grudge', mutual: true, value: -55 },
    { holder: 'ln04', target: 'bf01', kind: 'grudge', mutual: false, value: -35 },
    { holder: 'ln01', target: 'hc01', kind: 'grudge', mutual: false, value: -35 },
    { holder: 'ln01', target: '*highcrag-adult-elder', kind: 'none', mutual: true, value: 25 },
    { holder: 'mw01', target: 'ln07', kind: 'none', mutual: true, value: -25 },
    { holder: 'ln02', target: 'hc01', kind: 'none', mutual: true, value: -25 },
    { holder: 'ln02', target: 'hc07', kind: 'none', mutual: true, value: 10 },
    { holder: 'ln02', target: 'bf02', kind: 'crush', mutual: true, value: 30, fallback: { kind: 'none', value: 25 } },
    { holder: 'ln02', target: 'ln05', kind: 'friendship', mutual: true, value: 35 },
    { holder: 'ln03', target: 'ln07', kind: 'none', mutual: true, value: 25 },
    { holder: 'ln09', target: 'ln05', kind: 'none', mutual: true, value: 25 }
  ];

  function gauss(rng) {
    let u = 0; while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Relationships §0.3: half up. Positive .5 goes away from zero; negative .5 goes toward +∞. */
  function roundHalfUp(n) { return Math.round(n); }
  function pairKey(a, b) { return [a, b].sort().join('|'); }
  function blank(a, b) {
    const [x, y] = [a, b].sort();
    return { a: x, b: y, value: 0, kinds: [], flags: { grudge: [], crush: [] }, source: null };
  }
  function row(map, a, b) {
    const k = pairKey(a, b);
    if (!map[k]) map[k] = blank(a, b);
    return map[k];
  }
  function clamp(n) { return Math.max(-100, Math.min(100, n)); }
  function applyFloor(entry) {
    let floor = null;
    if (entry.kinds.includes('mates')) floor = 20;
    else if (entry.kinds.includes('family')) floor = 10;
    if (floor != null && entry.value < floor) entry.value = floor;
  }
  function compatible(kind, selfSex, otherSex) {
    if (kind === 'either') return true;
    if (kind === 'same') return selfSex === otherSex;
    if (kind === 'opposite') return selfSex && otherSex && selfSex !== otherSex;
    return false;
  }
  function bothWays(attraction, a, b, sexA, sexB) {
    return compatible(attraction[a], sexA, sexB) && compatible(attraction[b], sexB, sexA);
  }
  function adult(stage) { return stage === 'adult' || stage === 'elder'; }

  function seedKin(map, npcs) {
    const parents = Personality.PARENTS;
    for (const id of Personality.ORDER) {
      if (!npcs[id]) continue;
      for (const parent of parents[id]) {
        if (!parent || parent === 'off' || String(parent).startsWith('off_') || !npcs[parent]) continue;
        const entry = row(map, id, parent);
        if (!entry.kinds.includes('family')) entry.kinds.push('family');
        entry.value = 40;
        entry.source = 'kin-parent';
      }
    }
    const kids = {};
    for (const id of Personality.ORDER) {
      for (const parent of parents[id]) {
        if (!parent || parent === 'off') continue;
        (kids[parent] = kids[parent] || []).push(id);
      }
    }
    for (const group of Object.values(kids)) {
      const present = group.filter((id) => npcs[id]);
      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          const entry = row(map, present[i], present[j]);
          if (entry.source === 'kin-parent') continue;
          if (!entry.kinds.includes('family')) entry.kinds.push('family');
          entry.value = 30;
          entry.source = 'kin-sibling';
        }
      }
    }
    for (const [a, b] of MATES) {
      if (!npcs[a] || !npcs[b]) continue;
      const entry = row(map, a, b);
      if (!entry.kinds.includes('mates')) entry.kinds.push('mates');
      entry.value = Math.max(entry.value, 60);
      entry.source = 'mates';
      applyFloor(entry);
    }
  }

  function seedPride(map, npcs, seed) {
    const rng = Rng.stream(seed >>> 0, 'pairs');
    const ids = Personality.ORDER.filter((id) => npcs[id] && PRIDES.includes(npcs[id].faction));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (npcs[ids[i]].faction !== npcs[ids[j]].faction) continue;
        if (map[pairKey(ids[i], ids[j])]) continue;
        const value = clamp(roundHalfUp(10 + 12 * gauss(rng)));
        if (Math.abs(value) < 15) continue;
        const entry = row(map, ids[i], ids[j]);
        entry.value = value;
        entry.source = 'pride-normal';
      }
    }
  }

  function writeFlag(map, npcs, spec, dropped) {
    const targets = spec.target === '*highcrag-adult-elder'
      ? Object.values(npcs).filter((n) => n.faction === 'highcrag' && adult(n.stage) && n.id !== 'hc01').map((n) => n.id).sort()
      : [spec.target];
    for (const target of targets) {
      if (target === spec.holder || !npcs[spec.holder] || !npcs[target]) {
        dropped.push({ holder: spec.holder, target, reason: 'missing-cat' });
        continue;
      }
      let kind = spec.kind;
      let value = spec.value;
      if (kind === 'crush') {
        const ok = adult(npcs[spec.holder].stage) && adult(npcs[target].stage)
          && bothWays(spec.attraction, spec.holder, target, npcs[spec.holder].sex, npcs[target].sex);
        if (!ok) {
          kind = spec.fallback.kind;
          value = spec.fallback.value;
          dropped.push({ holder: spec.holder, target, reason: 'crush-gate', stored: 'none' });
        }
      }
      const entry = row(map, spec.holder, target);
      if (kind !== 'none' && !entry.kinds.includes(kind)) entry.kinds.push(kind);
      entry.value = value;
      applyFloor(entry);
      entry.source = 'seed-flag';
      if (kind === 'grudge') {
        if (!entry.flags.grudge.includes(spec.holder)) entry.flags.grudge.push(spec.holder);
        if (spec.mutual && !entry.flags.grudge.includes(target)) entry.flags.grudge.push(target);
      }
      if (kind === 'crush') {
        if (!entry.flags.crush.includes(spec.holder)) entry.flags.crush.push(spec.holder);
        if (spec.mutual && !entry.flags.crush.includes(target)) entry.flags.crush.push(target);
      }
    }
  }

  function seed(seed, npcs, attraction) {
    const map = {};
    const dropped = [];
    seedKin(map, npcs);
    seedPride(map, npcs, seed);
    for (const spec of FLAGS) writeFlag(map, npcs, Object.assign({ attraction: attraction || {} }, spec), dropped);
    return { pairs: map, dropped, stream: 'pairs' };
  }

  function stored(map, from, to) {
    if (!map) return null;
    const legacy = map[`${from}->${to}`];
    if (legacy && typeof legacy.value === 'number') return legacy;
    return map[pairKey(from, to)] || null;
  }

  return { MATES, FLAGS, seed, stored, pairKey, roundHalfUp };
});
