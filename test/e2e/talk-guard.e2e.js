/**
 * Native keyboard scrolls the quiet_walk prose, and an unaffordable opening
 * stays refused across Save/Continue. Real buttons and keys.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
async function size(app, page, w, h) {
  await page.waitForTimeout(200);
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setFullScreen(false); win.setContentSize(1280, 720); });
  if (w !== 1280) await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080); });
  await page.waitForTimeout(250);
}
async function meetLn05(page) {
  await page.evaluate(() => window.__menuDebug.setGameSeed(11));
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
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-guard-'));
  const { app, page } = await launch(ud);
  try {
    await size(app, page, 1280, 720);
    await meetLn05(page);
    await page.evaluate(() => window.__menuDebug.gamePatch({ needs: { energy: 1, hunger: 0, thirst: 0 } }));
    const blocked = await page.evaluate(() => {
      const company = document.querySelector('#game-event [data-choice="company"]');
      const leave = document.querySelector('#game-event [data-choice="leave"]');
      return { company: company.disabled, leave: leave.disabled, node: document.querySelector('.conversation-card').dataset.node };
    });
    assert.strictEqual(blocked.node, 'opening');
    assert.strictEqual(blocked.company, true);
    assert.strictEqual(blocked.leave, false);
    const companyAction = () => page.evaluate(() => {
      const b = document.querySelector('#game-event [data-choice="company"]');
      return { type: 'choose', choiceId: 'company', nodeId: b.dataset.node, instanceId: b.dataset.instance };
    });
    const assertRefused = (rejected) => {
      assert.strictEqual(rejected.error, 'unaffordable');
      assert.deepStrictEqual(
        [rejected.energy, rejected.hunger, rejected.thirst, rejected.node, rejected.ledger, rejected.slot, rejected.costRows, rejected.phase],
        [1, 0, 0, 'opening', 0, null, 0, 'conversation']
      );
      assert.ok(rejected.cooldown == null);
    };
    await page.locator('#game-event [data-choice="company"]').click({ force: true });
    await page.waitForTimeout(200);
    assertRefused(await page.evaluate((a) => window.__menuDebug.gameAct(a), await companyAction()));
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/unaffordable_opening_disabled.png', scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
    await page.locator('.talk-utility [data-g="save"]').click();
    await page.waitForTimeout(300);
    await press(page, 'Escape');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
    await press(page, 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    const reloaded = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const company = document.querySelector('#game-event [data-choice="company"]');
      return { disabled: company.disabled, energy: s.needs.energy, node: s.conversation.pending.nodeId };
    });
    assert.strictEqual(reloaded.disabled, true);
    assert.strictEqual(reloaded.energy, 1);
    assert.strictEqual(reloaded.node, 'opening');
    assertRefused(await page.evaluate((a) => window.__menuDebug.gameAct(a), await companyAction()));
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/opt/cursor/artifacts/unaffordable_opening_after_continue.png', scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
    await page.evaluate(() => window.__menuDebug.gamePatch({ needs: { energy: 80, hunger: 80, thirst: 80 } }));
    await page.locator('#game-event [data-choice="company"]').click(); await idle(page);
    await page.locator('#game-event [data-choice="quiet"]').click(); await idle(page);
    await page.waitForFunction(() => document.querySelector('.conversation-card')?.dataset.node === 'quiet_walk');
    async function scrollCheck(shot, w, h) {
      const before = await page.evaluate(() => window.__menuDebug.game().state.conversation.pending.nodeId);
      for (let i = 0; i < 8; i++) {
        const on = await page.evaluate(() => document.querySelector('.focused')?.dataset.scroll || null);
        if (on === 'prose') break;
        await page.keyboard.press('ArrowUp');
      }
      const onProse = await page.evaluate(() => document.querySelector('.focused')?.dataset.scroll || null);
      assert.strictEqual(onProse, 'prose');
      await page.keyboard.press('ArrowDown');
      const down = await page.evaluate(() => document.querySelector('[data-scroll="prose"]').scrollTop);
      assert.ok(down > 0, `arrow did not scroll (${down})`);
      await page.keyboard.press('End');
      const end = await page.evaluate(() => {
        const el = document.querySelector('[data-scroll="prose"]');
        return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
      });
      assert.ok(Math.abs(end.top - end.max) < 2, `end ${end.top} of ${end.max}`);
      if (shot) {
        const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }));
        await page.screenshot({ path: shot, scale: 'css', clip: { x: 0, y: 0, width: Math.min(w, view.w), height: Math.min(h, view.h) } });
      }
      await page.keyboard.press('Home');
      assert.strictEqual(await page.evaluate(() => document.querySelector('[data-scroll="prose"]').scrollTop), 0);
      await page.keyboard.press('PageDown');
      assert.ok(await page.evaluate(() => document.querySelector('[data-scroll="prose"]').scrollTop) > 0);
      await page.keyboard.press('PageUp');
      await page.keyboard.press('Enter');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.conversation.pending.nodeId), before);
    }
    await scrollCheck('/opt/cursor/artifacts/dialogue_keyboard_scroll_720.png', 1280, 720);
    await size(app, page, 1920, 1080);
    await scrollCheck('/opt/cursor/artifacts/dialogue_keyboard_scroll_1080.png', 1920, 1080);
    console.log('talk guard e2e passed');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
