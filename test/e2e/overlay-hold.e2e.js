/** Encounter and dialogue hold the nav. Save still works and reloads the same scene. */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-hold-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' } });
  const page = await app.firstWindow();
  let failed = 0;
  try {
    await page.waitForFunction(() => window.__menuDebug);
    await page.locator('[data-action="newGame"]').click();
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await page.locator('[data-nav="begin"]').click();
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    const views = await page.evaluate(() => [...document.querySelectorAll('#home-nav [data-view]')].map((b) => b.dataset.view));
    async function hold(kind) {
      await page.evaluate((which) => {
        const g = window.__menuDebug.game();
        const s = g.state;
        if (which === 'encounter') {
          s.phase = 'encounter';
          s.encounters = s.encounters || { log: [], cooldowns: {}, pending: null };
          s.encounters.pending = {
            encounterId: 'encounter.giant_deer.v1', encounterInstanceId: 'hold',
            assetId: 'giant-deer.png', displayName: 'Giant deer', nodeId: 'opening',
            lines: [{ kind: 'narration', text: 'The deer is here.' }],
            choices: [{ id: 'leave', label: 'Back away' }]
          };
        } else {
          const npc = s.npcs.hc01;
          s.phase = 'conversation';
          s.conversation = { pending: { catId: npc.id, nodeId: 'company', instanceId: 'hold-talk', dayResolved: false, paused: false } };
        }
        g.render();
      }, kind);
      await page.waitForTimeout(200);
      for (const view of views) await page.locator(`#home-nav [data-view="${view}"]`).click({ force: true });
      const held = await page.evaluate(() => {
        const s = window.__menuDebug.game().state;
        const lore = document.querySelector('.lore-book');
        const eventOpen = !document.getElementById('game-event').hidden;
        const nav = [...document.querySelectorAll('#home-nav [data-view]')];
        return {
          phase: s.phase,
          lore: !!lore,
          eventOpen,
          held: nav.every((b) => b.getAttribute('aria-disabled') === 'true' && b.title === 'Finish this first'),
          saveOff: document.querySelector('[data-g="save"]')?.disabled || false,
          menuOff: document.querySelector('[data-g="openMenu"]')?.disabled || false
        };
      });
      assert.strictEqual(held.phase, kind);
      assert.strictEqual(held.lore, false);
      assert.strictEqual(held.eventOpen, true);
      assert.strictEqual(held.held, true);
      assert.strictEqual(held.saveOff, false);
      assert.strictEqual(held.menuOff, false);
      await page.locator('#home-nav [data-view="lore"]').hover();
      const tip = await page.evaluate(() => getComputedStyle(document.querySelector('#home-nav [data-view="lore"]'), '::after').content);
      assert.ok(tip.includes('Finish this first'), tip);
    }
    await hold('encounter');
    if (await page.locator('.home-tools [data-g="save"]').isHidden()) await page.locator('[data-g="openMenu"]').click();
    await page.locator('.home-tools [data-g="save"]').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    const restored = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      return { phase: s.phase, id: s.encounters && s.encounters.pending && s.encounters.pending.encounterId, eventOpen: !document.getElementById('game-event').hidden };
    });
    assert.strictEqual(restored.phase, 'encounter');
    assert.strictEqual(restored.id, 'encounter.giant_deer.v1');
    assert.strictEqual(restored.eventOpen, true);
    await hold('conversation');
    console.log('overlay hold e2e ok');
  } catch (e) {
    failed = 1;
    console.error(e);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
  process.exit(failed);
})();
