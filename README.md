# Sabretooth (working title)

Single-player Ice Age Smilodon pride game for Windows (Electron). **Current scope: main menu only.**

## Install & run
```
npm install
npm start                 # Windows / macOS
npm run start:linux-dev   # Linux dev box (adds --no-sandbox)
npm test                  # unit tests (settings, slots + cap, copy/strings, navigation, gamepad, handlers)
npm run test:e2e          # Electron smoke test via playwright-core (needs a display; own temp userData)
npm run screenshots       # Linux dev: capture menu screens to ./screenshots and exit
node scripts/seed-demo-saves.js <dir>   # dev: seed fake runs/saves into a temp userData
npm run dist:win          # build Windows NSIS installer (run on Windows)
```
If `npm install` skips Electron's postinstall (npm install-scripts policy), run `node node_modules/electron/install.js`.

## Layout
- `src/main/` – main process (`main.js`), `preload.js` bridge, `settings-store.js`, `saves-store.js` (runs/saves)
- `src/renderer/` – `index.html`, `styles/theme.css` (palette/art slots), `styles/menu.css`, `js/` (`assets.js`, `input.js`, `menu.js`), `data/menu-copy.json` (generated from Saga's copy doc)
- `docs/` – `main-menu-spec.md` (Tundra), `main-menu-copy.md` (Saga), `architecture.md`
- `assets/menu/` – menu art (see **Background art** below)

## Copy
Player-facing text (taglines, storyteller modes, difficulties, Sandbox panel) lives in `src/renderer/data/menu-copy.json`,
generated from all JSON blocks in Saga's `docs/main-menu-copy.md` (§1–§5, §5 = `strings` map): `npm run sync-copy`. Never hand-edit the JSON.
Code looks strings up with `t(id, vars)` (`src/renderer/js/i18n.js`). Ids Saga hasn't written yet live in `PLACEHOLDER_STRINGS` there, shown with a `[PH]` prefix; once Saga adds an id to §5 and you run sync-copy, delete the placeholder (a test enforces this).

## Background art (for Ochre / Anna)
The menu background is **one swappable file**: `assets/menu/background.png` (also accepted: `background.jpg`, `background.webp`;
checked in that order, first found wins). 16:9, ideally 3840x2160, cover-scaled with focal point left of centre (the button column
sits on the left). Drop the file in and restart the app; no code change. If no file exists, the cold blue-grey gradient
(`--bg-fallback` in `src/renderer/styles/theme.css`) is shown. Optional logo: `assets/menu/logo.png` (else text title).
Other files in `assets/menu/` (e.g. `backgrounds/`, `refs/`, `html/`) are ignored by the app.

## Save model (spec v1.3)
2 run slots × up to 3 manual saves each, under `<userData>/saves/`:
`run-<0|1>/run.json` (run record: style, difficulty = Death rule, and sandboxOptions locked at New Game) and `run-<n>/save-<0..2>/meta.json`.
The cap is enforced in `src/main/saves-store.js` (`SaveCapError`). Continue = newest valid save across both runs (`saves:list` → `continueTarget`). Save meta has an optional `mainCat` (null for now).
Seeded screenshots: `SABRETOOTH_USERDATA=$(mktemp -d) node scripts/seed-demo-saves.js <that dir>` then
`SABRETOOTH_USERDATA=<that dir> npm run screenshots` (optional `SABRETOOTH_SHOTS=load,main-menu` filter). Delete the dir after.

## Settings
Changes apply live and are saved on leaving Settings (and also when the window is closed mid-edit).
Window mode: Fullscreen ↔ Windowed switch live. **Borderless is saved but not applied yet** (deferred; window stays as it is).
UI scale applies live on top of the 1920x1080 fit.
`settings.json` in Electron userData (Windows: `%APPDATA%/Sabretooth/settings.json`).
