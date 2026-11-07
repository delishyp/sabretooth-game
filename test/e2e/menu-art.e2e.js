/**
 * Approved main-menu art on a real window. Checks the plate is drawn, the menu
 * stays in the open left, and the cat side of the picture is still on screen.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.MENU_ART_SHOTS || path.join(root, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

function lum(px) { return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]; }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-menu-art-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(500);
  let client = null;
  const setSize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, s) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.setPosition(0, 0);
      win.setContentSize(s.w, s.h);
    }, { w, h });
    client = await page.context().newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await page.waitForTimeout(400);
  };
  try {
    for (const [w, h, name] of [[1920, 1080, 'menu-art-1920.png'], [1280, 720, 'menu-art-720.png']]) {
      await setSize(w, h);
      await page.waitForFunction(() => document.getElementById('bg-canvas'));
      const sample = await page.evaluate(() => {
        const c = document.getElementById('bg-canvas');
        const g = c.getContext('2d');
        const pick = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data];
        const buttons = [...document.querySelectorAll('[data-screen="root"] .menu button')].map((b) => b.textContent);
        const box = document.querySelector('[data-action="newGame"]').getBoundingClientRect();
        return { left: pick(0.14, 0.28), right: pick(0.84, 0.58), edge: pick(0.002, 0.5), buttons, box: { x: box.x, y: box.y, w: box.width, h: box.height }, cw: c.width, ch: c.height, reduced: document.body.classList.contains('reduced-motion') };
      });
      assert.ok(sample.buttons.includes('New Game'), sample.buttons.join(','));
      assert.ok(sample.box.x >= 0 && sample.box.x < w * 0.45, 'New Game is in the left of the window');
      assert.ok(sample.box.w > 40 && sample.box.h > 20, 'New Game is readable');
      assert.ok(lum(sample.right) > lum(sample.left) + 15, `cat side should be lighter than the open left (${lum(sample.left).toFixed(0)} vs ${lum(sample.right).toFixed(0)})`);
      assert.ok(lum(sample.edge) > 8, 'black side bar is not left on the window edge');
      assert.strictEqual(sample.reduced, false);
      const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      fs.writeFileSync(path.join(SHOTS, name), Buffer.from(shot.data, 'base64'));
      console.log('PASS', name, sample.cw + 'x' + sample.ch);
    }
    console.log('menu art e2e passed');
  } finally {
    await app.close();
    fs.rmSync(ud, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
