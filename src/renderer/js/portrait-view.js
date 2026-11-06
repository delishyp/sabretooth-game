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
    defaultHead: { x: 0.63, y: 0.0, w: 0.35, h: 0.54 },
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

  const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
  const ROLES = new Set(['original', 'eye-alternate']);

  function safeFile(file) {
    if (file == null) return null;
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('..') || file.includes('\\') || !file.toLowerCase().endsWith('.png')) {
      throw new Error('portrait file must be a relative png');
    }
    return file;
  }

  function isPortraitId(id) {
    return typeof id === 'string' && ID_RE.test(id);
  }

  function textOrNull(v, label) {
    if (v == null) return null;
    if (typeof v !== 'string') throw new Error(label + ' must be a string');
    return v;
  }

  function roleOf(v, label) {
    if (v == null) return null;
    if (!ROLES.has(v)) throw new Error(label + ' role is not original or eye-alternate');
    return v;
  }

  function issuesOf(v, label) {
    if (v == null) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error(label + ' known issues must be strings');
    return v.slice();
  }

  function aliasesOf(v, label) {
    if (v == null) return [];
    if (!Array.isArray(v)) throw new Error(label + ' aliases must be a list');
    return v.map((a) => {
      if (!a || typeof a !== 'object') throw new Error(label + ' alias');
      return {
        path: textOrNull(a.path, label + ' alias path'),
        role: roleOf(a.role, label + ' alias'),
        sourceLabel: textOrNull(a.source_label != null ? a.source_label : a.sourceLabel, label + ' alias source'),
        eyeLabel: textOrNull(a.eye_label != null ? a.eye_label : a.eyeLabel, label + ' alias eye'),
        nativeMode: textOrNull(a.native_mode != null ? a.native_mode : a.nativeMode, label + ' alias mode'),
        width: a.width == null ? null : a.width,
        height: a.height == null ? null : a.height,
        bytes: a.bytes == null ? null : a.bytes,
        encodedSha256: textOrNull(a.encoded_sha256 != null ? a.encoded_sha256 : a.encodedSha256, label + ' alias hash'),
      };
    });
  }

  function parse(input) {
    const src = input || FALLBACK;
    const portraits = (src.portraits || []).map((p) => {
      if (!p || !isPortraitId(p.id)) throw new Error('portrait id must be a lowercase slug');
      return {
        id: p.id,
        file: safeFile(p.file),
        head: headOf(p.head || src.defaultHead, p.id),
        role: roleOf(p.role, p.id),
        sourceLabel: textOrNull(p.sourceLabel != null ? p.sourceLabel : p.source_label, p.id + ' source'),
        eyeLabel: textOrNull(p.eyeLabel != null ? p.eyeLabel : p.eye_label, p.id + ' eye'),
        nativeMode: textOrNull(p.nativeMode != null ? p.nativeMode : p.native_mode, p.id + ' mode'),
        width: Number.isInteger(p.width) ? p.width : null,
        height: Number.isInteger(p.height) ? p.height : null,
        bytes: Number.isInteger(p.bytes) ? p.bytes : null,
        encodedSha256: textOrNull(p.encodedSha256, p.id + ' hash'),
        decodedRgbaSha256: textOrNull(p.decodedRgbaSha256, p.id + ' decoded'),
        aliases: aliasesOf(p.aliases, p.id),
        knownIssues: issuesOf(p.knownIssues != null ? p.knownIssues : p.known_issues, p.id),
      };
    });
    const ids = new Set();
    for (const p of portraits) {
      if (ids.has(p.id)) throw new Error('duplicate portrait ' + p.id);
      ids.add(p.id);
    }
    return {
      sharedPose: typeof src.sharedPose === 'string' && src.sharedPose ? src.sharedPose : FALLBACK.sharedPose,
      defaultHead: headOf(src.defaultHead || FALLBACK.defaultHead, 'defaultHead'),
      staticHead: src.staticHead ? headOf(src.staticHead, 'staticHead') : null,
      portraits,
    };
  }

  /**
   * Art lookup ignores sex. A missing or unknown id uses the runtime pose.
   * It never substitutes a different registered cat.
   */
  function entryFor(registry, portraitId, _sex) {
    const reg = registry || parse(FALLBACK);
    const requestedId = portraitId || null;
    const found = requestedId ? reg.portraits.find((p) => p.id === requestedId) : null;
    if (found && found.file) return { ...found, runtime: false, requestedId };
    return {
      id: null, file: null, head: reg.defaultHead, runtime: true, requestedId,
      role: null, sourceLabel: null, eyeLabel: null, nativeMode: null, width: null, height: null,
      bytes: null, encodedSha256: null, decodedRgbaSha256: null, aliases: [], knownIssues: [],
    };
  }

  /**
   * Paint generation. adopt() rejects a corrupt registry and keeps the previous one.
   * begin/current drop a paint that lost a race or started against an older registry.
   */
  function createSession(initial) {
    let registry = parse(initial || FALLBACK);
    let generation = 1;
    const tokens = new Map();
    function adopt(raw) {
      let next;
      try { next = parse(raw); } catch (e) {
        return { ok: false, error: String(e && e.message || e), generation, registry };
      }
      registry = next;
      generation += 1;
      return { ok: true, error: null, generation, registry };
    }
    function begin(canvas) {
      const token = (tokens.get(canvas) || 0) + 1;
      tokens.set(canvas, token);
      return { token, generation, registry };
    }
    function current(canvas, token, generationAtStart) {
      return tokens.get(canvas) === token && generation === generationAtStart;
    }
    return {
      adopt, begin, current,
      registry: () => registry,
      generation: () => generation,
    };
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

  return { FALLBACK, parse, entryFor, sharedPose, sourceRect, blitHead, openViewer, closeViewer, isPortraitId, createSession };
});
