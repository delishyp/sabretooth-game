/**
 * Same-save encounter art shots. ART_PHASE=before records the current panels.
 * ART_PHASE=after reloads those saves, checks the gameplay state, and opens Entire image.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = '/opt/cursor/artifacts';
const STORE = '/tmp/encounter-art-proof';
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(STORE, { recursive: true });
const PHASE = process.env.ART_PHASE || 'after';

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
async function reach(page, kind) {
  if (kind === 'deer') await page.locator('[data-g="hunt"][data-size="small"]').click();
  if (kind === 'wolf') await page.locator('[data-g="travel"][data-to="greywater_ford"]').click();
  if (kind === 'hyena') await page.locator('[data-g="travel"][data-to="twin_forks"]').click();
  await idle(page);
  await page.waitForSelector('.encounter-img');
}
const dump = (page) => page.evaluate(() => JSON.stringify(window.__menuDebug.game().state));
async function metrics(page) {
  return page.evaluate(() => {
    const img = document.querySelector('.encounter-img');
    const r = img.getBoundingClientRect();
    const save = document.querySelector('.talk-save').getBoundingClientRect();
    const choices = [...document.querySelectorAll('#game-event [data-choice]')].map((b) => {
      const box = b.getBoundingClientRect();
      return { id: b.dataset.choice, top: box.top, bottom: box.bottom, h: box.height };
    });
    const viewH = document.documentElement.clientHeight;
    return {
      art: { w: r.width, h: r.height, natW: img.naturalWidth, natH: img.naturalHeight, fit: getComputedStyle(img).objectFit },
      saveBottom: save.bottom, viewH,
      choices,
      prose: !!document.querySelector('[data-scroll="prose"]')
    };
  });
}

(async () => {
  const kinds = ['deer', 'wolf', 'hyena'];
  const sizes = [[1280, 720], [1920, 1080]];
  for (const kind of kinds) {
    const ud = path.join(STORE, kind);
    if (PHASE === 'before') fs.rmSync(ud, { recursive: true, force: true });
    const { app, page } = await launch(ud);
    try {
      await size(app, page, 1280, 720);
      if (PHASE === 'before') {
        await start(page);
        await reach(page, kind);
        await page.locator('.talk-utility [data-g="save"]').click();
        await page.waitForTimeout(300);
        fs.writeFileSync(path.join(STORE, `${kind}-state.json`), await dump(page));
      } else {
        await press(page, 'Enter');
        await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
        await idle(page);
        await page.waitForSelector('.encounter-img');
        const before = fs.readFileSync(path.join(STORE, `${kind}-state.json`), 'utf8');
        assert.strictEqual(await dump(page), before, `${kind} gameplay state changed`);
      }
      const measured = {};
      for (const [w, h] of sizes) {
        await size(app, page, w, h);
        const tag = h === 720 ? '720' : '1080';
        await shot(page, `encounter-${PHASE}-${kind}-${tag}.png`, w, h);
        measured[tag] = await metrics(page);
        if (PHASE === 'after') {
          const m = measured[tag];
          assert.strictEqual(m.art.fit, 'contain');
          assert.ok(m.saveBottom <= m.viewH + 1, `${kind} ${tag} save clipped ${m.saveBottom} > ${m.viewH}`);
          for (const choice of m.choices) assert.ok(choice.bottom <= m.viewH + 1 && choice.top >= 0, `${kind} ${tag} choice ${choice.id} off screen`);
          assert.ok(m.prose);
          const node = await page.evaluate(() => window.__menuDebug.game().state.encounters.pending.nodeId);
          await page.locator('[data-g="inspectEncounter"]').click();
          await page.waitForSelector('#encounter-inspect:not([hidden]) img');
          const opened = await page.evaluate(() => {
            const img = document.querySelector('#encounter-inspect img');
            const close = document.querySelector('#encounter-inspect-close');
            const box = img.getBoundingClientRect();
            const closeBox = close.getBoundingClientRect();
            const viewH = document.documentElement.clientHeight;
            const viewW = document.documentElement.clientWidth;
            return {
              fit: getComputedStyle(img).objectFit,
              natW: img.naturalWidth, natH: img.naturalHeight,
              w: box.width, h: box.height,
              closeTop: closeBox.top, closeBottom: closeBox.bottom, viewH, viewW,
              focused: document.querySelector('.focused')?.id || null
            };
          });
          assert.strictEqual(opened.fit, 'contain');
          assert.strictEqual(opened.natW, m.art.natW);
          assert.strictEqual(opened.natH, m.art.natH);
          assert.ok(opened.w >= m.art.w - 1 && opened.h >= m.art.h - 1, `${kind} ${tag} entire image is not larger`);
          assert.ok(opened.closeBottom <= opened.viewH + 1 && opened.closeTop >= 0, `${kind} ${tag} close off screen`);
          assert.strictEqual(opened.focused, 'encounter-inspect-close');
          await shot(page, `encounter-${PHASE}-${kind}-full-${tag}.png`, w, h);
          await page.keyboard.press('Escape');
          await page.waitForSelector('#encounter-inspect', { state: 'hidden' });
          const back = await page.evaluate(() => ({
            node: window.__menuDebug.game().state.encounters.pending.nodeId,
            hidden: document.querySelector('#encounter-inspect').hidden,
            focused: document.querySelector('.focused')?.dataset.g || null
          }));
          assert.strictEqual(back.hidden, true);
          assert.strictEqual(back.node, node);
          assert.strictEqual(back.focused, 'inspectEncounter');
        }
      }
      fs.writeFileSync(path.join(STORE, `${kind}-${PHASE}-metrics.json`), JSON.stringify(measured, null, 2));
      if (PHASE === 'after' && kind === 'deer') {
        await size(app, page, 1280, 720);
        const node = await page.evaluate(() => window.__menuDebug.game().state.encounters.pending.nodeId);
        for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('.focused')?.dataset.scroll) !== 'prose'; i++) {
          await page.keyboard.press('ArrowUp');
        }
        assert.strictEqual(await page.evaluate(() => document.querySelector('.focused')?.dataset.scroll), 'prose');
        await page.keyboard.press('PageDown');
        await page.keyboard.press('Enter');
        assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.encounters.pending.nodeId), node);
      }
      if (PHASE === 'after') assert.strictEqual(await dump(page), fs.readFileSync(path.join(STORE, `${kind}-state.json`), 'utf8'));
    } finally { await app.close(); }
  }
  console.log(`encounter art ${PHASE} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
