/**
 * Menu music (spec v1.3.2 §7, v1.4.1 equal-power loop seam). Web Audio, renderer only. UMD so node tests can drive it with a fake AudioContext.
 * Graph: pass source → pass gain (loop crossfade) → fade gain (fade in/out) → volume gain (master × music, 0 when muted) → out.
 * Mute only zeroes the volume gain, so the track keeps playing silently and unmuting resumes in place.
 * Missing/undecodable file → warn once, state 'silent', menu never blocked.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Music = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { url: '../../assets/audio/menu/earthbound-pulse.ogg', crossfadeSec: 3.0, fadeInSec: 1.5, fadeOutSec: 1.0, scheduleAheadSec: 4 };

  /** Output gain from settings.audio. */
  function volumeFor(audio = {}) {
    if (audio.mute) return 0;
    const c = (v) => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);
    return c(audio.master) * c(audio.music);
  }
  /** When the next pass starts (ctx time), given this pass started at `startAt` playing from `offset` into a `duration` buffer. */
  function nextPassStart(startAt, duration, crossfade, offset = 0) {
    const xf = Math.min(crossfade, duration / 2);
    return startAt + (duration - offset) - xf;
  }
  /**
   * Equal-power loop-seam curves (spec v1.4.1): outgoing cos(x·π/2) 1→0, incoming sin(x·π/2) 0→1, x = 0…1 over the crossfade.
   * out² + in² = 1 at every point, so the summed power stays flat (a linear ramp dips ~3 dB mid-seam; Tracker measured 6–8 dB
   * because the track's own tail fade overlaps it). Used for the loop seam only; menu fade-in/out stay linear.
   */
  const SEAM_POINTS = 128;
  function equalPowerCurves(n = SEAM_POINTS) {
    const out = new Float32Array(n), inc = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1); out[i] = Math.cos(x * Math.PI / 2); inc[i] = Math.sin(x * Math.PI / 2); }
    out[n - 1] = 0; inc[n - 1] = 1;
    return { out, in: inc };
  }
  const CURVES = equalPowerCurves();

  function loadArrayBuffer(url) {
    return new Promise((resolve, reject) => {   // XHR (fetch() refuses file:// in Electron)
      const x = new XMLHttpRequest(); x.open('GET', url); x.responseType = 'arraybuffer';
      x.onload = () => (x.status === 0 || x.status === 200) && x.response && x.response.byteLength ? resolve(x.response) : reject(new Error(`HTTP ${x.status}`));
      x.onerror = () => reject(new Error('load failed')); x.send();
    });
  }

  function create(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const setT = o.setTimeout || ((f, ms) => setTimeout(f, ms)); const clearT = o.clearTimeout || ((h) => clearTimeout(h));
    const warn = o.warn || ((m) => console.warn(m));
    let ctx = null, buffer = null, fadeGain = null, volGain = null, loading = null;
    let passes = [];           // {src, gain, startAt}
    let timer = null, stopTimer = null;
    let state = 'idle';        // idle | loading | playing | fadingOut | stopped | silent
    let audio = {}; let wantPlay = false;

    function ensureCtx() {
      if (ctx) return ctx;
      ctx = o.createContext ? o.createContext() : new (self.AudioContext || self.webkitAudioContext)();
      volGain = ctx.createGain(); volGain.connect(ctx.destination); volGain.gain.value = volumeFor(audio);
      fadeGain = ctx.createGain(); fadeGain.gain.value = 0; fadeGain.connect(volGain);
      return ctx;
    }
    function load() {
      if (loading) return loading;
      state = 'loading';
      loading = (async () => {
        try {
          ensureCtx();
          const ab = await (o.load || loadArrayBuffer)(o.url);
          buffer = await ctx.decodeAudioData(ab);
          if (!buffer || !(buffer.duration > 0)) throw new Error('empty audio');
          return true;
        } catch (e) {
          warn(`[music] menu music unavailable (${o.url}): ${e && e.message}; menu runs silent`);
          state = 'silent'; buffer = null; return false;
        }
      })();
      return loading;
    }
    function startPass(at, fadeInSeam) {
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const g = ctx.createGain(); src.connect(g); g.connect(fadeGain);
      const xf = Math.min(o.crossfadeSec, buffer.duration / 2);
      if (fadeInSeam) g.gain.setValueCurveAtTime(CURVES.in, at, xf);   // equal-power 0→1 (v1.4.1)
      else g.gain.setValueAtTime(1, at);
      src.start(at, 0);
      const pass = { src, gain: g, startAt: at }; passes.push(pass);
      scheduleNext(pass);
    }
    function scheduleNext(pass) {
      const xf = Math.min(o.crossfadeSec, buffer.duration / 2);
      const seam = nextPassStart(pass.startAt, buffer.duration, o.crossfadeSec);
      const delayMs = Math.max(0, (seam - o.scheduleAheadSec - ctx.currentTime) * 1000);
      timer = setT(() => {
        timer = null; if (state !== 'playing' && state !== 'fadingOut') return;
        pass.gain.gain.setValueCurveAtTime(CURVES.out, seam, xf);        // equal-power 1→0 (v1.4.1)
        try { pass.src.stop(seam + xf + 0.05); } catch { /* already stopped */ }
        startPass(seam, true);
        setT(() => { passes = passes.filter((p) => p !== pass); }, (seam + xf + 0.1 - ctx.currentTime) * 1000);
      }, delayMs);
    }
    function hardStop() {
      if (timer) { clearT(timer); timer = null; }
      for (const p of passes) { try { p.src.stop(); } catch { /* ok */ } try { p.src.disconnect(); } catch { /* ok */ } }
      passes = [];
    }

    /** Root menu shown: start (or restart) with a fade-in from 0. Idempotent while playing. */
    async function play() {
      wantPlay = true;
      if (state === 'playing') return state;
      if (!(await load())) return state;
      if (!wantPlay) return state;
      if (ctx.state === 'suspended' && ctx.resume) { try { await ctx.resume(); } catch { /* autoplay */ } }
      if (stopTimer) { clearT(stopTimer); stopTimer = null; }
      hardStop();
      const now = ctx.currentTime;
      fadeGain.gain.cancelScheduledValues(now); fadeGain.gain.setValueAtTime(0, now); fadeGain.gain.linearRampToValueAtTime(1, now + o.fadeInSec);
      state = 'playing';
      startPass(now, false);
      return state;
    }
    /** Run start (Begin/Continue/Load): fade out over fadeOutSec, then stop. */
    function fadeOutAndStop() {
      wantPlay = false;
      if (state !== 'playing') { if (state === 'loading') state = 'stopped'; return; }
      const now = ctx.currentTime; const g = fadeGain.gain;
      const cur = typeof g.value === 'number' ? g.value : 1;
      g.cancelScheduledValues(now); g.setValueAtTime(cur, now); g.linearRampToValueAtTime(0, now + o.fadeOutSec);
      state = 'fadingOut';
      stopTimer = setT(() => { stopTimer = null; if (state === 'fadingOut') { hardStop(); state = 'stopped'; } }, o.fadeOutSec * 1000 + 50);
    }
    /** settings.audio changed: apply live (short ramp avoids zipper clicks). */
    function setAudio(a) {
      audio = { ...a };
      if (!volGain) return;
      const now = ctx.currentTime; const v = volumeFor(audio);
      volGain.gain.cancelScheduledValues(now); volGain.gain.setValueAtTime(volGain.gain.value, now); volGain.gain.linearRampToValueAtTime(v, now + 0.03);
    }
    function debug() {
      return { state, volume: volGain ? volumeFor(audio) : null, volumeGain: volGain ? volGain.gain.value : null,
        fadeGain: fadeGain ? fadeGain.gain.value : null, passes: passes.length, duration: buffer ? buffer.duration : null,
        ctxTime: ctx ? ctx.currentTime : null, ctxState: ctx ? ctx.state : null,
        passGains: passes.map((p) => (p.gain.gain.events ? p.gain.gain.events.slice() : null)) };
    }
    return { play, fadeOutAndStop, setAudio, debug, get state() { return state; }, config: o };
  }
  return { create, volumeFor, nextPassStart, equalPowerCurves, SEAM_POINTS, DEFAULTS };
});
