// Menu music (spec v1.3.2 §7, v1.4.1 equal-power seam): loop/crossfade math, volume × mute, fade-out on run start, missing-file path.
const test = require('node:test');
const assert = require('node:assert');
const Music = require('../src/renderer/js/music');
const cfg = require('../src/renderer/data/menu-music.json');

function fakeCtx() {
  const ctx = { currentTime: 0, state: 'running', destination: {}, sources: [], log: [] };
  const param = (v) => ({ value: v, events: [],
    setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t) { this.events.push(['ramp', x, t]); this.value = x; },
    setValueCurveAtTime(c, t, d) { this.events.push(['curve', Array.from(c), t, d]); this.value = c[c.length - 1]; },
    cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  ctx.createGain = () => ({ gain: param(1), connect() {}, disconnect() {} });
  ctx.createBufferSource = () => { const s = { connect() {}, disconnect() {}, started: null, stopped: null,
    start(at, off) { s.started = [at, off]; }, stop(at) { s.stopped = at ?? ctx.currentTime; } }; ctx.sources.push(s); return s; };
  ctx.decodeAudioData = async (ab) => { if (ab.bad) throw new Error('decode error'); return { duration: ab.duration }; };
  return ctx;
}
function fakeTimers() {
  const q = []; return { q, setTimeout: (f, ms) => { const h = { f, ms }; q.push(h); return h; }, clearTimeout: (h) => { const i = q.indexOf(h); if (i >= 0) q.splice(i, 1); },
    runNext() { const h = q.shift(); h.f(); return h; } };
}
function make({ duration = 211.2, load, audio = { master: 0.8, music: 0.7, mute: false } } = {}) {
  const ctx = fakeCtx(); const tm = fakeTimers(); const warns = [];
  const m = Music.create({ createContext: () => ctx, load: load || (async () => ({ duration })), setTimeout: tm.setTimeout, clearTimeout: tm.clearTimeout, warn: (w) => warns.push(w) });
  m.setAudio(audio);
  return { m, ctx, tm, warns };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('config matches spec §7 (1.0s trim, 3.0s crossfade, 1.5s in, 1.0s out)', () => {
  assert.strictEqual(cfg.trimStartSec, 1.0); assert.strictEqual(cfg.crossfadeSec, Music.DEFAULTS.crossfadeSec);
  assert.strictEqual(Music.DEFAULTS.crossfadeSec, 3.0); assert.strictEqual(Music.DEFAULTS.fadeInSec, 1.5); assert.strictEqual(Music.DEFAULTS.fadeOutSec, 1.0);
  assert.ok(Music.DEFAULTS.url.endsWith(cfg.file.split('/').pop()));
});
test('nextPassStart: next pass begins crossfade seconds before the end', () => {
  near(Music.nextPassStart(0, 211.2, 2), 209.2);
  near(Music.nextPassStart(10, 211.2, 2), 219.2);
  near(Music.nextPassStart(0, 3, 2), 1.5);            // crossfade clamped to half a short buffer
});
test('equal-power seam curves: cos out / sin in, endpoints exact, out² + in² = 1 (no mid-seam dip)', () => {
  const c = Music.equalPowerCurves(); const n = Music.SEAM_POINTS;
  assert.strictEqual(c.out.length, n); assert.strictEqual(c.in.length, n);
  assert.deepStrictEqual([c.out[0], c.out[n - 1], c.in[0], c.in[n - 1]], [1, 0, 0, 1]);
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(c.out[i] ** 2 + c.in[i] ** 2 - 1) < 1e-6, `power at ${i}`);
    if (i) assert.ok(c.out[i] <= c.out[i - 1] && c.in[i] >= c.in[i - 1], 'monotonic');
  }
  const mid = Music.equalPowerCurves(3); assert.ok(Math.abs(mid.out[1] - Math.SQRT1_2) < 1e-6 && Math.abs(mid.in[1] - Math.SQRT1_2) < 1e-6);   // −3 dB each at the middle
});
test('volumeFor: master × music, mute → 0, clamps', () => {
  near(Music.volumeFor({ master: 0.8, music: 0.7 }), 0.56);
  assert.strictEqual(Music.volumeFor({ master: 0.8, music: 0.7, mute: true }), 0);
  assert.strictEqual(Music.volumeFor({ master: 2, music: -1 }), 0);
  assert.strictEqual(Music.volumeFor({ master: 1, music: 1 }), 1);
});
test('play: fades in from 0 over 1.5s and schedules the seamless next pass', async () => {
  const { m, ctx, tm } = make(); ctx.currentTime = 5;
  assert.strictEqual(await m.play(), 'playing');
  const d = m.debug(); assert.strictEqual(d.passes, 1); near(d.volumeGain, 0.56);
  assert.deepStrictEqual(ctx.sources[0].started, [5, 0]);
  near(tm.q[0].ms, (5 + 208.2 - 4 - 5) * 1000);     // timer fires 4s ahead of the seam (3.0s crossfade)
  ctx.currentTime = 210.5; tm.runNext();
  assert.strictEqual(ctx.sources.length, 2);
  near(ctx.sources[1].started[0], 213.2);            // sample-accurate start on the ctx clock, no gap
  near(ctx.sources[0].stopped, 216.25);              // outgoing pass stops after its fade
  // v1.4.1: the seam uses equal-power curves over exactly 3.0s on both passes, no linear ramps on pass gains
  const outEv = m.debug().passGains[0].filter((e) => e[0] === 'curve'); const inEv = m.debug().passGains[1].filter((e) => e[0] === 'curve');
  assert.strictEqual(outEv.length, 1); assert.strictEqual(inEv.length, 1);
  near(outEv[0][2], 213.2); near(outEv[0][3], 3.0); near(inEv[0][2], 213.2); near(inEv[0][3], 3.0);
  assert.deepStrictEqual(outEv[0][1], Array.from(Music.equalPowerCurves().out)); assert.deepStrictEqual(inEv[0][1], Array.from(Music.equalPowerCurves().in));
  assert.ok(m.debug().passGains.flat().every((e) => e[0] !== 'ramp'), 'seam has no linear ramps');
  assert.strictEqual(await m.play(), 'playing'); assert.strictEqual(ctx.sources.length, 2);   // idempotent
});
test('mute keeps playing silently (position kept); unmute restores volume without restarting', async () => {
  const { m, ctx } = make(); await m.play();
  m.setAudio({ master: 0.8, music: 0.7, mute: true }); assert.strictEqual(m.debug().volumeGain, 0);
  assert.strictEqual(m.state, 'playing'); assert.strictEqual(ctx.sources[0].stopped, null);
  m.setAudio({ master: 0.8, music: 0.7, mute: false }); near(m.debug().volumeGain, 0.56);
  assert.strictEqual(ctx.sources.length, 1);
  m.setAudio({ master: 0.5, music: 0.5, mute: false }); near(m.debug().volumeGain, 0.25);
});
test('launch while muted: plays at gain 0, unmute is audible from current position', async () => {
  const { m, ctx } = make({ audio: { master: 1, music: 1, mute: true } });
  assert.strictEqual(await m.play(), 'playing'); assert.strictEqual(m.debug().volumeGain, 0);
  m.setAudio({ master: 1, music: 1, mute: false }); assert.strictEqual(m.debug().volumeGain, 1); assert.strictEqual(ctx.sources.length, 1);
});
test('run start: fades out over 1.0s then stops; back to menu fades in again', async () => {
  const { m, ctx, tm } = make(); await m.play(); ctx.currentTime = 30;
  m.fadeOutAndStop(); assert.strictEqual(m.state, 'fadingOut');
  const fade = m.debug(); assert.strictEqual(fade.fadeGain, 0);
  const stopH = tm.q.find((h) => h.ms === 1050); assert.ok(stopH, 'stop after 1.0s fade');
  tm.q.splice(tm.q.indexOf(stopH), 1); stopH.f();
  assert.strictEqual(m.state, 'stopped'); assert.strictEqual(m.debug().passes, 0); assert.notStrictEqual(ctx.sources[0].stopped, null);
  ctx.currentTime = 40; assert.strictEqual(await m.play(), 'playing');
  assert.strictEqual(ctx.sources.length, 2); assert.deepStrictEqual(ctx.sources[1].started, [40, 0]);
});
test('missing file: warns, goes silent, never throws; later calls are no-ops', async () => {
  const { m, warns } = make({ load: async () => { throw new Error('HTTP 404'); } });
  assert.strictEqual(await m.play(), 'silent'); assert.strictEqual(warns.length, 1); assert.match(warns[0], /404/);
  m.setAudio({ master: 1, music: 1 }); m.fadeOutAndStop(); assert.strictEqual(await m.play(), 'silent'); assert.strictEqual(warns.length, 1);
});
test('undecodable file: warns and goes silent', async () => {
  const { m, warns } = make({ load: async () => ({ bad: true }) });
  assert.strictEqual(await m.play(), 'silent'); assert.match(warns[0], /decode/);
});

test('M2: original mp3 lives in audio-src/, is excluded from the build, and no mp3 ships under assets/', () => {
  const fs = require('fs'); const path = require('path'); const root = path.join(__dirname, '..');
  const pkg = require('../package.json');
  assert.ok(pkg.build.files.includes('!audio-src/**'));
  assert.strictEqual(cfg.source, 'audio-src/earthbound-pulse-original.mp3');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  assert.deepStrictEqual(walk(path.join(root, 'assets', 'audio')).filter((f) => f.endsWith('.mp3')), []);
});
