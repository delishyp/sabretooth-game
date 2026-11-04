/*!
 * shooting-stars.js — drop-in shooting-star overlay for the Sabretooth main menu.
 * No dependencies. Draws on one transparent full-screen <canvas> (pointer-events:none).
 *
 *   const stars = ShootingStars.start({ sky: { x0: 0, y0: 0, x1: 1, y1: 0.42 } });
 *   stars.stop();          // remove canvas + listeners
 *
 * CPU notes: the loop only runs while a streak is alive; between streaks it sleeps
 * on setTimeout (0 frames drawn). Pauses when the window is hidden.
 */
(function (root) {
  'use strict';
  var DEFAULTS = {
    // Sky region as fractions of the viewport (0..1). Streaks START inside this box
    // and are clipped to it, so they never cross the UI/ridge below.
    sky: { x0: 0.0, y0: 0.0, x1: 1.0, y1: 0.42 },
    // Optional rectangles (same 0..1 units) where streaks are hidden, e.g. over the cat.
    exclude: [],
    minDelay: 2500,          // ms between streaks (random in [minDelay, maxDelay])
    maxDelay: 7000,
    burstChance: 0.15,       // chance a second streak follows shortly after
    length: [140, 300],      // streak tail length in CSS px
    speed: [900, 1500],      // px per second
    angle: [18, 38],         // degrees below horizontal
    direction: 'random',     // 'left' | 'right' | 'random'  (travel direction)
    thickness: [1.2, 2.2],   // head width in CSS px
    color: '232,240,255',    // r,g,b of the streak
    glow: true,              // soft glow on the head
    zIndex: 1,               // put the canvas between background and UI
    parent: null,            // element to attach to (default document.body)
    respectReducedMotion: true,
    maxDpr: 2                // cap devicePixelRatio for cost
  };
  function rnd(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i] || {}; for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; }

  function start(userOpts) {
    var o = assign({}, DEFAULTS, userOpts || {});
    o.sky = assign({}, DEFAULTS.sky, (userOpts && userOpts.sky) || {});
    var mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;

    var canvas = document.createElement('canvas');
    canvas.className = 'shooting-stars-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:' + o.zIndex + ';';
    (o.parent || document.body).appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var streaks = [], raf = 0, timer = 0, last = 0, stopped = false;

    function resize() {
      dpr = Math.min(root.devicePixelRatio || 1, o.maxDpr);
      W = root.innerWidth; H = root.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function reduced() { return o.respectReducedMotion && mq && mq.matches; }

    function spawn() {
      var s = o.sky, x0 = s.x0 * W, x1 = s.x1 * W, y0 = s.y0 * H, y1 = s.y1 * H;
      var dir = o.direction === 'random' ? (Math.random() < 0.5 ? -1 : 1) : (o.direction === 'left' ? -1 : 1);
      var a = rnd(o.angle) * Math.PI / 180;
      var len = rnd(o.length), spd = rnd(o.speed);
      // start in upper 70% of the sky box so the streak has room to travel
      var sx = x0 + Math.random() * (x1 - x0), sy = y0 + Math.random() * (y1 - y0) * 0.7;
      var travel = len * 1.6 + Math.random() * len;
      streaks.push({ x: sx, y: sy, vx: Math.cos(a) * spd * dir, vy: Math.sin(a) * spd,
        len: len, w: rnd(o.thickness), t: 0, life: travel / spd });
    }

    function draw(now) {
      raf = 0;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      ctx.clearRect(0, 0, W, H);
      var s = o.sky;
      ctx.save();
      ctx.beginPath(); ctx.rect(s.x0 * W, s.y0 * H, (s.x1 - s.x0) * W, (s.y1 - s.y0) * H);
      for (var e = 0; e < o.exclude.length; e++) { var r0 = o.exclude[e]; ctx.rect(r0.x0 * W, r0.y0 * H, (r0.x1 - r0.x0) * W, (r0.y1 - r0.y0) * H); }
      ctx.clip('evenodd');
      for (var i = streaks.length - 1; i >= 0; i--) {
        var k = streaks[i]; k.t += dt;
        var p = k.t / k.life;
        if (p >= 1) { streaks.splice(i, 1); continue; }
        var hx = k.x + k.vx * k.t, hy = k.y + k.vy * k.t;
        var sp = Math.hypot(k.vx, k.vy), ux = k.vx / sp, uy = k.vy / sp;
        var tl = k.len * Math.min(1, p * 3);            // tail grows in
        var fade = p < 0.15 ? p / 0.15 : (p > 0.6 ? (1 - p) / 0.4 : 1); // fade in/out
        var tx = hx - ux * tl, ty = hy - uy * tl;
        var g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'rgba(' + o.color + ',0)');
        g.addColorStop(1, 'rgba(' + o.color + ',' + (0.9 * fade) + ')');
        ctx.strokeStyle = g; ctx.lineWidth = k.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        if (o.glow) {
          var r = k.w * 4;
          var rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
          rg.addColorStop(0, 'rgba(255,255,255,' + (0.85 * fade) + ')');
          rg.addColorStop(1, 'rgba(' + o.color + ',0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.2832); ctx.fill();
        }
      }
      ctx.restore();
      if (streaks.length && !stopped) raf = root.requestAnimationFrame(draw);
    }

    function kick() { if (!raf && !stopped) { last = performance.now(); raf = root.requestAnimationFrame(draw); } }
    function schedule() {
      clearTimeout(timer);
      if (stopped) return;
      timer = setTimeout(function () {
        if (!document.hidden && !reduced()) {
          spawn();
          if (Math.random() < o.burstChance) setTimeout(function () { if (!stopped && !reduced()) { spawn(); kick(); } }, 250 + Math.random() * 600);
          kick();
        }
        schedule();
      }, o.minDelay + Math.random() * (o.maxDelay - o.minDelay));
    }
    function onMotion() { if (reduced()) { streaks.length = 0; ctx.clearRect(0, 0, W, H); } }

    resize();
    root.addEventListener('resize', resize);
    if (mq) (mq.addEventListener ? mq.addEventListener('change', onMotion) : mq.addListener(onMotion));
    schedule();

    return {
      canvas: canvas,
      fire: function () { if (!reduced()) { spawn(); kick(); } }, // trigger one streak now (testing)
      setOptions: function (n) { assign(o, n || {}); if (n && n.sky) o.sky = assign({}, o.sky, n.sky); },
      stop: function () {
        stopped = true; clearTimeout(timer); if (raf) cancelAnimationFrame(raf);
        root.removeEventListener('resize', resize);
        if (mq) (mq.removeEventListener ? mq.removeEventListener('change', onMotion) : mq.removeListener(onMotion));
        canvas.remove();
      }
    };
  }
  var api = { start: start, defaults: DEFAULTS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ShootingStars = api;
})(typeof window !== 'undefined' ? window : this);
