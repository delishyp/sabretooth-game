// Tracker C4: electron-builder `build.files` ships only what the runtime loads (package.json is the config).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const { minimatch } = require('minimatch');
const root = path.join(__dirname, '..');
const files = require('../package.json').build.files;
/** electron-builder semantics: a path ships when it matches a positive pattern and no later "!" pattern. */
const ships = (rel) => files.reduce((inc, p) => (p.startsWith('!') ? (minimatch(rel, p.slice(1), { dot: true }) ? false : inc) : (inc || minimatch(rel, p, { dot: true }))), false);

test('runtime files ship: every manifest-referenced portrait layer, lineart, menu background/logo, menu music', () => {
  for (const pose of ['portrait-male', 'portrait-female']) {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'assets/portraits', pose, 'manifest.json'), 'utf8'));
    assert.ok(ships(`assets/portraits/${pose}/manifest.json`));
    for (const f of [...m.layers.map((l) => l.file), m.lineart]) assert.ok(ships(`assets/portraits/${pose}/${f}`), `${pose}/${f}`);
  }
  for (const f of ['assets/menu/background.png', 'assets/menu/background.jpg', 'assets/menu/background.webp', 'assets/menu/logo.png',
    'assets/audio/menu/earthbound-pulse.ogg', 'src/renderer/index.html', 'src/main/main.js', 'src/renderer/data/menu-copy.json', 'package.json']) assert.ok(ships(f), f);
});
test('art working files, sources, scripts, docs and screenshots do not ship', () => {
  for (const f of ['audio-src/earthbound-pulse-original.mp3', 'assets/menu/night/work/bg3840.png', 'assets/menu/night/work/old/x.png', 'assets/menu/night/crops-final/a.png',
    'assets/menu/backgrounds/raw-1.jpg', 'assets/menu/backgrounds/rejected/a.png', 'assets/menu/direction-a-cave-wall.png', 'assets/menu/contact-sheet-main-menu.png',
    'assets/menu/background-1920.png', 'assets/menu/refs/r.jpg', 'assets/menu/html/menu-night.html', 'assets/portraits/compare/rare-coats-v1.png',
    'assets/portraits/compare/markings-wrap-crops/head-all.png', 'assets/portraits/portrait-male/rejected/old.png', 'assets/portraits/README.md',
    'scripts/art/composite.py', 'scripts/sync-copy.js', 'docs/main-menu-spec.md', 'screenshots/creator-look.png', 'test/creator.test.js']) assert.ok(!ships(f), f);
});
