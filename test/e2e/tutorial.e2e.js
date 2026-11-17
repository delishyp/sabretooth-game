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
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
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
    await check('tips on: the first hunt reaches the Day 1 report and steps 5–9', async () => {
      for (let i = 0; i < 8 && await page.locator('#tutorial-card').count(); i++) {
        await page.locator('[data-g="tutorialDismiss"]').click();
      }
      if (await page.locator('#game-actions').isHidden()) await page.locator('[data-g="openActions"]').click();
      if (await page.locator('[data-g="hunt"][data-size="small"]').isHidden() && await page.locator('[data-g="pickHunt"]').isVisible()) await page.locator('[data-g="pickHunt"]').click();
      await page.locator('[data-g="hunt"][data-size="small"]').click();
      const seen = [];
      const firstVisible = async (sel) => {
        const loc = page.locator(sel);
        const n = await loc.count();
        for (let i = 0; i < n; i++) if (await loc.nth(i).isVisible()) return loc.nth(i);
        return null;
      };
      const playOut = async () => {
        for (let i = 0; i < 48; i++) {
          const tip = await firstVisible('#tutorial-card');
          if (tip) {
            seen.push(await tip.getAttribute('data-tip'));
            await tip.locator('[data-g="tutorialDismiss"]').click();
            continue;
          }
          const beat = await firstVisible('#game-event [data-g="advanceBeat"]');
          if (beat) { await beat.click(); continue; }
          const choose = await firstVisible('#game-event [data-g="choose"], #game-event [data-g="sceneChoose"], #game-event [data-g="encounterChoose"], #game-event [data-g="continue"]');
          if (choose) { await choose.click(); continue; }
          break;
        }
      };
      await playOut();
      assert.ok(seen.some((id) => id === 'guided.after.huntOk' || id === 'guided.after.huntMiss'), seen.join(','));
      assert.ok(seen.includes('guided.places'), seen.join(','));
      assert.ok(seen.includes('guided.lore'), seen.join(','));
      assert.ok(seen.includes('guided.closing'), seen.join(','));
      const held = await page.evaluate(() => {
        const t = window.__menuDebug.game().state.tutorial;
        return t.seen.concat(t.queue, t.active ? [t.active.id] : []);
      });
      assert.ok(held.includes('tip.hunt'), held.join(','));
      for (let i = 0; i < 6 && await page.locator('#tutorial-card').count(); i++) {
        await page.locator('[data-g="tutorialDismiss"]').click();
      }
      if (await page.locator('[data-g="watch"]').isHidden() && await page.locator('[data-g="showMore"]').isVisible()) await page.locator('[data-g="showMore"]').click();
      await page.locator('[data-g="watch"]').click();
      await playOut();
      if (await page.locator('[data-g="scent"]').isHidden() && await page.locator('[data-g="showMore"]').isVisible()) await page.locator('[data-g="showMore"]').click();
      await page.locator('[data-g="scent"]').click();
      await playOut();
      const actions = await page.evaluate(() => {
        const t = window.__menuDebug.game().state.tutorial;
        return t.seen.concat(t.queue, t.active ? [t.active.id] : []);
      });
      assert.ok(actions.includes('tip.watch'), actions.join(','));
      assert.ok(actions.includes('tip.scent'), actions.join(','));
      for (let i = 0; i < 4 && await page.locator('#tutorial-card').count(); i++) {
        await page.locator('[data-g="tutorialDismiss"]').click();
      }
      await page.locator('[data-view="wilderness"]').click();
      await page.locator('[data-view="breeding"]').click();
      await page.locator('[data-view="home"]').click();
      const places = await page.evaluate(() => {
        const t = window.__menuDebug.game().state.tutorial;
        return t.seen.concat(t.queue, t.active ? [t.active.id] : []);
      });
      assert.ok(places.includes('tip.place.unavailable'), places.join(','));
      assert.ok(places.includes('tip.place.home'), places.join(','));
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
