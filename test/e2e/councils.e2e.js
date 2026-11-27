/**
 * One offline council at 720 and 1080. Council text stays at least 16px.
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
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });

async function start(page) {
  await page.evaluate((n) => window.__menuDebug.setGameSeed(n), 11);
  await page.mouse.move(2, 2);
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await press(page, 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
}

async function fonts(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.event-card.is-council') || document.querySelector('.council-screen');
    if (!root) return [];
    return [...root.querySelectorAll('p, button, h2')].filter((node) => (node.innerText || '').trim()).map((node) => ({
      text: node.innerText.trim().slice(0, 40),
      size: parseFloat(getComputedStyle(node).fontSize)
    }));
  });
}

async function size(app, width, height) {
  await app.evaluate(({ BrowserWindow }, box) => {
    BrowserWindow.getAllWindows()[0].setContentSize(box.width, box.height);
  }, { width, height });
}
async function assertFonts(page, label) {
  const seen = await fonts(page);
  assert.ok(seen.length > 0, 'council text at ' + label);
  for (const row of seen) assert.ok(row.size >= 16, label + ' ' + row.size + ' ' + row.text);
  return seen;
}
async function choiceLayout(page, label) {
  const report = await page.evaluate(() => {
    const prompt = [...document.querySelectorAll('.event-card.is-council p')].find((el) => /Will you take a side/.test(el.innerText || ''));
    if (prompt) prompt.scrollIntoView({ block: 'center' });
    const box = prompt ? prompt.getBoundingClientRect() : null;
    const clipped = !prompt || prompt.scrollHeight > prompt.clientHeight + 2 || !box || box.top < -1 || box.bottom > innerHeight + 1 || box.height < 16;
    const splits = [];
    for (const button of document.querySelectorAll('.event-card.is-council .event-choices button')) {
      const source = [...button.childNodes].find((node) => node.nodeType === 3);
      const words = (button.innerText || '').split(/\s+/).filter(Boolean);
      if (!source) { splits.push(button.innerText || ''); continue; }
      let index = 0;
      for (const word of words) {
        const start = source.textContent.indexOf(word, index);
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(source, start);
        range.setEnd(source, start + word.length);
        if (range.getClientRects().length > 1) splits.push(word);
        index = start + word.length;
      }
    }
    return { prompt: prompt ? prompt.innerText : '', clipped, splits };
  });
  assert.ok(/Will you take a side/.test(report.prompt), label + ' prompt ' + report.prompt);
  assert.ok(!report.clipped, label + ' prompt clipped');
  assert.deepStrictEqual(report.splits, [], label + ' mid-word ' + report.splits.join(', '));
}
async function menuClearsNeeds(page) {
  const gap = await page.evaluate(() => {
    const menu = document.querySelector('[data-g="openMenu"]').getBoundingClientRect();
    const bars = [...document.querySelectorAll('#game-hud .need, #game-hud .need-bar, #game-hud .need-label')].map((el) => el.getBoundingClientRect());
    const right = Math.max(...bars.map((bar) => bar.right));
    const overlap = bars.some((bar) => menu.left < bar.right - 1 && menu.right > bar.left + 1 && menu.top < bar.bottom - 1 && menu.bottom > bar.top + 1);
    return { gap: menu.left - right, overlap, bars: bars.length };
  });
  assert.ok(gap.bars >= 4, 'need bars ' + gap.bars);
  assert.ok(!gap.overlap, 'menu overlaps a need bar');
  assert.ok(gap.gap >= 8, 'menu clearance ' + gap.gap);
}
async function choicesReachable(page) {
  const count = await page.locator('.event-card.is-council .event-choices button').count();
  assert.ok(count >= 4, 'choices ' + count);
  const before = await page.evaluate(() => {
    const event = document.getElementById('game-event');
    const box = event.getBoundingClientRect();
    const hidden = [...document.querySelectorAll('.event-card.is-council .event-choices button')].filter((button) => {
      const r = button.getBoundingClientRect();
      return r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.bottom > innerHeight + 1;
    }).length;
    return { hidden, scrolls: event.scrollHeight > event.clientHeight + 1 };
  });
  assert.ok(before.hidden > 0, 'a choice starts below the fold');
  assert.ok(before.scrolls, 'event area scrolls');
  const seen = new Set();
  for (let step = 0; step < count; step++) {
    await page.keyboard.press('ArrowDown');
    const hit = await page.evaluate(() => {
      const button = document.activeElement;
      const choices = [...document.querySelectorAll('.event-card.is-council .event-choices button')];
      if (!choices.includes(button)) return { choice: '' };
      const box = button.getBoundingClientRect();
      const event = document.getElementById('game-event');
      const view = event.getBoundingClientRect();
      const x = box.left + Math.min(24, box.width / 2);
      const y = box.top + box.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        choice: button.dataset.choice,
        inView: box.top >= view.top - 1 && box.bottom <= view.bottom + 1 && box.bottom <= innerHeight + 1,
        hit: !!(top && (top === button || button.contains(top)))
      };
    });
    assert.ok(hit.choice, 'choice focused');
    assert.ok(hit.inView, hit.choice + ' in view');
    assert.ok(hit.hit, hit.choice + ' clickable');
    await page.locator('.event-card.is-council .event-choices button.focused').click({ trial: true });
    seen.add(hit.choice);
  }
  assert.strictEqual(seen.size, count, 'reached ' + [...seen].join(', '));
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-council-'));
  const { app, page } = await launch(ud);
  try {
    await start(page);
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      const s = game.state;
      if (!s.records) s.records = {};
      s.records.pride = { id: 'pride-e2e', name: 'Ash' };
      game.render();
    });
    await size(app, 1280, 720);
    await page.locator('[data-g="openMenu"]').click();
    await page.locator('#game-menu [data-g="settings"]').click();
    await page.waitForFunction(() => document.querySelector('.screen.active').dataset.screen === 'settings');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.screen.active').dataset.screen === 'game');
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      game.state.records.lastCouncilSeason = 0;
      game.render();
    });
    await page.locator('[data-g="nav"][data-view="councils"]').click();
    const status = page.locator('.council-line');
    const statusText = await status.innerText();
    assert.strictEqual(statusText, 'Opens next season. The leaders already met this season.');
    assert.ok(!/ready to sit/.test(statusText));
    const statusSize = await status.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(statusSize >= 18, 'council status ' + statusSize);
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      delete game.state.records.lastCouncilSeason;
      game.render();
    });
    await page.locator('.council-screen [data-g="leaderCouncil"]').click();
    await idle(page);
    await page.waitForSelector('.event-card.is-council');
    const lockedNav = page.locator('#home-nav button[aria-disabled="true"]').first();
    await lockedNav.hover();
    const tip = page.locator('#nav-lock-tip');
    await tip.waitFor({ state: 'visible' });
    const hovered = await tip.boundingBox();
    assert.ok(hovered && hovered.x >= 0 && hovered.y >= 0 && hovered.width > 0, 'lock tip is on screen');
    assert.match(await tip.innerText(), /Finish this first/);
    await lockedNav.focus();
    assert.match(await tip.innerText(), /Finish this first/);
    await assertFonts(page, '720-open');
    for (let i = 0; i < 24 && !(await page.locator('#game-event [data-choice="stay_out"]').count()); i++) {
      await assertFonts(page, '720-beat');
      await page.locator('#game-event [data-g="advanceBeat"]').first().click();
      await idle(page);
    }
    await choiceLayout(page, '720');
    await size(app, 853, 480);
    await page.waitForTimeout(100);
    await assertFonts(page, '853-choices');
    await choiceLayout(page, '853');
    await menuClearsNeeds(page);
    await choicesReachable(page);
    await size(app, 2560, 1080);
    await assertFonts(page, 'ultrawide-choices');
    await choiceLayout(page, 'ultrawide');
    await size(app, 1920, 1080);
    await assertFonts(page, '1080-choices');
    await choiceLayout(page, '1080');
    await page.locator('#game-event [data-choice="stay_out"]').click();
    await idle(page);
    await assertFonts(page, '1080-result');
    await size(app, 1280, 720);
    await assertFonts(page, '720-result');
    let sawStanding = false;
    for (let i = 0; i < 24; i++) {
      const card = page.locator('.event-card.is-council');
      if (!(await card.count())) break;
      const text = await card.innerText();
      if (/unchang|warmer|cooler|mind/.test(text)) sawStanding = true;
      const clicked = await page.evaluate(() => {
        const button = document.querySelector('#game-event [data-g="advanceBeat"], #game-event [data-g="continue"]');
        if (!button) return false;
        button.click();
        return true;
      });
      if (!clicked) break;
      await idle(page);
    }
    assert.ok(sawStanding, 'a standing line played after staying out');
    console.log('council e2e ok');
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
