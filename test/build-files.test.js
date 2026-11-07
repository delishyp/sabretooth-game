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
  for (const f of ['assets/menu/background.png', 'assets/menu/background-1920.png', 'assets/menu/background.jpg', 'assets/menu/background.webp', 'assets/menu/logo.png',
    'assets/audio/menu/earthbound-pulse.ogg', 'assets/game/home-landscape.png', 'assets/portraits/registry.json', 'assets/portraits/cats/cat-6e2d788dd48ff440.png', 'src/renderer/index.html', 'src/renderer/js/portrait-view.js', 'src/main/main.js', 'src/renderer/data/menu-copy.json', 'package.json']) assert.ok(ships(f), f);
});
test('art working files, sources, scripts, docs and screenshots do not ship', () => {
  for (const f of ['audio-src/earthbound-pulse-original.mp3', 'assets/menu/night/work/bg3840.png', 'assets/menu/night/work/old/x.png', 'assets/menu/night/crops-final/a.png',
    'assets/menu/backgrounds/raw-1.jpg', 'assets/menu/backgrounds/rejected/a.png', 'assets/menu/direction-a-cave-wall.png', 'assets/menu/contact-sheet-main-menu.png',
    'assets/menu/refs/r.jpg', 'assets/menu/html/menu-night.html', 'assets/portraits/compare/rare-coats-v1.png',
    'assets/portraits/compare/markings-wrap-crops/head-all.png', 'assets/portraits/portrait-male/rejected/old.png', 'assets/portraits/README.md',
    'scripts/art/composite.py', 'scripts/sync-copy.js', 'docs/main-menu-spec.md', 'screenshots/creator-look.png', 'test/creator.test.js',
    'assets/appearance/master/master.png', 'assets/appearance/registry.json', 'src/renderer/appearance-preview.html', 'src/renderer/js/appearance-render.js']) assert.ok(!ships(f), f);
});
test('app icon: build/icon.png + build/icon.ico ship (BrowserWindow icon) and win/nsis point at the ICO; ICO has 16-256 PNG frames', () => {
  for (const f of ['build/icon.png', 'build/icon.ico']) { assert.ok(ships(f), f); assert.ok(fs.existsSync(path.join(root, f)), f); }
  const b = require('../package.json').build;
  assert.deepStrictEqual([b.win.icon, b.nsis.installerIcon, b.nsis.uninstallerIcon], ['build/icon.ico', 'build/icon.ico', 'build/icon.ico']);
  const ico = fs.readFileSync(path.join(root, 'build/icon.ico'));
  assert.deepStrictEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1]);
  const frames = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const e = 6 + 16 * i, w = ico[e] || 256, size = ico.readUInt32LE(e + 8), off = ico.readUInt32LE(e + 12);
    frames.push(w); assert.ok(off + size <= ico.length, `frame ${w} in bounds`);
    if (w === 256) assert.ok(ico.subarray(off, off + 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), '256 is PNG-compressed');
  }
  assert.deepStrictEqual(frames.sort((a, b) => a - b), [16, 24, 32, 48, 64, 128, 256]);
  const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
  assert.match(main, /icon: APP_ICON/); assert.match(main, /'icon\.ico' : 'icon\.png'/);
});
