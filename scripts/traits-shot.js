/** 720 stills of the creator trait picker and the appearance step. */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..');
const out = process.env.UI_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-traits-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await page.locator('[data-cnav="next"]').click();
  await page.locator('[data-cnav="next"]').click();
  await page.waitForFunction(() => window.__menuDebug.creator().model.step === 3);
  await page.evaluate(() => {
    const id = (trait) => document.querySelector('[data-pick="' + trait + '"]').click();
    id('lame_paw'); id('sickly'); id('iron_jaw'); id('broad_shoulders');
  });
  await page.waitForTimeout(200);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await page.waitForTimeout(250);
  const traits = path.join(out, 'ui-traits-720.png');
  await page.screenshot({ path: traits });
  await page.locator('[data-cnav="next"]').click();
  await page.waitForFunction(() => window.__menuDebug.creator().model.step === 4);
  await page.locator('.appearance-text').fill('A torn ear and a small scar on the face.');
  await page.waitForTimeout(200);
  const appearance = path.join(out, 'ui-appearance-720.png');
  await page.screenshot({ path: appearance });
  await app.close();
  console.log([traits, appearance].join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });
