/**
 * Electron smoke test (real app, real keyboard events). Needs a display; run with:  npm run test:e2e
 * Uses its own temp userData (never a QA dir) and closes the app at the end.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow(); await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(300);
  return { app, page };
}
const st = (page) => page.evaluate(() => window.__menuDebug.state());
/** Wait (up to 3s) until the menu reaches `state`; avoids timing flakes from async IPC. */
const waitState = (page, state) => page.waitForFunction((s) => window.__menuDebug.state().state === s, state, { timeout: 3000 }).catch(() => {});

(async () => {
  let failures = 0; const check = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.message); } };
  const STYLES = ['story', 'standard', 'sim']; const DEATHS = ['permadeath', 'heir', 'sandbox'];
  const horiz = (from, to, list) => { const d = list.indexOf(to) - list.indexOf(from); return Array(Math.abs(d)).fill(d < 0 ? 'ArrowLeft' : 'ArrowRight'); };
  const keysFor = (style, death) => [...horiz('standard', style, STYLES), 'Enter', 'ArrowDown', ...horiz('heir', death, DEATHS), 'Enter', 'ArrowDown',
    ...(death === 'sandbox' ? Array(4).fill('ArrowDown') : []), 'Enter'];
  // All 9 Style × Death rule combinations, by keyboard, two per app instance (slot 0 then slot 1).
  const combos = STYLES.flatMap((st) => DEATHS.map((d) => [st, d]));
  for (let i = 0; i < combos.length; i += 2) {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      for (const [slot, [style, death]] of combos.slice(i, i + 2).entries()) {
        await check(`keyboard starts ${style} + ${death}`, async () => {
          await page.mouse.move(2, 2);
          if ((await st(page)).state !== 'root') { await page.keyboard.press('Escape'); await waitState(page, 'root'); }
          await page.keyboard.press('Enter');                       // root default focus = New Game (no saves)
          await waitState(page, 'newGameSetup');
          const s0 = await st(page);
          assert.strictEqual(s0.state, 'newGameSetup');
          assert.deepStrictEqual([s0.setup.style, s0.setup.death, s0.setup.focus], ['standard', 'heir', 'style:standard']); // defaults every time
          for (const k of keysFor(style, death)) await page.keyboard.press(k);
          await waitState(page, 'starting');
          assert.strictEqual((await st(page)).state, 'starting');
          const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', `run-${slot}`, 'run.json'), 'utf8'));
          assert.deepStrictEqual([run.style, run.difficulty, run.sandboxOptions === null], [style, death, death !== 'sandbox']);
        });
      }
      if (i === 0) await check('both slots full → replace flow uses the summaryReplacing line', async () => {
        await page.keyboard.press('Escape'); await waitState(page, 'root'); await page.keyboard.press('Enter');
        await waitState(page, 'slotsFull');
        assert.strictEqual((await st(page)).state, 'slotsFull');
        await page.keyboard.press('Enter');                         // first run card → confirm dialog (focus Cancel)
        await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');   // OK = Replace
        await waitState(page, 'newGameSetup');
        assert.strictEqual((await st(page)).state, 'newGameSetup');
        const summary = await page.locator('#setup-summary').textContent();
        assert.ok(/Replaces/.test(summary), summary);
        await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');   // Begin (Standard + Heir)
        await waitState(page, 'starting');
        const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'utf8'));
        assert.deepStrictEqual([run.style, run.difficulty], ['standard', 'heir']);
      });
    } finally { await app.close(); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('hover moves focus only; Sandbox panel needs selection', async () => {
        await page.mouse.move(2, 2); await page.keyboard.press('Enter');
        const box = await page.locator('[data-nav="death:sandbox"]').boundingBox();
        await page.mouse.move(box.x + 20, box.y + 20); await page.waitForTimeout(100);
        const s = await st(page);
        assert.strictEqual(s.setup.focus, 'death:sandbox'); assert.strictEqual(s.setup.death, 'heir');
        assert.ok(await page.locator('#sandbox-panel').isHidden());
        await page.mouse.click(box.x + 20, box.y + 20); await page.waitForTimeout(100);
        assert.ok(await page.locator('#sandbox-panel').isVisible());
        await page.keyboard.press('Escape'); assert.strictEqual((await st(page)).state, 'root');
      });
    } finally { await app.close(); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('settings: Left/Right switch tabs, UI scale + fullscreen apply live, close flushes (B5/B6/B11)', async () => {
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); // New Game → (Load disabled, skipped) → Settings
        assert.strictEqual((await st(page)).state, 'settings'); await page.mouse.move(2, 2);
        for (let i = 0; i < 10 && (await st(page)).focused !== 'back'; i++) await page.keyboard.press('ArrowDown'); // to Back (non-slider)
        // focused: Back (non-slider) → Right switches tab to Display
        await page.keyboard.press('ArrowRight');
        assert.ok(await page.locator('#tabs [data-tab="display"].active').count());
        const before = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).transform);
        await page.locator('[data-key="uiScale"]').click(); await page.waitForTimeout(100);
        const after = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).transform);
        assert.notStrictEqual(before, after, 'uiScale applied live');
        await page.evaluate(() => { const b = document.querySelector('[data-key="mode"]'); b.click(); }); // borderless → windowed
        await page.evaluate(() => { const b = document.querySelector('[data-key="mode"]'); b.click(); }); // windowed → fullscreen
        await page.waitForTimeout(800);
        assert.strictEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), true);
        await page.evaluate(() => { const b = document.querySelector('[data-key="mode"]'); b.click(); b.click(); }); // → borderless → windowed
        await page.waitForTimeout(800);
        assert.strictEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), false);
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());   // close while still on Settings
        await new Promise((r) => setTimeout(r, 800));
        const saved = JSON.parse(fs.readFileSync(path.join(ud, 'settings.json'), 'utf8'));
        assert.strictEqual(saved.display.mode, 'windowed'); assert.notStrictEqual(saved.display.uiScale, 1.0);
      });
    } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    // N1: at every UI scale, every visible control on every menu screen stays inside the 1600×900 window.
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    require('child_process').execFileSync(process.execPath, [path.join(root, 'scripts', 'seed-demo-saves.js'), ud]);
    const { app, page } = await launch(ud);
    try {
      const SCREENS = ['root', 'newGame', 'newGame:sandbox', 'slotsFull', 'load', 'load:expanded', 'settings:audio', 'settings:display'];
      const setSize = async (w, h) => { await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [w, h]);
        await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [w, h], { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(150); };
      const offWindow = () => page.evaluate(() => {
        const W = innerWidth, H = innerHeight, out = [];
        for (const el of document.querySelectorAll('#stage button, #stage h1, #stage h2, #stage p, #stage label, #stage img')) {
          const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
          if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) out.push(`${el.tagName}.${el.className}#${el.id} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
        }
        return out;
      });
      const fitAll = async (u, screens = SCREENS) => {
        await page.evaluate((v) => window.__menuDebug.setUiScale(v), u);
        for (const screen of screens) {
          await page.evaluate((sc) => window.__menuDebug.show(sc), screen); await page.waitForTimeout(150);
          const bad = await offWindow(); assert.deepStrictEqual(bad, [], `${screen}: off-window ${bad.join('; ')}`);
        }
      };
      for (const [w, h, scales] of [[1600, 900, [0.8, 1.0, 1.1, 1.25, 1.5]], [1280, 720, [1.0, 1.25, 1.5]]]) {
        await setSize(w, h);
        for (const u of scales) await check(`${w}×${h} UI scale ${Math.round(u * 100)}%: all screens fit the window (N1)`, () => fitAll(u));
      }
      await check('resize 1600×900 → 1280×720 at UI scale 125% keeps New Game + Sandbox panel in the window (N1)', async () => {
        await setSize(1600, 900); await page.evaluate(() => window.__menuDebug.setUiScale(1.25));
        await page.evaluate(() => window.__menuDebug.show('newGame:sandbox')); await page.waitForTimeout(150);
        assert.deepStrictEqual(await offWindow(), []);
        await setSize(1280, 720);                                  // resize handler → scale() → fitActive()
        const bad = await offWindow(); assert.deepStrictEqual(bad, [], `after resize: ${bad.join('; ')}`);
      });
      await setSize(1600, 900);
      await page.evaluate(() => window.__menuDebug.setUiScale(1.25)); await page.evaluate(() => window.__menuDebug.show('newGame:sandbox'));
      await page.waitForTimeout(150); await page.screenshot({ path: path.join(root, 'screenshots', 'new-game-sandbox-scale125.png') });
    } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    // Menu music (spec v1.3.2 §7)
    const mus = (page) => page.evaluate(() => window.__menuDebug.music());
    const waitMusic = (page, st) => page.waitForFunction((s) => window.__menuDebug.music().state === s, st, { timeout: 8000 }).catch(() => {});
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    let { app, page } = await launch(ud);
    try {
      await check('music: plays on launch, fades in, ctx running (autoplay allowed)', async () => {
        await waitMusic(page, 'playing'); const m = await mus(page);
        assert.strictEqual(m.state, 'playing'); assert.strictEqual(m.ctxState, 'running'); assert.ok(Math.abs(m.duration - 211.2) < 0.1, m.duration);
        // ctx clock can run slower than wall time on a headless box, so wait on the gain itself
        await page.waitForFunction(() => window.__menuDebug.music().fadeGain > 0.95, null, { timeout: 8000 }).catch(() => {}); { const f = await mus(page); assert.ok(f.fadeGain > 0.95, 'fade-in complete ' + JSON.stringify(f)); }
        assert.ok(Math.abs((await mus(page)).volumeGain - 0.56) < 0.01);
      });
      await check('music: Music slider changes gain live, mute → 0 and keeps playing', async () => {
        await page.evaluate(() => window.__menuDebug.show('settings:audio')); await page.waitForTimeout(100);
        await page.locator('[data-key="music"]').click(); await page.waitForTimeout(150);     // 0.70 → 0.75
        assert.ok(Math.abs((await mus(page)).volumeGain - 0.6) < 0.01, String((await mus(page)).volumeGain));
        await page.locator('[data-key="mute"]').click(); await page.waitForTimeout(150);
        const m = await mus(page); assert.strictEqual(m.volumeGain, 0); assert.strictEqual(m.state, 'playing');
        await page.locator('[data-key="mute"]').click(); await page.waitForTimeout(150);
        assert.ok((await mus(page)).volumeGain > 0.59);
      });
      await check('music: starting a run fades out and stops; back to menu fades in', async () => {
        await page.evaluate(() => window.__menuDebug.show('starting')); await page.waitForTimeout(400);
        const mid = await mus(page); assert.strictEqual(mid.state, 'fadingOut'); assert.ok(mid.fadeGain < 0.9, String(mid.fadeGain));
        await waitMusic(page, 'stopped'); assert.strictEqual((await mus(page)).state, 'stopped');
        await page.keyboard.press('Escape'); await waitState(page, 'root'); await waitMusic(page, 'playing');
        const m = await mus(page); assert.strictEqual(m.state, 'playing'); assert.ok(m.fadeGain < 0.9, 'restarts from a fade-in');
      });
      await app.close(); await new Promise((r) => setTimeout(r, 500));
      const sp = path.join(ud, 'settings.json'); const sj = JSON.parse(fs.readFileSync(sp, 'utf8')); sj.audio.mute = true; fs.writeFileSync(sp, JSON.stringify(sj));
      ({ app, page } = await launch(ud));
      await check('music: launch while muted plays silently, music volume persisted', async () => {
        await waitMusic(page, 'playing'); const m = await mus(page);
        assert.strictEqual(m.state, 'playing'); assert.strictEqual(m.volumeGain, 0); assert.strictEqual(m.volume, 0);
        assert.strictEqual(JSON.parse(fs.readFileSync(sp, 'utf8')).audio.music, 0.75);
      });
    } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  console.log(failures ? `${failures} FAILED` : 'all e2e passed');
  process.exit(failures ? 1 : 0);
})();
