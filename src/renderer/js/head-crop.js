/**
 * Per-still head-and-shoulders box, measured from the plate's opaque pixels.
 * One shared fraction clips ears on some stills and leaves a dark strip on others.
 * UMD. The browser reads data/head-crops.json; node tests call measureHead on pixels.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HeadCrop = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function loadTable() {
    if (typeof require === 'function') {
      try { return require('../data/head-crops.json'); } catch (e) { /* generated table missing */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/head-crops.json', false);
        xhr.send();
        if (xhr.status === 200 || xhr.status === 0) return JSON.parse(xhr.responseText);
      } catch (e) { /* keep the empty table */ }
    }
    return { portraits: {}, poses: {} };
  }

  const TABLE = loadTable();

  function opaqueAt(data, width, height, x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return data[(y * width + x) * 4 + 3] > 48;
  }

  function bodyAt(data, width, height, x, y) {
    if (!opaqueAt(data, width, height, x, y)) return false;
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) if (opaqueAt(data, width, height, x + dx, y + dy)) n++;
    }
    return n >= 14;
  }

  /**
   * Square around the head and shoulders. Ears sit just inside the top.
   * Whiskers are ignored so the right edge is the muzzle, not a hairline.
   */
  function measureHead(data, width, height) {
    let earY = Math.round(height * 0.02);
    for (let y = 0; y < height; y++) {
      let hit = false;
      for (let x = Math.floor(width * 0.55); x < width; x++) {
        if (bodyAt(data, width, height, x, y)) { earY = y; hit = true; break; }
      }
      if (hit) break;
    }
    const y1 = Math.min(height - 1, earY + Math.round(height * 0.22));
    const need = Math.max(20, Math.round((y1 - earY) * 0.12));
    let nose = Math.floor(width * 0.9);
    for (let x = width - 1; x >= Math.floor(width * 0.5); x--) {
      let n = 0;
      for (let y = earY; y <= y1; y++) if (bodyAt(data, width, height, x, y)) n++;
      if (n >= need) { nose = x; break; }
    }
    let skull = nose;
    const ySkull = Math.min(height - 1, earY + Math.round(height * 0.06));
    for (let y = earY; y <= ySkull; y++) {
      for (let x = Math.floor(width * 0.5); x < nose; x++) {
        if (bodyAt(data, width, height, x, y) && x < skull) skull = x;
      }
    }
    const side = Math.max(32, Math.min(Math.round(width * 0.34), Math.round((nose - skull) * 1.26)));
    const margin = Math.max(4, Math.round(side * 0.055));
    let top = Math.max(0, earY - margin);
    let right = Math.min(width - 1, nose);
    let left = right - side + 1;
    if (left < 0) left = 0;
    if (top + side > height) top = Math.max(0, height - side);
    if (left + side > width) left = Math.max(0, width - side);
    const used = Math.min(side, width - left, height - top);
    return { x: left, y: top, w: used, h: used };
  }

  function fraction(box, width, height) {
    return { x: box.x / width, y: box.y / height, w: box.w / width, h: box.h / height };
  }

  /** Issues a pixel crop must not have: a padding strip, or ears clipped / buried. */
  function cropIssues(data, width, height, box) {
    const issues = [];
    const side = box.w;
    if (!side || box.h !== box.w) issues.push('not square');
    const countCol = (x) => {
      let n = 0;
      for (let i = 0; i < side; i++) if (opaqueAt(data, width, height, box.x + x, box.y + i)) n++;
      return n;
    };
    const countRow = (y) => {
      let n = 0;
      for (let i = 0; i < side; i++) if (opaqueAt(data, width, height, box.x + i, box.y + y)) n++;
      return n;
    };
    const padding = (count) => count < side * 0.02;
    let padL = 0;
    for (let x = 0; x < side; x++) { if (!padding(countCol(x))) break; padL++; }
    let padR = 0;
    for (let x = side - 1; x >= 0; x--) { if (!padding(countCol(x))) break; padR++; }
    let padB = 0;
    for (let y = side - 1; y >= 0; y--) { if (!padding(countRow(y))) break; padB++; }
    let padT = 0;
    for (let y = 0; y < side; y++) { if (!padding(countRow(y))) break; padT++; }
    if (padL > side * 0.04) issues.push('left pad ' + padL);
    if (padR > side * 0.04) issues.push('right pad ' + padR);
    if (padB > side * 0.04) issues.push('bottom pad ' + padB);
    if (padT > side * 0.12) issues.push('top pad ' + padT);
    let earY = -1;
    const x0 = box.x + Math.floor(side * 0.35);
    for (let y = 0; y < height && earY < 0; y++) {
      for (let x = x0; x < width; x++) {
        if (bodyAt(data, width, height, x, y)) { earY = y; break; }
      }
    }
    if (earY < box.y || earY >= box.y + side) issues.push('ear outside');
    else {
      const margin = (earY - box.y) / side;
      const room = earY > height * 0.03;
      if (room && margin < 0.02) issues.push('ear clipped');
      if (!room && earY < box.y) issues.push('ear clipped');
      if (margin > 0.14) issues.push('ear low');
    }
    return issues;
  }

  function rowFor(id) {
    if (!id) return null;
    if (TABLE.poses && TABLE.poses[id]) return TABLE.poses[id];
    return (TABLE.portraits && TABLE.portraits[id]) || null;
  }

  function fractionFor(id) {
    const row = rowFor(id);
    if (!row) return null;
    return { x: row.x / row.imgW, y: row.y / row.imgH, w: row.w / row.imgW, h: row.h / row.imgH };
  }

  function apply(img, id) {
    const row = rowFor(id);
    if (!img || !row || !row.w || !row.h || !img.style || typeof img.style.setProperty !== 'function') return false;
    const set = (key, value) => img.style.setProperty(key, value, 'important');
    set('position', 'absolute');
    set('left', (-row.x / row.w * 100) + '%');
    set('top', (-row.y / row.h * 100) + '%');
    set('width', (row.imgW / row.w * 100) + '%');
    set('height', (row.imgH / row.h * 100) + '%');
    set('max-width', 'none');
    set('max-height', 'none');
    set('object-fit', 'cover');
    set('object-position', 'left top');
    return true;
  }

  return { measureHead, cropIssues, fraction, fractionFor, apply, table: () => TABLE };
});
