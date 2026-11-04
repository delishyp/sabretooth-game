/**
 * Electron smoke test (real app, real keyboard events). Needs a display; run with:  npm run test:e2e
 * Uses its own temp userData (never a QA dir) and closes the app at the end.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow(); await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(300);
  return { app, page };
}
const st = (page) => page.evaluate(() => window.__menuDebug.state());

(async () => {
  let failures = 0; const check = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.message); } };
  for (const [id, keys] of Object.entries({
    permadeath: ['Enter', 'ArrowUp', 'Enter'],
    heir: ['ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'Enter'],
    sandbox: ['ArrowDown', 'ArrowDown', 'Enter', 'ArrowRight', 'ArrowUp', 'Enter']
  })) {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check(`keyboard starts ${id}`, async () => {
        await page.keyboard.press('Enter');                       // root → New Game (default focus, no saves)
        await page.mouse.move(5, 5);
        assert.strictEqual((await st(page)).state, 'difficulty');
        for (const k of keys) await page.keyboard.press(k);
        await page.waitForTimeout(300);
        assert.strictEqual((await st(page)).state, 'starting');
        const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'utf8'));
        assert.strictEqual(run.difficulty, id);
      });
      if (id === 'heir') await check('hover does not change selection', async () => {
        await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
        const box = await page.locator('.card[data-difficulty="sandbox"]').boundingBox();
        await page.mouse.move(box.x + 20, box.y + 20); await page.waitForTimeout(100);
        const s = await st(page);
        assert.strictEqual(s.diff.focus, 'card:sandbox'); assert.strictEqual(s.diff.selected, 'permadeath');
        assert.ok(await page.locator('#sandbox-panel').isHidden());
        await page.keyboard.press('Escape'); assert.strictEqual((await st(page)).state, 'root');
      });
    } finally { await app.close(); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('settings: Left/Right switch tabs, UI scale + fullscreen apply live, close flushes (B5/B6/B11)', async () => {
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); // New Game → (Load disabled, skipped) → Settings
        assert.strictEqual((await st(page)).state, 'settings'); await page.mouse.move(2, 2);
        for (let i = 0; i < 10 && (await st(page)).focused !== 'back'; i++) await page.keyboard.press('ArrowDown'); // to Back (non-slider)
        // focused: Back (non-slider) → Right switches tab to Display
        await page.keyboard.press('ArrowRight');
        assert.ok(await page.locator('#tabs [data-tab="display"].active').count());
        const before = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).transform);
        await page.locator('[data-key="uiScale"]').click(); await page.waitForTimeout(100);
        const after = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).transform);
        assert.notStrictEqual(before, after, 'uiScale applied live');
        await page.evaluate(() => { const b = document.querySelector('[data-key="mode"]'); b.click(); }); // borderless → windowed
        await page.evaluate(() => { const b = document.querySelector('[data-key="mode"]'); b.click(); }); // windowed → fullscreen
        await page.waitForTimeout(800);
        assert.strictEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), true);
        await page.evaluate(() => { const b = document.querySelector('[data-key="mode"]'); b.click(); b.click(); }); // → borderless → windowed
        await page.waitForTimeout(800);
        assert.strictEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), false);
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());   // close while still on Settings
        await new Promise((r) => setTimeout(r, 800));
        const saved = JSON.parse(fs.readFileSync(path.join(ud, 'settings.json'), 'utf8'));
        assert.strictEqual(saved.display.mode, 'windowed'); assert.notStrictEqual(saved.display.uiScale, 1.0);
      });
    } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  console.log(failures ? `${failures} FAILED` : 'all e2e passed');
  process.exit(failures ? 1 : 0);
})();
