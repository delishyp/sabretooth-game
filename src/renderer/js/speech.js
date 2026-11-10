/**
 * Saga revision 6 speech locations. Traits pick an authored line and a visible action.
 * They never change choice ids, outcomes, or receipts. A missing personality is an explicit gap.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Speech = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TRAITS = ['aggression', 'sociability', 'boldness', 'loyalty', 'curiosity'];
  const GAP = 'Personality is not on this save. This line is an incomplete stand-in, not this cat\'s voice.';
  const NEUTRAL = '{catName} waits for you to answer.';

  function pronouns(sex) {
    const female = sex === 'female';
    const he = female ? 'she' : 'he';
    const him = female ? 'her' : 'him';
    const his = female ? 'her' : 'his';
    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    return { he, him, his, He: cap(he), Him: cap(him), His: cap(his) };
  }
  function nameVars(npc, extra) {
    return Object.assign({ catName: npc && npc.name || '' }, pronouns(npc && npc.sex), extra || {});
  }
  function cueLine(pair, which) {
    if (!pair) return null;
    if (Array.isArray(pair)) {
      if (which === 'high') return pair[0];
      if (which === 'low') return pair[1];
      return pair.length > 2 ? pair[2] : null;
    }
    if (which === 'middle') return pair.middle || pair.baseline || pair.base || null;
    return pair[which] || null;
  }
  function fill(s, vars) {
    return String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
  }
  function band(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if (v >= 70) return 'high';
    if (v <= 30) return 'low';
    return 'middle';
  }
  function complete(p) {
    return !!(p && TRAITS.every((t) => Number.isInteger(p[t])));
  }
  /** Focus trait if it is extreme; otherwise the trait farthest from 50, ties keep requiredTraits order. */
  function actionPick(personality, focus) {
    const focusBand = band(personality[focus]);
    if (focusBand === 'high' || focusBand === 'low') return { trait: focus, band: focusBand };
    let best = null; let bestDist = -1; let bestBand = null;
    for (const t of TRAITS) {
      const b = band(personality[t]);
      if (b === 'middle') continue;
      const d = Math.abs(personality[t] - 50);
      if (d > bestDist) { best = t; bestDist = d; bestBand = b; }
    }
    return best ? { trait: best, band: bestBand } : null;
  }
  function resolve(coverage, path, personality, vars) {
    const row = coverage && coverage.speechLocations && coverage.speechLocations[path];
    if (!row) {
      return { characterization: 'unresolved', variantId: null, actionId: null, text: null, action: null, gap: GAP, path };
    }
    if (!complete(personality)) {
      return {
        characterization: 'unresolved', variantId: `${path}#unresolved`, actionId: 'unresolved',
        text: fill(row.base, vars), action: null, gap: GAP, path, traits: null
      };
    }
    const focusBand = band(personality[row.focusTrait]);
    const spokenBand = focusBand === 'high' || focusBand === 'low' ? focusBand : 'middle';
    const text = spokenBand === 'high' ? row.high : spokenBand === 'low' ? row.low : row.base;
    const picked = actionPick(personality, row.focusTrait);
    let action; let actionId;
    if (!picked) {
      const mid = cueLine(coverage.contextActions && coverage.contextActions[row.context] && coverage.contextActions[row.context][row.focusTrait], 'middle');
      action = fill(mid || NEUTRAL, vars);
      actionId = mid ? `${row.context}:${row.focusTrait}:middle` : `${row.context}:neutral`;
    } else {
      const pair = coverage.contextActions && coverage.contextActions[row.context] && coverage.contextActions[row.context][picked.trait];
      const cue = cueLine(pair, picked.band);
      action = cue ? fill(cue, vars) : fill(NEUTRAL, vars);
      actionId = `${row.context}:${picked.trait}:${picked.band}`;
    }
    return {
      characterization: 'traits', variantId: `${path}#${spokenBand}`, actionId, path,
      text: fill(text, vars), action, gap: null,
      traits: Object.fromEntries(TRAITS.map((t) => [t, personality[t]]))
    };
  }
  /** The extreme trait farthest from 50. Ties keep the trait order. A middle band is not a top trait. */
  function topTrait(personality) {
    if (!personality) return null;
    let best = null; let bestDist = -1; let bestBand = null;
    for (const t of TRAITS) {
      const b = band(personality[t]);
      if (b !== 'high' && b !== 'low') continue;
      const d = Math.abs(personality[t] - 50);
      if (d > bestDist) { best = t; bestDist = d; bestBand = b; }
    }
    return best ? { trait: best, band: bestBand } : null;
  }
  return { TRAITS, GAP, band, complete, resolve, topTrait, pronouns, nameVars };
});
