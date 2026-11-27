/**
 * One offline council at 720 and 1080. Council text stays at least 16px.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..', '..');

async function launch(ud) {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(300);
  return { app, page };
}
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });

async function start(page) {
  await page.evaluate((n) => window.__menuDebug.setGameSeed(n), 11);
  await page.mouse.move(2, 2);
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await press(page, 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
}

async function fonts(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.event-card.is-council') || document.querySelector('.council-screen');
    if (!root) return [];
    return [...root.querySelectorAll('p, button, h2')].filter((node) => (node.innerText || '').trim()).map((node) => ({
      text: node.innerText.trim().slice(0, 40),
      size: parseFloat(getComputedStyle(node).fontSize)
    }));
  });
}

async function size(app, width, height) {
  await app.evaluate(({ BrowserWindow }, box) => {
    BrowserWindow.getAllWindows()[0].setContentSize(box.width, box.height);
  }, { width, height });
}
async function assertFonts(page, label) {
  const seen = await fonts(page);
  assert.ok(seen.length > 0, 'council text at ' + label);
  for (const row of seen) assert.ok(row.size >= 16, label + ' ' + row.size + ' ' + row.text);
  return seen;
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-council-'));
  const { app, page } = await launch(ud);
  try {
    await start(page);
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      const s = game.state;
      if (!s.records) s.records = {};
      s.records.pride = { id: 'pride-e2e', name: 'Ash' };
      game.render();
    });
    await size(app, 1280, 720);
    await page.locator('[data-g="nav"][data-view="councils"]').click();
    await page.locator('.council-screen [data-g="leaderCouncil"]').click();
    await idle(page);
    await page.waitForSelector('.event-card.is-council');
    await assertFonts(page, '720-open');
    for (let i = 0; i < 24 && !(await page.locator('#game-event [data-choice="stay_out"]').count()); i++) {
      await assertFonts(page, '720-beat');
      await page.locator('#game-event [data-g="advanceBeat"]').first().click();
      await idle(page);
    }
    await size(app, 1920, 1080);
    await assertFonts(page, '1080-choices');
    await page.locator('#game-event [data-choice="stay_out"]').click();
    await idle(page);
    await assertFonts(page, '1080-result');
    await size(app, 1280, 720);
    await assertFonts(page, '720-result');
    let sawStanding = false;
    for (let i = 0; i < 24; i++) {
      const card = page.locator('.event-card.is-council');
      if (!(await card.count())) break;
      const text = await card.innerText();
      if (/unchang|warmer|cooler|mind/.test(text)) sawStanding = true;
      const clicked = await page.evaluate(() => {
        const button = document.querySelector('#game-event [data-g="advanceBeat"], #game-event [data-g="continue"]');
        if (!button) return false;
        button.click();
        return true;
      });
      if (!clicked) break;
      await idle(page);
    }
    assert.ok(sawStanding, 'a standing line played after staying out');
    console.log('council e2e ok');
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
