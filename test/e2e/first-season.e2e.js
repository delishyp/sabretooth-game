/**
 * First-season UI: seed 34, male player, the same legal day policy as test/first-season.test.js.
 * Courtship and founding choices sit in the green bond group. Save stays in the header.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const WorldMap = require(path.join(root, 'src/renderer/js/worldmap.js'));
const W = WorldMap.create(require(path.join(root, 'src/renderer/data/map.json')));
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(300);
  return { app, page };
}
const g = (page) => page.evaluate(() => window.__menuDebug.game());
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
async function size(app, w, h) {
  await app.evaluate(({ BrowserWindow }, box) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(box.w, box.h);
  }, { w, h });
  await new Promise((r) => setTimeout(r, 300));
}
async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, scale: 'css' });
  return file;
}
async function click(page, selector) {
  await page.locator(selector).first().click();
  await idle(page);
}

async function captureCard(app, page, shots, name) {
  const separated = await page.evaluate(() => ({
    saveInChoices: document.querySelectorAll('.bond-choices [data-g="save"]').length,
    navInChoices: document.querySelectorAll('.bond-choices [data-g="nav"]').length,
    headerSave: document.querySelectorAll('.home-tools [data-g="save"]').length,
    court: document.querySelectorAll('.bond-choices .is-court').length,
    found: document.querySelectorAll('.bond-choices .is-found, .bond-card[data-kind="founding"]').length
  }));
  assert.strictEqual(separated.saveInChoices, 0);
  assert.strictEqual(separated.navInChoices, 0);
  assert.strictEqual(separated.headerSave, 1);
  await size(app, 1280, 720);
  shots.push(await shot(page, `${name}-720`));
  await size(app, 1920, 1080);
  shots.push(await shot(page, `${name}-1080`));
  return separated;
}
async function clearPhase(app, page, shots, flags) {
  for (let i = 0; i < 8; i++) {
    const { state: s } = await g(page);
    if (s.phase === 'day') return s;
    if (s.phase === 'event' && s.pending && s.pending.bond) {
      const choice = await page.evaluate(() => {
        const p = window.__menuDebug.game().state.pending;
        const prefer = ['found_here', 'court', 'open_close', 'open_acquainted', 'talk_warm', 'acknowledge', 'continue', 'route_alone', 'route_pride'];
        const rows = p.choices || [];
        for (const id of prefer) {
          const row = rows.find((c) => c.id === id && !c.disabled);
          if (row) return row.id;
        }
        const any = rows.find((c) => !c.disabled);
        return any ? any.id : null;
      });
      if (!flags.target && s.pending.catId) flags.target = s.pending.catId;
      if (!choice) throw new Error('bond card has no choice');
      if (!flags.court && choice === 'court') {
        const separated = await captureCard(app, page, shots, 'courtship');
        assert.ok(separated.court >= 1);
        flags.court = true;
      }
      if (!flags.found && (choice === 'found_here' || (s.pending.group === 'founding'))) {
        await captureCard(app, page, shots, 'founding');
        flags.found = true;
      }
      await click(page, `#game-event [data-choice="${choice}"]`);
      continue;
    }
    if ((s.phase === 'event' || s.phase === 'eventResult') && s.pending && s.pending.bond && s.pending.group === 'founding' && !flags.found) {
      await captureCard(app, page, shots, 'founding');
      flags.found = true;
    }
    if (s.phase === 'event') {
      if (s.pending && s.pending.catId && s.npcs[s.pending.catId] && s.npcs[s.pending.catId].faction === 'loner') flags.target = s.pending.catId;
      const pass = page.locator('#game-event [data-choice="pass"], #game-event [data-choice="withdraw"], #game-event [data-choice="leave"]');
      if (await pass.count()) await click(page, '#game-event [data-choice="pass"], #game-event [data-choice="withdraw"], #game-event [data-choice="leave"]');
      else await click(page, '#game-event [data-g="choose"]');
      continue;
    }
    if (s.phase === 'encounter') {
      const leave = page.locator('#game-event [data-choice="leave"], #game-event [data-choice="give_ground"], #game-event [data-choice="retreat"], #game-event [data-choice="yield_kill"], #game-event [data-choice="withdraw"], #game-event [data-g="continue"]');
      await click(page, '#game-event [data-choice="leave"], #game-event [data-choice="give_ground"], #game-event [data-choice="retreat"], #game-event [data-choice="yield_kill"], #game-event [data-choice="withdraw"], #game-event [data-g="continue"]');
      void leave;
      continue;
    }
    if (s.phase === 'ford') {
      const stay = page.locator('#game-event [data-choice="stay_out"]');
      if (await stay.count()) await click(page, '#game-event [data-choice="stay_out"]');
      else await click(page, '#game-event [data-g="continue"]');
      continue;
    }
    if (s.phase === 'border' || s.phase === 'conversation' || s.phase === 'eventResult') {
      const cont = page.locator('#game-event [data-g="continue"]');
      if (await cont.count()) await click(page, '#game-event [data-g="continue"]');
      else await click(page, '#game-event [data-choice="leave"], #game-event [data-choice="withdraw"], #game-event [data-choice="pause"]');
      continue;
    }
    throw new Error(`unhandled phase ${s.phase}`);
  }
  return (await g(page)).state;
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-season-'));
  const { app, page } = await launch(ud);
  const shots = [];
  try {
    await page.evaluate((seed) => window.__menuDebug.setGameSeed(seed), 34);
    await page.mouse.move(2, 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    await page.evaluate(async () => window.__menuDebug.creatorLook({ sex: 'male' }));
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    const opened = (await g(page)).state;
    assert.strictEqual(opened.cat.sex, 'male');
    assert.strictEqual(opened.seed, 34);
    assert.strictEqual(opened.records.yearLengthDays, null);
    const portraits = Object.fromEntries(Object.values(opened.npcs).map((n) => [n.id, n.portraitId]));
    const flags = { court: false, found: false, target: null };
    for (let i = 0; i < 280; i++) {
      let s = await clearPhase(app, page, shots, flags);
      if (s.over) break;
      if (s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown && s.records.pride) break;
      const target = flags.target;
      const av = (await g(page)).available;
      const water = (id) => W.hasWater(id, s.season);
      let selector = null;
      if (av.forced) selector = '[data-g="forced"]';
      else if ((s.needs.thirst < 30) && !water(s.region)) {
        const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && water(t.to));
        if (to) selector = `[data-g="travel"][data-to="${to.to}"]`;
      } else if (target && s.region !== 'split_rock' && s.needs.thirst >= 30) {
        const back = (av.travel || []).find((t) => t.allowed && t.to === 'split_rock');
        if (back) selector = '[data-g="travel"][data-to="split_rock"]';
      }
      if (!selector && s.records.matePair && !s.records.pride && av.found && av.found.allowed) selector = '[data-g="found"]';
      if (!selector && target && s.needs.hunger > 20 && s.needs.energy >= 5 && !s.records.matePair) {
        const seek = (av.seekMate || []).find((row) => row.catId === target && row.allowed);
        if (seek) selector = `[data-g="seekMate"][data-cat="${target}"]`;
      }
      if (!selector && target && s.needs.hunger > 20) {
        const court = (av.court || []).find((row) => row.catId === target && row.allowed);
        if (court) selector = `[data-g="court"][data-cat="${target}"]`;
      }
      if (!selector && s.needs.hunger < 40 && av.hunt && av.hunt.allowed) selector = '[data-g="hunt"][data-size="small"]';
      if (!selector) selector = '[data-g="rest"]';
      await click(page, selector);
    }
    const done = (await g(page)).state;
    assert.strictEqual(done.over, false);
    assert.ok(done.day >= 21, `stopped on day ${done.day}`);
    assert.strictEqual(done.records.seasonEndShown, true);
    assert.ok(done.records.matePair, 'no mate');
    assert.ok(done.records.pride, 'no pride');
    assert.strictEqual(done.records.pride.territory.size, 60);
    assert.strictEqual(done.records.members.length, 2);
    const mate = done.npcs[done.records.matePair.mateId];
    assert.strictEqual(mate.portraitId, portraits[mate.id]);
    assert.strictEqual(done.records.cats[mate.id].skills, null);
    assert.strictEqual(done.records.yearLengthDays, null);
    assert.strictEqual(done.cat.sex, 'male');
    assert.strictEqual(done.records.matePair.mateSex, mate.sex);
    await size(app, 1280, 720);
    shots.push(await shot(page, 'day21-720'));
    await size(app, 1920, 1080);
    shots.push(await shot(page, 'day21-1080'));
    assert.ok(flags.court, 'courtship card was not shown');
    assert.ok(flags.found, 'founding choice was not shown');
    console.log('SHOTS', shots.join(' '));
    console.log('MATE', mate.id, mate.sex, 'DAY', done.day, 'PRIDE', done.records.pride.name);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
