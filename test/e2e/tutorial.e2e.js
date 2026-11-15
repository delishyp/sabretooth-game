/**
 * First guided beats with tips on, then a new run with tips off.
 * The goal line is present in both. The arrival card is not.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  return { app, page };
}
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };

async function startRun(page, { tips }) {
  await page.evaluate(() => window.__menuDebug.show('root'));
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  if (!tips) {
    await page.locator('#tutorial-toggle').click();
    const label = await page.locator('#tutorial-toggle').innerText();
    assert.match(label, /Off/);
  }
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
}

(async () => {
  let failures = 0;
  const check = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.stack || e.message); } };
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-tutorial-'));
  const { app, page } = await launch(ud);
  try {
    await check('tips on: the first guided beats play and the goal line is up', async () => {
      await startRun(page, { tips: true });
      await page.waitForSelector('#tutorial-card');
      const first = await page.locator('#tutorial-card').innerText();
      assert.match(first, /You're alone at The Split Rock/);
      assert.match(await page.locator('#goal-line').innerText(), /Get your bearings/);
      await page.locator('[data-g="tutorialDismiss"]').click();
      const second = await page.locator('#tutorial-card').innerText();
      assert.match(second, /bars at the top/);
      await page.locator('[data-g="tutorialDismiss"]').click();
      assert.match(await page.locator('#tutorial-card').innerText(), /Thirst eases where Water is Available/);
    });
    await check('tips off: no arrival card, goal line and a low-need line still show', async () => {
      await startRun(page, { tips: false });
      assert.strictEqual(await page.locator('#tutorial-card').count(), 0);
      assert.match(await page.locator('#goal-line').innerText(), /Get your bearings/);
      await page.evaluate(() => {
        const s = window.__menuDebug.game().state;
        s.needs.hunger = 10;
      });
      await page.evaluate(() => window.__menuDebug.game().render());
      assert.match(await page.locator('.urgent-line').innerText(), /Eat before you go on/);
      assert.strictEqual(await page.locator('#tutorial-card').count(), 0);
    });
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
  console.log(failures ? `${failures} FAILED` : 'tutorial e2e ok');
  process.exit(failures ? 1 : 0);
})();
