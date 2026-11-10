/**
 * Region map model (map-v1 v1.0.1 §4–§6, §8–§10), pure UMD. Built to last past slice 1: region graph, travel costs by season,
 * prey by season, derived danger, claim overlay (holder / disputed / state per §9.1), discovered set, and save migration (§10.3).
 * The slice keeps AI claims frozen at startClaims (slice-1 scope OUT: territory contest); the claim math is still here for later.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorldMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /** Closed map enums. `pool` is a seasonal pool (Tallgrass). */
  const ENUMS = {
    water: ['none', 'river', 'lake', 'marsh', 'meltwater', 'pool'],
    tier: ['safe', 'balanced', 'rich', 'hardship', 'deadly'],
    holder: ['neutral', 'highcrag', 'bonefield', 'mistwood', 'wolves'],
    factionKind: ['pride', 'pack'],
    season: ['spring', 'summer', 'autumn', 'winter']
  };
  function validate(data) {
    const errors = [];
    const known = (list, value) => list.includes(value);
    const biomes = new Set((data.biomes || []).map((row) => row.id));
    const hazards = new Set((data.hazards || []).map((row) => row.id));
    for (const season of data.seasons || []) if (!known(ENUMS.season, season)) errors.push(`season ${season}`);
    for (const faction of data.factions || []) if (!known(ENUMS.factionKind, faction.kind)) errors.push(`faction ${faction.id} kind ${faction.kind}`);
    for (const region of data.regions || []) {
      if (!known(ENUMS.water, region.water)) errors.push(`${region.id} water ${region.water}`);
      if (!known(ENUMS.tier, region.tier)) errors.push(`${region.id} tier ${region.tier}`);
      if (!known(ENUMS.holder, region.startHolder)) errors.push(`${region.id} startHolder ${region.startHolder}`);
      if (region.disputedBy != null && !known(ENUMS.holder, region.disputedBy)) errors.push(`${region.id} disputedBy ${region.disputedBy}`);
      if (region.pressureFaction != null && !known(ENUMS.holder, region.pressureFaction)) errors.push(`${region.id} pressureFaction ${region.pressureFaction}`);
      if (!biomes.has(region.biome)) errors.push(`${region.id} biome ${region.biome}`);
      for (const season of Object.keys(region.preyBySeason || {})) if (!known(ENUMS.season, season)) errors.push(`${region.id} prey season ${season}`);
      for (const hazard of region.hazards || []) {
        if (!hazards.has(hazard.id)) errors.push(`${region.id} hazard ${hazard.id}`);
        for (const season of hazard.seasons || []) if (!known(ENUMS.season, season)) errors.push(`${region.id} hazard season ${season}`);
      }
    }
    return errors;
  }
  function create(data) {
    const regions = new Map(data.regions.map((r) => [r.id, r]));
    const biomes = new Map(data.biomes.map((b) => [b.id, b]));
    const adj = new Map(data.regions.map((r) => [r.id, new Map()]));
    for (const e of data.edges) {
      if (!adj.has(e.a) || !adj.has(e.b)) throw new Error(`edge ${e.a}-${e.b}: unknown region`);
      adj.get(e.a).set(e.b, e); adj.get(e.b).set(e.a, e);
    }
    const T = data.tunables;
    const region = (id) => { const r = regions.get(id); if (!r) throw new Error(`unknown region ${id}`); return r; };
    const neighbours = (id) => [...adj.get(region(id).id).keys()];
    const edge = (a, b) => (adj.get(a) && adj.get(a).get(b)) || null;
    /** §5.3: winter uses winterDays (default = days). */
    const travelDays = (a, b, season) => { const e = edge(a, b); if (!e) return null; return season === 'winter' ? (e.winterDays || e.days) : e.days; };
    const preyFor = (id, season) => { const r = region(id); return r.preyBySeason && r.preyBySeason[season] !== undefined ? r.preyBySeason[season] : r.prey; };
    /** formulas §1 / map §8.2: prey 0..3 → hunt points. */
    const preyPoints = (id, season) => data.preyPoints[preyFor(id, season)];
    /** §6.1: a hazard rolls in `season` when it has no season tag, except thin_ice, which is spring-only unless tagged. */
    const hazardsFor = (id, season) => region(id).hazards.filter((h) => (h.seasons ? h.seasons.includes(season) : h.id !== 'thin_ice' || season === 'spring'));
    /** §6.4 as ruled: sum this season's hazard percentages, then band the total. The score cannot pass 3. */
    const danger = (id, season) => {
      const sum = hazardsFor(id, season).reduce((total, hazard) => total + hazard.pct, 0);
      const band = data.dangerBands.find((row) => sum <= row.max);
      return Math.min(3, band ? band.danger : 3);
    };
    /** §8.1: drinkable water this season (frozen water in winter → eat-snow, not free drink). Tar seeps etc. have water `none`. */
    const hasWater = (id, season) => { const r = region(id); return r.water !== 'none' && !(r.freezes && season === 'winter'); };
    const initClaims = () => {
      const c = Object.fromEntries(data.regions.map((r) => [r.id, {}]));
      for (const s of data.startClaims) c[s.regionId][s.prideId] = s.claim;
      return c;
    };
    /** §9.1 derived ownership from a region's claim map. */
    function ownership(claims, id) {
      const list = Object.entries((claims && claims[id]) || {}).sort((a, b) => b[1] - a[1]);
      const [lead, second] = list;
      const holder = lead && lead[1] >= T.holdMin ? lead[0] : 'neutral';
      const disputedBy = holder !== 'neutral' && second && second[1] >= T.contestMin && lead[1] - second[1] <= T.contestGap ? second[0] : null;
      return { holder, disputedBy, state: holder === 'neutral' ? 'wild' : disputedBy ? 'contested' : 'held', claims: Object.fromEntries(list) };
    }
    /** §8.3: prides whose claim here would trigger trespass for a loner (claim ≥ trespassClaimMin, or a disputant). Wolves are a pack, not a pride. */
    function trespassFactions(claims, id) {
      const kind = Object.fromEntries(data.factions.map((f) => [f.id, f.kind]));
      const o = ownership(claims, id);
      return Object.entries(o.claims).filter(([p, v]) => kind[p] === 'pride' && (v >= T.trespassClaimMin || p === o.disputedBy)).map(([p]) => p);
    }
    /** Discovered = visited regions plus their neighbours (seen from the edge). */
    const discover = (discovered, id) => [...new Set([...(discovered || []), id, ...neighbours(id)])];
    return { data, dataVersion: data.dataVersion, tunables: T, regions: [...regions.values()], region, biome: (id) => biomes.get(id), neighbours, edge, travelDays, preyFor, preyPoints, hazardsFor, danger, hasWater, initClaims, ownership, trespassFactions, discover };
  }
  /**
   * §10.3: bring a saved map block up to the current data. New regions → wild (no claims); removed ids drop out (claims go nowhere
   * in v1: no ids are expected to be removed); discovered ids that no longer exist are dropped; the player's region, if removed, moves to the start region.
   */
  function migrateMap(saved, wm) {
    const out = { ...saved, claims: { ...(saved.claims || {}) } };
    const ids = new Set(wm.regions.map((r) => r.id));
    for (const id of ids) if (!out.claims[id]) out.claims[id] = {};
    for (const id of Object.keys(out.claims)) if (!ids.has(id)) delete out.claims[id];
    out.discovered = (out.discovered || []).filter((id) => ids.has(id));
    out.visited = (out.visited || []).filter((id) => ids.has(id));
    if (out.flood && !ids.has(out.flood.region)) out.flood = null;
    out.blockedEdges = Object.fromEntries(Object.entries(out.blockedEdges || {}).filter(([k]) => k.split('|').every((id) => ids.has(id))));
    out.dataVersion = wm.dataVersion;
    return out;
  }
  const edgeKey = (a, b) => [a, b].sort().join('|');
  return { create, migrateMap, edgeKey, ENUMS, validate };
});
