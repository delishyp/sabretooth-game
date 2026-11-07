/**
 * Development preview DOM. Reads the registry and locked PNGs, then calls Appearance.
 * Display size is CSS only. The bitmap stays at the registry's native size.
 */
(function () {
  const A = window.Appearance;
  const P = window.PngDecode;
  const base = new URL('../../assets/appearance/', window.location.href);
  const cache = new Map();
  let registry, lock, masterImage, eyeNoseImage;
  const canvas = document.getElementById('view');

  function showError(e) {
    const message = e && e.message ? e.message : String(e);
    document.getElementById('err').textContent = message;
    window.__appearancePreview = { error: message };
  }

  async function sha256(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadImage(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const res = await fetch(new URL(rel, base));
    if (!res.ok) throw new Error('could not load ' + rel);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const expect = lock.files[rel];
    if (expect) {
      if (bytes.length !== expect.bytes) throw new Error(rel + ' byte length does not match ASSET-LOCK.json');
      const hash = await sha256(bytes);
      if (hash !== expect.sha256) throw new Error(rel + ' checksum does not match ASSET-LOCK.json; refusing to draw');
    }
    const decoded = await P.decode(bytes);
    if (expect && expect.png) {
      if (decoded.width !== expect.png.width || decoded.height !== expect.png.height || decoded.colorType !== expect.png.colorType) {
        throw new Error(rel + ' PNG header does not match ASSET-LOCK.json');
      }
    }
    const image = P.toRgbaImage(decoded);
    A.assertNative(image, registry.canvas, rel);
    cache.set(rel, image);
    return image;
  }

  function applyFit() {
    const stage = document.getElementById('stage');
    if (stage.clientWidth < 2 || stage.clientHeight < 2) return null;
    const fit = A.displayFit(canvas.width, canvas.height, stage.clientWidth, stage.clientHeight);
    canvas.style.width = fit.cssWidth + 'px';
    canvas.style.height = fit.cssHeight + 'px';
    document.getElementById('fit-readout').textContent =
      'Display ' + fit.cssWidth + '×' + fit.cssHeight + ' px at ' + fit.scale.toFixed(4) + '×, proportional. Bitmap stays ' + canvas.width + '×' + canvas.height + '.';
    return fit;
  }

  function cutoutReport(pixels) {
    let marked = 0, alphaZero = 0, differs = 0;
    const m = masterImage.data, e = eyeNoseImage.data;
    for (let i = 0; i < e.length; i += 4) {
      if (e[i] < 128) continue;
      marked++;
      if (m[i + 3] === 0) alphaZero++;
      if (pixels[i] !== m[i] || pixels[i + 1] !== m[i + 1] || pixels[i + 2] !== m[i + 2] || pixels[i + 3] !== m[i + 3]) differs++;
    }
    return { marked, alphaZero, differs };
  }

  async function imagesFor(selection) {
    const images = {};
    for (const slot of A.SLOTS) {
      const id = selection[slot];
      if (id == null) continue;
      const opt = registry.slots[slot].options.find((o) => o.id === id);
      if (opt && opt.file) images[opt.file] = await loadImage(opt.file);
    }
    if (selection.eyes || selection.nose) images[registry.masks.eyeNose.file] = eyeNoseImage;
    return images;
  }

  const model = { selection: null };

  async function draw() {
    const pixels = A.renderSelection(registry, model.selection, await imagesFor(model.selection));
    canvas.getContext('2d', { willReadFrequently: true }).putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0);
    const fit = applyFit();
    const isDefault = A.sameSelection(model.selection, A.defaultSelection(registry));
    window.__appearancePreview = {
      selection: model.selection,
      native: registry.canvas,
      fit,
      stack: A.STACK,
      masksApplied: A.masksUsed(model.selection),
      matchesMaster: isDefault && A.pixelsEqual(pixels, masterImage.data),
      cutouts: cutoutReport(pixels),
    };
    document.getElementById('err').textContent = '';
  }

  function buildControls() {
    for (const slot of A.SLOTS) {
      const pres = A.slotPresentation(registry, slot);
      const wrap = document.getElementById('slot-' + slot);
      wrap.replaceChildren();
      const label = document.createElement('label');
      label.append(pres.label);
      const sel = document.createElement('select');
      sel.disabled = !pres.enabled;
      if (!pres.enabled) {
        const o = document.createElement('option');
        o.textContent = 'Unavailable — no artwork registered';
        sel.append(o);
      } else {
        for (const opt of pres.options) {
          const o = document.createElement('option');
          o.value = opt.id;
          o.textContent = opt.label;
          if (opt.id === model.selection[slot]) o.selected = true;
          sel.append(o);
        }
        sel.addEventListener('change', () => {
          try {
            model.selection = A.selectSlot(registry, model.selection, slot, sel.value);
            draw().catch(showError);
          } catch (e) { showError(e); }
        });
      }
      label.append(sel);
      const note = document.createElement('p');
      note.className = 'slot-note';
      note.textContent = pres.note;
      wrap.append(label, note);
    }
  }

  async function main() {
    registry = A.parseRegistry(await (await fetch(new URL('registry.json', base))).json());
    lock = await (await fetch(new URL('ASSET-LOCK.json', base))).json();
    if (lock.canvas.width !== registry.canvas.width || lock.canvas.height !== registry.canvas.height) {
      throw new Error('registry canvas does not match ASSET-LOCK.json');
    }
    canvas.width = registry.canvas.width;
    canvas.height = registry.canvas.height;
    const record = await fetch(new URL('validation-metadata.json', base));
    if (!record.ok) throw new Error('validation record missing');
    const recordBytes = new Uint8Array(await record.arrayBuffer());
    const recordLock = lock.files['validation-metadata.json'];
    if (recordBytes.length !== recordLock.bytes || await sha256(recordBytes) !== recordLock.sha256) {
      throw new Error('validation-metadata.json checksum does not match ASSET-LOCK.json');
    }
    masterImage = await loadImage('master/master.png');
    await loadImage('master/body-mask.png');
    eyeNoseImage = await loadImage('master/eye-nose-mask.png');
    model.selection = A.defaultSelection(registry);
    const masterLock = lock.files['master/master.png'];
    document.getElementById('canvas-readout').textContent = 'Native canvas ' + canvas.width + '×' + canvas.height + '. Master RGBA, masks grayscale L.';
    document.getElementById('hash-readout').textContent = 'master.png SHA-256 ' + masterLock.sha256;
    buildControls();
    await draw();
    new ResizeObserver(() => {
      const fit = applyFit();
      if (fit && window.__appearancePreview && !window.__appearancePreview.error) window.__appearancePreview.fit = fit;
    }).observe(document.getElementById('stage'));
  }

  main().catch(showError);
})();
