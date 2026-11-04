# Shooting-star overlay (for Flint)

Self-contained, no dependencies: `shooting-stars.js` (+ optional `shooting-stars.css`).
It adds ONE transparent full-screen `<canvas>` (`position:fixed; pointer-events:none`) and draws an
occasional meteor streak in the sky. The background stays the single swappable file
`assets/menu/background.png`; nothing is baked into it.

## Wire it into the Electron main-menu renderer
```html
<!-- menu.html (renderer) -->
<link rel="stylesheet" href="assets/menu/overlay/shooting-stars.css">
<script src="assets/menu/overlay/shooting-stars.js"></script>
<script>
  // Values below match night-bg-v2-skygaze.png (cat faces left). For v1 use exclude x0:0.66,y0:0.20,x1:0.98.
  const stars = ShootingStars.start({
    sky:     { x0: 0, y0: 0, x1: 1, y1: 0.46 },          // fractions of the window; streaks are clipped to it
    exclude: [{ x0: 0.62, y0: 0.17, x1: 0.97, y1: 1 }],  // keep streaks off the Smilodon (non-overlapping rects)
    minDelay: 2500, maxDelay: 7000,                      // ms between streaks
    zIndex: 1                                            // above the background, below the UI
  });
  // when leaving the menu screen:
  // stars.stop();
</script>
```
* Give menu UI elements `position:relative/absolute; z-index:2` (or higher) so they sit above the canvas.
  Streaks then pass *behind* the frosted-glass panels, which blur them (looks intended).
* With `contextIsolation` + a CSP, load it as a normal local `<script src>` (no inline eval is used).
  It also works as CommonJS: `const ShootingStars = require('./shooting-stars.js')` in a renderer bundle
  (it still needs `window`/`document`).
* If the background is drawn with `background-size:cover` and the window aspect is not 16:9, the sky box
  is in *window* fractions; keep `y1` conservative or recompute on resize via `stars.setOptions({sky, exclude})`.

## Options (all optional)
| key | default | meaning |
|---|---|---|
| `sky` | `{x0:0,y0:0,x1:1,y1:0.42}` | region where streaks start and are drawn |
| `exclude` | `[]` | rects hidden from streaks (e.g. the cat). Don't overlap them (even-odd clip) |
| `minDelay`/`maxDelay` | 2500/7000 ms | random gap between streaks |
| `burstChance` | 0.15 | chance of a second streak right after |
| `length`, `speed`, `angle`, `thickness` | `[140,300]` px, `[900,1500]` px/s, `[18,38]`°, `[1.2,2.2]` px | ranges |
| `direction` | `'random'` | `'left'`, `'right'` or `'random'` |
| `color` | `'232,240,255'` | rgb string |
| `glow` | `true` | soft head glow |
| `respectReducedMotion` | `true` | no streaks when the OS asks for reduced motion (checked live) |
| `maxDpr` | 2 | caps devicePixelRatio to bound fill cost |

API: `start(opts)` → `{ canvas, fire(), setOptions(opts), stop() }`.

## Performance
The rAF loop only runs while a streak is alive (~0.3–0.6 s); between streaks it sleeps on a timer, so the
GPU/CPU cost at idle is ~0. Spawning pauses while the window is hidden (`document.hidden`).

## Reduced motion
Honours `prefers-reduced-motion: reduce` (Windows: Settings › Accessibility › Visual effects › Animation
effects = Off). Electron reports it automatically. The CSS file also hides the canvas in that mode.
Tested in headless Chrome: zero pixels drawn with reduced motion emulated; streaks drawn otherwise.

## Preview
`../preview/shooting-stars-preview-v2.mp4` / `.gif` (10 s, faster-than-default timing `min=700,max=1900`
so several streaks show). Re-record: `cd ../work && node record.js 2 frames_v2 300` then ffmpeg (see
`../README.md`).
