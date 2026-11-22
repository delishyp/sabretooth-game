/** Redesign layout: five window sizes, UI scales 1, 1.25 and 1.5.
 *  Asserts 18px text, AA contrast, no scene gutters, no clipping, no panel overlap, no placeholders. */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const out = process.env.REDESIGN_SHOTS || '/opt/cursor/artifacts/redesign';
fs.mkdirSync(out, { recursive: true });

const SIZES = [[1280, 720], [1920, 1080], [2560, 1440], [2560, 1080], [3440, 1440]];
const SCALES = [1, 1.25, 1.5];

function probe() {
  const W = innerWidth, H = innerHeight;
  const problems = [];
  const text = document.body.innerText || '';
  if (text.includes('[PH]') || text.includes('[Saga:') || /\{[a-zA-Z]/.test(text)) problems.push('placeholder');
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((n) => Number(n.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.95) return c;
      n = n.parentElement;
    }
    return null;
  };
  const nodes = [...document.querySelectorAll('button, p, span, h1, h2, h3, label, li, a')].filter((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && (el.innerText || '').trim();
  });
  for (const el of nodes) {
    const s = getComputedStyle(el);
    const fs = parseFloat(s.fontSize);
    if (fs < 17.5) problems.push('small ' + fs.toFixed(1) + ' ' + (el.innerText || '').slice(0, 24));
    const fg = parse(s.color);
    const bg = bgOf(el);
    if (!bg) problems.push('bare ' + (el.innerText || '').slice(0, 24));
    else if (fg) {
      const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const weight = parseInt(s.fontWeight, 10) || 400;
      const large = fs >= 24 || (fs >= 18.66 && weight >= 700);
      if (ratio < (large ? 3 : 4.5) - 0.05) problems.push('contrast ' + ratio.toFixed(2) + ' ' + (el.innerText || '').slice(0, 24));
    }
    if (el.scrollWidth > el.clientWidth + 3 && (s.overflowX === 'hidden' || s.textOverflow === 'ellipsis')) problems.push('clip ' + (el.innerText || '').slice(0, 24));
    if (problems.length > 12) break;
  }
  const stage = document.getElementById('stage').getBoundingClientRect();
  if (Math.abs(stage.width - W) > 3 || Math.abs(stage.height - H) > 3) problems.push('stage ' + Math.round(stage.width) + 'x' + Math.round(stage.height));
  const scene = [...document.querySelectorAll('.screen.active .home-landscape, .screen.active .creator-scene, #bg')].find((el) => {
    const s = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 2 && b.height > 2;
  });
  if (scene) {
    const r = scene.getBoundingClientRect();
    const vis = getComputedStyle(scene).visibility;
    if (vis === 'hidden' || r.width < W - 2 || r.height < H - 2) problems.push('scene ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const sc = document.querySelector('.screen.active:not([data-screen="game"])');
  if (sc && /newGameSetup|load|creator/.test(sc.dataset.screen || '')) {
    const r = sc.getBoundingClientRect();
    const centred = Math.abs((r.left + r.right) / 2 - W / 2) < 48;
    if (!centred || r.width > W * 0.96 || r.width < 320) problems.push('panel ' + Math.round(r.width) + ' at ' + Math.round(r.left));
  }
  const panels = [...document.querySelectorAll('.shell-top, .rail, #day-primary, #game-actions, #place-drawer, #game-event, .home-dock, .goal, .tutorial-card, #day-end')].filter((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden' && !el.hidden;
  }).map((el) => ({ id: el.id || el.className, el, r: el.getBoundingClientRect() }));
  const area = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  };
  const holds = (a, b) => a.left <= b.left + 1 && a.top <= b.top + 1 && a.right >= b.right - 1 && a.bottom >= b.bottom - 1;
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (panels[i].el.contains(panels[j].el) || panels[j].el.contains(panels[i].el)) continue;
      if (holds(panels[i].r, panels[j].r) || holds(panels[j].r, panels[i].r)) continue;
      if (area(panels[i].r, panels[j].r) > 16) problems.push('overlap ' + panels[i].id + ' ' + panels[j].id);
    }
  }
  return problems.slice(0, 16);
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-redesign-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  const shots = [];
  let failed = 0;
  try {
    await page.waitForFunction(() => window.__menuDebug);
    const shoot = async (name) => {
      const file = path.join(out, name + '.png');
      await page.screenshot({ path: file });
      shots.push(file);
      const problems = await page.evaluate(probe);
      assert.deepStrictEqual(problems, [], name + ' ' + problems.join(' | '));
      if (name.startsWith('encounter-')) {
        const choiceFit = await page.evaluate(() => {
          if (document.documentElement.dataset.choiceStack !== '1') return [];
          const out = [];
          for (const b of document.querySelectorAll('#game-event .event-choices button')) {
            const box = b.getBoundingClientRect();
            if (box.width < 220) out.push('choice narrow ' + Math.round(box.width));
            const cs = getComputedStyle(b);
            const parsed = parseFloat(cs.lineHeight);
            const font = parseFloat(cs.fontSize) || 18;
            const line = parsed > 8 ? parsed : font * 1.25;
            const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
            const lines = Math.round((b.scrollHeight - pad) / line);
            if (lines > 2) out.push('choice wrap ' + lines);
          }
          return out;
        });
        assert.deepStrictEqual(choiceFit, [], name + ' choices ' + choiceFit.join(' | '));
      }
      if (name.startsWith('dialogue-')) {
        await page.waitForFunction(() => {
          const imgs = [...document.querySelectorAll('#game-event img.headshot')];
          return imgs.length >= 2 && imgs.every((img) => img.complete && img.naturalWidth > 0);
        }, null, { timeout: 8000 });
        const heads = await page.evaluate(() => [...document.querySelectorAll('#game-event img.headshot')].map((img) => img.naturalWidth));
        assert.ok(heads.length >= 2 && heads.every((n) => n > 0), name + ' headshots ' + heads.join(','));
      }
      if (name.endsWith('1920x1080-u1')) {
        const layout = await page.evaluate((shot) => {
          const W = innerWidth, H = innerHeight, out = [];
          const box = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || el.hidden) return null;
            const b = el.getBoundingClientRect();
            if (b.width < 4 || b.height < 4) return null;
            return b;
          };
          if (shot.startsWith('new-game')) {
            const panel = box('.screen[data-screen="newGameSetup"]');
            if (!panel || panel.width > W * 0.92 || panel.width < 500) out.push('panel');
            const cards = [...document.querySelectorAll('#level-cards .card')];
            if (cards.length >= 2 && Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) > 12) out.push('cards wrapped');
          }
          if (shot.startsWith('home-')) {
            const primary = box('#day-primary');
            const rail = box('#home-nav');
            if (!primary || primary.right < W * 0.72 || primary.bottom < H - 160) out.push('primary');
            if (!rail || rail.width > 340 || rail.x > 120) out.push('rail');
          }
          if (shot.startsWith('actions-')) {
            const sheet = box('#game-actions');
            if (!sheet || sheet.x < W * 0.42) out.push('actions column');
          }
          if (shot.startsWith('encounter-')) {
            const ev = box('#game-event');
            const actor = box('.scene-actor');
            if (!ev || ev.y < H * 0.4) out.push('story panel');
            if (!actor || actor.height < 70) out.push('scene actor');
          }
          if (shot.startsWith('dialogue-')) {
            const ev = box('#game-event');
            if (!ev || ev.y < H * 0.35) out.push('dialogue panel');
          }
          if (shot.startsWith('lore-')) {
            const dock = box('.home-dock');
            if (!dock || dock.width < W * 0.45) out.push('book frame');
          }
          return out;
        }, name);
        assert.deepStrictEqual(layout, [], name + ' mockup layout ' + layout.join(' | '));
      }
      console.log('PASS', name);
    };
    const fit = async (w, h, u) => {
      await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h), { w, h });
      await page.waitForTimeout(150);
      await page.evaluate((v) => window.__menuDebug.setUiScale(v), u);
      await page.waitForTimeout(120);
    };
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        const tag = `${w}x${h}-u${String(u).replace('.', '')}`;
        await page.evaluate(() => window.__menuDebug.show('root'));
        await fit(w, h, u);
        await shoot(`menu-${tag}`);
        await page.evaluate(() => window.__menuDebug.show('newGame'));
        await page.waitForTimeout(80);
        await shoot(`new-game-${tag}`);
      }
    }
    await page.evaluate(() => window.__menuDebug.show('newGame'));
    await page.locator('[data-nav="begin"]').click();
    await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await shoot(`creator-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await shoot(`spotlight-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    for (let i = 0; i < 8 && await page.locator('[data-g="tutorialDismiss"]').count(); i++) {
      await page.locator('[data-g="tutorialDismiss"]').click();
    }
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        const tag = `${w}x${h}-u${String(u).replace('.', '')}`;
        await fit(w, h, u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await page.waitForTimeout(80);
        await shoot(`home-${tag}`);
        if (await page.locator('#game-actions').isHidden()) await page.locator('[data-g="openActions"]').click();
        await page.waitForTimeout(80);
        await shoot(`actions-${tag}`);
        await page.evaluate(() => { const box = document.getElementById('game-actions'); if (box) box.hidden = true; window.__menuDebug.game().render(); });
      }
    }
    await page.locator('[data-view="lore"]').click();
    await page.waitForTimeout(150);
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await shoot(`lore-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    await page.locator('[data-view="home"]').click();
    await page.evaluate(() => window.__menuDebug.gamePatch({
      phase: 'day',
      pending: null,
      report: { day: 1, region: 'split_rock', lines: [{ k: 'rest', energy: 20 }, { k: 'drink' }] }
    }));
    for (let i = 0; i < 8 && await page.locator('[data-g="tutorialDismiss"]').count(); i++) {
      await page.locator('[data-g="tutorialDismiss"]').click();
    }
    await page.waitForTimeout(80);
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await shoot(`day-end-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    if (await page.locator('[data-g="dismissReport"]').isVisible()) await page.locator('[data-g="dismissReport"]').click();
    for (const nose of ['keen_nose', 'dull_nose']) {
      await page.evaluate((id) => window.__menuDebug.gamePatch({ cat: { traits: [id] } }), nose);
      if (await page.locator('#game-actions').isHidden()) await page.locator('[data-g="openActions"]').click();
      if (await page.locator('[data-g="hunt"][data-size="small"]').isHidden()) await page.locator('[data-g="pickHunt"]').click();
      await page.waitForTimeout(80);
      for (const [w, h] of SIZES) {
        for (const u of SCALES) {
          await fit(w, h, u);
          const tag = nose === 'keen_nose' ? 'hunt-keen' : 'hunt-dull';
          await shoot(`${tag}-${w}x${h}-u${String(u).replace('.', '')}`);
        }
      }
    }
    const openEncounter = async (kind) => {
      await page.evaluate((kind) => {
        const spec = kind === 'deer'
          ? { id: 'encounter.giant_deer.v1', asset: 'giant-deer.png', name: 'Giant deer', line: 'A giant deer stands beyond the low cover, its antlers spread wide above its back.' }
          : { id: 'encounter.cave_hyena.v1', asset: 'cave-hyena.png', name: 'Cave hyena', line: 'A cave hyena stands over a carcass at the forks, mouth open, shoulders hunched high.' };
        const s = window.__menuDebug.game().state;
        window.__menuDebug.gamePatch({
          phase: 'encounter',
          report: null,
          encounters: {
            pending: {
              encounterId: spec.id,
              encounterInstanceId: 'e2e',
              assetId: spec.asset,
              displayName: spec.name,
              regionId: s.region,
              absDay: s.day,
              nodeId: 'opening',
              lines: [{ kind: 'narration', text: spec.line }],
              choices: [],
              terminal: false,
              forecast: spec.id.indexOf('hyena') >= 0 ? { tier: 'partial' } : null
            }
          }
        });
      }, kind);
      await page.waitForTimeout(80);
    };
    await openEncounter('deer');
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await shoot(`encounter-hunt-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    await openEncounter('hyena');
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await page.evaluate(() => window.__menuDebug.game().render());
        await shoot(`encounter-fight-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    await page.evaluate(() => window.__menuDebug.gamePatch({ phase: 'day', encounters: { pending: null } }));
    const npc = await page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const id = Object.keys(s.npcs || {}).find((key) => s.npcs[key] && s.npcs[key].portraitId);
      return id ? window.__menuDebug.forceMeeting(id) : null;
    });
    if (npc) {
      for (const [w, h] of SIZES) {
        for (const u of SCALES) {
          await fit(w, h, u);
          await page.evaluate(() => window.__menuDebug.game().render());
          await shoot(`dialogue-${w}x${h}-u${String(u).replace('.', '')}`);
        }
      }
    }
    await page.evaluate(() => window.__menuDebug.show('load'));
    await page.waitForTimeout(150);
    for (const [w, h] of SIZES) {
      for (const u of SCALES) {
        await fit(w, h, u);
        await shoot(`load-${w}x${h}-u${String(u).replace('.', '')}`);
      }
    }
    fs.writeFileSync(path.join(out, 'index.txt'), shots.map((f) => path.basename(f)).join('\n') + '\n');
    console.log('shots', shots.length);
  } catch (e) {
    failed = 1;
    console.error(e);
    try { await page.screenshot({ path: path.join(out, 'failure.png') }); } catch (err) { /* already closed */ }
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
  process.exit(failed);
})();
