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
  const NEUTRAL = '{catName} waits for your answer without hurrying you.';

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
      action = fill(NEUTRAL, vars);
      actionId = `${row.context}:neutral`;
    } else {
      const pair = coverage.contextActions && coverage.contextActions[row.context] && coverage.contextActions[row.context][picked.trait];
      action = pair ? fill(pair[picked.band === 'high' ? 0 : 1], vars) : fill(NEUTRAL, vars);
      actionId = `${row.context}:${picked.trait}:${picked.band}`;
    }
    return {
      characterization: 'traits', variantId: `${path}#${spokenBand}`, actionId, path,
      text: fill(text, vars), action, gap: null,
      traits: Object.fromEntries(TRAITS.map((t) => [t, personality[t]]))
    };
  }
  return { TRAITS, GAP, band, complete, resolve };
});
