/**
 * Slice 1 e2e (scope v1.0.1), real app: creator → several days → manual save → menu → Continue (same state) → play to the
 * day-20 summary; and the death path (starvation) → death summary, Continue shows the summary again.
 * Fixed seed via __menuDebug.setGameSeed. SLICE_SHOTS=<dir> also writes QA screenshots.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const WorldMap = require(path.join(root, 'src/renderer/js/worldmap.js'));
const W = WorldMap.create(require(path.join(root, 'src/renderer/data/map.json')));
const COPY = require(path.join(root, 'src/renderer/data/menu-copy.json')).strings;
const SHOTS = process.env.SLICE_SHOTS || null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SEED = Number(process.env.SLICE_SEED || 1234);

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow(); await page.waitForFunction(() => window.__menuDebug); await page.waitForTimeout(300);
  return { app, page };
}
const st = (page) => page.evaluate(() => window.__menuDebug.state());
const g = (page) => page.evaluate(() => window.__menuDebug.game());
const waitState = (page, s, timeout = 5000) => page.waitForFunction((x) => window.__menuDebug.state().state === x, s, { timeout }).catch(() => {});
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 5000 });
const shot = async (page, name) => { if (!SHOTS) return; await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
const gameJson = (ud, run, save) => JSON.parse(fs.readFileSync(path.join(ud, 'saves', `run-${run}`, `save-${save}`, 'game.json'), 'utf8'));

/** One step of a simple survival policy, by clicking the real buttons. Returns what it did. */
async function step(page, shots) {
  const { state: s, available: av } = await g(page);
  if (s.phase === 'event') {
    if (!shots.event && s.pending.catId) { await page.waitForTimeout(400); await shot(page, '04-event'); shots.event = true; }
    const b = page.locator('#game-event [data-g="choose"]').first(); await b.click(); await idle(page); return 'choose';
  }
  if (s.phase === 'eventResult') { await page.locator('#game-event [data-g="continue"]').click(); await idle(page); return 'continue'; }
  if (av.forced) { await page.locator('[data-g="forced"]').click(); await idle(page); return 'forced'; }
  if (s.needs.thirst < 50 && !W.hasWater(s.region, 'spring')) {
    const to = av.travel.find((o) => o.allowed && W.hasWater(o.to, 'spring') && o.days === 1) || av.travel.find((o) => o.allowed);
    await page.locator(`[data-g="travel"][data-to="${to.to}"]`).click(); await idle(page); return `travel ${to.to}`;
  }
  if (s.needs.hunger < 65 && av.hunt.allowed) {
    await page.locator('[data-g="hunt"][data-size="small"]').click(); await idle(page);
    if (!shots.hunt) { await shot(page, '03-hunt-result'); shots.hunt = true; }
    return 'hunt';
  }
  await page.locator('[data-g="rest"]').click(); await idle(page); return 'rest';
}

(async () => {
  let failures = 0; const check = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.stack || e.message); } };
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-slice-e2e-'));
  const { app, page } = await launch(ud);
  const shots = {};
  try {
    await check('creator Start opens the game on day 1 at Split Rock (scope start)', async () => {
      await page.evaluate((x) => window.__menuDebug.setGameSeed(x), SEED);
      await page.mouse.move(2, 2);
      await press(page, 'Enter'); await waitState(page, 'newGameSetup');
      await press(page, 'ArrowUp', 'Enter'); await waitState(page, 'creator');
      await page.waitForFunction(() => window.__menuDebug.creator().preview.rendered, null, { timeout: 5000 }).catch(() => {});
      await shot(page, '01-creator');
      await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter'); await waitState(page, 'game');
      assert.strictEqual((await st(page)).state, 'game');
      const { state: s } = await g(page);
      assert.deepStrictEqual([s.day, s.region, s.seed, s.needs], [1, 'split_rock', SEED, { health: 100, hunger: 80, thirst: 80, energy: 80 }]);
      assert.match(await page.locator('#game-day').textContent(), /day 1 of 20/);
      assert.strictEqual(await page.locator('.region-name').textContent(), W.region('split_rock').name);
      assert.strictEqual(await page.locator('.region-desc').textContent(), COPY['map.region.split_rock.description']);   // Saga, docs/map-copy.md
      assert.ok(!(await page.locator('#stage').textContent()).includes('[PH]'), 'no placeholder text on screen');
      // crosshair fix: background is one pre-scaled canvas, not a CSS cover background (software-raster tile seam)
      assert.deepStrictEqual(await page.evaluate(() => [!!document.getElementById('bg-canvas'), getComputedStyle(document.getElementById('bg')).backgroundImage.includes('url(')]), [true, false]);
      assert.strictEqual(await page.locator('[data-g="travel"]').count(), W.neighbours('split_rock').length);
      await page.waitForTimeout(500); await shot(page, '02-region');
      const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'utf8'));
      assert.strictEqual(s.cat.name, run.catName);
    });
    let before;
    await check('play several days; manual Save → menu → Continue restores the same state', async () => {
      while ((await g(page)).state.day < 6) await step(page, shots);
      while ((await g(page)).state.phase !== 'day') await step(page, shots);
      assert.ok(gameJson(ud, 0, 0).day >= 6, 'autosave each day');
      await page.locator('[data-g="save"]').click(); await page.waitForTimeout(300);
      before = (await g(page)).state;
      assert.deepStrictEqual(gameJson(ud, 0, 1), before);
      await press(page, 'Escape'); await waitState(page, 'root');
      assert.strictEqual(await page.evaluate(() => document.querySelector('button.focused').dataset.action), 'continue');
      await press(page, 'Enter'); await waitState(page, 'game');
      assert.deepStrictEqual((await g(page)).state, before);
    });
    await check('play on to the day-20 summary (regions, cats met, best affinity)', async () => {
      for (let i = 0; i < 200 && (await st(page)).state === 'game'; i++) await step(page, shots);
      await waitState(page, 'summary');
      assert.strictEqual((await st(page)).state, 'summary');
      const { summary } = await g(page);
      assert.strictEqual(summary.survived, true, `seed ${SEED} died: ${JSON.stringify(summary)}`);
      assert.strictEqual(summary.daysSurvived, 20);
      const txt = await page.locator('#summary-body').textContent();
      assert.match(txt, /20 of 20/); for (const r of summary.regionsVisited) assert.ok(txt.includes(W.region(r).name), r);
      await shot(page, '05-summary');
      assert.strictEqual(gameJson(ud, 0, 0).over, true);
      assert.ok(shots.hunt, 'hunt shot'); console.log(`    seed ${SEED}: ${summary.regionsVisited.length} regions, ${summary.catsMet.length} cats met, best ${JSON.stringify(summary.bestAffinity)}, event shot ${!!shots.event}`);
    });
    await check('death path: starvation kills, death summary shows the cause; Continue reopens the summary', async () => {
      await press(page, 'Escape'); await waitState(page, 'root');
      await page.evaluate(() => document.querySelector('[data-action="newGame"]').click()); await waitState(page, 'newGameSetup');
      await page.mouse.move(2, 2); await press(page, 'ArrowUp', 'Enter'); await waitState(page, 'creator');
      await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter'); await waitState(page, 'game');
      await page.evaluate(() => window.__menuDebug.gamePatch({ needs: { health: 10, hunger: 0, thirst: 100, energy: 100 }, counters: { starving: 2, parched: 0 } }));
      await page.locator('[data-g="rest"]').click(); await waitState(page, 'summary');
      const { summary, state: s } = await g(page);
      assert.deepStrictEqual([summary.survived, summary.cause, s.dead.day], [false, 'starvation', 1]);
      assert.match(await page.locator('.summary-cause').textContent(), /starvation/);
      await shot(page, '06-death-summary');
      assert.strictEqual(gameJson(ud, 1, 0).dead.cause, 'starvation');
      await press(page, 'Escape'); await waitState(page, 'root');
      await page.evaluate(() => document.querySelector('[data-action="continue"]').click()); await waitState(page, 'summary');
      assert.strictEqual((await st(page)).state, 'summary');
      await page.locator('[data-g="summaryMenu"]').click(); await waitState(page, 'root');
      assert.strictEqual((await st(page)).state, 'root');
    });
  } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  console.log(failures ? `${failures} FAILED` : 'all slice e2e passed');
  process.exit(failures ? 1 : 0);
})();
