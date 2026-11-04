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
  const STYLES = ['story', 'standard', 'sim']; const DEATHS = ['permadeath', 'heir', 'sandbox'];
  const horiz = (from, to, list) => { const d = list.indexOf(to) - list.indexOf(from); return Array(Math.abs(d)).fill(d < 0 ? 'ArrowLeft' : 'ArrowRight'); };
  const keysFor = (style, death) => [...horiz('standard', style, STYLES), 'Enter', 'ArrowDown', ...horiz('heir', death, DEATHS), 'Enter', 'ArrowDown',
    ...(death === 'sandbox' ? Array(4).fill('ArrowDown') : []), 'Enter'];
  // All 9 Style × Death rule combinations, by keyboard, two per app instance (slot 0 then slot 1).
  const combos = STYLES.flatMap((st) => DEATHS.map((d) => [st, d]));
  for (let i = 0; i < combos.length; i += 2) {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      for (const [slot, [style, death]] of combos.slice(i, i + 2).entries()) {
        await check(`keyboard starts ${style} + ${death}`, async () => {
          await page.mouse.move(2, 2);
          if ((await st(page)).state !== 'root') { await page.keyboard.press('Escape'); }
          await page.keyboard.press('Enter');                       // root default focus = New Game (no saves)
          const s0 = await st(page);
          assert.strictEqual(s0.state, 'newGameSetup');
          assert.deepStrictEqual([s0.setup.style, s0.setup.death, s0.setup.focus], ['standard', 'heir', 'style:standard']); // defaults every time
          for (const k of keysFor(style, death)) await page.keyboard.press(k);
          await page.waitForTimeout(300);
          assert.strictEqual((await st(page)).state, 'starting');
          const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', `run-${slot}`, 'run.json'), 'utf8'));
          assert.deepStrictEqual([run.style, run.difficulty, run.sandboxOptions === null], [style, death, death !== 'sandbox']);
        });
      }
      if (i === 0) await check('both slots full → replace flow uses the summaryReplacing line', async () => {
        await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
        assert.strictEqual((await st(page)).state, 'slotsFull');
        await page.keyboard.press('Enter');                         // first run card → confirm dialog (focus Cancel)
        await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');   // OK = Replace
        assert.strictEqual((await st(page)).state, 'newGameSetup');
        const summary = await page.locator('#setup-summary').textContent();
        assert.ok(/Replaces/.test(summary), summary);
        await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');   // Begin (Standard + Heir)
        await page.waitForTimeout(300);
        const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'utf8'));
        assert.deepStrictEqual([run.style, run.difficulty], ['standard', 'heir']);
      });
    } finally { await app.close(); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('hover moves focus only; Sandbox panel needs selection', async () => {
        await page.mouse.move(2, 2); await page.keyboard.press('Enter');
        const box = await page.locator('[data-nav="death:sandbox"]').boundingBox();
        await page.mouse.move(box.x + 20, box.y + 20); await page.waitForTimeout(100);
        const s = await st(page);
        assert.strictEqual(s.setup.focus, 'death:sandbox'); assert.strictEqual(s.setup.death, 'heir');
        assert.ok(await page.locator('#sandbox-panel').isHidden());
        await page.mouse.click(box.x + 20, box.y + 20); await page.waitForTimeout(100);
        assert.ok(await page.locator('#sandbox-panel').isVisible());
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
