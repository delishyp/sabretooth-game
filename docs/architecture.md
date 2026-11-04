# Architecture (main menu, built against main-menu-spec v1.3)

- **Main process** (`src/main/main.js`): window (min 1280x720), IPC per spec §5, all file I/O. Logs: `<userData>/logs/menu.log`, which also receives
  renderer warnings/errors (M1: `js/log.js` wraps `console.warn`/`console.error` and catches uncaught errors/rejections → preload `log(level, text)` → `ipcMain.on('log:renderer')`).
  - `settings-store.js`: pure Node; spec defaults (`storyteller.mode = "offline"`, shown as Classic); corrupt file → `settings.bad.json` + reset + toast. No difficulty setting.
  - `saves-store.js`: pure Node. 2 run slots × 3 saves.
    - `saves/run-<slotIndex>/run.json` = RunRecord `{runId, slotIndex, catName, prideName, style (story|standard|sim; missing → standard), difficulty (Death rule), sandboxOptions|null, storytellerMode, generation, createdAt, lastPlayedAt, gameVersion}`.
    - `saves/run-<slotIndex>/save-<saveIndex>/meta.json` = SaveRecord `{saveId, runId, saveIndex, writtenAt, inGameDate{year,season,day}, playTimeSec, saveVersion, mainCat}`.
    - `mainCat` (optional, spec v1.3 §1/§5): `{catId, name, sex, lifeStage, genes, scars[]}` snapshot of the cat being played when the save was written (in Heir mode the current heir, not the founder). `null` until gameplay writes it; `normalizeMainCat()` keeps only these fields.
    - `list()` also returns `continueTarget: {runId, saveId} | null` = newest valid save in a valid run (what Continue loads; the menu cat will read its `mainCat`).
    - `list()` → `{runs:[run|null, run|null]}`, saves newest first; unreadable records → `damaged: true` (deletable, not loadable).
    - `createRun()` uses first free slot or `replaceRunId` (deletes old run only at that point); throws `SaveCapError` if both full. Optional `playerCat` (creator) is stored on the run record.
    - `writeSave()` takes the first free index; throws `SaveCapError` at 3 unless `overwriteSaveIndex` (future in-game overwrite prompt).
    - Difficulty / sandboxOptions locked: no API changes them after `createRun`. Sandbox runs are tagged by `difficulty: "sandbox"`.
- **Preload** (`preload.js`) → `window.sabretooth`: `menu.newGame({style, difficulty, replaceRunId, sandboxOptions})`, `menu.loadSave`, `menu.deleteSave`, `menu.deleteRun`, `menu.newLineage`, `game.legacyEnd`, `saves.list`, `settings.get/set/reset`, `storyteller.check`, `copy.get`, `app.info/quit`, `onToast`, `onLegacyEnd`. contextIsolation on, nodeIntegration off, sandbox on.
- **Renderer**: plain HTML/CSS/JS. `menu.js` = spec state machine (root, difficulty + Sandbox panel, slotsFull → replaceConfirm, load / loadRunExpanded with delete confirms, settings, credits, legacy, starting/loading placeholders). `input.js` maps keyboard/mouse/Gamepad to actions (LB/RB = Settings tabs, or cycle Sandbox toggle values).
- **IPC**: `menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?}` (creates the run record; gameplay placeholder), `menu:loadSave {runId, saveId}`, `menu:deleteSave {runId, saveId}`, `menu:deleteRun {runId}`, `saves:list`, `settings:get`, `settings:set {patch}`, `storyteller:check {mode}`, `app:quit`; Legacy hook `game:legacyEnd {runId}` (main → renderer `legacyEnd` → Legacy placeholder) → `menu:newLineage {runId}` (placeholder). Extras: `settings:reset`, `copy:get`, `app:info`. Main → renderer: `toast {text}`.
- **Audio**: no menu music (spec §6.6); audio settings stored only.
- **Art drop-in**: `js/assets.js` probes `assets/menu/background.{png,jpg,webp}` and `logo.png`; missing → gradient / text. Palette in `styles/theme.css`.
- **Copy**: `scripts/sync-copy.js` (`parseCopy`) merges + validates the JSON blocks of `docs/main-menu-copy.md` into `src/renderer/data/menu-copy.json`.

## v0.1 QA fixes (Tracker B1–B12)
- `src/renderer/js/nav.js` (pure, UMD): difficulty screen model — **focus never selects**; Enter/Space/A/click selects; Sandbox panel exists only while Sandbox is selected. Also `createGamepadReader` (XInput mapping, 0.4 deadzone, 400/150ms repeat) and `KEYMAP`. Unit-tested in `test/nav.test.js`.
- `src/renderer/js/i18n.js`: `t(id, vars)` over Saga's §5 strings + marked `[PH]` placeholders. `test/strings.test.js` checks every id used exists.
- `src/main/menu-handlers.js`: newGame (records the effective storyteller after fallback; raw errors → log, renderer gets `toast.startFailed`), loadSave (refuses damaged runs/saves).
- Settings: renderer stages edits to main (`settings:stage`) so closing the window flushes them; window mode fullscreen/windowed applied live (borderless deferred); uiScale applied live; store validates types/enums/ranges.
- `test/e2e/menu.e2e.js` (`npm run test:e2e`): real-app keyboard smoke via playwright-core.

## v1.3 New Game setup
- State `newGameSetup` replaces `difficulty`. One screen: Style row (copy `playStyles`, title `newGame.styleRow`), Death rule row (copy `difficulties`, title `newGame.deathRuleRow`), Sandbox panel beside the Death rule row (only while Sandbox is selected; any Style), summary line (`newGame.summary` / `newGame.summaryReplacing`), Back + Begin.
- Model: `Nav.setupInit/setupReduce` (pure). Defaults every time: Standard + Heir + default Sandbox options. Focus never selects. Vertical stops: Style row → Death row → panel toggles → Back/Begin (wrap); entering a row focuses its selected card; Right on Sandbox card enters the panel; Esc/B or Left on a first value leaves the panel.
- Run cards show `run.modes` ("{styleName} · {deathRuleName}") on their own line, `· run.sandboxTag` for Sandbox.
- `styles.json` tunables (play-styles-spec §4) are gameplay-side and not built in the menu.

## v1.3.2 Menu music
`src/renderer/js/music.js` (UMD, unit-tested with a fake AudioContext in `test/music.test.js`). Graph: pass source → pass gain (loop crossfade)
→ fade gain (menu fade in/out) → volume gain (master × music, 0 when muted) → destination. Loop seams are scheduled on the AudioContext clock
(`nextPassStart`), with a timer firing 4 s ahead to create the next source. `menu.js` calls `music.play()` in `show('root')`,
`music.fadeOutAndStop()` in `show('starting'|'loading')`, and `music.setAudio(settings.audio)` from `applyLive()`. Main sets
`autoplayPolicy: 'no-user-gesture-required'`; CSP adds `media-src 'self' blob:`. Audio is loaded via XHR (fetch rejects file://).
Debug: `window.__menuDebug.music()`. Parameters/measurements: `src/renderer/data/menu-music.json`; see README "Menu music".
**v1.4.1:** the loop seam is an equal-power crossfade (`equalPowerCurves()`: cos out / sin in, 128 points, applied with `setValueCurveAtTime`
over the 3.0 s crossfade); menu fade in/out stay linear. Source mp3 moved to `audio-src/` (excluded from the build, M2).

## Planned (not built): menu cat (spec v1.3 §1)
- Renderer reads `continueTarget` from `saves:list` → that save's `mainCat`; none / missing snapshot / layer load error → default cat from `data/menuDefaultCat.json` (fixed genome, look by Ochre), logged, never crashes.
- Layered render like portraits: lying-pose lineart + gene layers (base coat, markings, eyes, sabers, scars, age variant from `lifeStage` adult/elder); pose by `sex`; files `assets/menu/cat/<sex>/<layer>.png` (Ochre owns paths).
- Re-render when `continueTarget` changes (e.g. after delete) with a 300ms crossfade; instant under Reduced Motion. Optional idle breathing/tail flick, off under Reduced Motion.
- Blocked on Anna's art pick; `menuDefaultCat.json`, rendering and crossfade intentionally not created yet.

## Portrait compositor
`src/renderer/js/compositor.js` (UMD, tests in `test/compositor.test.js`). `compose(manifest, genes, {canvas, loadImage, dir, lifeStage, scars, createCanvas?, warn?})`:
each active layer is drawn to an offscreen canvas, tinted with `tintPixels` (rgb = geneColor × mean-gray shading, alpha kept), then drawn to the
target with `blendFor(layer)` (`normal`→source-over default, `multiply`, `screen`; unknown → normal + warning) and the layer opacity. Order is
`STACK`: shadow, base_coat, markings_*, white_*, eye_left, eye_right, sabers, scar*, age_elder; then `manifest.lineart`. A layer whose file fails to
load is skipped with a warning. `genesToLayers(genes, {lifeStage, scars, elderOpacity, eyes?})` is pure: genetics-spec v0.3.1 §2 tints, all coat hexes in
the one `TINTS.coat` table (tawny, sandy `#D9BC8A`, russet, grey-dun, ash `#7D776F` = melan+leuc codominant, melanistic `#3A332E`, leucistic `#EFE6D6`);
dilution only changes the coat tint; markings = coat × 0.55 (ash too), melan `#1E1A17`, leuc `#D2C3A8`; intensity → 0.35/0.60/0.85; elder adds
`age_elder` at 0.5 and stains sabers 15%. Eyes: `resolveEyes(genes) → {left, right}` (genetics §2.5: right = `genes.eyeRight` only for `het/het` and a
different colour, else right = left; genomes without `het` resolve to matching eyes, the old `hetero` flag is ignored); `opts.eyes` overrides it;
`eye_left`/`eye_right` are tinted separately. Only layers that `genesToLayers` activates are drawn, so extra manifest layers/PNGs are ignored.
`poseFor(sex, lifeStage)`: adult/elder → `portrait-<sex>` (elder is the overlay), cub/adolescent → `portrait-<sex>-<stage>`;
`loadPoseManifest` falls back to the adult pose with a warning when that folder/manifest is missing. Assets: `assets/portraits/<pose>/` (see its README;
current files are placeholders from `scripts/gen-placeholder-portraits.py`). Dev renders: `npx electron scripts/render-portrait.js` → `screenshots/portrait-*.png`.

## Make Your Sabrecat (cat-creator-spec v0.3.1, main-menu-spec v1.4)
- **State machine:** `newGameSetup → creator` (Begin; the setup effect `{style, difficulty, sandboxOptions?}` is kept as `pendingSetup`) `→ starting` (Start).
  `creator` back on step 1 → `newGameSetup` with the setup model and `replaceRunId` untouched (no confirmation, nothing deleted).
- **Model** `src/renderer/js/creator.js` (UMD, pure): `init`, `reduce(state, action, arg, env) → {state, effect}`, `randomizeLook` (look only, never
  the same look; one roll = `rollLook(rare, rng)` with an injectable rng: common options uniform, and with §3c shown `RARE_CHANCE` 10% of rolls carry
  exactly one of `RARE_LOOKS` pale / ash / odd eyes, evenly), `randomizeTraits` (Normal(50,15), nearest 5, clamped; preset → custom), `applyPreset`, `nudgeTrait`/`setTrait` (any change → custom),
  `rangeFor(difficulty, sandboxOptions)` (20–80, or 0–100 for Sandbox + Free Customization On), `sanitizeName` (letters/space/hyphen/apostrophe, 16 max),
  `genesFor` (chosen loci homozygous via `COAT_GENES`, ash = `melan/leuc`; `D/D`, `ds/ds`, `I+/I-`, `none/none`, `ivory/ivory`; `het` `het/het` + `eyeRight`
  for odd eyes, else `Het/Het` + null; mutations []), `buildMainCat`.
  §3c: `rareAllowed(difficulty, sandboxOptions)` → `state.rare` (Sandbox + Free Customization On); `coatsFor(rare)` adds pale/ash; `ROWS(state)` adds
  `oddEyes` under Eyes and splits Eyes into `eyeLeft`/`eyeRight` while on (Right skips Left; Left landing on Right moves Right on). `coerceLook` runs on
  every `reduce` and on the debug restore hook, so a model never shows rare looks its Style doesn't allow (rare coat → random common coat, odd eyes off).
  Lifecycle: `RUN_START` (the one run-start constant), `PLAYER_START_AGE` 12, `birthSeasonFor`, `lifeStageFor` (stage starts 0/4/12/40).
- **Focus ids:** step 1 `name, sex, coat, markings, eyes | eyeLeft, eyeRight, [oddEyes]` + `randomize · back · next`; step 2 `preset, trait:<id>×5` + `randomize · back · start`.
  Up/Down wrap (entering the button row lands on Next/Start), Left/Right cycle / ±5 / move along buttons, Enter/Space/A cycles a row.
  Name: keyboard types into the field (input.js leaves letters, Space, Left/Right to it; Up/Down/Enter/Esc still navigate), keyboard Enter moves on to Sex,
  gamepad A rerolls a default name. Esc/B/right-click = Back. Gamepad Start = Next on step 1, Start on step 2. Mouse: row arrows, value click, slider
  track click/drag, buttons; hover follows real pointer movement only. Hints per last input device (keyboard / controller / mouse).
- **Preview:** main `portraits:load {pose}` (pose ids validated, cub/adolescent → adult fallback, cached) returns manifest + data-URL layers;
  `Compositor.compose(..., {tintCache})` caches tinted layers per file+tint, so a change redraws in ≈10–35 ms (§2.3 asks ≤ 100 ms).
- **Start:** `menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, mainCat}`. `src/main/main-cat.js` `validateMainCat` re-checks every field
  (range per Death rule/Sandbox option; coat pair must be a creator pair and pale/ash only with §3c; `het` must be
  `Het/Het` + null, or with §3c `het/het` + an `eyeRight` that differs from the left eye; no `hetero`, no unknown loci) and returns the save-meta snapshot and the run's full Cat record (`playerCat`); invalid → `toast.startFailed`, no deletion.
- **Sandbox options (v1.4.3):** Saga's `freePerkRespec` copy is synced but the toggle is **hidden** until perk respec exists (Director): it is listed in
  `DEFERRED_SANDBOX_OPTIONS` (saves-store), `visibleSandboxOptions()` drops it from the panel in `main.js loadCopy`, it is never stored, and copy-sync skips it.
- **Copy:** only `creator.*` / `common.back` / `run.defaultCatName` ids via `t()`; no `[PH]` strings. `test/strings.test.js` expands the creator templates.
- **Tests:** `test/creator.test.js` (model + validator), `test/menu-handlers.test.js` (Start with mainCat, replacement only on Start),
  e2e creator blocks (§7 checks 1–11, keyboard/mouse/fake-gamepad, 90 common looks, Sandbox 0–100, FC Off shows no rare looks, a fresh-profile §3c block:
  rows, Rare tags, Left/Right differ, rare looks render, Randomize, Start writes het/het + eyeRight) and the creator screens (incl. `creator:sandbox-look`)
  in the N1 fit block. `fitActive` now re-measures after zooming (up to 4 passes) because zoomed text doesn't shrink exactly in proportion.
- **Copy (v0.3.1):** `creator.coat.{sandy,pale,ash}`, `creator.row.{oddEyes,eyeLeft,eyeRight}`, `creator.oddEyes.{off,on}`, `creator.rareTag`. Left/Right Eye
  reuse `creator.help.eyes`; Odd Eyes has no help line (no copy). The sync also brought Saga's v0.4-proposal strings (rosette, barred, undercoat, dorsal),
  which are in `menu-copy.json` but unused.
