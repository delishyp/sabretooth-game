/**
 * Post-faction presentation baseline. Does not change layout.
 * Seed 11, pending node quiet_walk, same choice ids before and after the viewer.
 * Captures 1280x720 and 1920x1080.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.CONVERSATION_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(SHOTS, { recursive: true });
const SEED = 11;

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
async function size(app, page, w, h) {
  await app.evaluate(({ BrowserWindow }, box) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(box.w, box.h);
  }, { w, h });
  await page.waitForTimeout(250);
}
async function shot(page, name, w, h) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, scale: 'css', clip: { x: 0, y: 0, width: w, height: h } });
  return file;
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-baseline-'));
  const { app, page } = await launch(ud);
  try {
    await size(app, page, 1280, 720);
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
    const fixture = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const p = s.conversation.pending;
      return {
        seed: s.seed, nodeId: p.nodeId, choiceIds: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
        variantIds: p.presentation.variantIds, portraitId: s.npcs.ln05.portraitId, name: s.npcs.ln05.name,
        affinity: s.npcs.ln05.affinity, affinityText: document.querySelector('.event-affinity')?.textContent || ''
      };
    });
    assert.strictEqual(fixture.nodeId, 'quiet_walk');
    assert.strictEqual(fixture.portraitId, 'cat-6e2d788dd48ff440');
    assert.ok(fixture.affinityText.includes(String(fixture.affinity)));
    fs.writeFileSync(path.join(SHOTS, 'ui-baseline-quiet-walk.json'), JSON.stringify(fixture, null, 2));
    await shot(page, 'baseline-dialogue-720', 1280, 720);
    await page.locator('#game-event [data-g="expandCat"]').click();
    await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
    const nodeDuringViewer = await page.evaluate(() => window.__menuDebug.game().state.conversation.pending.nodeId);
    assert.strictEqual(nodeDuringViewer, fixture.nodeId);
    await shot(page, 'baseline-viewer-720', 1280, 720);
    await page.locator('#cat-viewer-close').click();
    await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
    await size(app, page, 1920, 1080);
    await shot(page, 'baseline-dialogue-1080', 1920, 1080);
    const choices1080 = await page.evaluate(() => [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice));
    assert.deepStrictEqual(choices1080, fixture.choiceIds);
    await page.locator('#game-event [data-g="expandCat"]').click();
    await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
    await shot(page, 'baseline-viewer-1080', 1920, 1080);
    await page.locator('#cat-viewer-close').click();
    const after = await page.evaluate(() => window.__menuDebug.game().state.conversation.pending.nodeId);
    assert.strictEqual(after, 'quiet_walk');
    console.log('baseline fixture', JSON.stringify(fixture));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
