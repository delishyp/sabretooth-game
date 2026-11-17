/** 720 stills of the difficulty row and the Deeds grid. */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..');
const out = process.env.UI_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-deeds-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-level="ice_age"]').click();
  await page.waitForTimeout(200);
  const difficulty = path.join(out, 'ui-difficulty-720.png');
  await page.screenshot({ path: difficulty });
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await page.evaluate(() => {
    const game = window.__menuDebug.game();
    const s = game.state;
    s.earnedDeeds = ['first_kill', 'mated'];
    s.deedFilter = 'all';
    const button = document.querySelector('[data-view="deeds"]');
    if (button) button.click();
    else game.render();
  });
  await page.waitForTimeout(250);
  const deeds = path.join(out, 'ui-deeds-720.png');
  await page.screenshot({ path: deeds });
  await app.close();
  console.log([difficulty, deeds].join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });
