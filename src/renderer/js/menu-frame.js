/**
 * Framing for the approved main-menu plate (assets/menu/background.jpg).
 * The file has narrow black side bars. Drawing skips those bars and cover-scales
 * the scene without stretching. The file itself is not rewritten.
 * UMD so node tests and the renderer share it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MenuFrame = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Measured on the approved 1200×630 plate: first and last non-black columns.
  const BARS = { x: 38 / 1200, w: 1123 / 1200 };

  function sourceRect(imgW, imgH) {
    const sx = BARS.x * imgW;
    const sw = BARS.w * imgW;
    return { sx, sy: 0, sw, sh: imgH };
  }

  /** Cover placement. dx/dy may be negative when the scene is larger than the view. */
  function place(viewW, viewH, imgW, imgH) {
    const src = sourceRect(imgW, imgH);
    const k = Math.max(viewW / src.sw, viewH / src.sh);
    const dw = src.sw * k;
    const dh = src.sh * k;
    return { ...src, dx: (viewW - dw) / 2, dy: (viewH - dh) / 2, dw, dh };
  }

  return { BARS, sourceRect, place };
});
