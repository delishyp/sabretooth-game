/**
 * Tracker blockers on 1f33406: Entire image Tab stays in the modal, and ask_unrelated offers Continue.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = '/opt/cursor/artifacts';
fs.mkdirSync(SHOTS, { recursive: true });

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(200);
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
async function size(app, page, w, h) {
  await page.waitForTimeout(150);
  await app.evaluate(({ BrowserWindow }, box) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(box.w, box.h);
  }, { w, h });
  await page.waitForTimeout(250);
}
async function shot(page, name, w, h) {
  const view = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }));
  await page.screenshot({ path: path.join(SHOTS, name), scale: 'css', clip: { x: 0, y: 0, width: Math.min(w, view.w), height: Math.min(h, view.h) } });
}
async function start(page) {
  await page.mouse.move(2, 2);
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await press(page, 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await idle(page);
  for (let i = 0; i < 8; i++) {
    const phase = await page.evaluate(() => window.__menuDebug.game().state.phase);
    if (phase === 'day') return;
    const leave = page.locator('#game-event [data-choice="leave"], #game-event [data-choice="give_ground"], #game-event [data-choice="pass"], #game-event [data-g="continue"], #game-event [data-choice="stay_out"]');
    if (await leave.count()) { await leave.first().click(); await idle(page); } else break;
  }
}
async function focusInside(page, rootSel) {
  for (const key of ['Tab', 'Shift+Tab', 'Tab', 'Tab']) {
    await page.keyboard.press(key);
    const where = await page.evaluate((sel) => {
      const active = document.activeElement;
      const focused = document.querySelector('.focused');
      const den = document.activeElement && document.activeElement.id === 'hotspot-den';
      return {
        activeIn: !!(active && active.closest(sel)),
        focusedIn: !!(focused && focused.closest(sel)),
        den,
        inert: document.querySelector('#stage').inert
      };
    }, rootSel);
    assert.strictEqual(where.den, false, key);
    assert.strictEqual(where.activeIn, true, key);
    assert.strictEqual(where.focusedIn, true, key);
    assert.strictEqual(where.inert, true, key);
  }
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-qa-'));
  const { app, page } = await launch(ud);
  try {
    await size(app, page, 1280, 720);
    await start(page);
    await page.waitForFunction(() => document.querySelector('#home-head') && document.querySelector('#home-head')._full);
    await page.locator('#home-expand').click();
    await page.waitForSelector('#cat-viewer:not([hidden])');
    assert.strictEqual(await page.evaluate(() => document.querySelector('.focused')?.id), 'cat-viewer-close');
    await focusInside(page, '#cat-viewer');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#cat-viewer', { state: 'hidden' });
    assert.strictEqual(await page.evaluate(() => document.querySelector('#stage').inert), false);
    assert.strictEqual(await page.evaluate(() => document.querySelector('.focused')?.id), 'home-expand');

    await page.locator('[data-g="hunt"][data-size="small"]').click();
    await idle(page);
    await page.waitForSelector('[data-g="inspectEncounter"]');
    for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
      await size(app, page, w, h);
      const node = await page.evaluate(() => window.__menuDebug.game().state.encounters.pending.nodeId);
      await page.locator('[data-g="inspectEncounter"]').click();
      await page.waitForSelector('#encounter-inspect:not([hidden])');
      assert.strictEqual(await page.evaluate(() => document.querySelector('.focused')?.id), 'encounter-inspect-close');
      await focusInside(page, '#encounter-inspect');
      await page.evaluate(() => document.querySelector('#hotspot-den').click());
      assert.strictEqual(await page.evaluate(() => document.querySelector('#encounter-inspect').hidden), false);
      assert.strictEqual(await page.evaluate(() => document.activeElement?.closest('#encounter-inspect') != null), true);
      await shot(page, `qa-inspect-tab-${tag}.png`, w, h);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#encounter-inspect', { state: 'hidden' });
      const back = await page.evaluate(() => ({
        node: window.__menuDebug.game().state.encounters.pending.nodeId,
        focused: document.querySelector('.focused')?.dataset.g || null,
        inert: document.querySelector('#stage').inert
      }));
      assert.strictEqual(back.node, node);
      assert.strictEqual(back.focused, 'inspectEncounter');
      assert.strictEqual(back.inert, false);
    }

    await page.locator('[data-choice="leave"]').click();
    await idle(page);
    await page.locator('[data-g="continue"]').click();
    await idle(page);
    for (let i = 0; i < 6; i++) {
      const phase = await page.evaluate(() => window.__menuDebug.game().state.phase);
      if (phase === 'day') break;
      const btn = page.locator('#game-event [data-g="continue"], #game-event [data-choice="pass"], #game-event [data-choice="stay_out"]').first();
      if (await btn.count()) { await btn.click(); await idle(page); }
    }

    for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
      await size(app, page, w, h);
      const phase = await page.evaluate(() => window.__menuDebug.game().state.phase);
      if (phase !== 'border') {
        await page.locator('#game-actions [data-g="border"]').click();
        await idle(page);
        await page.locator('[data-choice="request_introduction"]').click();
        await idle(page);
      }
      const gate = await page.evaluate(() => ({
        choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
        policy: window.__menuDebug.game().state.worldMemory.policy['highcrag->bonefield'].source,
        needs: window.__menuDebug.game().state.needs,
        slot: window.__menuDebug.game().state.conversation.slotDay
      }));
      assert.ok(gate.choices.includes('ask_unrelated'));
      assert.strictEqual(gate.policy, 'unreconciled');
      await page.locator('.talk-utility [data-g="save"]').click();
      await page.waitForTimeout(250);
      await press(page, 'Escape');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
      await press(page, 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      await idle(page);
      const reloadedGate = await page.evaluate(() => [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice));
      assert.ok(reloadedGate.includes('ask_unrelated'));
      await page.locator('[data-choice="ask_unrelated"]').click();
      await idle(page);
      const stuck = await page.evaluate(() => ({
        node: document.querySelector('.conversation-card')?.dataset.node,
        continues: document.querySelectorAll('#game-event [data-g="continue"]').length,
        choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice),
        policy: window.__menuDebug.game().state.worldMemory.policy['highcrag->bonefield'],
        needs: window.__menuDebug.game().state.needs,
        slot: window.__menuDebug.game().state.conversation.slotDay
      }));
      assert.strictEqual(stuck.node, 'unrelated');
      assert.strictEqual(stuck.continues, 1);
      assert.deepStrictEqual(stuck.choices, []);
      assert.strictEqual(stuck.policy.source, 'unreconciled');
      assert.strictEqual(stuck.policy.decision, undefined);
      assert.deepStrictEqual(stuck.needs, gate.needs);
      assert.strictEqual(stuck.slot, gate.slot);
      await shot(page, `qa-unrelated-continue-${tag}.png`, w, h);
      await page.locator('.talk-utility [data-g="save"]').click();
      await page.waitForTimeout(250);
      await press(page, 'Escape');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
      await press(page, 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      await idle(page);
      const resumed = await page.evaluate(() => ({
        node: document.querySelector('.conversation-card')?.dataset.node,
        continues: document.querySelectorAll('#game-event [data-g="continue"]').length,
        focused: document.querySelector('.focused')?.dataset.g || null,
        policy: window.__menuDebug.game().state.worldMemory.policy['highcrag->bonefield'].source
      }));
      assert.strictEqual(resumed.node, 'unrelated');
      assert.strictEqual(resumed.continues, 1);
      assert.strictEqual(resumed.policy, 'unreconciled');
      if (resumed.focused !== 'continue') {
        for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('.focused')?.dataset.g) !== 'continue'; i++) {
          await page.keyboard.press('ArrowDown');
        }
      }
      assert.strictEqual(await page.evaluate(() => document.querySelector('.focused')?.dataset.g), 'continue');
      await page.keyboard.press('Enter');
      await idle(page);
      const day = await page.evaluate(() => window.__menuDebug.game().state.phase);
      assert.strictEqual(day, 'day');
    }
    console.log('qa blockers e2e passed');
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
