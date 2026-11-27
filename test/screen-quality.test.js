// Ochre's screen-quality report: no CSS zoom, and every referenced background is in the installer.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { minimatch } = require('minimatch');

const root = path.join(__dirname, '..');
const renderer = path.join(root, 'src/renderer');
const files = require('../package.json').build.files;
const ships = (rel) => files.reduce((inc, pattern) => (
  pattern.startsWith('!')
    ? (minimatch(rel, pattern.slice(1), { dot: true }) ? false : inc)
    : (inc || minimatch(rel, pattern, { dot: true }))
), false);

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|css|html)$/.test(name)) out.push(full);
  }
  return out;
}

test('no screen sets zoom', () => {
  const sources = walk(renderer, []);
  assert.ok(sources.length > 0);
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    assert.doesNotMatch(text, /\.style\.zoom\s*=/, rel);
    assert.doesNotMatch(text, /(^|[^-\w])zoom\s*:/m, rel);
  }
  const menu = fs.readFileSync(path.join(renderer, 'js/menu.js'), 'utf8');
  assert.match(menu, /creator-scene/);
  assert.match(menu, /home-landscape/);
  assert.match(menu, /continue;/);
  const css = fs.readFileSync(path.join(renderer, 'styles/menu.css'), 'utf8');
  assert.match(css, /\.title\s*\{[^}]*background:/);
  assert.match(css, /\.home-brand\s*\{[^}]*background:/);
});

test('every background path referenced in the renderer is packaged', () => {
  const found = new Set();
  for (const file of walk(renderer, [])) {
    const text = fs.readFileSync(file, 'utf8');
    const re = /['"]([^'"]*assets\/[^'"]+\.(?:png|jpe?g|webp))['"]/g;
    let match;
    while ((match = re.exec(text))) {
      const rel = match[1].replace(/^(?:\.\.\/)+/, '');
      const background = /background|home-landscape|\/night\/|bg\d+\.png/.test(rel);
      if (background) found.add(rel);
    }
  }
  assert.ok(found.has('assets/game/home-landscape.webp'));
  assert.ok(found.has('assets/game/home-landscape-1440.webp'));
  assert.ok(found.has('assets/menu/background.webp'));
  assert.ok(!found.has('assets/menu/night/work/bg1920.png'));
  for (const rel of found) {
    assert.ok(ships(rel), rel);
    if (rel.endsWith('.webp')) continue;
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
});
