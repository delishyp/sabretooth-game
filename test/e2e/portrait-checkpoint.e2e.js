/**
 * DOM evidence for the portrait checkpoint: viewer keys stay inside the dialog and restore the opener,
 * registry failure falls back without a stale or substituted cat, reduced motion covers the OS and the setting,
 * and a registered id is the same bitmap from the creator through save/Continue.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const ID = 'cat-6e2d788dd48ff440';
const BAKED = 'cat-ee0fe001a6afbf55';
const SHOTS = process.env.CHECKPOINT_SHOTS || path.join(root, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(400);
  return { app, page };
}
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name) });

(async () => {
  let failures = 0;
  const errors = [];
  const check = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.stack || e.message); } };
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-portrait-e2e-'));
  const { app, page } = await launch(ud);
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await check('OS and game reduced motion both stop the menu snow, and leaving credits clears its timer', async () => {
      await page.mouse.move(2, 2);
      const snow = () => page.evaluate(() => getComputedStyle(document.getElementById('snow')).display);
      assert.notStrictEqual(await snow(), 'none');
      await page.evaluate(() => window.__menuDebug.show('credits'));
      await page.waitForFunction(() => window.__menuDebug.state().state === 'credits');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.creditsRunning()), true);
      await page.evaluate(() => window.__menuDebug.show('root'));
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.creditsRunning()), false);
      await page.evaluate(() => window.__menuDebug.show('settings:display'));
      await page.click('#tab-body [data-key="reducedMotion"]');
      assert.strictEqual(await page.evaluate(() => document.body.classList.contains('reduced-motion')), true);
      assert.strictEqual(await snow(), 'none');
      await page.click('#tab-body [data-key="reducedMotion"]');
      assert.strictEqual(await page.evaluate(() => document.body.classList.contains('reduced-motion')), false);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.body.classList.contains('reduced-motion'));
      assert.strictEqual(await snow(), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(() => !document.body.classList.contains('reduced-motion'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
    });

    await check('corrupt registry is refused and a missing file paints the runtime pose', async () => {
      await page.waitForFunction(() => window.__menuDebug.portraitOf('cat-6e2d788dd48ff440').file, null, { timeout: 8000 });
      const before = await page.evaluate(() => window.__menuDebug.portraitOf('cat-6e2d788dd48ff440').file);
      const bad = await page.evaluate(() => window.__menuDebug.adoptRegistry({ portraits: [{ id: 'Not A Slug', file: 'cats/x.png' }] }));
      assert.strictEqual(bad.ok, false);
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.portraitOf('cat-6e2d788dd48ff440').file), before);
      const missing = await page.evaluate(async () => {
        const raw = await (await fetch('../../assets/portraits/registry.json')).json();
        window.__menuDebug.adoptRegistry({
          sharedPose: 'portrait-female', defaultHead: raw.defaultHead,
          portraits: [{ id: 'gone-cat', file: 'cats/missing-file.png', head: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }],
        });
        const c = document.createElement('canvas');
        const look = { coat: 'tan', markings: 'none', eyes: 'amber', oddEyes: 'off', eyeRight: null, traits: { aggression: 50, sociability: 50, boldness: 50, loyalty: 50, curiosity: 50 } };
        const painted = await window.__menuDebug.paintPortrait({ portraitId: 'gone-cat', sex: 'female', look }, c, { frame: 'head' });
        window.__menuDebug.adoptRegistry(raw);
        const other = window.__menuDebug.portraitOf('cat-6e2d788dd48ff440');
        return { painted, width: c._full && c._full.width, other: other && other.file };
      });
      assert.strictEqual(missing.painted.ok, true);
      assert.strictEqual(missing.painted.runtime, true);
      assert.strictEqual(missing.painted.id, null);
      assert.ok(missing.width && missing.width !== 1448, 'runtime pose is not a registered plate');
      assert.strictEqual(missing.other, before);
    });

    await check('rapid paints keep only the latest cat', async () => {
      const out = await page.evaluate(async (ids) => {
        const c = document.createElement('canvas');
        const first = window.__menuDebug.paintPortrait({ portraitId: ids[0], sex: 'male' }, c, {});
        const second = window.__menuDebug.paintPortrait({ portraitId: ids[1], sex: 'female' }, c, {});
        const rs = await Promise.all([first, second]);
        return { id: c._portraitId, width: c._full && c._full.width, stale: rs.map((r) => r.stale) };
      }, [ID, BAKED]);
      assert.strictEqual(out.id, BAKED);
      assert.strictEqual(out.width, 1448);
      assert.ok(out.stale[0] || out.id === BAKED);
    });

    await check('creator viewer contains Tab, arrows and Enter, and Escape restores the opener without changing the name', async () => {
      await page.locator('[data-action="newGame"]').click();
      await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
      await page.locator('[data-nav="begin"]').click();
      await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
      await page.waitForFunction(() => window.__menuDebug.creator().preview.rendered, null, { timeout: 8000 });
      const before = await page.evaluate(() => window.__menuDebug.creator().model);
      await page.locator('#creator-expand').click();
      await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'cat-viewer-close');
      for (const key of ['Tab', 'Shift+Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(key);
      assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'cat-viewer-close');
      assert.strictEqual(await page.evaluate(() => document.getElementById('cat-viewer').hidden), false);
      const mid = await page.evaluate(() => window.__menuDebug.creator().model);
      assert.strictEqual(mid.name, before.name);
      assert.strictEqual(mid.coat, before.coat);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
      assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'creator-expand');
      await page.locator('#creator-expand').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.state().state), 'creator');
      assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'creator-expand');
      assert.strictEqual((await page.evaluate(() => window.__menuDebug.creator().model.name)), before.name);
    });

    await check('the same registered id survives creator, header, meeting, list, viewer, save and Continue', async () => {
      const painted = await page.evaluate((id) => window.__menuDebug.setPortraitId(id), ID);
      assert.strictEqual(painted.portraitId, ID);
      assert.strictEqual(painted.canvas, ID);
      await page.waitForFunction((id) => document.getElementById('creator-canvas')._portraitId === id, ID);
      const full = await page.evaluate(() => ({ w: document.getElementById('creator-canvas')._full.width, h: document.getElementById('creator-canvas')._full.height }));
      assert.deepStrictEqual(full, { w: 1448, h: 1086 });
      const sexSame = await page.evaluate((id) => {
        const m = window.__menuDebug.portraitOf(id, 'male');
        const f = window.__menuDebug.portraitOf(id, 'female');
        return m.file === f.file && m.id === id;
      }, ID);
      assert.strictEqual(sexSame, true);
      await shot(page, 'checkpoint-creator-head.png');
      await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      await page.waitForFunction((id) => document.getElementById('home-head').dataset.portraitId === id, ID, { timeout: 8000 });
      assert.strictEqual(await page.evaluate(() => document.body.classList.contains('menu-hidden')), true);
      assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('snow')).display), 'none');
      const day0 = await page.evaluate(() => window.__menuDebug.game().state.day);
      await page.locator('#home-expand').click();
      await page.waitForFunction(() => document.activeElement.id === 'cat-viewer-close');
      await page.keyboard.press('Tab');
      assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'cat-viewer-close');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
      assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'home-expand');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.state().state), 'game');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.day), day0);

      const meeting = await page.evaluate((id) => { window.__menuDebug.assignPortrait('hc01', id); return window.__menuDebug.forceMeeting('hc01'); }, ID);
      assert.strictEqual(meeting.choiceId, null);
      await page.waitForFunction((id) => { const c = document.getElementById('event-head'); return c && c.dataset.portraitId === id; }, ID, { timeout: 8000 });
      const choices = await page.locator('#game-event [data-g="choose"]').evaluateAll((els) => els.map((e) => e.dataset.choice));
      assert.deepStrictEqual(choices, ['introduce', 'withdraw', 'dismiss']);
      await shot(page, 'checkpoint-event-head.png');
      await page.locator('#game-event [data-g="expandCat"]').click();
      await page.waitForFunction(() => document.activeElement.id === 'cat-viewer-close');
      const viewerSize = await page.evaluate(() => ({ w: document.getElementById('cat-viewer-canvas').width, h: document.getElementById('cat-viewer-canvas').height }));
      assert.deepStrictEqual(viewerSize, { w: 1448, h: 1086 });
      await shot(page, 'checkpoint-event-full.png');
      for (const key of ['Tab', 'ArrowDown', 'Enter']) await page.keyboard.press(key);
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
      const held = await page.evaluate(() => { const s = window.__menuDebug.game().state; return { phase: s.phase, choice: s.pending.choiceId, affinity: s.npcs.hc01.affinity, day: s.day, seed: s.seed }; });
      assert.strictEqual(held.phase, 'event');
      assert.strictEqual(held.choice, null);
      assert.strictEqual(held.affinity, meeting.affinity);
      assert.strictEqual(held.day, meeting.day);
      assert.strictEqual(held.seed, meeting.seed);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__menuDebug.game().state.phase === 'eventResult');
      const once = await page.evaluate(() => { const s = window.__menuDebug.game().state; return { choice: s.pending.choiceId, affinity: s.npcs.hc01.affinity, day: s.day }; });
      assert.strictEqual(once.choice, 'introduce');
      assert.strictEqual(once.affinity, meeting.affinity + 5);
      assert.strictEqual(once.day, meeting.day);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__menuDebug.game().state.phase === 'day');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.npcs.hc01.affinity), meeting.affinity + 5);

      await page.locator('[data-view="cats"]').click();
      await page.waitForFunction((id) => { const c = document.getElementById('met-hc01'); return c && c.dataset.portraitId === id; }, ID, { timeout: 8000 });
      await page.locator('[data-source="met-hc01"]').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement && document.activeElement.dataset.source === 'met-hc01');
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.npcs.hc01.affinity), meeting.affinity + 5);

      const autoPath = path.join(ud, 'saves', 'run-0', 'save-0', 'game.json');
      for (let i = 0; i < 25 && !fs.existsSync(autoPath); i++) await page.waitForTimeout(200);
      assert.strictEqual(JSON.parse(fs.readFileSync(autoPath, 'utf8')).cat.portraitId, ID);
      await page.locator('[data-g="save"]').click();
      const manualPath = path.join(ud, 'saves', 'run-0', 'save-1', 'game.json');
      for (let i = 0; i < 25 && !fs.existsSync(manualPath); i++) await page.waitForTimeout(200);
      assert.strictEqual(JSON.parse(fs.readFileSync(manualPath, 'utf8')).cat.portraitId, ID);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
      assert.strictEqual(await page.evaluate(() => document.body.classList.contains('menu-hidden')), false);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      await page.waitForFunction((id) => document.getElementById('home-head').dataset.portraitId === id, ID, { timeout: 8000 });
      assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.cat.portraitId), ID);

      const legacy = await page.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__menuDebug.game().state)); delete s.cat.portraitId; s.npcs.hc01.portraitId = 'Not A Cat'; return s; });
      await page.evaluate((s) => window.__menuDebug.reloadGame(s), legacy);
      await page.waitForFunction(() => document.getElementById('home-head').dataset.runtime === '1');
      const after = await page.evaluate(() => { const s = window.__menuDebug.game().state; return { player: s.cat.portraitId, npc: s.npcs.hc01.portraitId, shown: document.getElementById('home-head').dataset.portraitId }; });
      assert.strictEqual(after.player, null);
      assert.strictEqual(after.npc, null);
      assert.strictEqual(after.shown, '');
    });

    await check('special-3 keeps its baked background', async () => {
      const px = await page.evaluate(async (id) => {
        const c = document.createElement('canvas');
        const painted = await window.__menuDebug.paintPortrait({ portraitId: id, sex: 'male' }, c, {});
        const g = c._full.getContext('2d').getImageData(0, 0, 1, 1).data;
        return { id: painted.id, mode: window.__menuDebug.portraitOf(id).nativeMode, issues: window.__menuDebug.portraitOf(id).knownIssues, px: [...g] };
      }, BAKED);
      assert.strictEqual(px.id, BAKED);
      assert.strictEqual(px.mode, 'RGB');
      assert.ok(px.issues.some((x) => /baked/i.test(x)));
      assert.strictEqual(px.px[3], 255);
    });

    const portraitErrors = errors.filter((e) => !/logo/i.test(e));
    assert.deepStrictEqual(portraitErrors, []);
  } finally {
    await app.close();
    fs.rmSync(ud, { recursive: true, force: true });
  }
  if (failures) { console.log(failures + ' failed'); process.exit(1); }
  console.log('portrait checkpoint e2e passed');
})().catch((e) => { console.error(e); process.exit(1); });
