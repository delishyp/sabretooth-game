/**
 * Ordinary Highcrag path, seed 9, female player. Same legal policy as test/pride-member.test.js.
 * No affinity or standing is written by the test.
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
  await page.waitForTimeout(200);
  return { app, page };
}
const g = (page) => page.evaluate(() => window.__menuDebug.game());
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
async function size(app, w, h) {
  await app.evaluate(({ BrowserWindow }, box) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false); win.setContentSize(box.w, box.h);
  }, { w, h });
  await new Promise((r) => setTimeout(r, 250));
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
function stepToward(region, dest) {
  if (region === dest) return null;
  const prev = new Map();
  const seen = new Set([dest]);
  const queue = [dest];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of W.neighbours(cur)) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === region) return prev.get(region);
      queue.push(next);
    }
  }
  return null;
}
function compatible(s, npc) {
  const kind = s.records.attraction[npc.id];
  if (kind === 'either') return true;
  if (kind === 'same') return s.cat.sex === npc.sex;
  return s.cat.sex !== npc.sex;
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-pride-'));
  const { app, page } = await launch(ud);
  const shots = [];
  const flags = { court: false, mates: false, found: false };
  try {
    await page.evaluate((seed) => window.__menuDebug.setGameSeed(seed), 9);
    await page.mouse.move(2, 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    await page.evaluate(async () => window.__menuDebug.creatorLook({ sex: 'female' }));
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    const opened = (await g(page)).state;
    assert.strictEqual(opened.cat.sex, 'female');
    assert.strictEqual(opened.seed, 9);
    const portraits = Object.fromEntries(Object.values(opened.npcs).map((n) => [n.id, n.portraitId]));
    let target = null;
    for (let i = 0; i < 900; i++) {
      let s = (await g(page)).state;
      if (s.over) break;
      if (s.day >= 21 && s.phase === 'day' && s.records.seasonEndShown && s.records.pride) break;
      if (s.phase === 'event' && s.pending && s.pending.bond) {
        const choice = await page.evaluate(() => {
          const p = window.__menuDebug.game().state.pending;
          const prefer = ['found_here', 'acknowledge', 'court', 'open_close', 'open_acquainted', 'talk_warm', 'continue', 'route_alone'];
          const rows = p.choices || [];
          for (const id of prefer) {
            const row = rows.find((c) => c.id === id && !c.disabled);
            if (row) return row.id;
          }
          const any = rows.find((c) => !c.disabled);
          return any ? any.id : null;
        });
        if (!flags.court && choice === 'court' && s.npcs[s.pending.catId] && s.npcs[s.pending.catId].faction !== 'loner') {
          for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
            await size(app, w, h); shots.push(await shot(page, `pride-court-${tag}`));
          }
          flags.court = true;
        }
        if (!choice) await click(page, '#game-event [data-g="continue"]');
        else await click(page, `#game-event [data-choice="${choice}"]`);
        continue;
      }
      if (s.phase === 'event') {
        const pass = page.locator('#game-event [data-choice="introduce"], #game-event [data-choice="steady"], #game-event [data-choice="yield"], #game-event [data-choice="greet"], #game-event [data-choice="pass"], #game-event [data-choice="withdraw"]');
        if (await pass.count()) await click(page, '#game-event [data-choice="introduce"], #game-event [data-choice="steady"], #game-event [data-choice="yield"], #game-event [data-choice="greet"], #game-event [data-choice="pass"], #game-event [data-choice="withdraw"]');
        else await click(page, '#game-event [data-g="choose"]');
        continue;
      }
      if (s.phase === 'encounter') {
        await click(page, '#game-event [data-choice="leave"], #game-event [data-choice="give_ground"], #game-event [data-choice="retreat"], #game-event [data-choice="yield_kill"], #game-event [data-choice="withdraw"], #game-event [data-g="continue"]');
        continue;
      }
      if (s.phase === 'ford') {
        if (await page.locator('#game-event [data-choice="stay_out"]').count()) await click(page, '#game-event [data-choice="stay_out"]');
        else await click(page, '#game-event [data-g="continue"]');
        continue;
      }
      if (s.phase === 'border' || s.phase === 'conversation' || s.phase === 'eventResult') {
        if (!flags.mates && s.records.matePair && await page.locator('.relation-mates, .hud-mates').count()) {
          for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
            await size(app, w, h); shots.push(await shot(page, `pride-mates-${tag}`));
          }
          flags.mates = true;
        }
        if (!flags.found && s.pending && s.pending.group === 'founding') {
          for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
            await size(app, w, h); shots.push(await shot(page, `pride-founding-${tag}`));
          }
          flags.found = true;
        }
        const cont = page.locator('#game-event [data-g="continue"]');
        if (await cont.count()) await click(page, '#game-event [data-g="continue"]');
        else await click(page, '#game-event [data-choice="leave"], #game-event [data-choice="pause"], #game-event [data-choice="withdraw"]');
        continue;
      }
      if (s.phase !== 'day') throw new Error(`phase ${s.phase}`);
      target = Object.values(s.npcs).find((n) => n.id !== 'hc01' && n.met && n.faction === 'highcrag' && (n.stage === 'adult' || n.stage === 'elder') && compatible(s, n)) || target;
      const av = (await g(page)).available;
      const water = (id) => W.hasWater(id, s.season);
      let selector = '[data-g="rest"]';
      if (av.forced) selector = '[data-g="forced"]';
      else if (s.needs.thirst < 30 && !water(s.region)) {
        const to = (av.travel || []).find((t) => t.allowed && t.days === 1 && water(t.to));
        if (to) selector = `[data-g="travel"][data-to="${to.to}"]`;
      } else if (s.records.matePair && !s.records.pride && av.found && av.found.allowed) selector = '[data-g="found"]';
      else if (s.records.matePair && !s.records.pride && s.region !== 'split_rock') {
        const hop = stepToward(s.region, 'split_rock');
        const allowed = hop && (av.travel || []).find((t) => t.allowed && t.to === hop);
        if (allowed) selector = `[data-g="travel"][data-to="${hop}"]`;
      } else if (!s.records.matePair && s.region !== 'highcrag' && s.needs.thirst >= 30) {
        const hop = stepToward(s.region, 'highcrag');
        const allowed = hop && (av.travel || []).find((t) => t.allowed && t.to === hop);
        if (allowed) selector = `[data-g="travel"][data-to="${hop}"]`;
      } else if (target && (av.audience || []).some((row) => row.catId === target.id && row.allowed)) selector = `[data-g="askLeader"][data-cat="${target.id}"]`;
      else if (target && s.needs.energy >= 5 && s.needs.hunger > 15) {
        if ((av.court || []).some((row) => row.catId === target.id && row.allowed)) selector = `[data-g="court"][data-cat="${target.id}"]`;
        else if ((av.seekMate || []).some((row) => row.catId === target.id && row.allowed)) selector = `[data-g="seekMate"][data-cat="${target.id}"]`;
        else if (s.needs.hunger < 40 && av.hunt && av.hunt.allowed) selector = '[data-g="hunt"][data-size="small"]';
      } else if (s.needs.hunger < 40 && av.hunt && av.hunt.allowed) selector = '[data-g="hunt"][data-size="small"]';
      await click(page, selector);
    }
    const done = (await g(page)).state;
    assert.strictEqual(done.over, false);
    assert.ok(done.day >= 21);
    assert.ok(done.records.matePair);
    assert.strictEqual(done.records.departure.from, 'highcrag');
    assert.strictEqual(done.records.matePair.mateId, 'hc08');
    assert.strictEqual(done.npcs.hc08.portraitId, portraits.hc08);
    assert.strictEqual(done.records.cats.hc08.skills, null);
    assert.strictEqual(done.npcs.hc08.sex, opened.npcs.hc08.sex);
    assert.deepStrictEqual(done.npcs.hc08.personality, opened.npcs.hc08.personality);
    for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
      await size(app, w, h); shots.push(await shot(page, `pride-day21-${tag}`));
    }
    assert.ok(flags.court && flags.mates && flags.found, JSON.stringify(flags));
    const bond = done.worldMemory.ledger.filter((row) => row.sourceType === 'pride_bond' && row.actor === 'highcrag');
    assert.strictEqual(bond.length, 1);
    assert.strictEqual(bond[0].delta, 20);
    console.log('SHOTS', shots.join(' '));
    console.log('LEDGER', JSON.stringify({
      mate: done.records.matePair.mateId,
      from: done.records.departure.fromName,
      pride: done.records.pride.name,
      claim: done.records.pride.territory.claim,
      members: done.records.members.map((m) => m.catId),
      bond: bond[0].delta,
      day: done.day,
      receipts: done.records.receipts.length
    }));
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
