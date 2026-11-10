/**
 * Rendered coverage: every registered portrait, both sexes, head and full,
 * at 1280x720 and 1920x1080, plus a legacy player blank after migration.
 * The sheets are painted by the game's portrait renderer, then photographed in the window.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.COVERAGE_SHOTS || '/opt/cursor/artifacts/portrait-legacy-coverage';
const DEFAULT = 'cat-6e2d788dd48ff440';
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-coverage-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForFunction(() => window.__menuDebug);
  const resize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h), { w, h });
    await page.waitForTimeout(200);
  };
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name) });

  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await page.waitForFunction(() => window.__menuDebug.creator().preview.rendered, null, { timeout: 8000 });

  const ids = await page.evaluate(async () => (await (await fetch('../../assets/portraits/registry.json')).json()).portraits.map((p) => p.id));
  assert.strictEqual(ids.length, 40);
  assert.strictEqual(ids[0], DEFAULT);

  const creatorSums = {};
  for (const sex of ['female', 'male']) {
    creatorSums[sex] = [];
    for (const id of ids) {
      const row = await page.evaluate(async ({ id, sex }) => {
        await window.__menuDebug.creatorLook({ sex });
        const shown = await window.__menuDebug.setPortraitId(id);
        const c = document.getElementById('creator-canvas');
        const src = c._full;
        const d = src.getContext('2d').getImageData(Math.floor(src.width / 2) - 4, Math.floor(src.height / 2) - 4, 8, 8).data;
        let sum = 0;
        for (let i = 0; i < d.length; i++) sum = (sum + d[i] * (i + 1)) % 1000003;
        return { id: shown.portraitId, canvas: c.dataset.portraitId, runtime: c.dataset.runtime, w: src.width, h: src.height, sex: window.__menuDebug.creator().model.sex, sum };
      }, { id, sex });
      assert.strictEqual(row.id, id);
      assert.strictEqual(row.canvas, id);
      assert.strictEqual(row.runtime, '0');
      assert.strictEqual(row.sex, sex);
      assert.ok(row.w > 0 && row.h > 0);
      assert.ok(row.sum > 0);
      creatorSums[sex].push(row.sum);
    }
  }
  assert.deepStrictEqual(creatorSums.female, creatorSums.male);
  assert.ok(new Set(creatorSums.female).size > 1);

  async function sheet(sex, frame, w, h, file) {
    await resize(w, h);
    const rows = await page.evaluate(async ({ ids, sex, frame, w, h, file }) => {
      const cols = 8;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d');
      g.fillStyle = '#241810';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f3e6d0';
      g.font = '16px serif';
      g.fillText(`${file}  ${ids.length} portraits  sex ${sex}  ${frame}`, 8, 18);
      const cellW = Math.floor(w / cols);
      const cellH = Math.floor((h - 24) / 5);
      const out = [];
      for (let i = 0; i < ids.length; i++) {
        const tile = document.createElement('canvas');
        const painted = await window.__menuDebug.paintPortrait({ portraitId: ids[i], sex }, tile, frame === 'head' ? { frame: 'head' } : {});
        const x = (i % cols) * cellW;
        const y = 24 + Math.floor(i / cols) * cellH;
        if (tile.width && tile.height) g.drawImage(tile, x + 1, y + 1, cellW - 2, cellH - 2);
        const d = tile.width ? tile.getContext('2d').getImageData(Math.floor(tile.width / 2), Math.floor(tile.height / 2), 1, 1).data : [0, 0, 0, 0];
        out.push({ id: ids[i], painted: painted.id, w: tile.width, h: tile.height, ink: d[0] + d[1] + d[2] + d[3] });
      }
      let host = document.getElementById('coverage-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'coverage-host';
        host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#241810';
        document.body.appendChild(host);
      }
      host.replaceChildren(canvas);
      return out;
    }, { ids, sex, frame, w, h, file });
    assert.strictEqual(rows.length, 40);
    for (const row of rows) {
      assert.strictEqual(row.painted, row.id, `${file} ${row.id}`);
      assert.ok(row.w > 0 && row.h > 0, `${file} ${row.id}`);
      assert.ok(row.ink > 0, `${file} ${row.id}`);
    }
    await shot(file);
    return rows;
  }

  const headFemale720 = await sheet('female', 'head', 1280, 720, 'sheet-head-female-720.png');
  const headMale720 = await sheet('male', 'head', 1280, 720, 'sheet-head-male-720.png');
  assert.deepStrictEqual(headFemale720.map((r) => r.painted), headMale720.map((r) => r.painted));
  await sheet('female', 'full', 1280, 720, 'sheet-full-female-720.png');
  await sheet('male', 'full', 1280, 720, 'sheet-full-male-720.png');
  await sheet('female', 'head', 1920, 1080, 'sheet-head-female-1080.png');
  await sheet('male', 'head', 1920, 1080, 'sheet-head-male-1080.png');
  await sheet('female', 'full', 1920, 1080, 'sheet-full-female-1080.png');
  await sheet('male', 'full', 1920, 1080, 'sheet-full-male-1080.png');
  await page.evaluate(() => { const host = document.getElementById('coverage-host'); if (host) host.remove(); });

  await page.locator('[data-cnav="next"]').click();
  await page.locator('[data-cnav="start"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await page.waitForFunction(() => document.getElementById('home-head'), null, { timeout: 8000 });

  for (const sex of ['female', 'male']) {
    const legacy = await page.evaluate((sex) => {
      const s = JSON.parse(JSON.stringify(window.__menuDebug.game().state));
      delete s.cat.portraitId;
      delete s.cat.portraitLegacy;
      s.cat.sex = sex;
      s.cat.name = sex === 'female' ? 'Legacy Doe' : 'Legacy Buck';
      return s;
    }, sex);
    const genes = legacy.cat.genes;
    const name = legacy.cat.name;
    await page.evaluate((s) => window.__menuDebug.reloadGame(s), legacy);
    await page.waitForFunction((id) => {
      const c = document.getElementById('home-head');
      return c && c.dataset.portraitId === id && c.dataset.runtime === '0';
    }, DEFAULT, { timeout: 8000 });
    const state = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      return { id: s.cat.portraitId, legacy: s.cat.portraitLegacy, sex: s.cat.sex, name: s.cat.name, genes: s.cat.genes, stage: s.cat.lifeStage };
    });
    assert.strictEqual(state.id, DEFAULT);
    assert.strictEqual(state.legacy.status, 'presentation-default');
    assert.strictEqual(state.legacy.case, 'field-absent');
    assert.strictEqual(state.legacy.phenotypeMatch, false);
    assert.strictEqual(state.legacy.policy, 'presentation-default-not-genotype');
    assert.strictEqual(state.sex, sex);
    assert.strictEqual(state.name, name);
    assert.deepStrictEqual(state.genes, genes);
    for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
      await resize(w, h);
      await shot(`legacy-home-${sex}-${tag}.png`);
      await page.locator('#home-expand').click();
      await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden && document.getElementById('cat-viewer-canvas').width > 0);
      const viewer = await page.evaluate(() => ({ id: document.getElementById('cat-viewer-canvas').dataset.portraitId || document.getElementById('home-head').dataset.portraitId, w: document.getElementById('cat-viewer-canvas').width, h: document.getElementById('cat-viewer-canvas').height }));
      assert.ok(viewer.w > 0 && viewer.h > 0);
      await shot(`legacy-viewer-${sex}-${tag}.png`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
    }
  }

  const live = await page.evaluate(async (ids) => {
    const waitFor = (sel, id) => new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const c = document.querySelector(sel);
        if (c && c.dataset.portraitId === id && c.width > 0) resolve(c);
        else if (Date.now() - start > 4000) resolve(c || null);
        else requestAnimationFrame(tick);
      };
      tick();
    });
    const sample = (c) => {
      if (!c || !c.width) return { id: null, w: 0, h: 0, ink: 0 };
      const sx = Math.max(0, Math.floor(c.width / 2) - 3);
      const sy = Math.max(0, Math.floor(c.height / 2) - 3);
      const d = c.getContext('2d').getImageData(sx, sy, Math.min(6, c.width - sx), Math.min(6, c.height - sy)).data;
      let ink = 0; for (const v of d) ink += v;
      return { id: c.dataset.portraitId || null, w: c.width, h: c.height, ink };
    };
    const out = [];
    for (const sex of ['female', 'male']) {
      for (const id of ids) {
        const s = window.__menuDebug.game().state;
        s.phase = 'day'; s.pending = null;
        s.cat.sex = sex; s.npcs.hc01.sex = sex;
        window.__menuDebug.assignPortrait('player', id);
        const home = sample(await waitFor('#home-head', id));
        window.__menuDebug.assignPortrait('hc01', id);
        window.__menuDebug.forceMeeting('hc01');
        const event = sample(await waitFor('#event-head', id));
        document.querySelector('[data-view="cats"]').click();
        const list = sample(await waitFor('#met-hc01', id));
        const full = document.createElement('canvas');
        const painted = await window.__menuDebug.paintPortrait({ portraitId: id, sex }, full, {});
        out.push({ sex, id, home, event, list, full: { id: painted.id, w: full.width, h: full.height } });
        s.phase = 'day'; s.pending = null;
        window.__menuDebug.assignPortrait('player', id);
      }
    }
    return out;
  }, ids);
  assert.strictEqual(live.length, 80);
  for (const row of live) {
    for (const surface of ['home', 'event', 'list']) {
      assert.strictEqual(row[surface].id, row.id, `${row.sex} ${surface} ${row.id}`);
      assert.ok(row[surface].w > 0 && row[surface].ink > 0, `${row.sex} ${surface} ${row.id}`);
    }
    assert.strictEqual(row.full.id, row.id);
    assert.ok(row.full.w > 0 && row.full.h > 0);
  }
  await resize(1280, 720);
  await shot('live-surfaces-player-home-720.png');
  await resize(1920, 1080);
  await shot('live-surfaces-player-home-1080.png');

  assert.deepStrictEqual(errors, []);
  await app.close();
  console.log('portrait coverage passed', ids.length, 'ids', SHOTS);
})().catch((e) => { console.error(e); process.exit(1); });
