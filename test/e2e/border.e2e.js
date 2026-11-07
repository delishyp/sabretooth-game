/**
 * Ordinary Highcrag border introduction at the starting region.
 * Unknown policy is the only branch current play can reach. Save and Continue keep the choices.
 * hc07's saved traits are recorded. This scene has no authored trait lines, so they do not change the reply.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.CONVERSATION_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(SHOTS, { recursive: true });

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setFullScreen(false); win.setContentSize(1280, 720); });
  await page.waitForTimeout(400);
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-border-'));
  const { app, page } = await launch(ud);
  try {
    await page.evaluate(() => window.__menuDebug.setGameSeed(4));
    await page.mouse.move(2, 2);
    await press(page, 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await press(page, 'ArrowUp', 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    for (let i = 0; i < 6 && (await page.evaluate(() => window.__menuDebug.game().state.phase)) !== 'day'; i++) {
      const choice = page.locator('#game-event [data-g="choose"], #game-event [data-g="continue"]');
      if (await choice.count()) { await choice.first().click(); await idle(page); }
    }
    await page.locator('#game-actions [data-g="border"]').click();
    await idle(page);
    await page.screenshot({ path: path.join(SHOTS, 'border-opening.png'), scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
    const cats = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      return {
        ln05: s.npcs.ln05.personality,
        hc07: s.npcs.hc07.personality,
        snapshot: s.border.guardPersonality,
        portrait: s.npcs.ln05.portraitId,
        title: document.querySelector('.event-scroll')?.innerText || ''
      };
    });
    assert.ok(cats.ln05 && cats.hc07);
    assert.notDeepStrictEqual(cats.ln05, cats.hc07);
    assert.deepStrictEqual(cats.snapshot, cats.hc07);
    assert.strictEqual(cats.portrait, 'cat-6e2d788dd48ff440');
    assert.ok(cats.title.includes('What brings you to our border'));
    await page.locator('#game-event [data-choice="request_introduction"]').click();
    await idle(page);
    const before = await page.evaluate(() => {
      const g = window.__menuDebug.game();
      return {
        node: document.querySelector('.conversation-card')?.dataset.node,
        choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
        stance: g.state.worldMemory.prideToPride['highcrag->bonefield'].value,
        reverse: g.state.worldMemory.prideToPride['bonefield->highcrag'].value,
        text: document.querySelector('.event-scroll')?.innerText || ''
      };
    });
    assert.strictEqual(before.node, 'policy_gate');
    assert.deepStrictEqual(before.choices, ['leave_request', 'withdraw']);
    assert.strictEqual(before.stance, 0);
    assert.strictEqual(before.reverse, 0);
    assert.ok(before.text.includes('I cannot promise an introduction'));
    await page.screenshot({ path: path.join(SHOTS, 'border-unknown.png'), scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
    await page.locator('#game-event [data-g="save"]').click();
    await page.waitForTimeout(300);
    await press(page, 'Escape');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
    await press(page, 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    const after = await page.evaluate(() => ({
      node: document.querySelector('.conversation-card')?.dataset.node,
      choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
      traits: window.__menuDebug.game().state.border.guardPersonality
    }));
    assert.deepStrictEqual(after.choices, before.choices);
    assert.strictEqual(after.node, before.node);
    assert.deepStrictEqual(after.traits, cats.hc07);
    await page.locator('#game-event [data-choice="leave_request"]').click();
    await idle(page);
    const done = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const rows = s.worldMemory.ledger.filter((e) => String(e.receiptKey).includes('/border/'));
      return {
        outcome: s.border.outcome,
        rows: rows.length,
        keys: rows.map((e) => e.receiptKey),
        stance: s.worldMemory.prideToPride['highcrag->bonefield'].value,
        reverse: s.worldMemory.prideToPride['bonefield->highcrag'].value
      };
    });
    assert.strictEqual(done.outcome, 'audience_pending_unknown');
    assert.strictEqual(done.rows, 2);
    assert.strictEqual(new Set(done.keys).size, 2);
    assert.strictEqual(done.stance, 0);
    assert.strictEqual(done.reverse, 0);
    console.log('border e2e passed', before.choices.join(','));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
