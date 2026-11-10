/**
 * Presentation checks on the same seed-11 quiet_walk fixture as the post-faction baseline.
 * Does not change receipts. Captures the after screens at 1280x720 and 1920x1080.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.CONVERSATION_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(SHOTS, { recursive: true });
const BEFORE = require('../fixtures/ui-baseline-quiet-walk.json');

function logicHash(row) {
  return crypto.createHash('sha256').update(JSON.stringify({
    seed: row.seed, nodeId: row.nodeId, choiceIds: row.choiceIds, variantIds: row.variantIds,
    portraitId: row.portraitId, affinity: row.affinity
  })).digest('hex');
}
function contrast(fg, bg) {
  const parse = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
  const lin = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const L = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const a = L(parse(fg)); const b = L(parse(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  return { app, page };
}
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
async function size(app, page, w, h) {
  await app.evaluate(({ BrowserWindow }, box) => { const win = BrowserWindow.getAllWindows()[0]; win.setFullScreen(false); win.setContentSize(box.w, box.h); }, { w, h });
  await page.waitForTimeout(250);
}
async function shot(page, name, w, h) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), scale: 'css', clip: { x: 0, y: 0, width: w, height: h } });
}
async function reach(page) {
  await page.evaluate((x) => window.__menuDebug.setGameSeed(x), BEFORE.seed);
  await page.mouse.move(2, 2);
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await press(page, 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await idle(page);
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => window.__menuDebug.game().state);
    if (s.phase === 'event' && s.pending && s.pending.catId === 'ln05') break;
    if (s.phase === 'conversation') break;
    if (s.phase === 'event') {
      const pass = page.locator('#game-event [data-choice="pass"]');
      if (await pass.count()) await pass.click(); else await page.locator('#game-event [data-g="choose"]').first().click();
      await idle(page); continue;
    }
    if (s.phase === 'eventResult' || s.phase === 'ford' || s.phase === 'border') {
      const cont = page.locator('#game-event [data-g="continue"]');
      if (await cont.count()) await cont.click(); else await page.locator('#game-event [data-choice="stay_out"], #game-event [data-choice="withdraw"]').first().click();
      await idle(page); continue;
    }
    await page.locator('[data-g="rest"]').click(); await idle(page);
  }
  await page.locator('#game-event [data-choice="greet"]').click(); await idle(page);
  await page.locator('#game-event [data-choice="company"]').click(); await idle(page);
  await page.locator('#game-event [data-choice="quiet"]').click(); await idle(page);
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-ui-'));
  const { app, page } = await launch(ud);
  try {
    await size(app, page, 1280, 720);
    await reach(page);
    const read = () => page.evaluate(() => {
      const s = window.__menuDebug.game().state;
      const p = s.conversation.pending;
      const card = document.querySelector('.conversation-card');
      const scroll = card.querySelector('.event-scroll');
      const choices = [...card.querySelectorAll('.event-choices button')];
      const save = card.querySelector('.talk-utility [data-g="save"]');
      const nav = document.querySelector('.home-nav').getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const text = card.querySelector('.event-text');
      const textCs = getComputedStyle(text);
      const scrollCs = getComputedStyle(scroll);
      const focus = document.querySelector('button.focused');
      const disabled = document.querySelector('.screen[data-screen="game"] button.is-unavailable');
      const needs = [...document.querySelectorAll('.need')].map((n) => n.getAttribute('aria-label'));
      return {
        seed: s.seed, nodeId: p.nodeId,
        choiceIds: choices.map((b) => b.dataset.choice),
        variantIds: p.presentation.variantIds,
        portraitId: s.npcs.ln05.portraitId, affinity: s.npcs.ln05.affinity,
        relations: card.querySelector('.relation-meters').innerText,
        meterRole: card.querySelector('.personal-meter')?.getAttribute('role'),
        meterNow: card.querySelector('.personal-meter')?.getAttribute('aria-valuenow'),
        meterMark: !!card.querySelector('.personal-meter .meter-mark'),
        romanceUnknown: (card.querySelector('.relation-romance')?.textContent || '').includes('Unknown'),
        cost: card.querySelector('.choice-cost').innerText,
        costData: card.querySelector('.choice-cost').dataset,
        needs,
        focusChoice: focus && focus.dataset.choice,
        focusOutline: focus ? getComputedStyle(focus).outlineWidth : '0px',
        unavailableOpacity: disabled ? getComputedStyle(disabled).opacity : null,
        scroll: { top: scroll.getBoundingClientRect().top, bottom: scroll.getBoundingClientRect().bottom, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight },
        choiceTops: choices.map((b) => b.getBoundingClientRect().top),
        choiceBottoms: choices.map((b) => Math.round(b.getBoundingClientRect().bottom)),
        saveTop: save.getBoundingClientRect().top,
        navRight: nav.right, cardLeft: cardBox.left,
        fg: textCs.color, bg: scrollCs.backgroundColor,
        innerHeight: window.innerHeight
      };
    });
    const at720 = await read();
    assert.strictEqual(at720.nodeId, BEFORE.nodeId);
    assert.deepStrictEqual(at720.choiceIds, BEFORE.choiceIds);
    assert.deepStrictEqual(at720.variantIds, BEFORE.variantIds);
    assert.strictEqual(at720.portraitId, BEFORE.portraitId);
    assert.strictEqual(at720.affinity, BEFORE.affinity);
    assert.strictEqual(logicHash(at720), logicHash(BEFORE));
    assert.strictEqual(at720.meterRole, 'meter');
    assert.strictEqual(at720.meterNow, '0');
    assert.strictEqual(at720.meterMark, true);
    assert.strictEqual(at720.romanceUnknown, true);
    assert.ok(at720.relations.includes('Personal · Coppergale → you +0 · Neutral'));
    assert.ok(at720.relations.includes('Romance · Unknown'));
    assert.ok(at720.relations.includes('Faction · Unknown'));
    assert.ok(!at720.relations.includes('No Opinion/Neutral'));
    assert.strictEqual(at720.costData.charged, '1');
    assert.ok(at720.cost.includes('asks nothing more'));
    assert.ok(!/Energy −\d+/.test(at720.cost));
    assert.ok(at720.needs.some((n) => n.startsWith('Health ')) && at720.needs.some((n) => n.startsWith('Hunger ')));
    assert.strictEqual(at720.focusChoice, BEFORE.choiceIds[0]);
    assert.notStrictEqual(at720.focusOutline, '0px');
    assert.ok(Number(at720.unavailableOpacity) < 0.9);
    assert.ok(at720.scroll.scrollHeight > at720.scroll.clientHeight + 8);
    assert.ok(at720.choiceTops.every((top) => top >= at720.scroll.bottom - 2));
    assert.ok(at720.saveTop >= at720.choiceTops[at720.choiceTops.length - 1]);
    assert.ok(at720.cardLeft >= at720.navRight - 2);
    assert.ok(contrast(at720.fg, at720.bg) >= 4.5, `contrast ${contrast(at720.fg, at720.bg)}`);
    assert.ok(at720.choiceBottoms.every((b) => b <= at720.innerHeight + 1));
    await shot(page, 'after-dialogue-720', 1280, 720);
    await page.keyboard.press('ArrowDown');
    const second = await page.evaluate(() => document.querySelector('button.focused')?.dataset.choice);
    assert.strictEqual(second, BEFORE.choiceIds[1]);
    await page.locator('#game-event [data-g="expandCat"]').click();
    await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
    await shot(page, 'after-viewer-720', 1280, 720);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
    assert.strictEqual(await page.evaluate(() => window.__menuDebug.game().state.conversation.pending.nodeId), 'quiet_walk');
    await size(app, page, 1920, 1080);
    const at1080 = await read();
    assert.strictEqual(logicHash(at1080), logicHash(BEFORE));
    assert.ok(at1080.choiceTops.every((top) => top >= at1080.scroll.bottom - 2));
    assert.ok(at1080.cardLeft >= at1080.navRight - 2);
    assert.ok(contrast(at1080.fg, at1080.bg) >= 4.5);
    await shot(page, 'after-dialogue-1080', 1920, 1080);
    await page.locator('#game-event [data-g="expandCat"]').click();
    await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
    await shot(page, 'after-viewer-1080', 1920, 1080);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
    await page.locator('.talk-utility [data-g="save"]').click();
    await page.waitForTimeout(300);
    await press(page, 'Escape');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
    await press(page, 'Enter');
    await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
    await idle(page);
    const restored = await page.evaluate(() => {
      const p = window.__menuDebug.game().state.conversation.pending;
      return { nodeId: p.nodeId, choices: [...document.querySelectorAll('#game-event [data-choice]')].map((b) => b.dataset.choice), variants: p.presentation.variantIds };
    });
    assert.strictEqual(restored.nodeId, 'quiet_walk');
    assert.deepStrictEqual(restored.choices, BEFORE.choiceIds);
    assert.deepStrictEqual(restored.variants, BEFORE.variantIds);
    const hash = logicHash(BEFORE);
    fs.writeFileSync(path.join(SHOTS, 'ui-after-quiet-walk.json'), JSON.stringify({ ...BEFORE, logicHash: hash, afterLogicHash: logicHash(at1080) }, null, 2));
    console.log('presentation e2e passed', hash);
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
