# Canonical head-and-shoulders crop (Ochre, ac2665d)

**One box fits every base and all 40 illustrated stills**, because they share one pose on a 4:3 canvas.
Square in pixels. It covers both ears, eyes, full sabers and chin, and the chest and shoulders down to just above the elbows (the top of the forelegs). It never cuts eyes or sabers.
Data: `headshot-crops.json`. Contact sheet: `share/headshot-crops.jpg` (each base with its box drawn, the resulting headshot, then all 40 stills cropped). Script: `scripts/headshots.py` (crop only, no resampling of kept pixels, no recolour).

| Normalised (fraction of full canvas) | x | y | w | h |
|---|---|---|---|---|
| all bases, all ages | 0.5856 | 0.0 | 0.4144 | 0.5525 |

| Base | Canvas | Box in native px (x, y, w, h) |
|---|---|---|
| Female historical base `1cffd694c43c…jpg` | 1152×864 | 675, 0, 477, 477 |
| Male historical base `617660c40258…jpg` | 1152×864 | 675, 0, 477, 477 |
| Layered composite, female (`assets/portraits/portrait-female/manifest.json` `size`) | 1152×864 | 675, 0, 477, 477 |
| Layered composite, male (`assets/portraits/portrait-male/manifest.json` `size`) | 1152×864 | 675, 0, 477, 477 |
| Illustrated stills `assets/portraits/cats/cat-*.png` (what the game shows now) | 1448×1086 | 848, 0, 600, 600 |

Use: `sx = round(x*W)`, `sy = round(y*H)`, `sw = round(w*W)`, `sh = round(h*H)`. That is the same maths as `sourceRect` in `src/renderer/js/portrait-view.js:171-178`, so this box can replace `staticHead`/`defaultHead` in `assets/portraits/registry.json` as is.

## Notes
- **Base files.** Director's store isn't mounted for me (`/cursor/stores/` has only `user`). I used byte-identical copies from `/workspace/sabretooth-art-reference/archive/historical-portraits/`, `1cffd694c43c_1cffd694…cacbdb.jpg` (female) and `617660c40258_617660c4…233ffc.jpg` (male). Their sha256 matches the file names.
- **Age variants: none.** ac2665d has no cub, adolescent or elder art. `npc-portrait-defaults.json` flags cub slots "adult image used for cub slot". The JSON lists cub, adolescent and elder as "use adult". If age art arrives at another scale, it needs its own box.
- **Illustrated NPC portraits:** one box works for all 40. No per-image boxes are needed (`perImageBoxes: []`). Two limits are in the source art, not the box:
  - **Small top margin.** The ears sit 11–36 px below the canvas top, so the top margin is small on every still.
  - **Nose at the canvas edge.** On 26 stills the nose tip touches the right edge of the canvas, so no box can add space in front of the nose; the UI frame pads around it instead. The 26 are:
    - 07a1fa78, 1e34c484, 3315fea2, 3c3c02a1, 3f9fb78f, 44c73696, 4cd271c4
    - 4f7ea033, 59d2b829, 5b118d80, 605f7d89, 6477d015, 6e2d788d, 702c446a
    - 7c5ab14d, 88528d46, 96beb461, ab15b6f4, e7454119, ee0fe001, eec858c7
    - f5e6e4ae, f70f52f0, f865fbd2, ff103676, ff92bf3c
  - **Background.** ee0fe001 and f5e6e4ae are RGB on a white ground, not transparent. The box still fits; they just show a white backdrop.
- **The game's current box vs this one.** The game's `staticHead` (0.57, 0, 0.43, 0.42), used by all 40 entries in `registry.json`, is 1.37:1 landscape. It keeps the sabers, but the ears touch the top and it stops at the throat. The box above is square and reaches the shoulders.
