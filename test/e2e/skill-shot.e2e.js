const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = '/workspace';
const out = '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-shot-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(() => window.__menuDebug, null, { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.evaluate(() => window.__menuDebug.setGameSeed(18));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'skill-strip-day1-720.png') });
  await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    s.records.playerSkills.aptitude.courtship = 100;
    s.cat.personality = { sociability: 50, aggression: 50, boldness: 50, loyalty: 50, curiosity: 50 };
    for (let day = 1; day <= 25; day++) {
      s.day = day;
      window.Skills.grant(s, 'display', true, `shot/display/${day}`);
    }
    s.records.playerSkills.modalOpen = true;
    window.__menuDebug.reloadGame(JSON.parse(JSON.stringify(s)));
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'skill-perk-modal-720.png') });
  const text = await page.locator('#skill-strip').textContent();
  const modal = await page.locator('#perk-modal').count();
  console.log('STRIP', text);
  console.log('MODAL', modal);
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
