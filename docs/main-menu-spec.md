# Sabretooth — Main Menu Spec (v1.4.4, FROZEN: changes only via Director)

Status: final, all questions decided by Anna (see §6 Decisions log).

Owner: Tundra (design). Audience: Flint. Scope: main menu only, no gameplay.
Stack assumption: Electron (Windows), renderer UI + main process for files. No scaffold existed when written; adapt names to Flint's conventions.
All player-facing strings come from `docs/main-menu-copy.md` (Saga); reference by `id`, don't hardcode.

## 1. Screen layout
- **Background:** full-bleed Ice Age art slot `assets/menu/background.png` (.jpg and .webp also accepted). 16:9, minimum 1920x1080, target 3840x2160 for final art, cover-scale, focal point left-of-center. Until delivered: dark blue-grey gradient placeholder. Optional slow parallax/snow layer later; must be toggle-able (Reduced Motion).
- **Menu cat (v1.3, art pending Anna's pick, so Flint plans now and builds after the pick):** the player's own current main cat appears lying on the right side of the background.
  - **Which cat:** the player cat from the save that Continue would load, meaning the newest valid save across both runs. In Heir mode that's the heir currently being played, not the founder, even when the founder has died. If there's no valid save, show the **default cat**, a fixed genome in `data/menuDefaultCat.json`; Ochre sets the look.
  - **How it's drawn:** the same layered pipeline as portraits, with fixed lying-pose lineart plus gene-driven layers (base coat, markings, eyes, sabers, scars, age variant).
  - **Poses:** male lying and female lying, picked by sex. The age variant comes from the cat's life stage, adult or elder. Art lives in `assets/portraits/menu-lying-male/` and `assets/portraits/menu-lying-female/`, each with a `manifest.json` that lists layer order, blend mode, and which gene picks or tints each layer. Elder overlay and scar layers are included. Ochre owns these paths.
  - **When it changes:** it re-renders whenever the Continue target changes, for example after a delete. Swapping cats uses a 300ms crossfade, or happens instantly with Reduced Motion.
  - **Idle animation:** an optional breathing or tail flick, turned off under Reduced Motion.
  - **Fallback:** if a snapshot is missing or a layer won't load, show the default cat and log it. The menu never crashes over this.
- **Title/logo:** top-left third. Logo slot `assets/menu/logo.png` (placeholder: text "SABRETOOTH"). One random tagline below (copy §1, avoid repeating last launch's).
- **Button column:** left side, vertically centered, under the title: Continue, New Game, Load, Settings, Credits, Quit. Fixed width, large text, ≥48px hit height.
- **Version string:** bottom-right, small, e.g. `v0.1.0 (build abc123)` from `app.getVersion()`.
- **Scaling:** design at 1920x1080 logical; scale UI uniformly by `min(w/1920, h/1080)`; letterbox UI, not background. Minimum window 1280x720. Fullscreen/borderless/windowed in Settings.

## 2. Buttons and flow
**Save model (decided):** at most 2 run slots; each run holds up to 3 manual saves.
- **New Game** → if a run slot is free, the first free one is used automatically → Difficulty screen. If both slots are full → "Both run slots are full" dialog showing the two run cards: pick a run to replace → danger confirm ("This permanently deletes *run* and all its saves", default focus Cancel) → Difficulty screen; or Cancel → root. **New Game setup screen** (v1.3, a single screen that replaces the Difficulty screen). It has two rows of cards:
    - **Row 1, Style:** Story / Standard / Sim. The default is Standard.
    - **Row 2, Death rule:** Permadeath / Play On as Heir / Sandbox. The default is Heir.
    - Descriptions come from the copy file (Saga). Below the rows is a summary line that names the chosen Style and Death rule, plus the **Begin** and Back buttons.
    - Style and Death rule are both **locked per run** and can't be changed later; neither appears in Settings. Rules are in `docs/play-styles-spec.md`.
  - **Sandbox options panel** (shown only while Sandbox is selected, right of the Death rule row): Needs drain (off/low/**normal**), Threat frequency (off/low/**normal**), Starting reputation (low/**normal**/high), Free cat customization at creation (**on**/off), Free perk respec (on/**off**, v1.4.3: swap perks at any rest, see skills-spec §7.6); defaults bold. Sandbox runs are tagged and can't be converted to other modes. Any replacement happens only after difficulty is confirmed. Emits `menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, worldSeed?, mainCat}` (`difficulty` = Death rule key, kept for compatibility) (`sandboxOptions` only when difficulty = sandbox); handler is a **placeholder** ("Gameplay coming soon" → root). From v1.4, Begin opens **Make Your Sabrecat** (`docs/cat-creator-spec.md`), and `menu:newGame` is emitted from that screen's Start, carrying `mainCat`. A run chosen for replacement is only deleted on Start.
  - **Advanced (world seed)** (v1.4.2, every Style and Death rule): a collapsed "Advanced" row below the Death rule row. Expanded, it shows one World seed field: blank by default (meaning random), digits only, 0–4294967295; an invalid value shows an inline error and blocks Begin. The value is carried to the creator's Start as `worldSeed` (omitted when blank, and main then generates one). See `docs/world-gen-spec.md`.
- **Continue** → loads the most recently written save across both runs; emits `menu:loadSave {runId, saveId}` (placeholder handler).
- **Load** → 2 run cards: cat name, pride name, style, death rule, generation, last played; an empty slot shows "Empty run" (not selectable). Selecting a run expands it to its 1-3 saves, newest first, each with real timestamp and in-game date/season. Actions: load save (`menu:loadSave`); delete save (confirm, default Cancel; `menu:deleteSave {runId, saveId}`); delete run (danger confirm naming the run, default Cancel; `menu:deleteRun {runId}`). Delete key / X = delete focused item; Back collapses the run.
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
- **New Game setup nav:** focus starts on the Style row at Standard. Left/Right (A/D, D-pad, or stick) moves within a row. Up/Down moves between the rows, the Sandbox panel (when shown), and Begin. Enter/Space/A selects a card. Esc/B goes back to root.
- **Sandbox panel nav:** with Sandbox selected, Right/D (or D-pad/stick right) moves focus from the cards into the panel; Up/Down moves between toggles; Left/Right cycles a toggle's value (Enter/Space/A also cycles); Esc/B or Left on the first value column returns to the cards. Controller: LB/RB also cycle values.
- **Focus:** vertical lists wrap top↔bottom; disabled items skipped; always-visible focus ring (2px, high contrast) on the focused element; last input device decides whether hover prompts show keyboard or controller glyphs.

## 5. Data / events
**State machine:** `boot → root`; `root → newGameSetup (slot free) | slotsFullDialog (both full) | load | settings | credits | quitConfirm | loading (continue)`; `slotsFullDialog → replaceConfirm → newGameSetup (replaceRunId set) | root (cancel)`; `newGameSetup → starting → root (placeholder)`, back → root; `load → loadRunExpanded (select run)`; `loadRunExpanded → loading | deleteSaveConfirm → loadRunExpanded | deleteRunConfirm → load`, back → load; `loading → root (placeholder)`; other sub-states back → root; `quitConfirm → exit | root`.

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
**Run record (`saves/run-<slotIndex>/run.json`):** `runId, slotIndex (0-1), catName, prideName, style (story|standard|sim), difficulty (death rule), sandboxOptions (null unless sandbox) {needsDrain, threatFrequency, startingReputation, freeCustomization, freePerkRespec}, storytellerMode, worldSeed (uint32, always set; also written to `logs/` at run start), generation, createdAt, lastPlayedAt (ISO), gameVersion`.
**Save record (`saves/run-<slotIndex>/save-<saveIndex>/meta.json`):** `saveId, runId, saveIndex (0-2), writtenAt (ISO), inGameDate {year, season, day}, playTimeSec, saveVersion, thumbnail?, mainCat {catId, name, sex, lifeStage, genes, scars[]}`. The snapshot is written on every save so the menu cat renders without loading the full save.

**IPC (renderer → main):** `menu:newGame {style, difficulty, replaceRunId?, sandboxOptions?, worldSeed?, mainCat}`, `menu:loadSave {runId, saveId}`, `menu:deleteSave {runId, saveId}`, `menu:deleteRun {runId}`, `saves:list → {runs: [RunRecord & {saves: SaveRecord[]}], continueTarget: {runId, saveId} | null}` (always 2 entries, null for empty; the menu cat reads `mainCat` from `continueTarget`), `settings:get`, `settings:set {patch}`, `storyteller:check {mode} → {available, reason}`, `app:quit`. Main → renderer: `toast {text}`.

## 6. Decisions log (Anna, 2026-11-04)
1. Save model: 2 run slots × 3 manual saves per run.
2. Default storyteller: Offline (Classic); settings default `storyteller.mode = "offline"`.
3. Difficulty: locked per run, chosen at New Game, shown on run cards, not in Settings.
4. Heir mode with no eligible heir: run ends on Legacy summary with "Begin a new lineage" (see §7).
5. Sandbox: no game over + optional toggles panel (see §2, §7); runs tagged, not convertible.
6. Menu music: none for now. Audio settings stay; menu music hook deferred. *(Superseded by v1.3.2: menu music added.)*

**v1.1 designer calls (Tundra, not Anna's decisions):**
7. `menu:newGame` payload order unified as `{difficulty, replaceRunId?, sandboxOptions?}` (§2, §5).
8. Load enabled whenever any run exists (even empty/damaged); Continue only with a valid save; default focus Continue else New Game (§3).
9. Sandbox Starting Reputation = one equal baseline offset to all three prides (§7).
10. Sandbox Free Customization Off = standard creation rules; On = all traits + full sliders; player cat at creation only (§7).

**v1.2 (Director-confirmed, 2026-11-04):** difficulty-screen button label is "Begin" (was Confirm). Menu background path is `assets/menu/background.png` (.jpg/.webp accepted), replacing `bg.png`. Background resolution: minimum 1920x1080, target 3840x2160 for final art. Spec frozen; further changes only when Director confirms.

**v1.3 (Director-approved, 2026-11-04):** New Game has two independent choices on one setup screen: Style (Story/Standard/Sim, default Standard) and Death rule (Permadeath/Heir/Sandbox, default Heir). Both are locked per run and shown on the run cards. `style` is added to `menu:newGame` and the run record, and `difficulty` stays as the Death rule key. The Sandbox panel now sits beside the Death rule row. Style rules are in `docs/play-styles-spec.md`. Director has approved Heir as the default Death rule and Sandbox with any Style. The menu cat (§1) is added: it shows the Continue save's player cat or a default cat, using layered art, with the build waiting on Anna's art pick. "Style" and "Death rule" are internal names only. On-screen headings and labels come from Saga's copy (§6).

**v1.3.1 errata (Director-confirmed, 2026-11-04, wording only):** Sandbox panel shows only while Sandbox is *selected* (not focused). Removed the stale §4 line placing Begin inside the Sandbox panel; the single Begin sits under the summary line.

**v1.3.2 (Director-confirmed, 2026-11-04):** menu music added. Anna's "Earthbound Pulse" replaces decision 6, which was no menu music. See §7 Menu music for trim, loop, fades, volume, mute and run-start behaviour. Loop crossfade set to 3.0s, Director-confirmed after Flint's test, because the song's own fade-in runs to about 2.4s. The trim stays at 1.0s.

**v1.4 (Director-confirmed, 2026-11-04):** Begin now leads to the Make Your Sabrecat screen (cat-creator-spec v0.1). `menu:newGame` gains `mainCat`, emitted on that screen's Start. Replacing a run is deferred to Start.

**v1.4.1 (Director-confirmed, 2026-11-04):** §7.2 loop crossfade uses an equal-power curve (trim 1.0s and crossfade 3.0s unchanged), per Tracker RETEST-2, where a linear curve dipped 6–8 dB for 1.5–2s at the loop. Mute keeps the track playing silently, and its position advances, as written. Anna will ear-test on Windows speakers with the next build.

**v1.4.2 (Director-approved, 2026-11-04):** New Game gets a collapsed Advanced row with an optional World seed field, shown in every Style (§2). `menu:newGame` gains optional `worldSeed`, and the run record always stores `worldSeed`, which is also logged at run start. Generation rules are in world-gen-spec.

**v1.4.3 (Director, 2026-11-04):** The Sandbox options panel gains a Free perk respec toggle, off by default. `sandboxOptions` gains `freePerkRespec`. Rules are in skills-spec §7.6.

**v1.4.4 (Director, 2026-11-05):** §7 menu music item 5: the fade-out fires on the creator's Start, Continue or Load, not on Begin. Music keeps playing through Make Your Sabrecat. Per Tracker's creator report, `/workspace/qa/creator/REPORT.md`.

## 7. Design notes (decided)
**Heir mode, no eligible heir:** an heir is any living pride member adolescent or older, ranked by blood relation to the player cat, then age. If none qualify, the run ends on a Legacy summary screen (as Permadeath) offering "Begin a new lineage": a fresh lone cat in the same world, where old-pride survivors may remain. Legacy screen is out of menu scope; menu hook only: `game:legacyEnd {runId}` → Legacy screen (future) → `menu:newLineage {runId}` or root.

**Sandbox:** no game over plus the optional toggles in §2.
- *Starting reputation:* one equal baseline offset (low/normal/high) applied to all three prides; each pride's temperament and later events still move it from there.
- *Free customization* (player cat at creation only): **Off** = standard rules as in Permadeath/Heir: common coats, markings, eyes only; no rare or mutation traits; personality sliders limited to a set range (placeholder 20-80%, tunable; final values in the future gameplay genetics spec). **On** = all appearance options incl. rare and mutation traits, sliders 0-100%. No in-game cheat/editing console in v1. Sandbox runs are tagged (`difficulty: "sandbox"`) and can't be converted.

**Menu music (v1.3.2):** Anna's track "Earthbound Pulse", source file `assets/audio/menu/earthbound-pulse-original.mp3` (3:33).
1. **Trim:** skip the 1.0s of leading silence. Flint decides whether to trim the asset or seek on load. The shipped file is `assets/audio/menu/earthbound-pulse.ogg`, and the original is kept.
2. **Loop:** loop without a gap. Crossfade the tail into the start over 3.0s, overlapping the track's own tail fade. The song's own fade-in runs to about 2.4s, so a shorter crossfade dips at each loop. The crossfade uses an equal-power curve (v1.4.1).
3. **Start:** fade in from 0 over 1.5s when the root menu first appears.
4. **Volume:** output = `audio.master` × `audio.music`. Changes apply live from the Settings Audio tab, which already has the Music slider. `audio.mute` = silent. The track keeps its position while muted, so unmuting resumes rather than restarting.
5. **Run start:** on Start (creator), Continue or Load, fade out over 1.0s, then stop (v1.4.4: music keeps playing through the creator). Gameplay audio is a separate spec.
6. **Back to menu:** when a run is quit to the root menu, start the music again with the same 1.5s fade-in.
7. **Errors:** if the file is missing or fails to decode, log a warning and run the menu silent. It must never block the menu.
