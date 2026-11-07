# Sabretooth (working title)

Single-player Ice Age Smilodon pride game for Windows (Electron). **Current scope: main menu + Make Your Sabrecat (cat creator).**

## Install & run
```
npm install
npm start                 # Windows / macOS
npm run start:linux-dev   # Linux dev box (adds --no-sandbox)
npm test                  # unit tests (settings, slots + cap, copy/strings, navigation, gamepad, handlers, music, compositor, creator)
npm run test:e2e          # Electron smoke test via playwright-core (needs a display; own temp userData)
npm run screenshots       # Linux dev: capture menu screens to ./screenshots and exit
npm run appearance-preview  # dev only: modular PNG preview (add -- --screenshot to write screenshots/appearance-preview.png)
node scripts/seed-demo-saves.js <dir>   # dev: seed fake runs/saves into a temp userData
npm run dist:win          # build Windows NSIS installer (run on Windows)
```
If `npm install` skips Electron's postinstall (npm install-scripts policy), run `node node_modules/electron/install.js`.

## Layout
- `src/main/` – main process (`main.js`), `preload.js` bridge, `settings-store.js`, `saves-store.js` (runs/saves)
- `src/renderer/` – `index.html`, `styles/theme.css` (palette/art slots), `styles/menu.css`, `js/` (`assets.js`, `input.js`, `menu.js`, `creator.js`, `compositor.js`, `music.js`, `log.js`), `data/menu-copy.json` (generated from Saga's copy doc)
- `docs/` – `main-menu-spec.md` (Tundra), `main-menu-copy.md` (Saga), `architecture.md`
- `assets/menu/` – menu art (see **Background art** below)

## Copy
Player-facing text (taglines, storyteller modes, difficulties, Sandbox panel) lives in `src/renderer/data/menu-copy.json`,
generated from all JSON blocks in Saga's `docs/main-menu-copy.md` (§1–§5, §5 = `strings` map): `npm run sync-copy`. Never hand-edit the JSON.
Code looks strings up with `t(id, vars)` (`src/renderer/js/i18n.js`). Ids Saga hasn't written yet live in `PLACEHOLDER_STRINGS` there, shown with a `[PH]` prefix; once Saga adds an id to §5 and you run sync-copy, delete the placeholder (a test enforces this).

## Make Your Sabrecat (cat-creator-spec v0.3.1)
New Game setup → **Begin** → creator step 1 **Look** (Name, Sex, Coat, Markings, Eyes, live portrait) → **Next** → step 2 **Personality**
(Preset + five 20–80 sliders, 0–100 for Sandbox with Free Customization On) → **Start** → `menu:newGame {…, mainCat}`.
- Model is pure: `src/renderer/js/creator.js` (unit-tested in `test/creator.test.js`); the DOM lives in the creator section of `menu.js`.
- Start builds `mainCat` (`catId, name, sex, ageSeasons: 12, birthSeason: {year: -2, season: "spring"}, lifeStage: "adult", genes, scars: []`).
  The run start date is the single constant `Creator.RUN_START` (day 1 of spring, Year 1; lifecycle-spec §1.3).
- Main re-validates the cat (`src/main/main-cat.js`) before creating the run; a run picked for replacement is deleted only then.
  The run record gets `catName` and `playerCat` (full Cat record with `ageSeasons` and `birthSeason`).
- Preview: `portraits:load {pose}` serves the pose manifest + layers as data URLs (keeps the canvas untainted); the renderer draws with
  `Compositor.compose` on `poseFor(sex, 'adult')` with a tint cache (redraws ≈ 10–35 ms).
- Coats (every Style): Tan, Gray, Brown, Black (`melan/melan`), Sandy. **Sandbox with Free Customization On** also offers the rare
  Pale (`leuc/leuc`) and Ash (`melan/leuc`) coats and an **Odd Eyes** row (off by default) that splits Eyes into Left Eye / Right Eye
  (always different; genes `het: [het, het]` + `eyeRight`, otherwise `[Het, Het]` + null). These carry a small "Rare" tag. Sandbox Randomize gives
  exactly one rare look 10% of the time (pale / ash / odd eyes, evenly); every other case rolls common looks only, and a restored model is coerced
  back to common (`Creator.coerceLook`). Main rejects rare looks outside Sandbox + Free Customization and odd eyes with matching eyes.
- Back on step 2 → step 1 (everything kept); Back on step 1 → New Game setup (no confirmation, setup and replacement kept).
- Screenshots: `screenshots/creator-look.png`, `creator-personality.png`, `creator-personality-sandbox.png`, `creator-look-sandbox-ash-oddeyes.png` (e2e and `npm run screenshots`).

## Background art (for Ochre / Anna)
The menu background is **one swappable file**: `assets/menu/background.png` (also accepted: `background.jpg`, `background.webp`;
checked in that order, first found wins). The current file is `background.jpg`, the approved Milky Way plate, used as supplied.
It is cover-scaled, not stretched. Narrow black side bars in that file are skipped when it is drawn. The cat stays on the
right and the buttons sit in the open left. If no file exists, the cold blue-grey gradient
(`--bg-fallback` in `src/renderer/styles/theme.css`) is shown. Optional logo: `assets/menu/logo.png` (else text title).
Other files in `assets/menu/` (e.g. `backgrounds/`, `refs/`, `html/`) are ignored by the app.

## Save model (spec v1.3)
2 run slots × up to 3 manual saves each, under `<userData>/saves/`:
`run-<0|1>/run.json` (run record: style, difficulty = Death rule, and sandboxOptions locked at New Game) and `run-<n>/save-<0..2>/meta.json`.
The cap is enforced in `src/main/saves-store.js` (`SaveCapError`). Continue = newest valid save across both runs (`saves:list` → `continueTarget`). Save meta has an optional `mainCat` (null until gameplay writes saves). The run record carries `playerCat` from the creator.
Seeded screenshots: `SABRETOOTH_USERDATA=$(mktemp -d) node scripts/seed-demo-saves.js <that dir>` then
`SABRETOOTH_USERDATA=<that dir> npm run screenshots` (optional `SABRETOOTH_SHOTS=load,main-menu` filter). Delete the dir after.

## Menu music (spec v1.3.2 §7)
- Source (kept unchanged): `audio-src/earthbound-pulse-original.mp3` (3:33, 48 kHz stereo). `audio-src/**` is excluded from the build
  (`package.json` `build.files`), so only the .ogg ships (M2). Scratch clips don't belong in `assets/`.
- Game file: `assets/audio/menu/earthbound-pulse.ogg` (Vorbis q6, 211.2 s) = original 1.0 s → 212.2 s
  (lead silence trimmed in the asset; tail silence after the fade dropped). Parameters in `src/renderer/data/menu-music.json`.
- Measured (ffmpeg silencedetect −50 dB): lead silence 0.014–0.807 s, track fades in to full by ~2.0 s; tail fade starts ~210.0 s, silent from 212.19 s.
- Loop: Web Audio, two buffer sources; next pass starts 3.0 s before the end (t = start + 208.2 s). The seam is an **equal-power** crossfade over 3.0 s
  (spec v1.4.1): `setValueCurveAtTime` with cos (out, 1→0) / sin (in, 0→1) curves of 128 points, so out² + in² = 1 and the seam no longer dips
  (linear ramps dipped 6–8 dB, Tracker RETEST-2). Only the seam uses it; the menu fade-in/out stay linear.
- Fade in 1.5 s from 0 whenever the root menu appears; on Begin / Continue / Load ('starting'/'loading') fade out 1.0 s then stop.
- Gain = `audio.master × audio.music`; `audio.mute` sets gain 0 but keeps playing (position kept). Applied live from the Audio tab.
- Missing/undecodable file → one `console.warn`, menu runs silent. Reduced Motion doesn't affect audio.

## Logs
`<userData>/logs/menu.log`: main-process events plus renderer `console.warn` / `console.error`, uncaught errors and unhandled
rejections (M1; `src/renderer/js/log.js` → preload `log` → main `log:renderer`).

## Settings
Changes apply live and are saved on leaving Settings (and also when the window is closed mid-edit).
Window mode: Fullscreen ↔ Windowed switch live. **Borderless is saved but not applied yet** (deferred; window stays as it is).
UI scale applies live on top of the 1920x1080 fit.
`settings.json` in Electron userData (Windows: `%APPDATA%/Sabretooth/settings.json`).
