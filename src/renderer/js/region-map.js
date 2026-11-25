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
        visited: visited.has(region.id),
        holder: holderOf(s, region.id)
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
    const Territory = typeof require === 'function' ? require('./territory') : (typeof self !== 'undefined' ? self.Territory : null);
    const card = {
      id,
      known: true,
      name: region.name,
      descriptionKey: 'map.region.' + id + '.description',
      here: state.region === id,
      holder: holderOf(state, id)
    };
    if (Territory && (state.map.visited || []).indexOf(id) >= 0) {
      const lead = Territory.lead(state.map && state.map.claims, id);
      const viewer = state.records && state.records.pride && state.records.pride.id;
      card.dangerWord = Territory.word(Territory.danger(region, { holder: lead.holder, claim: lead.claim }, viewer));
      card.arrival = Territory.arrival(id, (state.map.visited || []).filter((row) => row === id).length > 1 ? 'return' : 'first');
      if (id === 'split_rock') {
        const LoreBook = typeof require === 'function' ? require('./lore-book') : (typeof self !== 'undefined' ? self.LoreBook : null);
        const line = LoreBook && LoreBook.copy && (LoreBook.copy.common_knowledge || []).find((row) => row.id === 'ck_custom_councils');
        card.council = line && line.text;
      }
    } else if (Territory) card.dangerWord = 'Unknown';
    return card;
  }
  function holderOf(state, id) {
    const Territory = typeof require === 'function' ? require('./territory') : (typeof self !== 'undefined' ? self.Territory : null);
    if (!Territory || !state.map) return 'neutral';
    return Territory.lead(state.map.claims, id).holder || 'neutral';
  }
  /**
   * Spread the known regions across the board from their map coordinates, then
   * nudge any overlapping labels away from those anchors. chipW and chipH, when
   * set, are the measured label size. anchorX/anchorY stay the region point.
   */
  function layoutChips(nodes, boardW, boardH, font) {
    const px = Math.max(18, Number(font) || 18);
    const width = Math.max(1, Number(boardW) || 1);
    const height = Math.max(1, Number(boardH) || 1);
    const gap = 8;
    const chips = (nodes || []).filter((n) => n && n.name).map((n) => {
      const text = String(n.name);
      const w = Math.min(width, Math.max(px, Math.ceil(n.chipW || (text.length * px * 0.62 + 28))));
      const h = Math.min(height, Math.max(px, Math.ceil(n.chipH || (px * 1.35 + 12))));
      return {
        id: n.id, w, h,
        axPct: Number(n.left) || 0,
        ayPct: Number(n.top) || 0,
        x: 0, y: 0, anchorX: 0, anchorY: 0
      };
    });
    if (!chips.length) return chips;
    const minX = Math.min(...chips.map((c) => c.axPct));
    const maxX = Math.max(...chips.map((c) => c.axPct));
    const minY = Math.min(...chips.map((c) => c.ayPct));
    const maxY = Math.max(...chips.map((c) => c.ayPct));
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const maxW = Math.max(...chips.map((c) => c.w));
    const maxH = Math.max(...chips.map((c) => c.h));
    const padX = Math.max(0, Math.min(maxW / 2, (width - 8) / 2));
    const padY = Math.max(0, Math.min(maxH / 2, (height - 8) / 2));
    const clamp = (c) => {
      c.x = Math.max(0, Math.min(Math.max(0, width - c.w), c.x));
      c.y = Math.max(0, Math.min(Math.max(0, height - c.h), c.y));
    };
    for (const c of chips) {
      const tx = (c.axPct - minX) / spanX;
      const ty = (c.ayPct - minY) / spanY;
      c.anchorX = padX + tx * Math.max(0, width - 2 * padX);
      c.anchorY = padY + ty * Math.max(0, height - 2 * padY);
      c.x = c.anchorX - c.w / 2;
      c.y = c.anchorY - c.h / 2;
      clamp(c);
    }
    const hits = (a, b) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
    const nudge = (a, b, axis) => {
      const before = [a.x, a.y, b.x, b.y];
      const overlap = axis === 'x'
        ? Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        : Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const amount = Math.max(1, overlap + gap);
      const delta = axis === 'x' ? a.axPct - b.axPct : a.ayPct - b.ayPct;
      if (Math.abs(delta) < 0.01) return false;
      if (axis === 'x') {
        if (delta < 0) { a.x -= amount / 2; b.x += amount / 2; }
        else { b.x -= amount / 2; a.x += amount / 2; }
      } else if (delta < 0) { a.y -= amount / 2; b.y += amount / 2; }
      else { b.y -= amount / 2; a.y += amount / 2; }
      clamp(a);
      clamp(b);
      return a.x !== before[0] || a.y !== before[1] || b.x !== before[2] || b.y !== before[3];
    };
    for (let pass = 0; pass < 80; pass++) {
      let moved = false;
      for (let i = 0; i < chips.length; i++) {
        for (let j = i + 1; j < chips.length; j++) {
          const a = chips[i];
          const b = chips[j];
          if (!hits(a, b)) continue;
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          const adx = Math.abs(a.axPct - b.axPct);
          const ady = Math.abs(a.ayPct - b.ayPct);
          const first = (oy + (ady < 0.01 ? 1e9 : 0)) <= (ox + (adx < 0.01 ? 1e9 : 0)) ? 'y' : 'x';
          const second = first === 'x' ? 'y' : 'x';
          if (nudge(a, b, first) || nudge(a, b, second)) moved = true;
        }
      }
      if (!moved) break;
    }
    return chips;
  }
  return { LAYOUT, NODE, CARD, intersects, saddleBox, build, cardFor, layoutChips };
});
