/**
 * Overflow sweep plus the inset focus ring.
 * Visits the menu, creator, settings, and the game screens at the gate sizes
 * and at 100% and 150%. Writes a JSON report and screenshots under the artifacts folder.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const outDir = '/opt/cursor/artifacts/ui-overflow';
fs.mkdirSync(outDir, { recursive: true });

const SIZES = [[853, 480], [1280, 720], [1920, 1080], [2560, 1440], [3440, 1440]];
const SCALES = [1, 1.5];

async function launch(ud) {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForTimeout(200);
  return { app, page };
}
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };

async function fit(app, page, w, h, scale) {
  await app.evaluate(({ BrowserWindow }, box) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(box.w, box.h);
  }, { w, h });
  await page.evaluate((v) => window.__menuDebug.setUiScale(v), scale);
  await page.waitForTimeout(80);
}

function auditSource() {
  return () => {
    const skip = (el) => {
      if (!el || el.hidden) return true;
      const dialog = document.getElementById('dialog');
      if (dialog && !dialog.hidden && getComputedStyle(dialog).display !== 'none' && !dialog.contains(el)) return true;
      if (el.closest('.home-landscape, .home-scene, .creator-scene, #nav-lock-tip')) return true;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return true;
      const r = el.getBoundingClientRect();
      return r.width < 2 || r.height < 2;
    };
    const label = (el) => ((el.innerText || el.getAttribute('aria-label') || el.id || el.className || '').trim()).slice(0, 60);
    const issues = [];
    const controls = [...document.querySelectorAll('button, a, input, select, textarea, summary')].filter((el) => !skip(el));
    for (const el of controls) {
      const s = getComputedStyle(el);
      if (s.textOverflow !== 'ellipsis' && (s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 4) {
        issues.push({ kind: 'clipped', text: label(el) });
      }
    }
    for (let i = 0; i < controls.length; i++) {
      const a = controls[i].getBoundingClientRect();
      for (let j = i + 1; j < controls.length; j++) {
        if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
        const b = controls[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 8 && h > 8) issues.push({ kind: 'overlap', text: label(controls[i]) + ' | ' + label(controls[j]) });
      }
    }
    for (const el of controls) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (r.left < -2 || r.top < -2 || r.right > innerWidth + 2 || r.bottom > innerHeight + 2) {
        issues.push({ kind: 'unreachable', text: label(el), box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
      }
    }
    const focusSpills = [];
    const seen = new Set();
    const rules = [];
    for (const sheet of document.styleSheets) {
      let list = [];
      try { list = [...sheet.cssRules]; } catch (e) { continue; }
      for (const rule of list) {
        if (!rule.selectorText || !/button|:focus|\.focused/.test(rule.selectorText)) continue;
        if (!/:focus|\.focused/.test(rule.selectorText)) continue;
        rules.push(rule.selectorText);
      }
    }
    for (const el of controls) {
      el.classList.add('focused');
      const s = getComputedStyle(el);
      const w = parseFloat(s.outlineWidth) || 0;
      const o = parseFloat(s.outlineOffset) || 0;
      const key = (el.dataset && (el.dataset.g || el.dataset.t || el.dataset.action)) || label(el);
      if (s.outlineStyle !== 'none' && w > 0 && o + w > 0.5 && !seen.has(key)) {
        seen.add(key);
        focusSpills.push({ text: key, outline: s.outline, offset: s.outlineOffset });
      }
      el.classList.remove('focused');
    }
    return { issues, focusSpills, selectors: rules.length, controls: controls.length };
  };
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-overflow-'));
  const { app, page } = await launch(ud);
  const report = [];
  const audit = auditSource();
  try {
    const menuScreens = ['root', 'newGame', 'creator', 'creator:personality', 'settings', 'load'];
    for (const [w, h] of SIZES) {
      for (const scale of SCALES) {
        await fit(app, page, w, h, scale);
        for (const screen of menuScreens) {
          await page.evaluate((name) => window.__menuDebug.show(name), screen);
          await page.waitForTimeout(60);
          const found = await page.evaluate(audit);
          if (found.issues.length || found.focusSpills.length) {
            const file = `menu-${screen.replace(':', '-')}-${w}x${h}-${scale}.png`;
            await page.screenshot({ path: path.join(outDir, file) });
            report.push({ where: screen, w, h, scale, ...found, shot: file });
          }
        }
      }
    }
    await fit(app, page, 1280, 720, 1);
    await page.evaluate((n) => window.__menuDebug.setGameSeed(n), 11);
    await page.evaluate(() => window.__menuDebug.show('root'));
    await page.mouse.move(2, 2);
    await press(page, 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
    await press(page, 'ArrowUp', 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await page.evaluate(() => {
      const game = window.__menuDebug.game();
      const s = game.state;
      if (!s.records) s.records = {};
      s.records.pride = { id: 'pride-e2e', name: 'Ash' };
      delete s.records.lastCouncilSeason;
      game.render();
    });
    const views = ['home', 'wilderness', 'map', 'cats', 'lore', 'councils', 'pride', 'den', 'reputation', 'inventory'];
    for (const [w, h] of SIZES) {
      for (const scale of SCALES) {
        await fit(app, page, w, h, scale);
        for (const view of views) {
          const opened = await page.evaluate((id) => {
            const button = document.querySelector(`[data-g="nav"][data-view="${id}"]`);
            if (!button) return 'missing';
            const r = button.getBoundingClientRect();
            const s = getComputedStyle(button);
            if (button.getAttribute('aria-disabled') === 'true') {
              button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              return 'locked';
            }
            button.click();
            return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), display: s.display };
          }, view);
          if (opened === 'missing') continue;
          await page.waitForTimeout(40);
          const found = await page.evaluate(audit);
          if (found.issues.length || found.focusSpills.length) {
            const file = `game-${view}-${w}x${h}-${scale}.png`;
            await page.screenshot({ path: path.join(outDir, file) });
            report.push({ where: view, w, h, scale, ...found, shot: file });
          }
        }
        await page.evaluate(() => {
          const button = document.querySelector('[data-g="openMenu"]');
          const menu = document.getElementById('game-menu');
          if (button && menu && menu.hidden) button.click();
        });
        await page.waitForTimeout(30);
        const menu = await page.evaluate(audit);
        if (menu.issues.length || menu.focusSpills.length) {
          const file = `game-menu-${w}x${h}-${scale}.png`;
          await page.screenshot({ path: path.join(outDir, file) });
          report.push({ where: 'game-menu', w, h, scale, ...menu, shot: file });
        }
        await page.evaluate(() => {
          const button = document.querySelector('[data-g="openMenu"]');
          const menu = document.getElementById('game-menu');
          if (button && menu && !menu.hidden) button.click();
          const cancel = document.querySelector('#dialog [data-action="cancel"], #dialog button');
          const dialog = document.getElementById('dialog');
          if (dialog && !dialog.hidden && cancel) cancel.click();
        });
      }
    }
    const focus = report.flatMap((row) => row.focusSpills.map((item) => row.where + ' ' + item.text));
    const spills = report.flatMap((row) => row.issues.map((item) => `${row.w}x${row.h}@${row.scale} ${row.where} ${item.kind} ${item.text}`));
    console.log('overflow findings', spills.length);
    spills.slice(0, 40).forEach((line) => console.log(' ', line));
    console.log('focus spills', focus.length);
    assert.deepStrictEqual(focus, [], 'focus ring spills');
    assert.deepStrictEqual(spills, [], 'overflow findings');
    console.log('ui overflow e2e wrote', report.length, 'rows');
  } finally {
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
