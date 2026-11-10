/**
 * Captures one multi-beat meeting, a scent reading, and one cat approach at 720 and 1080.
 * The approach uses seed 1 at ice_wall, where the existing loner chance brings ln01.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.SCENE_SHOTS || '/opt/cursor/artifacts/scene-beats';
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-beats-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', '--force-device-scale-factor=1', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  const resize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h), { w, h });
    await page.waitForTimeout(250);
    const got = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    assert.deepStrictEqual(got, { w, h });
  };
  const overflow = async () => page.evaluate(() => {
    const card = document.querySelector('.event-card');
    const beat = document.querySelector('.event-beat');
    return {
      page: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      card: !card || card.scrollWidth <= card.clientWidth + 1,
      beat: !beat || beat.scrollWidth <= beat.clientWidth + 1
    };
  });
  await page.evaluate(() => window.__menuDebug.setGameSeed(1));
  await page.locator('[data-action="newGame"]').click();
  await page.locator('[data-nav="begin"]').click();
  await page.locator('[data-cnav="next"]').click();
  await page.locator('[data-cnav="start"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');

  await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    const n = s.npcs.bf01;
    n.met = true;
    s.phase = 'event';
    s.pending = { eventId: 'slice.meeting.bonefield', kind: 'first_meeting', catId: 'bf01', catName: n.name, day: s.day, hostile: false, choiceId: null, beatIndex: 0 };
    window.__menuDebug.assignPortrait('player', s.cat.portraitId);
  });
  await page.waitForFunction(() => document.querySelector('.event-beat'));
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await resize(w, h);
    const fit = await overflow();
    assert.deepStrictEqual(fit, { page: true, card: true, beat: true });
    await page.screenshot({ path: path.join(SHOTS, `beats-meeting-${tag}.png`) });
  }
  await resize(1280, 720);
  for (let i = 0; i < 4 && !(await page.locator('[data-g="choose"]').count()); i++) {
    await page.locator('[data-g="advanceBeat"]').click();
  }
  await page.waitForFunction(() => document.querySelector('[data-g="choose"]'));
  await page.screenshot({ path: path.join(SHOTS, 'beats-meeting-choices-720.png') });

  await page.evaluate(() => window.__menuDebug.gameAct({ type: 'continue' }));
  await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    s.phase = 'day'; s.pending = null;
    s.npcs.ln05.met = true;
    s.region = s.npcs.ln05.homeZones[0];
    window.__menuDebug.assignPortrait('player', s.cat.portraitId);
  });
  await page.locator('[data-g="scent"]').click();
  await page.waitForFunction(() => document.querySelector('.event-beat'));
  const metName = await page.evaluate(() => window.__menuDebug.game().state.npcs.ln05.name);
  for (let i = 0; i < 40; i++) {
    const text = await page.evaluate(() => document.querySelector('.event-beat').textContent);
    if (text.includes(metName)) break;
    const next = page.locator('[data-g="advanceBeat"]');
    if (!(await next.count())) break;
    await next.click();
  }
  const scentText = await page.evaluate(() => document.querySelector('.event-beat').textContent);
  assert.ok(scentText.includes(metName), scentText);
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await resize(w, h);
    const fit = await overflow();
    assert.deepStrictEqual(fit, { page: true, card: true, beat: true });
    await page.screenshot({ path: path.join(SHOTS, `scent-sign-${tag}.png`) });
  }

  await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    s.phase = 'day'; s.pending = null;
    s.region = s.npcs.ln05.homeZones[0];
    for (const n of Object.values(s.npcs)) if (n.faction === 'loner') { n.met = true; n.affinity = 25; }
    const cat = s.npcs.ln01;
    cat.personality = Object.assign({}, cat.personality, { sociability: 80, aggression: 40, loyalty: 40, curiosity: 40 });
    window.__menuDebug.assignPortrait('player', s.cat.portraitId);
  });
  await page.locator('[data-g="approach"]').click();
  await page.waitForFunction(() => document.querySelector('.event-beat'));
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await resize(w, h);
    const fit = await overflow();
    assert.deepStrictEqual(fit, { page: true, card: true, beat: true });
    await page.screenshot({ path: path.join(SHOTS, `cat-approach-${tag}.png`) });
  }
  const who = await page.evaluate(() => window.__menuDebug.game().state.pending.catId);
  assert.ok(who);

  await page.evaluate(() => {
    const s = window.__menuDebug.game().state;
    s.phase = 'day'; s.pending = null; s.day = 1; s.region = 'mistwood';
    s.records.receipts = (s.records.receipts || []).filter((k) => !k.includes('/approach/'));
    for (const n of Object.values(s.npcs)) if (n.faction === 'loner') { n.met = false; n.affinity = 0; }
    const n = s.npcs.mw04;
    n.met = true; n.affinity = 25;
    n.personality = { aggression: 40, sociability: 50, boldness: 40, loyalty: 90, curiosity: 40 };
    window.__menuDebug.assignPortrait('player', s.cat.portraitId);
  });
  await page.locator('[data-g="approach"]').click();
  await page.waitForFunction(() => document.querySelector('.event-beat') && document.querySelector('.event-beat').textContent.includes('Fog lies on the marsh'));
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await resize(w, h);
    const fit = await overflow();
    assert.deepStrictEqual(fit, { page: true, card: true, beat: true });
    await page.screenshot({ path: path.join(SHOTS, `mistwood-request-${tag}.png`) });
  }
  for (let i = 0; i < 8 && !(await page.locator('[data-g="sceneChoose"]').count()); i++) {
    await page.locator('[data-g="advanceBeat"]').click();
  }
  await page.waitForFunction(() => document.querySelector('[data-g="sceneChoose"]'));
  const ask = await page.evaluate(() => document.querySelector('.event-beat').textContent);
  assert.ok(ask.includes('Bring me a hare'));
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await resize(w, h);
    const fit = await overflow();
    assert.deepStrictEqual(fit, { page: true, card: true, beat: true });
    await page.screenshot({ path: path.join(SHOTS, `mistwood-request-choices-${tag}.png`) });
  }
  await app.close();
  console.log('scene captures', SHOTS, who);
})().catch((e) => { console.error(e); process.exit(1); });
