/**
 * Cats-list layout at the real window size, plus the creator's cat-free scene.
 * Dark, pale, and special-background heads. Does not walk a season or change formulas.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.LIST_SHOTS || '/opt/cursor/artifacts/cats-list-layout';
const SCENE = 'assets/menu/night/work/bg1920.png';
const CATS = [
  { slot: 'hc01', id: 'cat-46f04e1c79d4e443', kind: 'dark' },
  { slot: 'hc05', id: 'cat-f70f52f0f22da7fc', kind: 'pale' },
  { slot: 'ln05', id: 'cat-ee0fe001a6afbf55', kind: 'special-background' }
];
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-list-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', '--force-device-scale-factor=1', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForFunction(() => window.__menuDebug);
  const resize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h), { w, h });
    await page.waitForTimeout(250);
    return page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
  };
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name) });

  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await page.waitForFunction(() => document.querySelector('.creator-scene') && document.querySelector('.creator-scene').naturalWidth > 0);
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    const size = await resize(w, h);
    const scene = await page.evaluate(() => {
      const img = document.querySelector('.creator-scene');
      const r = img.getBoundingClientRect();
      const bg = getComputedStyle(document.getElementById('bg')).visibility;
      return { src: img.currentSrc, w: r.width, h: r.height, natural: img.naturalWidth, bg };
    });
    assert.ok(scene.src.includes(SCENE), scene.src);
    assert.ok(scene.natural >= 1600, String(scene.natural));
    assert.ok(scene.w >= w - 2 && scene.h >= h - 2, JSON.stringify({ scene, size }));
    assert.strictEqual(scene.bg, 'hidden');
    await shot(`creator-scene-${tag}.png`);
    console.log('creator', tag, JSON.stringify(size));
  }

  await page.locator('[data-cnav="next"]').click();
  await page.locator('[data-cnav="start"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await page.waitForFunction(() => document.getElementById('home-head'));
  await page.evaluate((cats) => {
    const s = window.__menuDebug.game().state;
    for (const cat of cats) {
      s.npcs[cat.slot].met = true;
      window.__menuDebug.assignPortrait(cat.slot, cat.id);
    }
    document.querySelector('[data-view="cats"]').click();
  }, CATS);
  await page.waitForFunction((id) => {
    const c = document.getElementById('met-hc01');
    return c && c.dataset.portraitId === id && c.width > 0;
  }, CATS[0].id, { timeout: 8000 });

  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    const size = await resize(w, h);
    await page.waitForTimeout(300);
    const report = await page.evaluate((cats) => {
      const dock = document.querySelector('.home-dock');
      const dockBox = dock.getBoundingClientRect();
      const pageBox = { w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, h: document.documentElement.clientHeight, sh: document.documentElement.scrollHeight };
      const rows = [...document.querySelectorAll('.met-cat')].filter((li) => li.querySelector('canvas')).map((li) => {
        const canvas = li.querySelector('canvas');
        const frame = li.querySelector('.portrait-frame');
        const button = li.querySelector('.portrait-expand');
        const cr = canvas.getBoundingClientRect();
        const fr = frame.getBoundingClientRect();
        const br = button.getBoundingClientRect();
        return {
          id: canvas.dataset.portraitId,
          frame: { x: fr.x, y: fr.y, w: fr.width, h: fr.height },
          canvas: { x: cr.x, y: cr.y, w: cr.width, h: cr.height, bitmapW: canvas.width, bitmapH: canvas.height },
          button: { text: button.textContent, x: br.x, y: br.y, w: br.width, h: br.height }
        };
      });
      return {
        dock: { x: dockBox.x, y: dockBox.y, w: dockBox.width, h: dockBox.height, sw: dock.scrollWidth, cw: dock.clientWidth },
        page: pageBox,
        zoom: document.querySelector('.screen[data-screen="game"]').style.zoom || '',
        widest: (() => {
          const stage = document.getElementById('stage').getBoundingClientRect();
          let best = null;
          for (const el of document.querySelectorAll('.screen[data-screen="game"] *')) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const right = r.right - stage.left;
            if (!best || right > best.right) best = { right, w: r.width, tag: el.tagName, id: el.id, cls: el.className && String(el.className).slice(0, 80) };
          }
          return best;
        })(),
        frame: (() => { const f = document.querySelector('.met-cat .portrait-frame'); const s = f ? getComputedStyle(f) : null; return s && { w: s.width, min: s.minWidth, max: s.maxWidth, h: s.height }; })(),
        rows
      };
    }, CATS);
    console.log('layout', tag, JSON.stringify({ zoom: report.zoom, widest: report.widest, frame: report.frame, dock: report.dock }));
    assert.strictEqual(report.rows.length, 3, JSON.stringify(report.rows.map((r) => r.id)));
    const ids = report.rows.map((r) => r.id);
    for (const cat of CATS) assert.ok(ids.includes(cat.id), cat.id);
    for (const row of report.rows) {
      assert.ok(row.frame.w >= 60 && row.frame.h >= 48, JSON.stringify(row.frame));
      assert.ok(row.frame.w / row.frame.h > 0.9 && row.frame.w / row.frame.h < 1.5, JSON.stringify(row.frame));
      assert.ok(row.canvas.bitmapW / row.canvas.bitmapH > 1.2, JSON.stringify(row.canvas));
      const b = row.button;
      assert.strictEqual(b.text, 'Entire cat');
      assert.ok(b.w >= 60 && b.h >= 22, JSON.stringify(b));
      assert.ok(b.x >= report.dock.x - 1 && b.x + b.w <= report.dock.x + report.dock.w + 1, JSON.stringify({ b, dock: report.dock }));
      assert.ok(b.y >= report.dock.y - 1 && b.y + b.h <= report.dock.y + report.dock.h + 1, JSON.stringify({ b, dock: report.dock }));
    }
    assert.ok(report.zoom === '' || Number(report.zoom) > 0.85, report.zoom);
    assert.ok(report.dock.sw <= report.dock.cw + 1, JSON.stringify(report.dock));
    assert.ok(report.page.sw <= report.page.w + 1, JSON.stringify(report.page));
    assert.strictEqual(size.w, w);
    assert.strictEqual(size.h, h);
    await shot(`live-list-${tag}-native.png`);
    console.log('list', tag, JSON.stringify({ size, dock: report.dock, rows: report.rows }));
  }

  const menuBg = await page.evaluate(() => getComputedStyle(document.getElementById('bg')).visibility);
  assert.strictEqual(menuBg, 'visible');
  assert.deepStrictEqual(errors, []);
  await app.close();
  console.log('cats list layout passed', SHOTS);
})().catch((e) => { console.error(e); process.exit(1); });
