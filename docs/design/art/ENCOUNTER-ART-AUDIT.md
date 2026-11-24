# Encounter and speaker art audit (ac2665d, read-only)

Ochre, for Flint. Source: temp worktree of `ac2665d` (removed after). No repo changes.
Names come from a seeded run, so a name→image link only holds for one seed. I started real runs on ac2665d
(Electron, `setGameSeed(8)`, the seed every proof shot uses) and read `state.npcs`: dump in `scripts/npc-dump.json`
(script `scripts/dump-npcs.js`). `npc-portrait-defaults.json` has not changed since `54ffedf`, so c03a622 and later use the same map.

## A. Named cats used in the mockups (seed 8)

| Mockup use | NPC id in source | Image it maps to in source | What the mockup used before | Correct image | Match before? |
|---|---|---|---|---|---|
| Sleetbark, dialogue speaker + spar foe | `hc07` (`src/renderer/data/npc-portrait-defaults.json:48`) | `assets/portraits/cats/cat-7c5ab14d9e51320a.png` | `cat-eec858c7a583cdc6.png` (Briarlight `hc06` :41, Alderstep `bf04` :109, Swiftbark `mw05` :191) | `cat-7c5ab14d9e51320a.png` | **No, fixed** |
| Galestride, den member | `bf01` (:87) | `cat-e67924de1f224fd0.png` | `cat-46f04e1c79d4e443.png` | `cat-e67924de1f224fd0.png` | **No, fixed** |
| Summercloud, den member | `mw04` (:184) | `cat-f70f52f0f22da7fc.png` | `cat-7c5ab14d9e51320a.png` (that is Sleetbark's) | `cat-f70f52f0f22da7fc.png` | **No, fixed** |
| Little Reed (illustrative cub, not an NPC id) | none | none (no cub art exists; source uses adult art for cub slots) | `cat-4a74e453bae483ad.png` | adult stand-in `cat-4a74e453bae483ad.png` | n/a, stand-in |
| Player Ravenmark: ledge, avatar, encounter, creator | player `portraitId` (default `PLAYER_STILL`, `src/renderer/js/game-screen.js:47`) | `cat-6e2d788dd48ff440.png` | same file, but the den ledge sprite was a broken cut-out (front half only) | `cat-6e2d788dd48ff440.png` whole | **Ledge no, fixed**; others yes |

The name "Sleetbark" itself: `src/renderer/data/names/names.json:363`; quest copy pins it to the same slot: `src/renderer/data/quests/quests-mockup-copy.json:67-68` (`"asker": "Sleetbark", "slot": "hc07"`).

## B. Encounter screens in source: what each foe draws

| Encounter / foe id in source | Image it currently maps to | Correct image | Match |
|---|---|---|---|
| `encounter.giant_deer.v1` (`src/renderer/data/events/encounters-v0.2.json:105-108`, used `src/renderer/js/encounter.js:185-186`) | `assets/encounters/giant-deer.png` via `encounterPanels` (`game-screen.js:49-56`, drawn :965-973) | `giant-deer.png` | yes |
| `encounter.wolf_pack.v1` (`encounters-v0.2.json:221-224`, `encounter.js:195-198`) | `assets/encounters/old-pack-enemy.png` | `old-pack-enemy.png` | yes |
| `encounter.cave_hyena.v1` (`encounters-v0.2.json:311-314`, `encounter.js:211-214`) | `assets/encounters/cave-hyena.png` | `cave-hyena.png` | yes |
| Screen kind `hyena` (`src/renderer/js/encounter-screen.js:78-85`) | `encounters/cave-hyena.png` (hard-coded :85) | `cave-hyena.png` | yes |
| Screen kind `fight` / `spar` against a cat (`encounter-screen.js:65-73`) | `row.art`, else **`encounters/giant-deer.png`** (:73). No path from the foe cat's id to its portrait | the foe cat's `portraitId`: `assets/portraits/cats/<npc.portraitId>.png` (Sleetbark → `cat-7c5ab14d9e51320a.png`) | **No**: a cat fight with no `art` shows a deer |
| Screen kind `courtship` (`encounter-screen.js:142`) | `row.art`, else `null` (empty panel) | the partner's `portraitId` still | **No** when `art` is missing |
| Screen kind `hunt` (`encounter-screen.js:116`) | `row.art`, else `giant-deer.png` for every prey | the prey's own art; only giant deer art exists | partial (right for deer only) |
| Screen kind `human` (`encounter-screen.js:97`) | `null` (empty foe panel); no human art in `assets/encounters/` | none exists | n/a, flag |
| Player panel in both renderers (`game-screen.js:54`, `:1139`) | `assets/portraits/cats/<s.cat.portraitId>.png`, else `cat-6e2d788dd48ff440` | same | yes |
| Fight HP bar foe name (`game-screen.js:1155`) | `s.pending.foeName || view.kind` | the foe cat's name | **No** when `foeName` is unset: label falls back to "fight" |

Nothing in runtime source sets `screenKind` yet (`game-screen.js:1177` reads it; only the shot script writes it), so rows 5–8 show only in shots today, but they will show wrong art the day they go live.

## C. Shot script that produced the wrong pairing

| Where | Current | Correct | Match |
|---|---|---|---|
| `scripts/ui-groups-shot.js:81` `foeName` | `'Hyena'` for fight, hunt and courtship | the foe cat's name (for the seed-8 shot: `'Sleetbark'`) | **No** |
| `scripts/ui-groups-shot.js:82` fight `art` | `portraits/cats/cat-eec858c7a583cdc6.png` (Briarlight hc06 / Alderstep bf04 / Swiftbark mw05) | `portraits/cats/cat-7c5ab14d9e51320a.png` if the foe is Sleetbark (hc07) | **No** |
| `scripts/ui-groups-shot.js:82` courtship `art` | `portraits/cats/cat-46f04e1c79d4e443.png` (hc02, hc08, mw02, mw08, ln01, ln09) | the partner's `portraitId` | unpinned (no partner named) |

My earlier BEFORE still (`before/encounter-*.png`) used the same injection, so it shows a cat labelled "Hyena" with eec858 art. That is the shot's bug, not live data.

## D. Other mapping oddities for Flint

- `npc-portrait-defaults.json:3` has a stray top-level `"ln05": "cat-6e2d788dd48ff440"` beside `assignments.ln05` (:268). Sunstep (ln05) uses the same image as the default player (`PLAYER_STILL`), so a fresh player and Sunstep look identical.
- `test/e2e/cats-list-layout.e2e.js:12` expects `hc01` → `cat-46f04e1c79d4e443`, but the defaults map `hc01` → `cat-3f9fb78fb1697a76` (:5-6).
- Suggested fix (not made): give `fight`/`spar`/`courtship` screens a `catId` and resolve `art` from `npc.portraitId` in `encounter-screen.js:73/142`, with no deer fallback for cats; set `foeName` from `npc.name`.

## E. Mockup after the fix

- `encounter.html` foe panel: `portraits/sleetbark-fullbody.png` = byte copy of `cat-7c5ab14d9e51320a.png`, mirrored by CSS so it faces the player (the game flips animal foes, `encounter-screen.js:74`).
- `dialogue*.html` speaker: `portraits/sleetbark-head.png`, canonical crop of the same still (see HEADSHOT-CROPS.md).
