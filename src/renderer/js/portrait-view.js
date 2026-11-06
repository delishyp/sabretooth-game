/**
 * Head crop and full-cat view for one shared portrait per identity.
 * Sex does not select art. A complete-cat PNG is registered with a head rectangle;
 * the source file is never cropped. An empty registry uses the shared runtime pose.
 * UMD so node tests and the renderer share it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PortraitView = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FALLBACK = {
    sharedPose: 'portrait-female',
    defaultHead: { x: 0.66, y: 0.02, w: 0.33, h: 0.46 },
    portraits: [],
  };

  function frac(n, label) {
    if (typeof n !== 'number' || n < 0 || n > 1) throw new Error(label + ' must be between 0 and 1');
    return n;
  }

  function headOf(raw, label) {
    const h = raw || {};
    const x = frac(h.x, label + '.x');
    const y = frac(h.y, label + '.y');
    const w = frac(h.w, label + '.w');
    const hh = frac(h.h, label + '.h');
    if (w <= 0 || hh <= 0 || x + w > 1 + 1e-9 || y + hh > 1 + 1e-9) throw new Error(label + ' falls outside the canvas');
    return { x, y, w, h: hh };
  }

  function safeFile(file) {
    if (file == null) return null;
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('..') || file.includes('\\') || !file.toLowerCase().endsWith('.png')) {
      throw new Error('portrait file must be a relative png');
    }
    return file;
  }

  function parse(input) {
    const src = input || FALLBACK;
    const portraits = (src.portraits || []).map((p) => {
      if (!p || typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) throw new Error('portrait id must be a lowercase slug');
      return { id: p.id, file: safeFile(p.file), head: headOf(p.head || src.defaultHead, p.id) };
    });
    const ids = new Set();
    for (const p of portraits) {
      if (ids.has(p.id)) throw new Error('duplicate portrait ' + p.id);
      ids.add(p.id);
    }
    return {
      sharedPose: typeof src.sharedPose === 'string' && src.sharedPose ? src.sharedPose : FALLBACK.sharedPose,
      defaultHead: headOf(src.defaultHead || FALLBACK.defaultHead, 'defaultHead'),
      portraits,
    };
  }

  /** Art lookup ignores sex. A missing id uses the runtime pose and the default head. */
  function entryFor(registry, portraitId, _sex) {
    const reg = registry || parse(FALLBACK);
    const found = portraitId ? reg.portraits.find((p) => p.id === portraitId) : null;
    if (found) return { id: found.id, file: found.file, head: found.head, runtime: !found.file };
    return { id: null, file: null, head: reg.defaultHead, runtime: true };
  }

  function sharedPose(registry) {
    return (registry || parse(FALLBACK)).sharedPose;
  }

  /** Integer source rectangle. Does not read or write pixels. */
  function sourceRect(width, height, head) {
    const box = headOf(head, 'head');
    const sx = Math.min(width - 1, Math.max(0, Math.round(box.x * width)));
    const sy = Math.min(height - 1, Math.max(0, Math.round(box.y * height)));
    const sw = Math.max(1, Math.min(width - sx, Math.round(box.w * width)));
    const sh = Math.max(1, Math.min(height - sy, Math.round(box.h * height)));
    return { sx, sy, sw, sh };
  }

  function blitHead(source, dest, head) {
    const r = sourceRect(source.width, source.height, head);
    dest.width = r.sw;
    dest.height = r.sh;
    dest.getContext('2d').drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh);
    return r;
  }

  /** Viewer state. Opening or closing never produces a day action. */
  function openViewer(sourceId) {
    return { open: true, sourceId: sourceId || null, action: null };
  }
  function closeViewer() {
    return { open: false, sourceId: null, action: null };
  }

  return { FALLBACK, parse, entryFor, sharedPose, sourceRect, blitHead, openViewer, closeViewer };
});
