/**
 * Play seed 11 to quiet_walk once and keep the complete userdata save.
 * Later baseline and after shots load this directory. They do not start a new cat.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const OUT = path.join(root, 'test', 'fixtures', 'matched-quiet-walk');
const SEED = 11;

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setFullScreen(false); win.setContentSize(1280, 720); });
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-record-'));
  const { app, page } = await launch(ud);
  try {
    await page.evaluate((x) => window.__menuDebug.setGameSeed(x), SEED);
    await page.mouse.move(2, 2);
    await press(page, 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await press(page, 'ArrowUp', 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => window.__menuDebug.game().state);
      if (s.phase === 'event' && s.pending && s.pending.catId === 'ln05') break;
      if (s.phase === 'conversation') break;
      if (s.phase === 'event') {
        const pass = page.locator('#game-event [data-choice="pass"]');
        if (await pass.count()) await pass.click(); else await page.locator('#game-event [data-g="choose"]').first().click();
        await idle(page); continue;
      }
      if (s.phase === 'eventResult' || s.phase === 'ford' || s.phase === 'border') {
        const cont = page.locator('#game-event [data-g="continue"]');
        if (await cont.count()) await cont.click(); else await page.locator('#game-event [data-choice="stay_out"], #game-event [data-choice="withdraw"]').first().click();
        await idle(page); continue;
      }
      await page.locator('[data-g="rest"]').click(); await idle(page);
    }
    await page.locator('#game-event [data-choice="greet"]').click(); await idle(page);
    await page.locator('#game-event [data-choice="company"]').click(); await idle(page);
    await page.locator('#game-event [data-choice="quiet"]').click(); await idle(page);
    const state = await page.evaluate(() => window.__menuDebug.game().state);
    assert.strictEqual(state.conversation.pending.nodeId, 'quiet_walk');
    fs.cpSync(path.join(ud, 'saves'), path.join(OUT, 'saves'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'recorded-state.json'), JSON.stringify(state));
    const cat = state.cat;
    console.log('recorded', JSON.stringify({
      player: cat.name, portrait: cat.portraitId, node: state.conversation.pending.nodeId,
      npc: state.npcs.ln05.name, npcPortrait: state.npcs.ln05.portraitId
    }));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
