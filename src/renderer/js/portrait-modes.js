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
  /** Adult head-and-shoulders box. Ochre: every adult base and still. */
  const HEAD = { x: 0.5856, y: 0.0, w: 0.4144, h: 0.5525 };
  /** Cub base v1. Square on 1152×864: 730, 60, 400, 400. */
  const CUB_HEAD = { x: 0.6337, y: 0.0694, w: 0.3472, h: 0.4630 };
  const FULL = { width: 1152, height: 864 };
  const AGES = ['cub', 'adolescent', 'adult', 'elder'];
  const HEAD_PLACES = {
    dialogue: true, event: true, talk: true, directory: true, profile: true,
    head: true, council: true, heir: true, lore: true, headshot: true
  };

  function stageOf(spec, lifeStage) {
    if (lifeStage === 'cub' || lifeStage === 'adolescent' || lifeStage === 'adult' || lifeStage === 'elder') return lifeStage;
    if (spec && typeof spec === 'object') {
      return spec.lifeStage || spec.stage || (spec.look && (spec.look.lifeStage || spec.look.stage)) || 'adult';
    }
    return 'adult';
  }
  function poseFor(sex, lifeStage) {
    const base = sex === 'male' ? POSE.male : POSE.female;
    const stage = stageOf(null, lifeStage);
    return stage === 'cub' ? base + '-cub' : base;
  }
  function cropFor(sexOrSpec, lifeStage) {
    return stageOf(sexOrSpec, lifeStage) === 'cub' ? CUB_HEAD : HEAD;
  }
  function isCub(spec) {
    return stageOf(spec) === 'cub';
  }
  /** Gene composite on the cub pose. Not the baked smilodon-cub.png still. */
  function stillFor(spec) {
    if (!isCub(spec)) return null;
    const sex = (spec && (spec.sex || (spec.look && spec.look.sex))) || 'female';
    return { pose: poseFor(sex, 'cub'), crop: CUB_HEAD, plain: false };
  }
  /**
   * A cub always composites the cub pose. An assigned adult still is ignored until the cat is adult.
   * Adolescent and elder keep that still.
   */
  function resolveArt(spec) {
    const stage = stageOf(spec);
    const sex = (spec && (spec.sex || (spec.look && spec.look.sex))) || 'female';
    if (stage === 'cub') return { stage, sex, pose: poseFor(sex, 'cub'), crop: CUB_HEAD, portraitId: null, compose: true };
    const portraitId = (spec && spec.portraitId) || null;
    return { stage, sex, pose: poseFor(sex, 'adult'), crop: HEAD, portraitId, compose: !portraitId };
  }
  function cubFallback(spec) {
    const coat = (spec && spec.look && spec.look.coat) || '';
    const file = {
      gray: 'stills/cub-full-greydun-faintstripe.png',
      greydun: 'stills/cub-full-greydun-faintstripe.png',
      black: 'stills/cub-full-melan-rosette.png',
      melan: 'stills/cub-full-melan-rosette.png',
      sandy: 'stills/cub-full-sandy-plain.png',
      tan: 'stills/cub-full-tawny-spotted.png',
      tawny: 'stills/cub-full-tawny-spotted.png'
    }[coat] || 'stills/cub-full-tawny-spotted.png';
    return file;
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
  return { POSE, HEAD, CUB_HEAD, FULL, AGES, poseFor, cropFor, isCub, stillFor, resolveArt, cubFallback, modeFor, aspect, speakerOpts, fullOpts, cssViolations };
});