# Portrait layers — PLACEHOLDERS

**Everything in `portrait-male/` and `portrait-female/` is a PLACEHOLDER** made by Flint with
`scripts/gen-placeholder-portraits.py` from the approved base JPGs (each `manifest.json` has `"placeholder": true`).
Ochre's real art overwrites these files at the same paths; no code change is needed.

Contract (per pose folder `assets/portraits/<pose>/`, pose = `portrait-male` | `portrait-female`; later `portrait-<sex>-cub` / `-adolescent`, same contract):
- Every layer is a 1152×864 RGBA PNG on the same canvas as the base, pixel-aligned with `lineart.png` (no offsets, no trimming).
- Gene layers: alpha = mask, grayscale = shading (white = full gene colour). The compositor tints to geneColor × shading.
- Files, bottom → top: `shadow.png` (blend multiply; gray = darkening), `base_coat.png`, `markings_spotted.png`, `markings_faintstripe.png`,
  `eye_left.png`, `eye_right.png`, `sabers.png`, then `lineart.png` (drawn as-is, transparent background).
- Optional later: `white_*.png`, `markings_dorsal.png`, `scar_*.png`, `age_elder.png` — list them in the manifest and they draw in stack order.
- `manifest.json`: `{ pose, size:[w,h], placeholder, lineart, layers:[{id, file, blend, tintFrom}] }`. `blend` ∈ normal | multiply | screen (default normal).
  Remove `placeholder` (or set false) when real art lands.

Known placeholder flaws: markings are random spots / broad diagonal bands, not anatomical; `eye_right` is empty (far eye hidden in the 3/4 view);
sabers are hand-placed polygons; lineart is a dark-pixel threshold of the JPG, so it is slightly soft.
