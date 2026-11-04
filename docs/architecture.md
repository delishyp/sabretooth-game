# Architecture (main menu, built against main-menu-spec v1.3)

- **Main process** (`src/main/main.js`): window (min 1280x720), IPC per spec §5, all file I/O. Logs: `<userData>/logs/menu.log`.
  - `settings-store.js`: pure Node; spec defaults (`storyteller.mode = "offline"`, shown as Classic); corrupt file → `settings.bad.json` + reset + toast. No difficulty setting.
  - `saves-store.js`: pure Node. 2 run slots × 3 saves.
    - `saves/run-<slotIndex>/run.json` = RunRecord `{runId, slotIndex, catName, prideName, style (story|standard|sim; missing → standard), difficulty (Death rule), sandboxOptions|null, storytellerMode, generation, createdAt, lastPlayedAt, gameVersion}`.
    - `saves/run-<slotIndex>/save-<saveIndex>/meta.json` = SaveRecord `{saveId, runId, saveIndex, writtenAt, inGameDate{year,season,day}, playTimeSec, saveVersion, mainCat}`.
    - `mainCat` (optional, spec v1.3 §1/§5): `{catId, name, sex, lifeStage, genes, scars[]}` snapshot of the cat being played when the save was written (in Heir mode the current heir, not the founder). `null` until gameplay writes it; `normalizeMainCat()` keeps only these fields.
    - `list()` also returns `continueTarget: {runId, saveId} | null` = newest valid save in a valid run (what Continue loads; the menu cat will read its `mainCat`).
    - `list()` → `{runs:[run|null, run|null]}`, saves newest first; unreadable records → `damaged: true` (deletable, not loadable).
    - `createRun()` uses first free slot or `replaceRunId` (deletes old run only at that point); throws `SaveCapError` if both full.
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

## Planned (not built): menu cat (spec v1.3 §1)
- Renderer reads `continueTarget` from `saves:list` → that save's `mainCat`; none / missing snapshot / layer load error → default cat from `data/menuDefaultCat.json` (fixed genome, look by Ochre), logged, never crashes.
- Layered render like portraits: lying-pose lineart + gene layers (base coat, markings, eyes, sabers, scars, age variant from `lifeStage` adult/elder); pose by `sex`; files `assets/menu/cat/<sex>/<layer>.png` (Ochre owns paths).
- Re-render when `continueTarget` changes (e.g. after delete) with a 300ms crossfade; instant under Reduced Motion. Optional idle breathing/tail flick, off under Reduced Motion.
- Blocked on Anna's art pick; `menuDefaultCat.json`, rendering and crossfade intentionally not created yet.

## Portrait compositor (engine only; creator screen not built yet)
`src/renderer/js/compositor.js` (UMD, tests in `test/compositor.test.js`). `compose(manifest, genes, {canvas, loadImage, dir, lifeStage, scars, createCanvas?, warn?})`:
each active layer is drawn to an offscreen canvas, tinted with `tintPixels` (rgb = geneColor × mean-gray shading, alpha kept), then drawn to the
target with `blendFor(layer)` (`normal`→source-over default, `multiply`, `screen`; unknown → normal + warning) and the layer opacity. Order is
`STACK`: shadow, base_coat, markings_*, white_*, eye_left, eye_right, sabers, scar*, age_elder; then `manifest.lineart`. A layer whose file fails to
load is skipped with a warning. `genesToLayers(genes, {lifeStage, scars, elderOpacity})` is pure: genetics-spec §2 tints (dilution only changes the
coat tint; markings = coat × 0.55, melan `#1E1A17`, leuc `#D2C3A8`; intensity → 0.35/0.60/0.85; elder adds `age_elder` at 0.5 and stains sabers 15%).
`poseFor(sex, lifeStage)`: adult/elder → `portrait-<sex>` (elder is the overlay), cub/adolescent → `portrait-<sex>-<stage>`;
`loadPoseManifest` falls back to the adult pose with a warning when that folder/manifest is missing. Assets: `assets/portraits/<pose>/` (see its README;
current files are placeholders from `scripts/gen-placeholder-portraits.py`). Dev renders: `npx electron scripts/render-portrait.js` → `screenshots/portrait-*.png`.
