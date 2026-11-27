/**
 * Pair, conceive, give birth, see the cubs, and read the overcrowding warning.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..', '..');

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-breed-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  try {
    await page.waitForFunction(() => window.__menuDebug);
    await page.evaluate((n) => window.__menuDebug.setGameSeed(n), 11);
    await page.mouse.move(2, 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
    }
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    const known = await page.evaluate(() => {
      const game = window.__menuDebug.game();
      const s = game.state;
      s.cat.sex = 'female';
      s.cat.ageSeasons = 12;
      s.records.pride = { id: 'pride-e2e', name: 'Ash', denRegionId: s.region };
      s.records.matePair = { mateId: 'birch', bondedDay: 1 };
      s.npcs.birch = { id: 'birch', name: 'Birch', sex: 'male', ageSeasons: 12, lifeStage: 'adult', met: true, faction: 'pride-e2e', genes: { v: 2, personality: { sociability: 50 } } };
      s.map.claims[s.region] = Object.assign({}, s.map.claims[s.region], { 'pride-e2e': 80 });
      s.day = 1;
      const card = window.Breeding.onDay(s);
      s.pending = card;
      s.phase = 'event';
      game.render();
      return { id: card && card.eventId, text: card && card.beats[0].text, due: s.cat.pregnancy && s.cat.pregnancy.dueAbsDay };
    });
    assert.strictEqual(known.id, 'breeding.pregnancy_known');
    assert.match(known.text, /carrying/);
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      game.state.pending = null;
      game.state.phase = 'day';
      game.render();
    });
    await page.locator('[data-g="nav"][data-view="breeding"]').click();
    await page.waitForTimeout(100);
    const status = await page.locator('.breeding-screen').innerText();
    assert.match(status, /carrying|cubs/);
    const born = await page.evaluate((due) => {
      const game = window.__menuDebug.game();
      const s = game.state;
      s.day = due;
      const card = window.Breeding.onDay(s);
      s.pending = card;
      s.phase = 'event';
      game.render();
      return { id: card && card.eventId, text: card && card.beats.map((beat) => beat.text).join(' '), cubs: window.Breeding.view(s).cubs.length };
    }, known.due);
    assert.strictEqual(born.id, 'breeding.litter_born');
    assert.match(born.text, /cub/);
    assert.ok(born.cubs >= 1);
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      game.state.pending = null;
      game.state.phase = 'day';
      game.render();
    });
    await page.locator('[data-g="nav"][data-view="breeding"]').click();
    await page.waitForTimeout(80);
    const cubText = await page.locator('.breeding-cubs').innerText();
    assert.match(cubText, /Pebble|Flint|Fern|Reed|Mist|Ash|Wren|Bram|Lark|Tor/);
    const warning = await page.evaluate(() => {
      const game = window.__menuDebug.game();
      const s = game.state;
      s.day = 41;
      for (let i = 0; i < 10; i++) s.npcs['pad' + i] = { id: 'pad' + i, faction: 'pride-e2e', ageSeasons: 9, dead: false };
      const card = window.Breeding.onDay(s);
      s.pending = card;
      s.phase = 'event';
      game.render();
      return { id: card && card.eventId, text: card && card.beats[0].text, warned: window.Breeding.view(s).warning };
    });
    assert.strictEqual(warning.id, 'breeding.overcrowded');
    assert.match(warning.text, /press/);
    assert.strictEqual(warning.warned, true);
    console.log('breeding e2e ok');
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
