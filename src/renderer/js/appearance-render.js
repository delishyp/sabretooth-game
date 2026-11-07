/**
 * Modular PNG appearance compositor for the development preview.
 * Data in: a registry plus same-canvas RGBA buffers. Data out: one straight-alpha buffer.
 * This file does not read creator state, coat alleles, or the portrait compositor.
 *
 * Stack, bottom to top: eyes, nose, coat, pattern. One source-over each.
 * Eye and nose alpha are multiplied by the eye/nose mask luminance (channel R), then drawn
 * behind the coat so a body silhouette cannot erase the cutouts.
 * The body mask is never sampled. It matches master alpha and includes teeth and claws,
 * so it is not a fur tint and must not multiply the coat (that double-applies the fringe).
 * Coat and pattern keep the RGB and alpha stored in their PNGs. Nothing is rescaled.
 * UMD so node tests and the Electron preview share one implementation.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Appearance = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SLOTS = ['coat', 'pattern', 'eyes', 'nose'];
  const STACK = ['eyes', 'nose', 'coat', 'pattern'];
  const SLOT_LABEL = { coat: 'Coat', pattern: 'Pattern', eyes: 'Eyes', nose: 'Nose' };

  function assertSafeFile(file, label) {
    if (typeof file !== 'string' || !file) throw new Error(label + ' path is missing');
    if (file.startsWith('/') || file.startsWith('\\') || /^[a-zA-Z]:/.test(file) || file.includes('..') || file.includes('\\') || file.includes('\0')) {
      throw new Error(label + ' path must stay inside assets/appearance (' + file + ')');
    }
    if (!file.toLowerCase().endsWith('.png')) throw new Error(label + ' must be a .png');
  }

  function normalizeOption(slot, raw) {
    if (!raw || typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(raw.id)) throw new Error(slot + ' option id must be a lowercase slug');
    if (typeof raw.label !== 'string' || !raw.label.trim()) throw new Error(slot + ' option "' + raw.id + '" needs a label');
    const available = raw.available !== false;
    if (raw.file == null) {
      if (available && slot === 'coat') throw new Error('available coat "' + raw.id + '" needs a PNG');
    } else assertSafeFile(raw.file, slot + ' ' + raw.id);
    return { id: raw.id, label: raw.label, file: raw.file == null ? null : raw.file, available };
  }

  function optionById(registry, slot, id) {
    return registry.slots[slot].options.find((o) => o.id === id && o.available);
  }

  function checkedId(registry, slot, id) {
    const def = registry.slots[slot];
    if (!def) throw new Error('unknown slot ' + slot);
    const available = def.options.filter((o) => o.available);
    if (id == null) {
      if (available.length === 0) return null;
      throw new Error(slot + ' requires a registered option');
    }
    if (!available.some((o) => o.id === id)) {
      if (available.length === 0) throw new Error(slot + ' unavailable: no artwork registered');
      throw new Error(slot + ' "' + id + '" is not a registered option');
    }
    return id;
  }

  function parseRegistry(input) {
    if (!input || typeof input !== 'object' || !input.slots) throw new Error('registry must be an object');
    const width = input.canvas && input.canvas.width;
    const height = input.canvas && input.canvas.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('registry canvas must be a positive integer size');
    const masks = input.masks || {};
    if (!masks.body || !masks.eyeNose) throw new Error('registry requires masks.body and masks.eyeNose');
    if (masks.body.applied === true) throw new Error('body mask cannot be applied; it matches master alpha and includes teeth and claws');
    if (masks.body.encoding && masks.body.encoding !== 'luminance') throw new Error('body mask encoding must be luminance');
    if (masks.eyeNose.encoding && masks.eyeNose.encoding !== 'luminance') throw new Error('eye-nose mask encoding must be luminance');
    if (masks.eyeNose.applied && masks.eyeNose.applied !== 'eyes-and-nose-only') throw new Error('eye-nose mask applies only to eye and nose fills');
    assertSafeFile(masks.body.file, 'body mask');
    assertSafeFile(masks.eyeNose.file, 'eye-nose mask');
    const slots = {};
    for (const name of SLOTS) {
      const raw = input.slots[name];
      if (!raw || !Array.isArray(raw.options)) throw new Error('registry missing slot ' + name);
      const options = raw.options.map((o) => normalizeOption(name, o));
      const ids = new Set();
      for (const o of options) {
        if (ids.has(o.id)) throw new Error(name + ' option "' + o.id + '" is duplicated');
        ids.add(o.id);
      }
      slots[name] = { default: raw.default == null ? null : raw.default, options };
    }
    const registry = {
      id: typeof input.id === 'string' ? input.id : 'appearance',
      version: input.version || 1,
      canvas: { width, height },
      masks: {
        body: { file: masks.body.file, encoding: 'luminance', applied: false },
        eyeNose: { file: masks.eyeNose.file, encoding: 'luminance', applied: 'eyes-and-nose-only' },
      },
      slots,
    };
    for (const name of SLOTS) checkedId(registry, name, registry.slots[name].default);
    return registry;
  }

  function defaultSelection(registry) {
    const sel = {};
    for (const slot of SLOTS) sel[slot] = checkedId(registry, slot, registry.slots[slot].default);
    return sel;
  }

  function selectSlot(registry, selection, slot, id) {
    if (!SLOTS.includes(slot)) throw new Error('unknown slot ' + slot);
    const next = { coat: selection.coat, pattern: selection.pattern, eyes: selection.eyes, nose: selection.nose };
    next[slot] = checkedId(registry, slot, id);
    return next;
  }

  function sameSelection(a, b) {
    return SLOTS.every((s) => a[s] === b[s]);
  }

  function slotPresentation(registry, slot) {
    const options = registry.slots[slot].options.filter((o) => o.available).map((o) => ({ id: o.id, label: o.label, file: o.file }));
    if (options.length === 0) {
      return { slot, label: SLOT_LABEL[slot], enabled: false, options, note: 'No artwork registered. Nothing is painted for this slot.' };
    }
    const note = slot === 'coat' ? 'Full-canvas artwork under the pattern. The master is the locked painting, not a recolor.'
      : slot === 'pattern' ? 'Full-canvas artwork above the coat, using its own alpha. No pattern leaves the coat unchanged.'
      : 'Drawn behind the coat. Alpha is confined to the eye/nose luminance so the body cannot clip the cutouts.';
    return { slot, label: SLOT_LABEL[slot], enabled: true, options, note };
  }

  /** Masks the compositor will sample for this selection. The body mask is never one of them. */
  function masksUsed(selection) {
    return selection && (selection.eyes || selection.nose) ? ['eyeNose'] : [];
  }

  function assertNative(image, canvas, label) {
    const w = image && image.width, h = image && image.height;
    const n = w > 0 && h > 0 ? w * h * 4 : 0;
    if (!image || w !== canvas.width || h !== canvas.height || !image.data || image.data.length !== n) {
      throw new Error(label + ' is ' + w + 'x' + h + '; required ' + canvas.width + 'x' + canvas.height + ' with no scale, crop, or resample');
    }
  }

  function confined(layer, mask) {
    const s = layer.data, m = mask.data, o = new Uint8ClampedArray(s.length);
    for (let i = 0; i < s.length; i += 4) {
      o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2];
      o[i + 3] = Math.round(s[i + 3] * m[i] / 255);
    }
    return o;
  }

  /** Straight alpha. A transparent destination copies the source bytes unchanged (no RGB premultiply). */
  function sourceOver(dst, src) {
    for (let i = 0; i < dst.length; i += 4) {
      const sa = src[i + 3];
      if (sa === 0) continue;
      const da = dst[i + 3];
      if (da === 0 || sa === 255) {
        dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = sa;
        continue;
      }
      const s = sa / 255, d = da / 255, inv = 1 - s, oa = s + d * inv;
      dst[i] = Math.round((src[i] * s + dst[i] * d * inv) / oa);
      dst[i + 1] = Math.round((src[i + 1] * s + dst[i + 1] * d * inv) / oa);
      dst[i + 2] = Math.round((src[i + 2] * s + dst[i + 2] * d * inv) / oa);
      dst[i + 3] = Math.round(oa * 255);
    }
  }

  function composite(canvas, layers, masks) {
    const out = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    const eyeNose = masks && masks.eyeNose;
    for (const slot of STACK) {
      const layer = layers && layers[slot];
      if (!layer) continue;
      assertNative(layer, canvas, slot);
      if (slot === 'eyes' || slot === 'nose') {
        if (!eyeNose) throw new Error(slot + ' requires the eye-nose luminance mask');
        assertNative(eyeNose, canvas, 'eye-nose mask');
        sourceOver(out, confined(layer, eyeNose));
      } else sourceOver(out, layer.data);
    }
    return out;
  }

  function renderSelection(registry, selection, images) {
    const sel = {};
    for (const slot of SLOTS) {
      const id = selection && Object.prototype.hasOwnProperty.call(selection, slot) ? selection[slot] : registry.slots[slot].default;
      sel[slot] = checkedId(registry, slot, id);
    }
    const layers = {};
    for (const slot of STACK) {
      if (sel[slot] == null) continue;
      const opt = optionById(registry, slot, sel[slot]);
      if (!opt.file) continue;
      const img = images && images[opt.file];
      if (!img) throw new Error('missing pixels for ' + slot + ' "' + opt.id + '" (' + opt.file + ')');
      layers[slot] = img;
    }
    const eyeNose = (layers.eyes || layers.nose) ? images[registry.masks.eyeNose.file] : null;
    if ((layers.eyes || layers.nose) && !eyeNose) throw new Error('missing eye-nose mask pixels');
    return composite(registry.canvas, layers, { eyeNose });
  }

  /** Uniform contain-fit. Does not change the native bitmap. */
  function displayFit(nativeWidth, nativeHeight, viewWidth, viewHeight) {
    if (!(viewWidth > 0) || !(viewHeight > 0) || !(nativeWidth > 0) || !(nativeHeight > 0)) throw new Error('display fit needs positive sizes');
    const scale = Math.min(viewWidth / nativeWidth, viewHeight / nativeHeight);
    return { scale, cssWidth: Math.max(1, Math.floor(nativeWidth * scale)), cssHeight: Math.max(1, Math.floor(nativeHeight * scale)) };
  }

  function pixelsEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function sample(data, width, x, y) {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  return {
    SLOTS, STACK, parseRegistry, defaultSelection, selectSlot, sameSelection, slotPresentation, masksUsed,
    assertNative, composite, renderSelection, displayFit, pixelsEqual, sample,
  };
});
