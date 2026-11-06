/**
 * Tiny string lookup: t(id, vars). Strings come from menu-copy.json `strings` (Saga, copy doc §5).
 * PLACEHOLDER_STRINGS are Flint's clearly-marked stand-ins for ids Saga hasn't written yet; Saga's map always wins,
 * and a test fails if a placeholder id also exists in Saga's map (so placeholders get removed once covered).
 * Missing ids render as ⟦id⟧ so they're obvious on screen. UMD: used by renderer (window.I18n) and main (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.I18n = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Placeholders for ids Saga hasn't written yet go here (none outstanding; slice 1 copy is in docs/slice-ui-copy.md + docs/map-copy.md).
  const PLACEHOLDER_STRINGS = {};
  function create(strings = {}) {
    const map = { ...PLACEHOLDER_STRINGS, ...strings };
    const t = (id, vars = {}) => {
      const s = map[id];
      if (s === undefined) return `⟦${id}⟧`;
      return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    };
    t.has = (id) => id in map;
    return t;
  }
  return { create, PLACEHOLDER_STRINGS };
});
