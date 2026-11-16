/**
 * Hunt escape (4 bands) and courtship interest (5 bands). Display only.
 * Labels come from menu-copy keys. The filled count is the only number, and it stays on the meter.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WordBar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const KINDS = {
    hunt: { bands: 4, titleKey: 'ui.meter.hunt' },
    court: { bands: 5, titleKey: 'ui.meter.court' }
  };
  function describe(meter) {
    const kind = meter && KINDS[meter.kind];
    if (!kind) return null;
    const band = Math.max(0, Math.min(kind.bands - 1, Math.round(Number(meter.band) || 0)));
    return { kind: meter.kind, bands: kind.bands, band, titleKey: kind.titleKey, bandKey: 'ui.meter.band' };
  }
  let cachedHints = null;
  function loadHints() {
    if (cachedHints) return cachedHints;
    if (typeof require === 'function') {
      try { cachedHints = require('../data/events/first-season-v0.6.2.json').uiHints || {}; return cachedHints; } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/events/first-season-v0.6.2.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) { cachedHints = JSON.parse(xhr.responseText).uiHints || {}; return cachedHints; }
      } catch (e) { /* missing hints leave the meter untitled */ }
    }
    return {};
  }
  function label(id, vars) {
    const raw = loadHints()[id] || '';
    return String(raw).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
  }
  function mount(parent, meter, labelFn) {
    const spec = describe(meter);
    if (!spec || !parent) return null;
    const say = labelFn || label;
    const doc = parent.ownerDocument || document;
    const box = doc.createElement('div');
    box.className = 'word-bar is-' + spec.kind;
    box.dataset.kind = spec.kind;
    box.dataset.band = String(spec.band);
    box.dataset.bands = String(spec.bands);
    const title = doc.createElement('p');
    title.className = 'word-bar-title';
    title.textContent = say(spec.titleKey);
    const track = doc.createElement('div');
    track.className = 'word-bar-track';
    for (let i = 0; i < spec.bands; i++) {
      const seg = doc.createElement('i');
      if (i <= spec.band) seg.className = 'is-filled';
      track.append(seg);
    }
    const word = doc.createElement('p');
    word.className = 'word-bar-word';
    word.textContent = say(spec.bandKey, { band: String(spec.band + 1), bands: String(spec.bands) });
    box.append(title, track, word);
    parent.append(box);
    return box;
  }
  return { KINDS, describe, mount };
});
