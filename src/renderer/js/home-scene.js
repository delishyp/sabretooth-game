/**
 * Gameplay home scene layout. Pure geometry and navigation; no genetics and no portrait pixels.
 * The landscape is the 1280×720 clean background (16:9, same shape as the 1920×1080 stage).
 * The player figure is the existing 1152×864 portrait, scaled with one factor so the paws
 * (near the bottom of that bitmap) meet the rocky ledge. Nothing here resamples the cat.
 * UMD so node tests and the game screen share it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HomeScene = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /** Rocky mid-left foreground on home-landscape.png, as a fraction of the image. */
  const LEDGE = { x0: 0.25, x1: 0.55, y0: 0.50, y1: 0.72 };
  /** Standing surface inside the ledge. The cave sits further left than the reference mockup. */
  const PAW_Y = 0.68;
  /** Opaque paw line of the shipped 1152×864 portraits (female ~0.956, male ~0.948). */
  const PAW_FRAC = 0.955;
  const PORTRAIT = { width: 1152, height: 864 };
  const NAV = [
    { id: 'home', implemented: true },
    { id: 'pride', implemented: true },
    { id: 'den', implemented: true },
    { id: 'wilderness', implemented: true },
    { id: 'cats', implemented: true },
    { id: 'breeding', implemented: false },
    { id: 'market', implemented: false },
    { id: 'inventory', implemented: false },
    { id: 'lore', implemented: false },
  ];

  function navItem(id) {
    return NAV.find((item) => item.id === id) || null;
  }

  /** @returns {{view: string, unavailable: string|null}} */
  function selectView(current, id) {
    const item = navItem(id);
    if (!item) throw new Error('unknown home view ' + id);
    if (!item.implemented) return { view: current, unavailable: id };
    return { view: id, unavailable: null };
  }

  /**
   * Display box for the portrait bitmap. One scale for both axes.
   * The paw line (PAW_FRAC down the bitmap) lands on PAW_Y of the scene.
   * The box width is the ledge width, so the figure stays inside x 25–55%.
   */
  function catBox(sceneW, sceneH) {
    if (!(sceneW > 0) || !(sceneH > 0)) throw new Error('scene size must be positive');
    const aspect = PORTRAIT.width / PORTRAIT.height;
    const ledgeW = (LEDGE.x1 - LEDGE.x0) * sceneW;
    const width = ledgeW;
    const height = width / aspect;
    const top = PAW_Y * sceneH - height * PAW_FRAC;
    const left = LEDGE.x0 * sceneW;
    return { left, top, width, height };
  }

  return { LEDGE, PAW_Y, PAW_FRAC, PORTRAIT, NAV, navItem, selectView, catBox };
});
