/**
 * Presentation follow-up. Loads the ordinary seed-34 saves and checks readable courtship
 * choices plus a Mates label that does not invent romance or reveal attraction.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const FIX = path.join(root, 'test/fixtures/presentation-same-save');
const OUT = '/opt/cursor/artifacts';

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(300);
  return { app, page };
}
async function size(app, w, h) {
  await app.evaluate(({ BrowserWindow }, box) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(box.w, box.h);
  }, { w, h });
  await new Promise((r) => setTimeout(r, 350));
}
function gameplay(s) {
  const mateId = s.records && s.records.matePair && s.records.matePair.mateId;
  return {
    day: s.day,
    matePair: s.records && s.records.matePair,
    pride: s.records && s.records.pride,
    attraction: s.records && s.records.attraction,
    romance: s.worldMemory && s.worldMemory.romance,
    affinity: s.npcs && s.npcs[mateId] && s.npcs[mateId].affinity,
    portrait: s.npcs && s.npcs[mateId] && s.npcs[mateId].portraitId,
    needs: s.needs
  };
}

(async () => {
  for (const name of ['courtship', 'founding', 'day21']) {
    assert.ok(fs.existsSync(path.join(FIX, `${name}.json`)), `missing ${name} save`);
  }
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-present-'));
  const { app, page } = await launch(ud);
  try {
    await page.mouse.move(2, 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    for (const name of ['courtship', 'founding', 'day21']) {
      const saved = JSON.parse(fs.readFileSync(path.join(FIX, `${name}.json`), 'utf8'));
      await page.evaluate((game) => window.__menuDebug.reloadGame(game), saved);
      await page.waitForTimeout(400);
      const loaded = await page.evaluate(() => window.__menuDebug.game().state);
      assert.deepStrictEqual(gameplay(loaded), gameplay(saved), `${name} gameplay bytes changed on load`);
      const again = JSON.parse(JSON.stringify(loaded));
      await page.evaluate(() => window.__menuDebug.game().state && window.__menuDebug.reloadGame(window.__menuDebug.game().state));
      await page.waitForTimeout(200);
      const rendered = await page.evaluate(() => window.__menuDebug.game().state);
      assert.deepStrictEqual(gameplay(rendered), gameplay(again), `${name} render wrote gameplay`);
      if (name !== 'day21') {
        await size(app, 1280, 720);
        const box = await page.evaluate(() => {
          const list = document.querySelector('.bond-choices');
          const buttons = [...list.querySelectorAll('button')];
          const style = getComputedStyle(list);
          const sample = getComputedStyle(buttons[0]);
          const rects = buttons.map((b) => b.getBoundingClientRect());
          const separated = rects.slice(1).every((r, i) => r.top >= rects[i].bottom - 1);
          return {
            gap: parseFloat(style.rowGap || style.gap),
            font: parseFloat(sample.fontSize),
            minHeight: parseFloat(sample.minHeight),
            separated,
            save: list.querySelectorAll('[data-g="save"]').length,
            nav: list.querySelectorAll('[data-g="nav"]').length,
            labels: buttons.filter((b) => !b.disabled).map((b) => b.dataset.choice || b.dataset.g)
          };
        });
        assert.ok(box.gap >= 14, `${name} gap ${box.gap}`);
        assert.ok(box.font >= 22, `${name} font ${box.font}`);
        assert.ok(box.minHeight >= 56, `${name} min-height ${box.minHeight}`);
        assert.strictEqual(box.separated, true, `${name} choices overlap`);
        assert.strictEqual(box.save, 0);
        assert.strictEqual(box.nav, 0);
        for (let i = 0; i < box.labels.length; i++) {
          const seen = await page.evaluate(() => {
            const el = document.querySelector('.bond-choices button.focused');
            const list = document.querySelector('.bond-choices');
            if (!el || !list.contains(el)) return null;
            const er = el.getBoundingClientRect();
            const br = list.getBoundingClientRect();
            return { id: el.dataset.choice || el.dataset.g, inside: er.top >= br.top - 2 && er.bottom <= br.bottom + 2 };
          });
          assert.ok(seen && seen.inside, `${name} choice ${i} not in view ${JSON.stringify(seen)}`);
          assert.strictEqual(seen.id, box.labels[i]);
          if (i < box.labels.length - 1) await page.keyboard.press('ArrowDown');
        }
      }
      const words = await page.evaluate(() => ({
        mates: document.body.innerText.includes('\nMates') || !!document.querySelector('.relation-mates, .hud-mates'),
        matesText: (document.querySelector('.relation-mates') || document.querySelector('.hud-mates') || {}).textContent || '',
        attraction: (document.querySelector('.relation-attraction') || {}).textContent || '',
        romanceUnknown: !!document.querySelector('.relation-romance') && document.querySelector('.relation-romance').textContent.includes('Unknown')
      }));
      const mateId = saved.records.matePair && saved.records.matePair.mateId;
      const kind = mateId && saved.records.attraction[mateId];
      const card = await page.locator('.relation-meters, .hud-mates').first().innerText();
      if (kind) assert.ok(!card.includes(kind), `${name} revealed attraction ${kind}`);
      if (name === 'courtship') {
        assert.strictEqual(saved.records.matePair, null);
        assert.ok(!documentMates(words), 'courtship ask is not a committed bond');
      }
      if (name === 'founding' || name === 'day21') {
        assert.ok(saved.records.matePair, `${name} fixture is not paired`);
        assert.strictEqual(words.matesText, 'Mates');
        if (name === 'founding') {
          assert.strictEqual(words.attraction, 'Attraction · Unknown');
          assert.strictEqual(words.romanceUnknown, false);
          assert.strictEqual(saved.worldMemory.romance[mateId], undefined);
        }
      }
      for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
        await size(app, w, h);
        await page.screenshot({ path: path.join(OUT, `after-${name}-${tag}.png`), scale: 'css' });
      }
      console.log('PASS', name);
    }
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
  function documentMates(words) { return words.matesText === 'Mates'; }
})().catch((e) => { console.error(e); process.exit(1); });
