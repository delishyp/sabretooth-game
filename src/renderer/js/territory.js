/**
 * Danger, claims and the three territory deeds.
 * Danger uses the highest hazard, then trespass and the four fixed features.
 * Mark is map-v1's +25. UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Territory = factory();
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
  const gossip = load('map-danger-gossip-v1.json') || {};
  const arrivals = load('region-arrivals-v1.json') || {};
  const MARK = 25;
  const TRESPASS = 40;
  const FEATURES = { salt_flats: 'human', camel_ridge: 'human', tar_seeps: 'hyena', south_range: 'hyena' };
  const WORDS = ['Safe', 'Uneasy', 'Dangerous', 'Deadly'];

  function hazardBand(pct) {
    if (pct > 10) return 3;
    if (pct >= 6) return 2;
    if (pct >= 2) return 1;
    return 0;
  }
  function highestHazard(region) {
    const list = (region && region.hazards) || [];
    let best = 0;
    for (const row of list) best = Math.max(best, Number(row.dailyPct || row.pct || 0));
    return best;
  }
  function danger(region, ownership, viewer) {
    let band = hazardBand(highestHazard(region));
    const holder = ownership && ownership.holder;
    const claim = ownership && ownership.claim;
    if (holder && holder !== 'neutral' && holder !== viewer && (claim || 0) >= TRESPASS) band += 1;
    const homes = (ownership && ownership.bandHomes) || [];
    if (region && homes.indexOf(region.id) >= 0) band += 1;
    if (FEATURES[region && region.id]) band += 1;
    return Math.max(0, Math.min(3, band));
  }
  function word(band) {
    const keys = ['safe', 'uneasy', 'dangerous', 'deadly'];
    const row = gossip.danger && gossip.danger.levels && gossip.danger.levels[keys[band]];
    return (row && row.label) || WORDS[band] || 'Unknown';
  }
  function arrival(regionId, kind) {
    const row = arrivals[regionId];
    if (!row || row[kind] == null) return '';
    const value = row[kind];
    if (typeof value === 'string') return value;
    if (value.text) return value.text;
    if (Array.isArray(value)) return (value[0] && (value[0].text || value[0])) || '';
    return '';
  }
  const mapData = load('map.json');
  function neighboursOf(id) {
    const out = [];
    for (const edge of (mapData && mapData.edges) || []) {
      if (edge.a === id) out.push(edge.b);
      else if (edge.b === id) out.push(edge.a);
    }
    return out;
  }
  function lead(claims, id) {
    const row = (claims && claims[id]) || {};
    let best = null;
    let bestN = 0;
    for (const [fid, n] of Object.entries(row)) if (n > bestN) { best = fid; bestN = n; }
    return { holder: bestN >= 50 ? best : 'neutral', claim: bestN, faction: best };
  }
  function heldBy(state, holder) {
    const claims = (state.map && state.map.claims) || {};
    const regions = (mapData && mapData.regions) || [];
    const out = [];
    for (const region of regions) {
      if (lead(claims, region.id).holder === holder) out.push(region.id);
    }
    return out;
  }
  function noteDeeds(state) {
    const Deeds = typeof require === 'function' ? require('./deeds') : (typeof self !== 'undefined' ? self.Deeds : null);
    if (!Deeds || !state.records || !state.records.pride || !state.records.pride.name) return;
    const pride = state.records.pride.id;
    const held = heldBy(state, pride);
    if (held.length >= 6) Deeds.note(state, 'regions.six');
    const prides = ['highcrag', 'bonefield', 'mistwood'];
    const touched = new Set();
    const claims = state.map.claims || {};
    for (const id of held) {
      for (const next of neighboursOf(id)) {
        const owner = lead(claims, next).holder;
        if (prides.indexOf(owner) >= 0) touched.add(owner);
      }
    }
    if (touched.size === 3) Deeds.note(state, 'borders.three');
    const den = state.records.pride.denRegionId;
    if (den && held.indexOf(den) >= 0) {
      state.records.denHeldDays = (state.records.denHeldDays || 0) + 1;
      if (state.records.denHeldDays >= 80) Deeds.note(state, 'den.held_year');
    } else state.records.denHeldDays = 0;
  }
  function mark(claims, regionId, faction) {
    if (!claims[regionId]) claims[regionId] = {};
    claims[regionId][faction] = Math.min(100, (claims[regionId][faction] || 0) + MARK);
    return claims[regionId][faction];
  }
  return { MARK, TRESPASS, FEATURES, hazardBand, danger, word, arrival, heldBy, lead, noteDeeds, mark, neighboursOf };
});
