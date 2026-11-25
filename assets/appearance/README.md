# Appearance assets (immutable master set)

Development-only artwork for the modular PNG preview. These files are **not** the creator portraits in `assets/portraits/` and they are **not** packaged with the game.

Imported byte-for-byte from the authoritative master set. Do not recompress, re-export, resize, crop, or paint on them. `ASSET-LOCK.json` is the checksum record; `test/appearance-render.test.js` fails if any listed byte changes. The preview also refuses to draw a locked PNG whose SHA-256 does not match.

| File | Bytes | SHA-256 | Native |
| --- | --- | --- | --- |
| `master/master.png` | 1274763 | `5de0cfdeb68d99820b139680ff27566695cf1bae6a709f0751e771a8372da76b` | 1448×1086 RGBA (color type 6, 8-bit) |
| `master/body-mask.png` | 31757 | `729219293bf8fb38a18d2ac32e9c85095ffdea869557a23474d9ec8c4a4d260a` | 1448×1086 grayscale L (color type 0, 8-bit) |
| `master/eye-nose-mask.png` | 2420 | `86a31245b5512e5fd3ce8b840b0824fbeb7bda1e995adc81748195ebe30921ba` | 1448×1086 grayscale L (color type 0, 8-bit) |
| `validation-metadata.json` | 11476 | `47e216d5380b94d8f096ec85e0eb9d10ffddf5b1cd3d4918bc16cc59f554472f` | validation record only; the renderer does not read it |

`registry.json` is renderer configuration (not part of the locked paint). It is the only place a new same-canvas PNG is registered.

## What the pixels mean

- **Master** is finished artwork. Eye and nose holes are already transparent, including the soft fringe. The default preview draws this buffer and nothing else.
- **Body mask** is mode L. Its luminance is byte-identical to the master alpha, soft fringe included. A mode-L PNG decodes with opaque alpha, so coverage is the luminance channel, not alpha. It includes teeth and claws. It is **not** a fur-only tint mask and the compositor does **not** apply it (doing so would recolor teeth and claws and double-multiply the fringe).
- **Eye/nose mask** is mode L and marks the transparent cutouts (three soft components). It is complementary to the body at a hard threshold. Eye and nose artwork, when some exists, is confined with this luminance and drawn **behind** the coat so body coverage cannot erase the holes.

No eyes, noses, coats, or patterns are invented here. Registered choices today: coat `master`, pattern `none`. Eyes and nose have no artwork and stay unavailable.

## Adding a same-canvas PNG later

Put the file under `assets/appearance/` (for example `coats/some-name.png`) and add an option to `registry.json`. It must be exactly 1448×1086; any other size is rejected and is not scaled. No renderer change.

```json
{ "id": "some-name", "label": "Some name", "file": "coats/some-name.png", "available": true }
```

A pattern is a full-canvas PNG with its own alpha, drawn above the coat. An eye or nose file is a full-canvas PNG drawn behind the coat and multiplied by the eye/nose luminance. Paths stay relative to this directory (no `..`, no absolute paths). To offer "nothing" for a slot that has real options, register an explicit option with `"file": null` the way pattern `none` does. An empty `options` array stays honestly unavailable.

Preview: `npm run appearance-preview` (add `--screenshot` to write `screenshots/appearance-preview.png`).
