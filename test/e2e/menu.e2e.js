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
/** Creator with defaults: Up (button row, Next) Enter → step 2, Up (Start) Enter. */
async function throughCreator(page) { for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k); }
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
          await waitState(page, 'creator');                          // v1.4: Begin opens Make Your Sabrecat
          const cname = (await st(page)).creator.name;
          await throughCreator(page);
          await waitState(page, 'starting');
          assert.strictEqual((await st(page)).state, 'starting');
          const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', `run-${slot}`, 'run.json'), 'utf8'));
          assert.deepStrictEqual([run.style, run.difficulty, run.sandboxOptions === null], [style, death, death !== 'sandbox']);
          assert.strictEqual(run.catName, cname); assert.strictEqual(run.playerCat.ageSeasons, 12);
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
        await waitState(page, 'creator'); await throughCreator(page);
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
      const SCREENS = ['root', 'newGame', 'newGame:sandbox', 'creator', 'creator:personality', 'creator:sandbox', 'creator:sandbox-look', 'slotsFull', 'load', 'load:expanded', 'settings:audio', 'settings:display'];
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
    // Make Your Sabrecat (cat-creator-spec v0.2 §7 checks 1–11), keyboard / mouse / gamepad.
    const C = require(path.join(root, 'src/renderer/js/creator.js'));
    const names = require(path.join(root, 'src/renderer/data/menu-copy.json')).creator.defaultNames;
    const cr = async (page) => page.evaluate(() => window.__menuDebug.creator());
    const model = async (page) => (await cr(page)).model;
    const runJson = (ud, slot) => JSON.parse(fs.readFileSync(path.join(ud, 'saves', `run-${slot}`, 'run.json'), 'utf8'));
    const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
    const toCreator = async (page) => {                   // root (no saves or one free slot) → setup → Begin → creator
      await page.mouse.move(2, 2);
      if ((await st(page)).state !== 'root') { await page.evaluate(() => window.__menuDebug.show('root')); await waitState(page, 'root'); }
      await page.evaluate(() => document.querySelector('[data-action="newGame"]').click());
      await waitState(page, 'newGameSetup'); await press(page, 'ArrowUp', 'Enter'); await waitState(page, 'creator');
    };
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('creator §7.1: all 90 common looks (5 coats) render with no missing layer (adult pose per sex), each redraw < 100 ms', async () => {
        await toCreator(page); const times = [];
        for (const sex of C.SEXES) for (const coat of C.COATS) for (const markings of C.MARKINGS) for (const eyes of C.EYES) {
          const p = await page.evaluate((l) => window.__menuDebug.creatorLook(l), { sex, coat, markings, eyes });
          assert.deepStrictEqual(p.skipped, [], `${sex} ${coat} ${markings} ${eyes}`);
          assert.strictEqual(p.pose, `portrait-${sex}`);
          const want = ['shadow', 'base_coat', ...(markings === 'none' ? [] : [`markings_${markings}`]), 'eye_left', 'eye_right', 'sabers', 'lineart'];
          assert.deepStrictEqual(p.drawn, want); times.push(p.ms);
        }
        const warm = times.filter((_, i) => i % 45 !== 0);   // first draw per pose includes the one-time asset load
        assert.ok(Math.max(...warm) < 100, `max redraw ${Math.max(...warm).toFixed(1)} ms`);
        console.log(`    preview redraw: max ${Math.max(...warm).toFixed(1)} ms, mean ${(warm.reduce((a, b) => a + b, 0) / warm.length).toFixed(1)} ms`);
      });
      await check('creator keyboard flow: Name typed/filtered, Sex keeps look (2), Randomize (3), presets (8), clamps (9), Back/Next keep (10), Start → mainCat (6, 11)', async () => {
        await toCreator(page);
        let m = await model(page);
        assert.deepStrictEqual([m.step, m.focus], [1, 'name']); assert.ok(names.includes(m.name), m.name);
        assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'creator-name'));
        await page.keyboard.press('Control+A'); await page.keyboard.type('Ash  Tail7');
        m = await model(page); assert.strictEqual(m.name, 'Ash  Tail'); assert.strictEqual(m.nameError, 'creator.name.error.invalidChars');
        assert.match(await page.locator('[data-row="name"] .crow-help').textContent(), /letters, spaces/);
        await page.keyboard.press('Control+A'); await page.keyboard.type('Abcdefghijklmnopq');   // 17th character rejected (4)
        m = await model(page); assert.strictEqual(m.name, 'Abcdefghijklmnop'); assert.match(await page.locator('[data-row="name"] .crow-help').textContent(), /16/);
        await page.keyboard.press('Control+A'); await page.keyboard.type('Ash  Tail');
        await press(page, 'ArrowDown'); m = await model(page); assert.strictEqual(m.focus, 'sex');
        const look = { coat: m.coat, markings: m.markings, eyes: m.eyes };
        await press(page, 'ArrowRight'); const m2 = await model(page);
        assert.notStrictEqual(m2.sex, m.sex); assert.deepStrictEqual({ coat: m2.coat, markings: m2.markings, eyes: m2.eyes }, look);   // check 2
        await page.waitForFunction((sx) => window.__menuDebug.creator().preview.pose === `portrait-${sx}`, m2.sex, { timeout: 2000 });
        await press(page, 'ArrowDown', 'ArrowRight');                                  // Coat cycles
        assert.strictEqual((await model(page)).coat, C.COATS[(C.COATS.indexOf(look.coat) + 1) % C.COATS.length]);
        await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown');                       // markings, eyes, button row (Next)
        assert.strictEqual((await model(page)).focus, 'next');
        await press(page, 'ArrowLeft', 'ArrowLeft'); assert.strictEqual((await model(page)).focus, 'randomize');
        for (let i = 0; i < 8; i++) {                                                    // check 3
          const b = await model(page); await press(page, 'Enter'); const a = await model(page);
          assert.ok(a.coat !== b.coat || a.markings !== b.markings || a.eyes !== b.eyes, 'look changed');
          assert.deepStrictEqual([a.name, a.sex, a.traits, a.preset], [b.name, b.sex, b.traits, b.preset]);   // step 1 Randomize leaves personality (9)
        }
        const lookBefore = await model(page);
        await press(page, 'ArrowRight', 'ArrowRight', 'Enter');                           // Next
        m = await model(page); assert.deepStrictEqual([m.step, m.focus, m.preset], [2, 'preset', 'balanced']);
        await page.screenshot({ path: path.join(root, 'screenshots', 'creator-personality.png') });
        const want = { fighter: [75, 40, 70, 50, 40], peacemaker: [30, 75, 45, 60, 50], wanderer: [45, 35, 60, 30, 80], guardian: [55, 55, 50, 80, 35], balanced: [50, 50, 50, 50, 50] };
        for (let i = 0; i < 5; i++) {                                                    // check 8
          await press(page, 'ArrowRight'); m = await model(page);
          assert.deepStrictEqual(C.TRAITS.map((k) => m.traits[k]), want[m.preset]);
          assert.strictEqual(await page.locator('[data-row="preset"] .crow-val').textContent(), { balanced: 'Balanced', fighter: 'Fighter', peacemaker: 'Peacemaker', wanderer: 'Wanderer', guardian: 'Guardian' }[m.preset]);
        }
        await press(page, 'ArrowRight');                                                 // fighter
        await press(page, 'ArrowDown', 'ArrowRight'); m = await model(page);
        assert.deepStrictEqual([m.focus, m.traits.aggression, m.preset], ['trait:aggression', 80, 'custom']);
        assert.strictEqual(await page.locator('[data-row="preset"] .crow-val').textContent(), 'Custom');
        for (let i = 0; i < 5; i++) await press(page, 'ArrowRight');
        assert.strictEqual((await model(page)).traits.aggression, 80);                    // clamp 80 (9)
        await press(page, 'ArrowDown'); for (let i = 0; i < 12; i++) await press(page, 'ArrowLeft');
        assert.strictEqual((await model(page)).traits.sociability, 20);                   // clamp 20 (9)
        assert.match(await page.locator('[data-row="trait:sociability"] .end.low').textContent(), /Solitary/);
        assert.match(await page.locator('[data-row="trait:sociability"] .end.high').textContent(), /Friendly/);
        await press(page, 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft');      // preset → start → back → randomize
        assert.strictEqual((await model(page)).focus, 'randomize');
        for (let i = 0; i < 10; i++) {                                                   // step 2 Randomize: traits only, in range (9)
          await press(page, 'Enter'); m = await model(page);
          for (const v of Object.values(m.traits)) assert.ok(v >= 20 && v <= 80 && v % 5 === 0, String(v));
          assert.deepStrictEqual([m.coat, m.markings, m.eyes, m.sex, m.preset], [lookBefore.coat, lookBefore.markings, lookBefore.eyes, lookBefore.sex, 'custom']);
        }
        const traits = m.traits;
        await press(page, 'Escape'); m = await model(page);                               // check 10
        assert.deepStrictEqual([m.step, m.focus, m.coat, m.markings, m.eyes, m.name], [1, 'next', lookBefore.coat, lookBefore.markings, lookBefore.eyes, 'Ash  Tail']);
        await press(page, 'Enter'); m = await model(page); assert.deepStrictEqual([m.step, m.traits], [2, traits]);
        await press(page, 'ArrowUp'); assert.strictEqual((await model(page)).focus, 'start');
        await press(page, 'Enter'); await waitState(page, 'starting');
        const run = runJson(ud, 0);                                                       // checks 6 + 11
        assert.strictEqual(run.catName, 'Ash Tail');
        const pc = run.playerCat;
        assert.deepStrictEqual(pc.genes.personality, traits);
        assert.deepStrictEqual([pc.sex, pc.ageSeasons, pc.birthSeason, pc.scars], [m.sex, 12, { year: -2, season: 'spring' }, []]);
        assert.deepStrictEqual(pc.genes.loci, { coat: C.COAT_GENES[m.coat], dilute: ['D', 'D'], marking: Array(2).fill(C.MARKING_ALLELE[m.markings]), dorsal: ['ds', 'ds'],
          intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: Array(2).fill(C.EYE_ALLELE[m.eyes]), saber: ['ivory', 'ivory'], het: ['Het', 'Het'] });
        assert.deepStrictEqual([pc.genes.eyeRight, 'hetero' in pc.genes, pc.genes.mutations], [null, false, []]);
      });
      await check('M1: renderer console.warn / console.error / uncaught errors reach logs/menu.log', async () => {
        await page.evaluate(() => { console.warn('e2e-M1-warn', { a: 1 }); console.error('e2e-M1-error'); setTimeout(() => { throw new Error('e2e-M1-uncaught'); }); });
        await page.waitForTimeout(300);
        const logTxt = fs.readFileSync(path.join(ud, 'logs', 'menu.log'), 'utf8');
        assert.match(logTxt, /renderer warn: e2e-M1-warn \{"a":1\}/); assert.match(logTxt, /renderer error: e2e-M1-error/); assert.match(logTxt, /renderer error: uncaught: .*e2e-M1-uncaught/);
      });
      await check('creator §7.4: blank name shows emptyHint and Start fills a default name', async () => {
        await toCreator(page);
        await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.type('   ');
        assert.match(await page.locator('[data-row="name"] .crow-help').textContent(), /Leave it blank/);
        await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter'); await waitState(page, 'starting');
        assert.ok(names.includes(runJson(ud, 1).catName), runJson(ud, 1).catName);
      });
      await check('creator §7.5 + §1.2: Back from step 1 keeps setup choices and the run picked for replacement still exists', async () => {
        await page.evaluate(() => window.__menuDebug.show('root')); await waitState(page, 'root');
        await page.evaluate(() => document.querySelector('[data-action="newGame"]').click()); await waitState(page, 'slotsFull');
        const victim = runJson(ud, 0).runId;
        await page.mouse.move(2, 2); await press(page, 'Enter', 'ArrowUp', 'Enter'); await waitState(page, 'newGameSetup');   // replace run 1
        await press(page, 'ArrowRight', 'Enter', 'ArrowDown', 'ArrowLeft', 'Enter');      // Sim + Permadeath
        await press(page, 'ArrowDown', 'Enter'); await waitState(page, 'creator');        // Begin
        assert.ok(fs.existsSync(path.join(ud, 'saves', 'run-0', 'run.json')) && runJson(ud, 0).runId === victim, 'not deleted on Begin');
        await press(page, 'Escape'); await waitState(page, 'newGameSetup');
        const s = await st(page);
        assert.deepStrictEqual([s.state, s.setup.style, s.setup.death, s.dialog], ['newGameSetup', 'sim', 'permadeath', false]);   // no confirmation
        assert.match(await page.locator('#setup-summary').textContent(), /Replaces/);
        assert.strictEqual(runJson(ud, 0).runId, victim, 'replaced run still exists after Back');
        await press(page, 'Enter'); await waitState(page, 'creator');                      // Begin again → fresh creator, still replacing
        await throughCreator(page); await waitState(page, 'starting');
        const now = runJson(ud, 0); assert.notStrictEqual(now.runId, victim); assert.deepStrictEqual([now.style, now.difficulty], ['sim', 'permadeath']);
      });
    } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    const C = require(path.join(root, 'src/renderer/js/creator.js'));
    const names = require(path.join(root, 'src/renderer/data/menu-copy.json')).creator.defaultNames;
    const model = async (page) => (await page.evaluate(() => window.__menuDebug.creator())).model;
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('creator §7.7 mouse only: arrows, value clicks, Randomize, Next, slider track, preset, Back, Start', async () => {
        await page.locator('[data-action="newGame"]').click(); await waitState(page, 'newGameSetup');
        await page.locator('[data-nav="begin"]').click(); await waitState(page, 'creator');
        await page.screenshot({ path: path.join(root, 'screenshots', 'creator-look.png') });
        let m = await model(page);
        await page.locator('[data-row="coat"] .arrow[data-arrow="1"]').click();
        assert.strictEqual((await model(page)).coat, C.COATS[(C.COATS.indexOf(m.coat) + 1) % C.COATS.length]);
        await page.locator('[data-row="eyes"] .crow-val').click();
        assert.strictEqual((await model(page)).eyes, C.EYES[(C.EYES.indexOf(m.eyes) + 1) % 3]);
        await page.locator('[data-row="sex"] .arrow[data-arrow="-1"]').click();
        assert.notStrictEqual((await model(page)).sex, m.sex);
        await page.locator('[data-row="markings"]').hover(); m = await model(page); assert.strictEqual(m.focus, 'markings');
        assert.strictEqual(await page.locator('#creator-hint').textContent(), 'Click the arrows to change a row, then Start.');
        await page.locator('[data-cnav="randomize"]').click(); const r = await model(page);
        assert.ok(r.coat !== m.coat || r.markings !== m.markings || r.eyes !== m.eyes);
        await page.locator('#creator-name').click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Mouse Cat');
        await page.locator('[data-cnav="next"]').click(); assert.strictEqual((await model(page)).step, 2);
        await page.locator('[data-row="preset"] .arrow[data-arrow="-1"]').click(); assert.strictEqual((await model(page)).preset, 'guardian');
        const box = await page.locator('[data-row="trait:curiosity"] .track').boundingBox();
        await page.mouse.click(box.x + box.width - 1, box.y + box.height / 2);
        m = await model(page); assert.deepStrictEqual([m.traits.curiosity, m.preset], [80, 'custom']);
        await page.mouse.click(box.x + 1, box.y + box.height / 2); assert.strictEqual((await model(page)).traits.curiosity, 20);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); assert.strictEqual((await model(page)).traits.curiosity, 50);
        await page.locator('[data-row="trait:boldness"] .arrow[data-arrow="1"]').click(); assert.strictEqual((await model(page)).traits.boldness, 55);
        await page.locator('#creator-actions [data-cnav="back"]').click(); assert.strictEqual((await model(page)).step, 1);
        await page.locator('[data-cnav="next"]').click(); m = await model(page); assert.strictEqual(m.traits.boldness, 55);
        await page.locator('[data-cnav="start"]').click(); await waitState(page, 'starting');
        const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'utf8'));
        assert.strictEqual(run.catName, 'Mouse Cat'); assert.deepStrictEqual(run.playerCat.genes.personality, m.traits);
      });
      await check('creator §7.7 gamepad only: A on Name rerolls, D-pad rows/values, B back, Start = Next then Start; hint + name helper', async () => {
        // Fake XInput pad: navigator.getGamepads is read every frame by js/input.js.
        await page.evaluate(() => {
          const pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0] };
          window.__pad = pad; navigator.getGamepads = () => [pad];
          window.__tap = (i) => new Promise((ok) => { pad.buttons[i].pressed = true; setTimeout(() => { pad.buttons[i].pressed = false; setTimeout(ok, 60); }, 60); });
        });
        const tap = (i) => page.evaluate((b) => window.__tap(b), i);
        const A = 0, B = 1, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
        await tap(B); await waitState(page, 'root');                                        // placeholder → root
        await tap(A); await waitState(page, 'newGameSetup');                                // no saves: default focus is New Game
        await tap(UP); await tap(A); await waitState(page, 'creator');                      // Begin
        let m = await model(page); assert.strictEqual(m.focus, 'name');
        assert.match(await page.locator('#creator-hint').textContent(), /A on Name: new name/);
        assert.strictEqual(await page.locator('[data-row="name"] .crow-help').textContent(), 'Press A for another name.');
        await tap(A); const n2 = (await model(page)).name; assert.ok(names.includes(n2) && n2 !== m.name, `${m.name} → ${n2}`);
        await tap(DOWN); await tap(RIGHT); const m2 = await model(page); assert.deepStrictEqual([m2.focus, m2.sex !== m.sex], ['sex', true]);
        await tap(START); m = await model(page); assert.deepStrictEqual([m.step, m.focus], [2, 'preset']);   // Start = Next on step 1
        await tap(RIGHT); assert.strictEqual((await model(page)).preset, 'fighter');
        await tap(DOWN); await tap(LEFT); m = await model(page); assert.deepStrictEqual([m.traits.aggression, m.preset], [70, 'custom']);
        await tap(B); assert.strictEqual((await model(page)).step, 1);
        await tap(START); assert.strictEqual((await model(page)).traits.aggression, 70);
        await tap(START); await waitState(page, 'starting');
        const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-1', 'run.json'), 'utf8'));
        assert.deepStrictEqual([run.catName, run.playerCat.genes.personality.aggression], [n2, 70]);
      });
      await check('creator §7.9 Sandbox + Free Customization On opens 0–100; Off keeps 20–80', async () => {
        await page.evaluate(() => { navigator.getGamepads = () => []; });
        await page.evaluate(() => window.__menuDebug.show('creator:sandbox')); await waitState(page, 'creator');
        let m = await model(page); assert.deepStrictEqual(m.range, { min: 0, max: 100 });
        await page.mouse.move(2, 2); await page.keyboard.press('ArrowDown');
        for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
        assert.strictEqual((await model(page)).traits.aggression, 100);
        for (let i = 0; i < 22; i++) await page.keyboard.press('ArrowLeft');
        assert.strictEqual((await model(page)).traits.aggression, 0);
        await page.screenshot({ path: path.join(root, 'screenshots', 'creator-personality-sandbox.png') });
        await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await waitState(page, 'newGameSetup');
        assert.strictEqual(await page.locator('#sandbox-rows .opt').count(), 4, 'four Sandbox toggles');
        assert.strictEqual(await page.locator('[data-opt="freePerkRespec"]').count(), 0, 'freePerkRespec hidden until respec exists');
        // Sandbox panel: Free Customization is the 4th toggle; turn it Off, then Begin again
        await page.evaluate(() => document.querySelector('[data-nav="opt:freeCustomization"]').click()); await page.waitForTimeout(50);
        assert.strictEqual((await st(page)).setup.opts.freeCustomization, false);
        await page.evaluate(() => document.querySelector('[data-nav="begin"]').click()); await waitState(page, 'creator');
        m = await model(page); assert.deepStrictEqual(m.range, { min: 20, max: 80 });
      });
      await check('creator §3c.1: Sandbox with Free Customization Off shows no rare looks (rows, coat cycle, Randomize, restored look)', async () => {
        let m = await model(page); assert.deepStrictEqual([m.step, m.rare], [1, false]);
        assert.strictEqual(await page.locator('[data-row="oddEyes"]').count(), 0);
        assert.strictEqual(await page.locator('#creator-panel .rare-tag:not([hidden])').count(), 0);
        const seen = new Set(); for (let i = 0; i < 7; i++) { await page.locator('[data-row="coat"] .arrow[data-arrow="1"]').click(); seen.add((await model(page)).coat); }
        assert.deepStrictEqual([...seen].sort(), [...C.COATS].sort());
        for (let i = 0; i < 60; i++) { await page.locator('[data-cnav="randomize"]').click(); m = await model(page); assert.ok(C.COATS.includes(m.coat) && m.oddEyes === 'off', JSON.stringify(m)); }
        const p = await page.evaluate(() => window.__menuDebug.creatorLook({ coat: 'ash', oddEyes: 'on', eyeRight: 'green' }));
        m = await model(page); assert.ok(C.COATS.includes(m.coat) && m.oddEyes === 'off' && m.eyeRight === null, 'restored rare look is dropped');
        assert.deepStrictEqual(p.skipped, []);
      });
    } finally { await app.close().catch(() => {}); fs.rmSync(ud, { recursive: true, force: true }); }
  }
  {
    // cat-creator-spec v0.3.1 §3c: Sandbox + Free Customization On rare looks (pale, ash, odd eyes), fresh profile so Start creates run 1.
    const C = require(path.join(root, 'src/renderer/js/creator.js'));
    const model = async (page) => (await page.evaluate(() => window.__menuDebug.creator())).model;
    const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-e2e-'));
    const { app, page } = await launch(ud);
    try {
      await check('creator §3c / §7.1: Sandbox + FC On adds Pale/Ash (Rare tag) and Odd Eyes; Left/Right differ; rare looks render; Start writes het/het + eyeRight', async () => {
        await page.evaluate(() => window.__menuDebug.show('creator:sandbox')); await waitState(page, 'creator');
        await page.mouse.move(2, 2); await press(page, 'Escape');
        let m = await model(page); assert.deepStrictEqual([m.step, m.rare, m.oddEyes, m.focus], [1, true, 'off', 'next']);
        assert.ok(C.COATS.includes(m.coat), 'opens on a common look');
        assert.deepStrictEqual(await page.locator('#creator-panel .crow').evaluateAll((r) => r.map((x) => x.dataset.row)), ['name', 'sex', 'coat', 'markings', 'eyes', 'oddEyes']);
        assert.strictEqual(await page.locator('[data-row="oddEyes"] .crow-label').textContent(), 'Odd Eyes');
        assert.strictEqual(await page.locator('[data-row="oddEyes"] .crow-val').textContent(), 'Off');
        assert.strictEqual(await page.locator('[data-row="oddEyes"] .rare-tag').isVisible(), true);
        assert.strictEqual(await page.locator('[data-row="oddEyes"] .rare-tag').textContent(), 'Rare');
        // coat row: 7 options; Pale/Ash carry the Rare tag
        await press(page, 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp'); assert.strictEqual((await model(page)).focus, 'coat');
        const labels = {};
        for (let i = 0; i < 7; i++) { await press(page, 'ArrowRight'); const c = (await model(page)).coat;
          labels[c] = [await page.locator('[data-row="coat"] .crow-val').textContent(), await page.locator('[data-row="coat"] .rare-tag').isVisible()]; }
        assert.deepStrictEqual(labels, { tan: ['Tan', false], gray: ['Gray', false], brown: ['Brown', false], black: ['Black', false], sandy: ['Sandy', false], pale: ['Pale', true], ash: ['Ash', true] });
        // odd eyes on → Left Eye / Right Eye rows, always different
        await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown'); assert.strictEqual((await model(page)).focus, 'oddEyes');
        await press(page, 'Enter'); m = await model(page);
        assert.ok(m.oddEyes === 'on' && m.eyeRight && m.eyeRight !== m.eyes, JSON.stringify(m));
        assert.deepStrictEqual(await page.locator('#creator-panel .crow').evaluateAll((r) => r.map((x) => x.dataset.row)), ['name', 'sex', 'coat', 'markings', 'eyeLeft', 'eyeRight', 'oddEyes']);
        assert.deepStrictEqual([await page.locator('[data-row="eyeLeft"] .crow-label').textContent(), await page.locator('[data-row="eyeRight"] .crow-label').textContent()], ['Left Eye', 'Right Eye']);
        await press(page, 'ArrowUp'); assert.strictEqual((await model(page)).focus, 'eyeRight');
        for (let i = 0; i < 4; i++) { await press(page, 'ArrowRight'); m = await model(page); assert.notStrictEqual(m.eyeRight, m.eyes); }
        await press(page, 'ArrowUp'); for (let i = 0; i < 4; i++) { await press(page, 'ArrowRight'); m = await model(page); assert.notStrictEqual(m.eyeRight, m.eyes); }
        assert.match(await page.locator('#creator-canvas').getAttribute('aria-label'), new RegExp(`${m.eyes}/${m.eyeRight} eyes`));
        // every rare look renders on both bases with no missing layer
        for (const sex of C.SEXES) { await page.evaluate((sx) => window.__menuDebug.creatorLook({ sex: sx }), sex);   // first draw per pose loads its assets
        for (const coat of [...C.RARE_COATS, 'tan']) for (const [eyes, eyeRight] of [['amber', 'gold'], ['gold', 'green'], ['green', 'amber']]) for (const odd of ['on', 'off']) {
          const p = await page.evaluate((l) => window.__menuDebug.creatorLook(l), { sex, coat, markings: 'spotted', eyes, oddEyes: odd, eyeRight: odd === 'on' ? eyeRight : null });
          assert.deepStrictEqual(p.skipped, [], `${sex} ${coat} ${eyes}/${eyeRight}`);
          assert.deepStrictEqual(p.drawn, ['shadow', 'base_coat', 'markings_spotted', 'eye_left', 'eye_right', 'sabers', 'lineart']);
          assert.ok(p.ms < 100, `redraw ${p.ms.toFixed(1)} ms`);
        } }
        // the preview's genes tint eye_left and eye_right separately (pixels aren't compared: the committed placeholder far-eye mask is empty, genetics §2.5 art caveat)
        const eyeTints = await page.evaluate(async () => {
          await window.__menuDebug.creatorLook({ sex: 'male', coat: 'tan', markings: 'none', eyes: 'amber', oddEyes: 'on', eyeRight: 'green' });
          const L = Compositor.genesToLayers(Creator.genesFor(window.__menuDebug.creator().model));
          return [L.eye_left.tint, L.eye_right.tint, window.__menuDebug.creator().preview.drawn.includes('eye_right')];
        });
        assert.deepStrictEqual(eyeTints, ['#C98A1E', '#8FA34A', true]);
        // Randomize in Sandbox + FC: some rolls carry exactly one rare look (rate checked statistically in unit tests)
        await page.evaluate(() => window.__menuDebug.creatorLook({ coat: 'tan', oddEyes: 'off', eyeRight: null }));
        let rare = 0; const N = 300;
        for (let i = 0; i < N; i++) {
          await page.evaluate(() => document.querySelector('[data-cnav="randomize"]').click()); m = await model(page);
          const k = (C.RARE_COATS.includes(m.coat) ? 1 : 0) + (m.oddEyes === 'on' ? 1 : 0); assert.ok(k <= 1, JSON.stringify(m)); rare += k;
          if (m.oddEyes === 'on') assert.notStrictEqual(m.eyeRight, m.eyes);
        }
        assert.ok(rare >= 10 && rare <= 60, `rare ${rare}/${N}`);
        console.log(`    Sandbox Randomize: ${rare}/${N} rolls with a rare look`);
        // screenshot: Sandbox ash + odd eyes, then Start writes the §3c genes
        await page.evaluate(() => window.__menuDebug.show('creator:sandbox-look')); await waitState(page, 'creator');
        await page.waitForFunction(() => window.__menuDebug.creator().preview.rendered && window.__menuDebug.creator().preview.rendered.includes('|ash|'), null, { timeout: 3000 });
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(root, 'screenshots', 'creator-look-sandbox-ash-oddeyes.png') });
        m = await model(page); assert.deepStrictEqual([m.coat, m.eyes, m.oddEyes, m.eyeRight], ['ash', 'amber', 'on', 'green']);
        assert.strictEqual(await page.locator('[data-row="coat"] .rare-tag').isVisible(), true);
        await page.evaluate(() => document.querySelector('[data-cnav="next"]').click());
        await page.evaluate(() => document.querySelector('[data-cnav="start"]').click()); await waitState(page, 'starting');
        const run = JSON.parse(fs.readFileSync(path.join(ud, 'saves', 'run-0', 'run.json'), 'utf8'));
        assert.deepStrictEqual([run.difficulty, run.playerCat.genes.loci.coat, run.playerCat.genes.loci.het, run.playerCat.genes.loci.eyes, run.playerCat.genes.eyeRight],
          ['sandbox', ['melan', 'leuc'], ['het', 'het'], ['amber', 'amber'], 'green']);
      });
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
