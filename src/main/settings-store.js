/**
 * Settings persistence (spec §5). Pure Node, no Electron import, so it is unit-testable.
 * File: <userData>/settings.json  (on Windows: %APPDATA%/Sabretooth/settings.json)
 * - Missing file -> defaults written (first launch, spec §3).
 * - Corrupt file -> backed up to settings.bad.json, defaults restored, `recovered: true` reported.
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
  version: 1,
  audio: { master: 0.8, music: 0.7, sfx: 0.8, ambient: 0.7, mute: false },
  display: { mode: 'borderless', resolution: 'native', uiScale: 1.0, reducedMotion: false, vsync: true },
  controls: { keyBindings: 'default', controllerVibration: true, invertY: false },
  storyteller: { mode: 'offline', localModelPath: null }
});
const STORYTELLER_MODES = ['online', 'local', 'offline'];

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep-merge `patch` into `base`, only for keys that exist in DEFAULTS shape. */
function merge(base, patch, shape = DEFAULTS) {
  const out = clone(base);
  if (!isObj(patch)) return out;
  for (const k of Object.keys(patch)) {
    if (!(k in shape) || k === 'version') continue;
    if (isObj(shape[k])) out[k] = merge(out[k] || {}, patch[k], shape[k]);
    else out[k] = patch[k];
  }
  return out;
}

/** Allowed values beyond plain type checks. Numbers in RANGES are clamped; anything else invalid → default (B10). */
const ENUMS = {
  'display.mode': ['fullscreen', 'borderless', 'windowed'],
  'display.uiScale': [0.8, 0.9, 1.0, 1.1, 1.25],
  'storyteller.mode': STORYTELLER_MODES
};
const RANGES = { 'audio.master': [0, 1], 'audio.music': [0, 1], 'audio.sfx': [0, 1], 'audio.ambient': [0, 1] };

function validate(s) {
  for (const [sec, fields] of Object.entries(DEFAULTS)) {
    if (!isObj(fields)) continue;
    for (const [k, def] of Object.entries(fields)) {
      const key = `${sec}.${k}`; let v = s[sec][k];
      if (key === 'storyteller.localModelPath') { if (v !== null && typeof v !== 'string') v = null; }
      else if (typeof v !== typeof def || (typeof v === 'number' && !Number.isFinite(v))) v = def;
      if (ENUMS[key] && !ENUMS[key].includes(v)) v = def;
      if (RANGES[key]) v = Math.min(RANGES[key][1], Math.max(RANGES[key][0], v));
      s[sec][k] = v;
    }
  }
  return s;
}

function createSettingsStore(dir) {
  const file = path.join(dir, 'settings.json');
  let recovered = false;

  function write(s) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
    fs.renameSync(tmp, file);
  }

  function load() {
    if (!fs.existsSync(file)) { const d = clone(DEFAULTS); write(d); return d; }
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isObj(parsed)) throw new Error('not an object');
      return validate(merge(DEFAULTS, parsed));
    } catch {
      fs.copyFileSync(file, path.join(dir, 'settings.bad.json'));
      recovered = true;
      const d = clone(DEFAULTS); write(d); return d;
    }
  }

  let current = load();
  return {
    file,
    get: () => clone(current),
    set(patch) { current = validate(merge(current, patch)); write(current); return clone(current); },
    reset(section) {
      current = section && section in DEFAULTS ? merge(current, { [section]: DEFAULTS[section] }) : clone(DEFAULTS);
      write(current); return clone(current);
    },
    /** True once if the file was corrupt at load (main shows a toast). */
    takeRecovered() { const r = recovered; recovered = false; return r; }
  };
}

module.exports = { createSettingsStore, DEFAULTS, STORYTELLER_MODES };
