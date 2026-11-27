/**
 * Rival challenge win and loss at 720 and 1080. Text stays at least 16px.
 * A loss shows Continue only.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..', '..');

async function launch(ud) {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(300);
  return { app, page };
}
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };

async function start(page) {
  await page.evaluate((n) => window.__menuDebug.setGameSeed(n), 4);
  await page.mouse.move(2, 2);
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await press(page, 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
}

async function fonts(page) {
  return page.evaluate(() => [...document.querySelectorAll('#game-event p, #game-event button, #game-event h2')]
    .filter((node) => (node.innerText || '').trim())
    .map((node) => ({ text: node.innerText.trim().slice(0, 80), size: parseFloat(getComputedStyle(node).fontSize) })));
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-rival-'));
  const { app, page } = await launch(ud);
  try {
    await start(page);
    await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const target = s.npcs.bf04;
      const rival = s.npcs.bf02;
      s.records.willingness[target.id] = { accepted: true, pride: 'bonefield' };
      s.records.approval.bonefield = { approved: true };
      s.records.catToCat[`${rival.id}->${target.id}`] = { value: 40 };
      s.cat.perks = ['right_of_challenge'];
      s.cat.sex = 'male';
      target.sex = 'male';
      rival.sex = 'male';
      target.mateId = null;
      rival.mateId = null;
      target.stage = 'adult';
      rival.stage = 'adult';
      target.affinity = 40;
      s.region = 'bonefield';
      if (!s.map.claims.bonefield) s.map.claims.bonefield = {};
      s.map.claims.bonefield.bonefield = 80;
      s.records.bonds[target.id] = { stage: 'courting', originPrideId: null };
    });
    const found = { won: null, lost: null };
    for (let day = 1; day <= 40 && (!found.won || !found.lost); day++) {
      const card = await page.evaluate((day) => {
        const s = window.__menuDebug.game().state;
        s.day = day;
        s.over = false;
        s.dead = null;
        s.needs.health = 100;
        s.needs.hunger = 80;
        s.needs.energy = 80;
        s.phase = 'day';
        s.pending = null;
        s.records.fights = [];
        s.records.receipts = (s.records.receipts || []).filter((key) => key.indexOf('/rival/') < 0);
        const opened = window.__menuDebug.gameAct({ type: 'challenge', catId: 'bf04' });
        if (opened.error) return { error: opened.error };
        const now = window.__menuDebug.game().state;
        const fight = (now.records.fights || []).find((row) => row.catId === 'bf04');
        return {
          won: !!(fight && fight.won),
          choices: ((now.pending && now.pending.choices) || []).map((choice) => choice.label),
          text: ((now.pending && now.pending.lines) || []).map((line) => line.text).join('\n')
        };
      }, day);
      assert.ok(!card.error, card.error + ' on day ' + day);
      if (card.won && !found.won) found.won = card;
      if (!card.won && !found.lost) found.lost = card;
    }
    assert.ok(!found.error, found.error);
    assert.ok(found.lost, 'no loss');
    assert.ok(found.won, 'no win');
    assert.deepStrictEqual(found.lost.choices, []);
    assert.ok(!found.lost.text.includes('Would you be my mate?'));
    assert.ok(found.lost.text.includes("I won't pretend that didn't matter here."));
    assert.ok(found.won.choices.some((label) => label.includes('Would you be my mate?')));

    await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      s.day = 1;
      s.phase = 'day';
      s.pending = null;
      s.records.fights = [];
      s.records.receipts = (s.records.receipts || []).filter((key) => key.indexOf('/rival/') < 0);
      window.__menuDebug.gameAct({ type: 'challenge', catId: 'bf04' });
    });
    for (const box of [{ w: 1280, h: 720, name: '720' }, { w: 1920, h: 1080, name: '1080' }]) {
      await app.evaluate(({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0].setContentSize(size.w, size.h);
      }, box);
      await page.waitForSelector('#game-event');
      const seen = await fonts(page);
      assert.ok(seen.length > 0, box.name);
      for (const row of seen) assert.ok(row.size >= 16, `${box.name} ${row.size} ${row.text}`);
    }
    console.log('rival e2e ok');
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
