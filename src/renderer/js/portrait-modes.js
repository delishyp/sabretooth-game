/**
 * Full-body versus headshot for a cat portrait.
 * Head boxes are measured on the male and female base lineart (1152×864).
 * Cubs, adolescents and elders use that same pose, so they use the same box.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PortraitModes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const POSE = { female: 'portrait-female', male: 'portrait-male' };
  /** One square head-and-shoulders box. Ochre: every base, every still, every age. */
  const HEAD = { x: 0.5856, y: 0.0, w: 0.4144, h: 0.5525 };
  /** Finished cub still. Spots and the open mouth are baked in, so it is never tinted. */
  const CUB_STILL = { id: 'smilodon-cub', file: 'cats/smilodon-cub.png', plain: true };
  const FULL = { width: 1152, height: 864 };
  const AGES = ['cub', 'adolescent', 'adult', 'elder'];
  const HEAD_PLACES = {
    dialogue: true, event: true, talk: true, directory: true, profile: true,
    head: true, council: true, heir: true, lore: true, headshot: true
  };

  function poseFor(sex) {
    return sex === 'male' ? POSE.male : POSE.female;
  }
  function cropFor() {
    return HEAD;
  }
  function isCub(spec) {
    const stage = spec && (spec.stage || spec.lifeStage || (spec.look && (spec.look.stage || spec.look.lifeStage)));
    return stage === 'cub';
  }
  function stillFor(spec) {
    return isCub(spec) ? CUB_STILL : null;
  }
  function modeFor(place) {
    return HEAD_PLACES[place] ? 'headshot' : 'full';
  }
  function aspect(mode, sex) {
    if (mode !== 'headshot') return FULL.width / FULL.height;
    const box = cropFor(sex);
    return (box.w * FULL.width) / (box.h * FULL.height);
  }
  function speakerOpts() {
    return { frame: 'head', mode: 'headshot', place: 'dialogue' };
  }
  function fullOpts(place) {
    return { mode: 'full', place: place || 'den' };
  }
  /**
   * Cat bitmaps must be contained, or sized to their own aspect.
   * A fixed height without that cuts the body. Backgrounds are not cat art.
   */
  function cssViolations(css) {
    const out = [];
    const cat = /portrait-frame|home-cat|home-head|event-portrait|encounter-panel|encounter-body|creator-canvas|cat-viewer-canvas/;
    const bitmap = /canvas|img|home-cat|event-portrait|encounter-body|creator-canvas|cat-viewer-canvas/;
    for (const chunk of String(css || '').split('}')) {
      const parts = chunk.split('{');
      if (parts.length < 2) continue;
      const selector = parts[0];
      const body = parts[1];
      if (!cat.test(selector)) continue;
      if (/object-fit\s*:\s*cover/.test(body)) out.push('cover ' + selector.trim());
      if (!bitmap.test(selector)) continue;
      const fixed = /(?:^|[;])\s*height\s*:\s*(?:var\(\s*--frame-h|\d+(?:\.\d+)?px)/.test(';' + body);
      const safe = /object-fit\s*:\s*contain/.test(body) || /aspect-ratio\s*:/.test(body) || /height\s*:\s*auto/.test(body);
      if (fixed && !safe) out.push('fixed height ' + selector.trim());
    }
    return out;
  }
  return { POSE, HEAD, CUB_STILL, FULL, AGES, poseFor, cropFor, isCub, stillFor, modeFor, aspect, speakerOpts, fullOpts, cssViolations };
});