/** Home fills the window at wide sizes. Menu art stays hidden. Need bars have fill. */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const out = process.env.WIDE_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-wide-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  let failed = 0;
  try {
    await page.waitForFunction(() => window.__menuDebug);
    await page.locator('[data-action="newGame"]').click();
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await page.locator('[data-nav="begin"]').click();
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    const sizes = [[1280, 720], [1920, 1080], [2560, 1080], [2560, 1440], [3440, 1440]];
    for (const [w, h] of sizes) {
      await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h), { w, h });
      await page.waitForTimeout(200);
      for (const u of [1, 1.5]) {
        await page.evaluate((v) => window.__menuDebug.setUiScale(v), u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await page.waitForTimeout(250);
        const box = await page.evaluate(() => {
          const bg = getComputedStyle(document.getElementById('bg')).visibility;
          const stage = document.getElementById('stage').getBoundingClientRect();
          const label = document.querySelector('#home-nav .nav-label');
          const font = label ? parseFloat(getComputedStyle(label).fontSize) : 0;
          const fills = [...document.querySelectorAll('#game-hud .need-bar i')].map((el) => el.getBoundingClientRect().width);
          return { bg, stageW: stage.width, stageH: stage.height, W: innerWidth, H: innerHeight, font, fills };
        });
        assert.strictEqual(box.bg, 'hidden', `${w} bg`);
        assert.ok(Math.abs(box.stageW - box.W) < 3 && Math.abs(box.stageH - box.H) < 3, `${w} stage ${box.stageW}x${box.stageH}`);
        assert.ok(box.fills.length >= 3 && box.fills.every((n) => n > 2), `${w} fills ${box.fills}`);
        assert.ok(box.font >= (w >= 1920 ? 14 : 12), `${w} font ${box.font}`);
        await page.screenshot({ path: path.join(out, `wide-home-${w}x${h}-u${u}.png`) });
        console.log('PASS', w, h, u, 'font', box.font, 'fills', box.fills.map((n) => Math.round(n)).join(','));
      }
    }
  } catch (e) {
    failed = 1;
    console.error(e);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
  process.exit(failed);
})();
