# Sabretooth — Main Menu Spec (v1.1, FINAL)

Status: final, all questions decided by Anna (see §6 Decisions log).

Owner: Tundra (design). Audience: Flint. Scope: main menu only, no gameplay.
Stack assumption: Electron (Windows), renderer UI + main process for files. No scaffold existed when written; adapt names to Flint's conventions.
All player-facing strings come from `docs/main-menu-copy.md` (Saga); reference by `id`, don't hardcode.

## 1. Screen layout
- **Background:** full-bleed Ice Age art slot `assets/menu/bg.png` (Ochre). 16:9, author at 3840x2160, cover-scale, focal point left-of-center. Until delivered: dark blue-grey gradient placeholder. Optional slow parallax/snow layer later; must be toggle-able (Reduced Motion).
- **Title/logo:** top-left third. Logo slot `assets/menu/logo.png` (placeholder: text "SABRETOOTH"). One random tagline below (copy §1, avoid repeating last launch's).
- **Button column:** left side, vertically centered, under the title: Continue, New Game, Load, Settings, Credits, Quit. Fixed width, large text, ≥48px hit height.
- **Version string:** bottom-right, small, e.g. `v0.1.0 (build abc123)` from `app.getVersion()`.
- **Scaling:** design at 1920x1080 logical; scale UI uniformly by `min(w/1920, h/1080)`; letterbox UI, not background. Minimum window 1280x720. Fullscreen/borderless/windowed in Settings.

## 2. Buttons and flow
**Save model (decided):** at most 2 run slots; each run holds up to 3 manual saves.
- **New Game** → if a run slot is free, the first free one is used automatically → Difficulty screen. If both slots are full → "Both run slots are full" dialog showing the two run cards: pick a run to replace → danger confirm ("This permanently deletes *run* and all its saves", default focus Cancel) → Difficulty screen; or Cancel → root. Difficulty screen: three cards (Permadeath / Play On as Heir / Sandbox), one-line descriptions from copy §3; Confirm/Back. Difficulty is **locked per run** (cannot be changed later; no difficulty control in Settings).
  - **Sandbox options panel** (shown only while Sandbox is focused/selected, right of the cards): Needs drain (off/low/**normal**), Threat frequency (off/low/**normal**), Starting reputation (low/**normal**/high), Free cat customization at creation (**on**/off); defaults bold. Sandbox runs are tagged and can't be converted to other modes. Any replacement happens only after difficulty is confirmed. Emits `menu:newGame {difficulty, replaceRunId?, sandboxOptions?}` (`sandboxOptions` only when difficulty = sandbox); handler is a **placeholder** ("Gameplay coming soon" → root).
- **Continue** → loads the most recently written save across both runs; emits `menu:loadSave {runId, saveId}` (placeholder handler).
- **Load** → 2 run cards: cat name, pride name, difficulty, generation, last played; an empty slot shows "Empty run" (not selectable). Selecting a run expands it to its 1-3 saves, newest first, each with real timestamp and in-game date/season. Actions: load save (`menu:loadSave`); delete save (confirm, default Cancel; `menu:deleteSave {runId, saveId}`); delete run (danger confirm naming the run, default Cancel; `menu:deleteRun {runId}`). Delete key / X = delete focused item; Back collapses the run.
- **In-game save (future, outside menu scope):** saving when the run already has 3 saves asks which save to overwrite.
- **Settings** → tabs: Audio, Display, Controls, Storyteller. No difficulty setting. Changes apply live; saved on leaving screen. "Reset to defaults" per tab with confirm.
  - Storyteller: Online / Local / Classic (`offline`, **default**), descriptions from copy §2.
  - **Fallback rule:** on selecting or starting with Online, check connectivity; Local, check model availability. If unavailable: Online→Local→Offline, Local→Offline; show a non-blocking toast ("Online storyteller unavailable, using Classic"). Saved preference is not overwritten.
- **Credits** → auto-scrolling text; any confirm/back skips to menu; hold down/stick to fast scroll.
- **Quit** → confirm dialog (Quit / Cancel, default focus Cancel) → `app:quit`.

## 3. States
- **First launch:** no `settings.json` → write defaults; no saves. Optional one-time hint "Press Enter or A to select".
- **Load** is enabled whenever any run exists (including empty or damaged runs, so they can be deleted); disabled only when no run exists.
- **Continue** is enabled only when ≥1 valid save exists in any run.
- **Default focus:** Continue if enabled; otherwise New Game. Disabled items are dimmed and skipped by focus.
- **Corrupted save:** applies per save. Unreadable save → listed as "Damaged save" (load disabled, delete allowed). If the most recent save is damaged, Continue uses the next most recent valid one across both runs; if none are valid, treat as no saves. Unreadable run record → card shows "Damaged run" (delete run allowed; it still counts as a run, so Load stays enabled). Never crash; log to `logs/`.
- **Corrupted settings:** back up to `settings.bad.json`, reset to defaults, toast.

## 4. Input
- **Keyboard:** Up/Down or W/S move; Left/Right or A/D for tabs and sliders; Enter/Space confirm; Esc back (on root menu: opens Quit confirm).
- **Mouse:** hover moves focus; click confirms; right-click = back.
- **Controller (Gamepad API, XInput layout):** D-pad/left stick navigate (repeat 150ms after 400ms hold, stick deadzone 0.4); A confirm; B back; Start = confirm on root; LB/RB switch Settings tabs; X = delete focused save/run in Load.
- **Sandbox panel nav:** with Sandbox selected, Right/D (or D-pad/stick right) moves focus from the cards into the panel; Up/Down moves between toggles; Left/Right cycles a toggle's value (Enter/Space/A also cycles); Esc/B or Left on the first value column returns to the cards; Confirm button sits at the bottom of the panel. Controller: LB/RB also cycle values.
- **Focus:** vertical lists wrap top↔bottom; disabled items skipped; always-visible focus ring (2px, high contrast) on the focused element; last input device decides whether hover prompts show keyboard or controller glyphs.

## 5. Data / events
**State machine:** `boot → root`; `root → difficulty (slot free) | slotsFullDialog (both full) | load | settings | credits | quitConfirm | loading (continue)`; `slotsFullDialog → replaceConfirm → difficulty (replaceRunId set) | root (cancel)`; `difficulty → starting → root (placeholder)`, back → root; `load → loadRunExpanded (select run)`; `loadRunExpanded → loading | deleteSaveConfirm → loadRunExpanded | deleteRunConfirm → load`, back → load; `loading → root (placeholder)`; other sub-states back → root; `quitConfirm → exit | root`.

**Settings (`%APPDATA%/Sabretooth/settings.json`) defaults:**
```json
{
  "version": 1,
  "audio": { "master": 0.8, "music": 0.7, "sfx": 0.8, "ambient": 0.7, "mute": false },
  "display": { "mode": "borderless", "resolution": "native", "uiScale": 1.0, "reducedMotion": false, "vsync": true },
  "controls": { "keyBindings": "default", "controllerVibration": true, "invertY": false },
  "storyteller": { "mode": "offline", "localModelPath": null }
}
```
**Run record (`saves/run-<slotIndex>/run.json`):** `runId, slotIndex (0-1), catName, prideName, difficulty, sandboxOptions (null unless sandbox) {needsDrain, threatFrequency, startingReputation, freeCustomization}, storytellerMode, generation, createdAt, lastPlayedAt (ISO), gameVersion`.
**Save record (`saves/run-<slotIndex>/save-<saveIndex>/meta.json`):** `saveId, runId, saveIndex (0-2), writtenAt (ISO), inGameDate {year, season, day}, playTimeSec, saveVersion, thumbnail?`.

**IPC (renderer → main):** `menu:newGame {difficulty, replaceRunId?, sandboxOptions?}`, `menu:loadSave {runId, saveId}`, `menu:deleteSave {runId, saveId}`, `menu:deleteRun {runId}`, `saves:list → {runs: [RunRecord & {saves: SaveRecord[]}] }` (always 2 entries, null for empty), `settings:get`, `settings:set {patch}`, `storyteller:check {mode} → {available, reason}`, `app:quit`. Main → renderer: `toast {text}`.

## 6. Decisions log (Anna, 2026-11-04)
1. Save model: 2 run slots × 3 manual saves per run.
2. Default storyteller: Offline (Classic); settings default `storyteller.mode = "offline"`.
3. Difficulty: locked per run, chosen at New Game, shown on run cards, not in Settings.
4. Heir mode with no eligible heir: run ends on Legacy summary with "Begin a new lineage" (see §7).
5. Sandbox: no game over + optional toggles panel (see §2, §7); runs tagged, not convertible.
6. Menu music: none for now. Audio settings stay; menu music hook deferred.

**v1.1 designer calls (Tundra, not Anna's decisions):**
7. `menu:newGame` payload order unified as `{difficulty, replaceRunId?, sandboxOptions?}` (§2, §5).
8. Load enabled whenever any run exists (even empty/damaged); Continue only with a valid save; default focus Continue else New Game (§3).
9. Sandbox Starting Reputation = one equal baseline offset to all three prides (§7).
10. Sandbox Free Customization Off = standard creation rules; On = all traits + full sliders; player cat at creation only (§7).

## 7. Design notes (decided)
**Heir mode, no eligible heir:** an heir is any living pride member adolescent or older, ranked by blood relation to the player cat, then age. If none qualify, the run ends on a Legacy summary screen (as Permadeath) offering "Begin a new lineage": a fresh lone cat in the same world, where old-pride survivors may remain. Legacy screen is out of menu scope; menu hook only: `game:legacyEnd {runId}` → Legacy screen (future) → `menu:newLineage {runId}` or root.

**Sandbox:** no game over plus the optional toggles in §2.
- *Starting reputation:* one equal baseline offset (low/normal/high) applied to all three prides; each pride's temperament and later events still move it from there.
- *Free customization* (player cat at creation only): **Off** = standard rules as in Permadeath/Heir: common coats, markings, eyes only; no rare or mutation traits; personality sliders limited to a set range (placeholder 20-80%, tunable; final values in the future gameplay genetics spec). **On** = all appearance options incl. rare and mutation traits, sliders 0-100%. No in-game cheat/editing console in v1. Sandbox runs are tagged (`difficulty: "sandbox"`) and can't be converted.

**Audio:** no menu music in v1.0; `audio.music` setting kept, menu music hook deferred.
