/**
 * Playable deer, wolf, and hyena scenes using the supplied PNGs.
 * The standing ledger is proved in test/encounter.test.js; this checks the pictures,
 * a pending reload, and the on-screen hyena result.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = '/opt/cursor/artifacts';
fs.mkdirSync(SHOTS, { recursive: true });

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(200);
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setFullScreen(false); win.setContentSize(1280, 720); });
  await page.waitForTimeout(250);
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
async function start(page) {
  await page.mouse.move(2, 2);
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await press(page, 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await idle(page);
}
async function shot(page, name, w = 1280, h = 720) {
  const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }));
  await page.screenshot({ path: path.join(SHOTS, name), scale: 'css', clip: { x: 0, y: 0, width: Math.min(w, view.w), height: Math.min(h, view.h) } });
}
async function clearToDay(page) {
  for (let i = 0; i < 8; i++) {
    const phase = await page.evaluate(() => window.__menuDebug.game().state.phase);
    if (phase === 'day') return;
    const leave = page.locator('#game-event [data-choice="leave"], #game-event [data-choice="give_ground"], #game-event [data-choice="pass"], #game-event [data-g="continue"], #game-event [data-choice="stay_out"]');
    if (await leave.count()) { await leave.first().click(); await idle(page); }
    else break;
  }
}

(async () => {
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-deer-'));
    const { app, page } = await launch(ud);
    try {
      await start(page);
      await clearToDay(page);
      await page.locator('[data-g="hunt"][data-size="small"]').click();
      await idle(page);
      await page.waitForSelector('img[data-asset="giant-deer.png"]');
      const open = await page.evaluate(() => ({
        asset: document.querySelector('.encounter-img').dataset.asset,
        alt: document.querySelector('.encounter-img').alt,
        fit: getComputedStyle(document.querySelector('.encounter-img')).objectFit,
        bg: getComputedStyle(document.querySelector('.encounter-art')).backgroundColor,
        node: document.querySelector('.encounter-card').dataset.node,
        choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice)
      }));
      assert.strictEqual(open.asset, 'giant-deer.png');
      assert.strictEqual(open.alt, 'Giant deer');
      assert.strictEqual(open.fit, 'contain');
      assert.strictEqual(open.node, 'opening');
      assert.deepStrictEqual(open.choices, ['observe', 'stalk', 'leave']);
      await shot(page, 'encounter-deer-720.png');
      await page.locator('.talk-utility [data-g="save"]').click();
      await page.waitForTimeout(300);
      await press(page, 'Escape');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
      await press(page, 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      await idle(page);
      const kept = await page.evaluate(() => ({
        asset: document.querySelector('.encounter-img').dataset.asset,
        node: document.querySelector('.encounter-card').dataset.node,
        energy: window.__menuDebug.game().state.needs.energy
      }));
      assert.strictEqual(kept.asset, 'giant-deer.png');
      assert.strictEqual(kept.node, 'opening');
      assert.strictEqual(kept.energy, 70);
      await shot(page, 'encounter-deer-reloaded-720.png');
    } finally { await app.close(); }
  }
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-wolf-'));
    const { app, page } = await launch(ud);
    try {
      await start(page);
      await clearToDay(page);
      await page.locator('[data-g="travel"][data-to="greywater_ford"]').click();
      await idle(page);
      await page.waitForSelector('img[data-asset="old-pack-enemy.png"]');
      const wolf = await page.evaluate(() => ({
        alt: document.querySelector('.encounter-img').alt,
        choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
        day: window.__menuDebug.game().state.day,
        phase: window.__menuDebug.game().state.phase
      }));
      assert.strictEqual(wolf.alt, 'Wolf pack enemy');
      assert.deepStrictEqual(wolf.choices, ['give_ground', 'watch']);
      assert.strictEqual(wolf.day, 1);
      assert.strictEqual(wolf.phase, 'encounter');
      await shot(page, 'encounter-wolf-720.png');
    } finally { await app.close(); }
  }
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-hyena-'));
    const { app, page } = await launch(ud);
    try {
      await start(page);
      await clearToDay(page);
      const stat = await page.evaluate(() => {
        const s = window.__menuDebug.game().state;
        return { aggression: s.cat.genes.personality.aggression, tier: window.__menuDebug.game().state && null };
      });
      await page.locator('[data-g="travel"][data-to="twin_forks"]').click();
      await idle(page);
      await page.waitForSelector('img[data-asset="cave-hyena.png"]');
      const opened = await page.evaluate(() => {
        const img = document.querySelector('.encounter-img');
        const s = window.__menuDebug.game().state;
        return {
          alt: img.alt, fit: getComputedStyle(img).objectFit,
          choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
          standing: s.worldMemory.prideToPlayer['highcrag->player'].value,
          region: s.region
        };
      });
      assert.strictEqual(opened.alt, 'Cave hyena');
      assert.strictEqual(opened.fit, 'contain');
      assert.strictEqual(opened.region, 'twin_forks');
      assert.strictEqual(opened.standing, 0);
      assert.ok(opened.choices.includes('drive_off') && opened.choices.includes('retreat'));
      await shot(page, 'encounter-hyena-720.png');
      await page.locator('[data-choice="drive_off"]').click();
      await idle(page);
      const driven = await page.evaluate(() => {
        const s = window.__menuDebug.game().state;
        return {
          node: s.encounters.pending && s.encounters.pending.nodeId,
          standing: s.worldMemory.prideToPlayer['highcrag->player'].value,
          text: document.querySelector('.event-scroll').innerText
        };
      });
      await shot(page, 'encounter-hyena-result-720.png');
      if (stat.aggression >= 25) {
        assert.strictEqual(driven.node, 'after_drive');
        assert.strictEqual(driven.standing, 5);
        await page.locator('[data-choice="share_remains"]').click(); await idle(page);
        await page.locator('[data-choice="warn_off_trespasser"]').click(); await idle(page);
        const both = await page.evaluate(() => window.__menuDebug.game().state.worldMemory.prideToPlayer['highcrag->player'].value);
        assert.strictEqual(both, 15);
        await shot(page, 'encounter-hyena-deeds-720.png');
      } else {
        assert.strictEqual(driven.standing, 0);
      }
      console.log('creator aggression', stat.aggression);
    } finally { await app.close(); }
  }
  console.log('encounter e2e passed');
})().catch((e) => { console.error(e); process.exit(1); });
