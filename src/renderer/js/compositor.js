/**
 * Layered portrait compositor (genetics-spec v0.1 §2.3, cat-creator-spec v0.1 §3.6, Ochre's art contract).
 * Each layer PNG: alpha = mask, grayscale = shading. Tint = geneColor × shading (alpha kept) on an offscreen canvas,
 * then drawn onto the stack with the layer's `blend` (normal = source-over default, multiply = shadow, screen = rim light).
 * Stack bottom→top: shadow, base_coat, markings_*, white_*, eye_left, eye_right, sabers, scars*, age_elder, then lineart.
 * UMD so node tests can drive it with fake canvases. Pure helpers are exported for tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Compositor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // genetics-spec v0.3.1 §2 tints (incl. sandy #D9BC8A, ash #7D776F = melan+leuc codominant, leucistic #EFE6D6, melanistic #3A332E;
  // markings: melanistic #1E1A17 ghost markings, leucistic #D2C3A8, ash and every other coat = coat × 0.55) — placeholder (Ochre tunes; later moves to data/genetics.json per §6.2).
  const TINTS = {
    coat: { tawny: '#C8955A', sandy: '#D9BC8A', russet: '#B0623A', greydun: '#A39A88', ash: '#8A95A3', melan: '#141416', leuc: '#EDE6DA' },
    // Ochre coat-palette v1 + portrait-layers v2 (docs/art/): undercoat `cream` hexes; `pale` = mix(cream, coat, 0.5)
    undercoat: { tawny: '#E6CFA6', sandy: '#EEDFC4', russet: '#DDB08C', greydun: '#CDC5B5', ash: '#BAC3CD', melan: '#1A1A1D', leuc: '#F6F2EB' },
    rim: { melan: '#4A5868' },                       // screen
    sheen: { ash: '#DCE3EA', melan: '#38424E' },     // screen
    nose: { default: '#4A3C38', russet: '#5A3A30', ash: '#4E5158', melan: '#19191B', leuc: '#B89A9C' },
    claws: '#D6CCB8',
    eyes: { amber: '#C98A1E', gold: '#D9B43A', copper: '#B5652A', green: '#8FA34A', blue: '#8EB6D1' },
    saber: { ivory: '#EFE7D2', creamy: '#E3CF96', stained: '#8C7A5A' },
    white: '#F7F4EE', age: '#C9C4BC', scar: '#8E6F66', diluteTarget: '#F3EBDD',
    // Markings draw with blend MULTIPLY (manifest), so the tint is what the coat is multiplied by.
    markingsMelan: '#3A3836', markingsLeuc: '#E6DED2',
  };
  const DILUTE_T = [0, 0.15, 0.35];
  const INTENSITY_OPACITY = [0.35, 0.60, 0.85];
  const MARKINGS_MIX = 0.6, MARKINGS_SCALE = 0.62;      // default multiply tint = scale(mix(white, coat, 0.6), 0.62)
  const UNDER_INT_OPACITY = [0.35, 0.60, 0.85];        // genetics v0.4.3 §1.13 (count of U+); creator uses 0.85
  const RIM_OPACITY = 1.0;
  const SHEEN_OPACITY = { ash: 0.25, melan: 0.9 };
  const ELDER_OPACITY = 0.5;
  const ELDER_SABER_STAIN = 0.15;
  // portrait-layers v2: flat colour first, then `shadow` (multiply: form shading + ground shadow) and the screen lights on top,
  // so markings pick up the lighting. Layers above `shadow` carry their own shading in their grayscale.
  const STACK = ['base_coat', 'undercoat', 'markings', 'dorsal', 'shadow', 'rim', 'sheen', 'white', 'nose', 'eye_left', 'eye_right', 'sabers', 'claws', 'scars', 'age_elder'];
  // Black (melan) only: markings + dorsal draw just above `sheen` (still multiply) so the lit back doesn't wash them out (Ochre item 7).
  const MELAN_MARKINGS_AFTER = 'sheen';
  const BLENDS = { normal: 'source-over', multiply: 'multiply', screen: 'screen' };
  const LIFE_STAGES = ['cub', 'adolescent', 'adult', 'elder'];

  const hexToRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const scale = (a, k) => rgbToHex(hexToRgb(a).map((v) => v * k));

  /** In place: rgb = tint × shading (shading = mean of rgb, 0..1); alpha untouched. Returns the array. */
  function tintPixels(data, hex) {
    const [tr, tg, tb] = hexToRgb(hex);
    for (let i = 0; i < data.length; i += 4) {
      const s = (data[i] + data[i + 1] + data[i + 2]) / 765;
      data[i] = Math.round(tr * s); data[i + 1] = Math.round(tg * s); data[i + 2] = Math.round(tb * s);
    }
    return data;
  }
  /** Canvas globalCompositeOperation for a manifest layer; missing → normal; unknown → normal + warning. */
  function blendFor(layer, warn = () => {}) {
    const b = layer && layer.blend != null ? layer.blend : 'normal';
    if (!BLENDS[b]) { warn(`compositor: unknown blend "${b}" on ${layer && layer.id}, using normal`); return BLENDS.normal; }
    return BLENDS[b];
  }
  const stackGroup = (id) => (id === 'markings_dorsal' ? 'dorsal' : id.startsWith('markings_') ? 'markings' : id.startsWith('white_') ? 'white' : id.startsWith('scar') ? 'scars' : id);
  /** Manifest layers that are active for this cat, sorted into STACK order (stable within a group); lineart excluded.
   *  An active entry may carry `after: '<stack group>'` to draw just above that group instead of its own slot. */
  function stackOrder(manifestLayers, active) {
    return manifestLayers
      .filter((l) => active[l.id] && l.id !== 'lineart')
      .map((l, i) => ({ l, i, r: active[l.id].after ? STACK.indexOf(active[l.id].after) + 0.5 : STACK.indexOf(stackGroup(l.id)) }))
      .sort((a, b) => (a.r === -1 ? 99 : a.r) - (b.r === -1 ? 99 : b.r) || a.i - b.i)
      .map((x) => ({ ...x.l, ...active[x.l.id] }));
  }
  const phen = (pair, order) => { const p = Array.isArray(pair) ? pair : [pair, pair]; for (const a of order) if (p.includes(a)) return a; return p[0]; };
  const count = (pair, a) => (Array.isArray(pair) ? pair.filter((x) => x === a).length : 0);

  /**
   * Pure: genetics-spec §2.5 eye resolver → {left, right}. left = the `eyes` phenotype; right = genes.eyeRight only when the cat
   * shows odd eyes (`het`/`het`) and it differs, else right = left. Genotypes without a `het` locus (pre-v0.3) resolve to matching eyes.
   */
  function resolveEyes(genes) {
    const L = (genes && genes.loci) || {};
    const left = phen(L.eyes || ['amber', 'amber'], ['amber', 'gold', 'copper', 'green', 'blue']);
    const odd = count(L.het, 'het') === 2 && genes.eyeRight && TINTS.eyes[genes.eyeRight] && genes.eyeRight !== left;
    return { left, right: odd ? genes.eyeRight : left };
  }
  /**
   * Pure: genotype (genetics-spec §6) → { layerId: {tint, opacity} } for every layer to draw (shadow always).
   * opts.lifeStage 'elder' adds age_elder. opts.scars = [scarLayerId] adds those.
   * opts.eyes = {left, right} overrides the resolved eyes (right defaults to left); eye_left/eye_right are tinted separately.
   */
  function genesToLayers(genes, opts = {}) {
    const L = (genes && genes.loci) || {};
    const coatP = (() => { const p = L.coat || ['tawny', 'tawny'];
      if (p.includes('melan') && p.includes('leuc')) return 'ash';
      return phen(p, ['tawny', 'russet', 'sandy', 'greydun', 'melan', 'leuc']); })();
    const coat = mix(TINTS.coat[coatP], TINTS.diluteTarget, DILUTE_T[count(L.dilute, 'd')]);
    const dT = DILUTE_T[count(L.dilute, 'd')];
    const out = { shadow: { tint: '#FFFFFF', opacity: 1 }, base_coat: { tint: coat, opacity: 1 } };
    const under = phen(L.under || ['cream', 'cream'], ['cream', 'pale', 'off']);
    if (under !== 'off') {
      const cream = mix(TINTS.undercoat[coatP], TINTS.diluteTarget, dT);
      out.undercoat = { tint: under === 'pale' ? mix(cream, coat, 0.5) : cream, opacity: UNDER_INT_OPACITY[L.underInt ? count(L.underInt, 'U+') : 2] };
    }
    if (TINTS.rim[coatP]) out.rim = { tint: TINTS.rim[coatP], opacity: RIM_OPACITY };
    if (TINTS.sheen[coatP]) out.sheen = { tint: TINTS.sheen[coatP], opacity: SHEEN_OPACITY[coatP] };
    out.nose = { tint: TINTS.nose[coatP] || TINTS.nose.default, opacity: 1 };
    out.claws = { tint: TINTS.claws, opacity: 1 };
    const mk = phen(L.marking || ['plain', 'plain'], ['spotted', 'rosette', 'barred', 'faintstripe', 'plain']);
    const mTint = coatP === 'melan' ? TINTS.markingsMelan : coatP === 'leuc' ? TINTS.markingsLeuc : scale(mix('#FFFFFF', coat, MARKINGS_MIX), MARKINGS_SCALE);
    const mOp = INTENSITY_OPACITY[L.intensity ? count(L.intensity, 'I+') : 1];
    const mAfter = coatP === 'melan' ? { after: MELAN_MARKINGS_AFTER } : {};
    if (mk !== 'plain') out['markings_' + mk] = { tint: mTint, opacity: mOp, ...mAfter };
    if (Array.isArray(L.dorsal) && L.dorsal.includes('Ds')) out.markings_dorsal = { tint: mTint, opacity: mOp, ...mAfter };
    const w = L.white || ['none', 'none'];
    if (w.includes('piebald')) out.white_piebald = { tint: TINTS.white, opacity: 1 };
    else { if (w.includes('socks')) out.white_socks = { tint: TINTS.white, opacity: 1 }; if (w.includes('blaze')) out.white_blaze = { tint: TINTS.white, opacity: 1 }; }
    const eyes = opts.eyes && opts.eyes.left ? { left: opts.eyes.left, right: opts.eyes.right || opts.eyes.left } : resolveEyes(genes);
    out.eye_left = { tint: TINTS.eyes[eyes.left], opacity: 1 };
    out.eye_right = { tint: TINTS.eyes[eyes.right] || TINTS.eyes[eyes.left], opacity: 1 };
    let sab = TINTS.saber[phen(L.saber || ['ivory', 'ivory'], ['ivory', 'creamy', 'stained'])];
    if (opts.lifeStage === 'elder') sab = mix(sab, TINTS.saber.stained, ELDER_SABER_STAIN);
    out.sabers = { tint: sab, opacity: 1 };
    for (const s of opts.scars || []) out[s] = { tint: TINTS.scar, opacity: 1 };
    if (opts.lifeStage === 'elder') out.age_elder = { tint: TINTS.age, opacity: opts.elderOpacity != null ? opts.elderOpacity : ELDER_OPACITY };
    return out;
  }

  /** Pure: pose id for sex + life stage. adult/elder share the adult pose (elder = age_elder overlay). */
  function poseFor(sex, lifeStage = 'adult') {
    const s = sex === 'female' ? 'female' : 'male';
    if (lifeStage === 'cub' || lifeStage === 'adolescent') return `portrait-${s}-${lifeStage}`;
    return `portrait-${s}`;
  }
  /** Loads the pose manifest via loadJson(path); falls back to the adult pose (with a warning) if it is missing. */
  async function loadPoseManifest(sex, lifeStage, { loadJson, base = 'assets/portraits', warn = console.warn }) {
    const want = poseFor(sex, lifeStage), adult = poseFor(sex, 'adult');
    try { return { pose: want, dir: `${base}/${want}`, manifest: await loadJson(`${base}/${want}/manifest.json`) }; } catch (e) {
      if (want === adult) throw e;
      warn(`compositor: pose ${want} missing, falling back to ${adult}`);
      return { pose: adult, dir: `${base}/${adult}`, manifest: await loadJson(`${base}/${adult}/manifest.json`) };
    }
  }

  /**
   * Draws the cat onto opts.canvas. opts: {canvas, loadImage(path)→Promise<img>, dir?, lifeStage?, scars?, createCanvas?(w,h), warn?, tintCache?: Map}.
   * A layer whose file fails to load is skipped with a warning. Returns {drawn:[ids], skipped:[ids]}.
   */
  async function compose(manifest, genes, opts) {
    const { canvas, loadImage } = opts; const warn = opts.warn || console.warn;
    const [w, h] = manifest.size; canvas.width = w; canvas.height = h;
    const mk = opts.createCanvas || ((cw, ch) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(cw, ch)
      : Object.assign(document.createElement('canvas'), { width: cw, height: ch })));
    const path = (f) => (opts.dir ? `${opts.dir}/${f}` : f);
    const layers = stackOrder(manifest.layers || [], genesToLayers(genes, opts));
    const imgs = await Promise.all(layers.map((l) => loadImage(path(l.file)).catch((e) => { warn(`compositor: skipping ${l.id} (${l.file}): ${e && e.message || e}`); return null; })));
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h);
    const drawn = [], skipped = [];
    const cache = opts.tintCache;   // optional Map: `${file}|${tint}|${w}x${h}` → tinted canvas (creator preview redraws < 100 ms)
    layers.forEach((l, i) => {
      if (!imgs[i]) { skipped.push(l.id); return; }
      const key = `${path(l.file)}|${l.tint}|${w}x${h}`;
      let off = cache && cache.get(key);
      if (!off) {
        off = mk(w, h); const o = off.getContext('2d', { willReadFrequently: true });
        o.drawImage(imgs[i], 0, 0, w, h);
        const px = o.getImageData(0, 0, w, h); tintPixels(px.data, l.tint); o.putImageData(px, 0, 0);
        if (cache) cache.set(key, off);
      }
      ctx.globalCompositeOperation = blendFor(l, warn); ctx.globalAlpha = l.opacity != null ? l.opacity : 1;
      ctx.drawImage(off, 0, 0); drawn.push(l.id);
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (manifest.lineart) {
      const img = await loadImage(path(manifest.lineart)).catch((e) => { warn(`compositor: skipping lineart: ${e && e.message || e}`); return null; });
      if (img) { ctx.drawImage(img, 0, 0, w, h); drawn.push('lineart'); } else skipped.push('lineart');
    }
    return { drawn, skipped };
  }

  return { compose, genesToLayers, resolveEyes, tintPixels, blendFor, stackOrder, poseFor, loadPoseManifest, TINTS, STACK, LIFE_STAGES, hexToRgb, mix };
});
