/**
 * World-gen §5 personalities on the `personality` stream.
 * §1.5 order: slot founders (§5.1), then hidden founders, then kin (§5.2).
 * ln05's sire is off_bf_sire and its dam is off, so ln05 is kin. It is not a §5.1 roll of the slot.
 * Narrative lean is never stored. Old saves that never rolled this stream keep an explicit gap.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng'));
  else root.Personality = factory(root.Rng);
})(typeof self !== 'undefined' ? self : this, function (Rng) {
  const TRAITS = ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity'];
  /** sire, dam. Both "off" = founder. off_* is one shared hidden founder. Bare off on a kin link is that link's hidden founder. */
  const PARENTS = {
    hc01: ['off', 'off'], hc02: ['hc03', 'hc01'], hc03: ['off', 'off'], hc04: ['off', 'off'], hc05: ['off', 'off'],
    hc06: ['off', 'off'], hc07: ['off', 'off'], hc08: ['off', 'off'], hc09: ['hc03', 'hc01'], hc10: ['hc02', 'hc06'],
    hc11: ['hc02', 'hc06'], bf01: ['off', 'off'], bf02: ['off', 'off'], bf03: ['off', 'off'], bf04: ['off', 'off'],
    bf05: ['off', 'off'], bf06: ['off', 'off'], bf07: ['off', 'off'], bf08: ['bf01', 'bf04'], bf09: ['bf01', 'bf04'],
    bf10: ['off', 'bf05'], mw01: ['off', 'off'], mw02: ['off', 'off'], mw03: ['off', 'off'], mw04: ['off', 'off'],
    mw05: ['off', 'off'], mw06: ['off', 'off'], mw07: ['off', 'off'], mw08: ['off_longshadow', 'mw01'], mw09: ['mw02', 'mw04'],
    ln01: ['off', 'off'], ln02: ['off', 'hc07'], ln03: ['off_bf_sire', 'off'], ln04: ['off', 'off'], ln05: ['off_bf_sire', 'off'],
    ln06: ['off', 'off'], ln07: ['off', 'off'], ln08: ['off', 'off'], ln09: ['off_longshadow', 'off']
  };
  const ORDER = Object.keys(PARENTS);
  const LN05_LEAN = [30, 75, 55, 35, 75];
  const GAP = 'This save has no stored personality. The build that wrote it did not roll the personality stream, so the seed cannot recover an original roll. A new roll is not assigned.';

  function gauss(rng) {
    let u = 0; while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Half away from zero. Personality inputs are clamped to a non-negative range first. */
  function roundHalfAway(n) {
    if (n === 0) return 0;
    const sign = n < 0 ? -1 : 1;
    const a = Math.abs(n);
    const base = Math.floor(a);
    return sign * (a - base >= 0.5 ? base + 1 : base);
  }
  function founderTraits(rng) {
    const out = {};
    for (const t of TRAITS) out[t] = roundHalfAway(Math.max(5, Math.min(95, 50 + 15 * gauss(rng))));
    return out;
  }
  function kinTraits(rng, a, b) {
    const out = {};
    for (const t of TRAITS) {
      const raw = (a[t] + b[t]) / 2 + 8 * gauss(rng);
      out[t] = roundHalfAway(Math.max(0, Math.min(100, raw)));
    }
    return out;
  }
  function isFounder(id) { const p = PARENTS[id]; return p && p[0] === 'off' && p[1] === 'off'; }
  function hiddenKey(child, role, token) { return token.startsWith('off_') ? token : `${child}:${role}`; }
  function complete(p) { return !!(p && TRAITS.every((t) => Number.isInteger(p[t]))); }

  function roll(seed) {
    const rng = Rng.stream(seed >>> 0, 'personality');
    const byId = {}; const order = [];
    const take = (id, personality, source) => { byId[id] = { personality, source }; order.push(id); };
    for (const id of ORDER) if (isFounder(id)) take(id, founderTraits(rng), { method: 'world-gen-5.1-founder', stream: 'personality' });
    const named = [];
    for (const id of ORDER) {
      if (isFounder(id)) continue;
      for (const token of PARENTS[id]) if (token.startsWith('off_') && !named.includes(token)) named.push(token);
    }
    for (const id of named) take(id, founderTraits(rng), { method: 'world-gen-5.1-hidden-founder', stream: 'personality' });
    const bare = [];
    for (const id of ORDER) {
      if (isFounder(id)) continue;
      PARENTS[id].forEach((token, i) => {
        if (token === 'off') bare.push(hiddenKey(id, i === 0 ? 'sire' : 'dam', token));
      });
    }
    for (const id of bare) take(id, founderTraits(rng), { method: 'world-gen-5.1-hidden-founder', stream: 'personality' });
    const parentOf = (child, token, role) => byId[token.startsWith('off_') || ORDER.includes(token) ? token : hiddenKey(child, role, token)];
    for (const id of ORDER) {
      if (isFounder(id)) continue;
      const [sire, dam] = PARENTS[id];
      const ps = parentOf(id, sire, 'sire'); const pd = parentOf(id, dam, 'dam');
      take(id, kinTraits(rng, ps.personality, pd.personality), {
        method: 'world-gen-5.2-kin', stream: 'personality', sire, dam,
        narrativeLeanIgnored: id === 'ln05' ? LN05_LEAN.slice() : null
      });
    }
    return { byId, order };
  }

  function portraitGap() {
    return { status: 'no-approved-assignment', portraitId: null, note: 'No approved slot-to-portrait map. Registry order is not an assignment.' };
  }
  const PROOF_PORTRAIT = 'cat-6e2d788dd48ff440';
  function proofPortrait(rules) {
    const id = rules && rules.presentationPortraits && rules.presentationPortraits.ln05;
    return typeof id === 'string' && id ? id : PROOF_PORTRAIT;
  }
  function assignProofPortrait(npc, rules) {
    if (!npc || npc.id !== 'ln05') return;
    if (npc.portraitAssignment === 'cleared' || npc.portraitAssignment === 'legacy-null') return;
    if (typeof npc.portraitId === 'string' && npc.portraitId) return;
    npc.portraitId = proofPortrait(rules);
    npc.portraitAssignment = 'presentation-proof-v1';
    npc.portraitGap = null;
  }
  function applyNew(state, rules) {
    if (!state || state.seed == null || !state.npcs) return state;
    const rolled = roll(state.seed);
    for (const [id, npc] of Object.entries(state.npcs)) {
      const row = rolled.byId[id];
      if (row && !complete(npc.personality)) {
        npc.personality = row.personality;
        npc.personalitySource = row.source;
        npc.personalityGap = null;
      }
      if (id === 'ln05') assignProofPortrait(npc, rules);
      else if (!npc.portraitId) npc.portraitGap = portraitGap();
      npc.prideLoyalty = npc.faction && npc.faction !== 'loner' && complete(npc.personality)
        ? Math.max(0, Math.min(100, roundHalfAway(70 + (npc.personality.loyalty - 50) * 0.2))) : null;
    }
    state.personalityRoll = { stream: 'personality', orderNote: 'founders, hidden founders, then kin in world-gen §2.1 order', ln05: 'kin' };
    return state;
  }
  /** Does not invent a personality for a save that never stored one. */
  function migrate(state, rules) {
    if (!state || !state.npcs) return state;
    for (const npc of Object.values(state.npcs)) {
      if (complete(npc.personality)) npc.personalityGap = null;
      else {
        const missing = TRAITS.filter((t) => !npc.personality || !Number.isInteger(npc.personality[t]));
        if (!npc.personality || typeof npc.personality !== 'object') npc.personality = null;
        npc.personalityGap = { status: 'unresolved', recoverable: false, missing, reason: GAP, narrativeLeanIgnored: true };
      }
      if (npc.portraitAssignment === 'cleared') { npc.portraitId = null; npc.portraitGap = { status: 'cleared', portraitId: null }; continue; }
      if (typeof npc.portraitId === 'string' && npc.portraitId) { npc.portraitGap = null; continue; }
      const missingField = !Object.prototype.hasOwnProperty.call(npc, 'portraitId');
      if (missingField && npc.id === 'ln05' && npc.portraitAssignment !== 'legacy-null') { assignProofPortrait(npc, rules); continue; }
      if (npc.portraitGap && (npc.portraitGap.status === 'no-approved-assignment' || npc.portraitGap.status === 'cleared')) continue;
      if (missingField) { npc.portraitId = null; npc.portraitGap = portraitGap(); continue; }
      npc.portraitId = null;
      if (!npc.portraitAssignment) npc.portraitAssignment = 'legacy-null';
      npc.portraitGap = { status: 'legacy-null', portraitId: null, note: 'A stored null is kept. It is not treated as a missing portrait and is not filled.' };
    }
    return state;
  }
  return { TRAITS, PARENTS, ORDER, LN05_LEAN, PROOF_PORTRAIT, roll, applyNew, migrate, complete, roundHalfAway };
});
