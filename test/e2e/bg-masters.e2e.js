/**
 * Menu and home masters at the gate sizes, UI scale 1 and 1.5.
 * The menu canvas must cover the window. The home file follows the window height.
 * The cat stays fully inside the window.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const out = process.env.BG_SHOTS || '/opt/cursor/artifacts/bg-masters';
fs.mkdirSync(out, { recursive: true });

const SIZES = [[1280, 720], [1920, 1080], [2560, 1440], [2560, 1080], [3440, 1440]];
const SCALES = [1, 1.5];

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-bg-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForFunction(() => document.getElementById('bg-canvas'), null, { timeout: 8000 });
  const fit = async (w, h, u) => {
    await app.evaluate(({ BrowserWindow }, box) => {
      BrowserWindow.getAllWindows()[0].setContentSize(box.w, box.h);
    }, { w, h });
    await page.waitForTimeout(120);
    const got = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    if (got.w !== w || got.h !== h) {
      await app.evaluate(({ BrowserWindow }, box) => {
        BrowserWindow.getAllWindows()[0].setContentSize(box.w, box.h);
      }, { w: w - (got.w - w), h: h - (got.h - h) });
      await page.waitForTimeout(120);
    }
    await page.evaluate((v) => window.__menuDebug.setUiScale(v), u);
    await page.waitForTimeout(180);
  };
  const tagOf = (w, h, u) => `${w}x${h}-u${String(u).replace('.', '')}`;
  for (const [w, h] of SIZES) {
    for (const u of SCALES) {
      await page.evaluate(() => window.__menuDebug.show('root'));
      await fit(w, h, u);
      const menu = await page.evaluate(() => {
        const canvas = document.getElementById('bg-canvas');
        const box = canvas.getBoundingClientRect();
        const g = canvas.getContext('2d');
        const row = (y) => {
          const data = g.getImageData(0, y, canvas.width, 1).data;
          let dark = 0;
          const step = Math.max(1, Math.floor(canvas.width / 80));
          let n = 0;
          for (let x = 0; x < canvas.width; x += step) {
            const i = x * 4;
            if (data[i] + data[i + 1] + data[i + 2] < 18) dark += 1;
            n += 1;
          }
          return dark / n;
        };
        return {
          w: innerWidth, h: innerHeight,
          covers: box.width >= innerWidth - 1 && box.height >= innerHeight - 1,
          top: row(2),
          bottom: row(canvas.height - 3)
        };
      });
      assert.ok(Math.abs(menu.w - w) <= 4 && Math.abs(menu.h - h) <= 4, JSON.stringify(menu));
      assert.ok(menu.covers, 'menu canvas covers ' + w + 'x' + h);
      assert.ok(menu.top < 0.9 && menu.bottom < 0.9, 'black bar ' + JSON.stringify(menu));
      await page.screenshot({ path: path.join(out, `menu-${tagOf(w, h, u)}.png`) });
    }
  }
  await page.evaluate(() => window.__menuDebug.show('newGame'));
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  for (const [w, h] of SIZES) {
    for (const u of SCALES) {
      await fit(w, h, u);
      await page.evaluate(() => window.__menuDebug.game().render());
      await page.waitForTimeout(200);
      const home = await page.evaluate(() => {
        const land = document.getElementById('home-landscape');
        const cat = document.getElementById('home-cat');
        const lb = land.getBoundingClientRect();
        const cb = cat.getBoundingClientRect();
        const src = land.currentSrc || land.src || '';
        return {
          src: src.split('/').pop(),
          landCovers: lb.width >= innerWidth - 2 && lb.height >= innerHeight - 2,
          cat: { top: cb.top, bottom: cb.bottom, height: cb.height, width: cb.width },
          h: innerHeight
        };
      });
      const want = home.h > 1440 ? 'home-landscape.webp' : 'home-landscape-1440.webp';
      assert.strictEqual(home.src, want, tagOf(w, h, u));
      assert.ok(home.landCovers, 'landscape covers ' + tagOf(w, h, u));
      assert.ok(home.cat.top >= -1, 'cat top ' + JSON.stringify(home.cat));
      assert.ok(home.cat.bottom <= home.h + 1, 'cat bottom ' + JSON.stringify(home.cat));
      assert.ok(home.cat.height > home.h * 0.2, 'cat height ' + JSON.stringify(home.cat));
      await page.screenshot({ path: path.join(out, `home-${tagOf(w, h, u)}.png`) });
    }
  }
  await fit(1920, 1600, 1);
  await page.evaluate(() => window.__menuDebug.game().render());
  const tall = await page.evaluate(() => ({
    h: innerHeight,
    src: (document.getElementById('home-landscape').currentSrc || '').split('/').pop()
  }));
  assert.ok(tall.h > 1440, JSON.stringify(tall));
  assert.strictEqual(tall.src, 'home-landscape.webp');
  await page.screenshot({ path: path.join(out, 'home-1920x1600-u1.png') });
  await fit(1920, 1080, 1);
  await page.locator('[data-g="nav"][data-view="lore"]').click();
  await page.waitForTimeout(200);
  const lore = await page.evaluate(() => (document.getElementById('home-landscape').currentSrc || '').split('/').pop());
  assert.strictEqual(lore, 'home-landscape-1440.webp');
  await page.screenshot({ path: path.join(out, 'lore-1920x1080-u1.png') });
  await app.close();
  console.log('bg masters ok', out);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
