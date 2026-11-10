/**
 * FIXTURE: the Ask to join button is the real control. The leader is marked met and the region is set.
 * This is not an ordinary walk onto held land.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-join-ui-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', '--force-device-scale-factor=1', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.evaluate(() => window.__menuDebug.setGameSeed(36));
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await page.locator('[data-cnav="next"]').click();
  await page.locator('[data-cnav="start"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    s.region = 'highcrag';
    s.npcs.hc01.met = true;
    window.__menuDebug.assignPortrait('hc01', s.npcs.hc01.portraitId);
  });
  const button = page.locator('[data-g="joinAsk"]');
  await button.waitFor({ timeout: 8000 });
  const label = await button.innerText();
  assert.ok(label.includes('to join'), label);
  await button.click();
  await page.waitForFunction(() => {
    const s = window.__menuDebug.game().state;
    return s.cat && s.cat.status === 'member';
  });
  const result = await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    return {
      status: s.cat.status,
      prideId: s.cat.prideId,
      mate: s.records.matePair,
      summary: s.pending && s.pending.summary,
      members: s.records.members.filter((m) => m.prideId === 'highcrag').length,
      seed: s.seed
    };
  });
  assert.strictEqual(result.seed, 36);
  assert.strictEqual(result.status, 'member');
  assert.strictEqual(result.prideId, 'highcrag');
  assert.strictEqual(result.mate, null);
  assert.strictEqual(result.members, 1);
  assert.ok(result.summary.includes('member of Highcrag'));
  await app.close();
  console.log('FIXTURE join button accepted', JSON.stringify(result));
})().catch((e) => { console.error(e); process.exit(1); });
