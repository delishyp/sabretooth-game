/**
 * Vale map screen. Positions are a schematic of the existing region list.
 * No new art: names and descriptions stay in map data and Saga's map copy.
 * The hover card is fixed on the west of the board so it never covers East Saddle.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RegionMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /** Top-left of each region node, as a percent of the board. North is up. */
  const LAYOUT = {
    ice_wall: [6, 4], frost_tongue: [22, 6], blue_caves: [38, 4], wind_scree: [14, 18],
    north_pass: [58, 6], highcrag: [44, 16], horse_meadows: [32, 26], upper_greywater: [50, 26],
    greywater_ford: [50, 36], salt_flats: [10, 34], bonefield: [22, 48], herd_trail: [14, 58],
    tallgrass: [30, 56], south_range: [36, 70], split_rock: [28, 44], twin_forks: [54, 48],
    reedbank: [46, 56], mistwood: [24, 66], fog_paths: [12, 70], west_spur: [4, 56],
    drowned_mere: [62, 46], mere_shore: [54, 60], island_mere: [64, 60], east_saddle: [78, 34],
    bears_throat: [44, 76], claw_gorge: [60, 72], tar_seeps: [32, 82], ash_hills: [74, 56],
    wolf_run: [84, 70], camel_ridge: [68, 82]
  };
  const NODE = { width: 12, height: 8 };
  /** The card is a side column, not a layer on the board, so it cannot cover East Saddle. */
  const CARD = { overlay: false };

  function box(at, size) {
    return { left: at[0], top: at[1], width: size.width, height: size.height };
  }
  function intersects(a, b) {
    return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
  }
  function saddleBox() {
    return box(LAYOUT.east_saddle, NODE);
  }
  function regionsOf(map) {
    if (!map) return [];
    if (Array.isArray(map.regions)) return map.regions;
    if (typeof map.regions === 'function') return map.regions();
    return [];
  }
  /**
   * @param map world map data or the worldmap API
   * @param state slice state (region, map.discovered, map.visited)
   * @param opts {{hover?: string}}
   */
  function build(map, state, opts) {
    const s = state || {};
    const discovered = new Set((s.map && s.map.discovered) || []);
    const visited = new Set((s.map && s.map.visited) || []);
    const hover = opts && opts.hover;
    const nodes = regionsOf(map).map((region) => {
      const at = LAYOUT[region.id];
      if (!at) return null;
      const known = discovered.has(region.id);
      if (!known) return null;
      return {
        id: region.id,
        name: region.name,
        left: at[0],
        top: at[1],
        width: NODE.width,
        height: NODE.height,
        here: region.id === s.region,
        visited: visited.has(region.id)
      };
    }).filter(Boolean);
    const card = hover ? cardFor(map, s, hover) : null;
    return { nodes, card, cardBox: CARD, saddle: saddleBox(), nodeSize: NODE };
  }
  function cardFor(map, state, id) {
    const region = regionsOf(map).find((row) => row.id === id);
    if (!region) return null;
    const known = !!((state.map && state.map.discovered) || []).includes(id);
    if (!known) return { id, known: false, unknownKey: 'game.region.unknown' };
    return {
      id,
      known: true,
      name: region.name,
      descriptionKey: 'map.region.' + id + '.description',
      here: state.region === id
    };
  }
  return { LAYOUT, NODE, CARD, intersects, saddleBox, build, cardFor };
});
