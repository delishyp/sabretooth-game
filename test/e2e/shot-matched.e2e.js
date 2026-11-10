/**
 * Load the one recorded quiet_walk save and photograph it.
 * MATCH_APP selects the app tree. MATCH_TAG names the files. No new game.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const repo = path.join(__dirname, '..', '..');
const APP = process.env.MATCH_APP || repo;
const TAG = process.env.MATCH_TAG || 'after';
const SHOTS = process.env.CONVERSATION_SHOTS || '/opt/cursor/artifacts';
const FIX = path.join(repo, 'test', 'fixtures', 'matched-quiet-walk', 'saves');
fs.mkdirSync(SHOTS, { recursive: true });

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', APP], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  return { app, page };
}
async function size(app, page, w, h) {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(1280, 720);
  });
  if (w !== 1280) {
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080); });
  }
  await page.waitForTimeout(300);
}
async function shot(page, name, w, h) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), scale: 'css', clip: { x: 0, y: 0, width: w, height: h } });
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-match-'));
  fs.cpSync(FIX, path.join(ud, 'saves'), { recursive: true });
  const { app, page } = await launch(ud);
  try {
    await page.waitForTimeout(400);
    await size(app, page, 1280, 720);
    await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game', null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('.conversation-card')?.dataset.node === 'quiet_walk');
    const state = await page.evaluate(() => window.__menuDebug.game().state);
    fs.writeFileSync(path.join(SHOTS, `matched-${TAG}-state.json`), JSON.stringify(state));
    const identity = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const p = s.conversation.pending;
      return {
        player: s.cat.name, playerPortrait: s.cat.portraitId, genes: s.cat.genes,
        npc: s.npcs.ln05.name, npcPortrait: s.npcs.ln05.portraitId, personality: s.npcs.ln05.personality,
        nodeId: p.nodeId, choiceIds: p.presentedChoiceIds, variantIds: p.presentation && p.presentation.variantIds,
        needs: s.needs, affinity: s.npcs.ln05.affinity
      };
    });
    assert.strictEqual(identity.nodeId, 'quiet_walk');
    await shot(page, `matched-${TAG}-dialogue-720`, 1280, 720);
    const expand = page.locator('#game-event [data-g="expandCat"]');
    if (await expand.count()) {
      await expand.click();
      await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
      await shot(page, `matched-${TAG}-viewer-720`, 1280, 720);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
    }
    await size(app, page, 1920, 1080);
    await shot(page, `matched-${TAG}-dialogue-1080`, 1920, 1080);
    if (await expand.count()) {
      await expand.click();
      await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
      await shot(page, `matched-${TAG}-viewer-1080`, 1920, 1080);
      await page.keyboard.press('Escape');
    }
    const again = await page.evaluate(() => window.__menuDebug.game().state);
    assert.strictEqual(JSON.stringify(again), JSON.stringify(state));
    console.log(TAG, JSON.stringify(identity));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
