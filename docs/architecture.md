# Architecture (main menu, built against main-menu-spec v1.2)

- **Main process** (`src/main/main.js`): window (min 1280x720), IPC per spec §5, all file I/O. Logs: `<userData>/logs/menu.log`.
  - `settings-store.js`: pure Node; spec defaults (`storyteller.mode = "offline"`, shown as Classic); corrupt file → `settings.bad.json` + reset + toast. No difficulty setting.
  - `saves-store.js`: pure Node. 2 run slots × 3 saves.
    - `saves/run-<slotIndex>/run.json` = RunRecord `{runId, slotIndex, catName, prideName, difficulty, sandboxOptions|null, storytellerMode, generation, createdAt, lastPlayedAt, gameVersion}`.
    - `saves/run-<slotIndex>/save-<saveIndex>/meta.json` = SaveRecord `{saveId, runId, saveIndex, writtenAt, inGameDate{year,season,day}, playTimeSec, saveVersion}`.
    - `list()` → `{runs:[run|null, run|null]}`, saves newest first; unreadable records → `damaged: true` (deletable, not loadable).
    - `createRun()` uses first free slot or `replaceRunId` (deletes old run only at that point); throws `SaveCapError` if both full.
    - `writeSave()` takes the first free index; throws `SaveCapError` at 3 unless `overwriteSaveIndex` (future in-game overwrite prompt).
    - Difficulty / sandboxOptions locked: no API changes them after `createRun`. Sandbox runs are tagged by `difficulty: "sandbox"`.
- **Preload** (`preload.js`) → `window.sabretooth`: `menu.newGame(difficulty,{sandboxOptions,replaceRunId})`, `menu.loadSave`, `menu.deleteSave`, `menu.deleteRun`, `menu.newLineage`, `game.legacyEnd`, `saves.list`, `settings.get/set/reset`, `storyteller.check`, `copy.get`, `app.info/quit`, `onToast`, `onLegacyEnd`. contextIsolation on, nodeIntegration off, sandbox on.
- **Renderer**: plain HTML/CSS/JS. `menu.js` = spec state machine (root, difficulty + Sandbox panel, slotsFull → replaceConfirm, load / loadRunExpanded with delete confirms, settings, credits, legacy, starting/loading placeholders). `input.js` maps keyboard/mouse/Gamepad to actions (LB/RB = Settings tabs, or cycle Sandbox toggle values).
- **IPC**: `menu:newGame {difficulty, replaceRunId?, sandboxOptions?}` (creates the run record; gameplay placeholder), `menu:loadSave {runId, saveId}`, `menu:deleteSave {runId, saveId}`, `menu:deleteRun {runId}`, `saves:list`, `settings:get`, `settings:set {patch}`, `storyteller:check {mode}`, `app:quit`; Legacy hook `game:legacyEnd {runId}` (main → renderer `legacyEnd` → Legacy placeholder) → `menu:newLineage {runId}` (placeholder). Extras: `settings:reset`, `copy:get`, `app:info`. Main → renderer: `toast {text}`.
- **Audio**: no menu music (spec §6.6); audio settings stored only.
- **Art drop-in**: `js/assets.js` probes `assets/menu/background.{png,jpg,webp}` and `logo.png`; missing → gradient / text. Palette in `styles/theme.css`.
- **Copy**: `scripts/sync-copy.js` (`parseCopy`) merges + validates the JSON blocks of `docs/main-menu-copy.md` into `src/renderer/data/menu-copy.json`.

## v0.1 QA fixes (Tracker B1–B12)
- `src/renderer/js/nav.js` (pure, UMD): difficulty screen model — **focus never selects**; Enter/Space/A/click selects; Sandbox panel exists only while Sandbox is selected. Also `createGamepadReader` (XInput mapping, 0.4 deadzone, 400/150ms repeat) and `KEYMAP`. Unit-tested in `test/nav.test.js`.
- `src/renderer/js/i18n.js`: `t(id, vars)` over Saga's §5 strings + marked `[PH]` placeholders. `test/strings.test.js` checks every id used exists.
- `src/main/menu-handlers.js`: newGame (records the effective storyteller after fallback; raw errors → log, renderer gets `toast.startFailed`), loadSave (refuses damaged runs/saves).
- Settings: renderer stages edits to main (`settings:stage`) so closing the window flushes them; window mode fullscreen/windowed applied live (borderless deferred); uiScale applied live; store validates types/enums/ranges.
- `test/e2e/menu.e2e.js` (`npm run test:e2e`): real-app keyboard smoke via playwright-core.
