/**
 * Recurring-conversation UI proof at 1280x720: longest exchange, Continue mid-talk, later callback.
 * Same saved ln05. Real buttons, save and Continue. No debug meeting injection.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.CONVERSATION_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(SHOTS, { recursive: true });
const SEED = Number(process.env.CONVERSATION_SEED || 11);

async function launch(ud) {
  const app = await electron.launch({ executablePath: require('electron'), args: ['--no-sandbox', root], env: { ...process.env, SABRETOOTH_USERDATA: ud } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setFullScreen(false);
    win.setContentSize(1280, 720);
  });
  await page.waitForTimeout(400);
  return { app, page };
}
const g = (page) => page.evaluate(() => window.__menuDebug.game());
const idle = (page) => page.waitForFunction(() => !window.__menuDebug.game().busy, null, { timeout: 8000 });
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
async function shot(page, name) {
  await page.waitForTimeout(350);
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, scale: 'css', clip: { x: 0, y: 0, width: 1280, height: 720 } });
  return file;
}
async function clickChoice(page, id) {
  const b = page.locator(`#game-event [data-choice="${id}"]`);
  await b.click();
  await idle(page);
}
async function layout(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.conversation-card');
    const cast = document.querySelector('.event-cast');
    const name = document.querySelector('.event-cast-name');
    const scroll = document.querySelector('.event-scroll');
    const choices = document.querySelector('.conversation-card .event-choices');
    const buttons = [...choices.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return {
        text: b.textContent, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        height: r.height, wraps: cs.whiteSpace !== 'nowrap',
        clipped: b.scrollHeight > b.clientHeight + 2 || b.scrollWidth > b.clientWidth + 2
      };
    });
    const sr = scroll.getBoundingClientRect();
    const cr = cast.getBoundingClientRect();
    const nr = name.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      node: card.dataset.node, cat: card.dataset.cat, name: name.textContent,
      castTop: cr.top, nameTop: nr.top, nameBottom: nr.bottom,
      scrollTop: sr.top, scrollBottom: sr.bottom, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
      choicesTop: choices.getBoundingClientRect().top,
      choicesInScroll: scroll.contains(choices),
      buttons
    };
  });
}
function assertLayout(box, { scroll = false } = {}) {
  console.log('LAYOUT', JSON.stringify({ node: box.node, size: [box.innerWidth, box.innerHeight], scroll: [box.scrollHeight, box.clientHeight], choicesTop: box.choicesTop, scrollBottom: box.scrollBottom, buttons: box.buttons.map((b) => ({ t: b.text.slice(0, 42), bottom: Math.round(b.bottom), clipped: b.clipped })) }));
  assert.ok(Math.abs(box.innerWidth - 1280) <= 2 && Math.abs(box.innerHeight - 720) <= 2, `window ${box.innerWidth}x${box.innerHeight}`);
  assert.ok(box.castTop >= -1 && box.nameTop >= -1, 'speaker scrolled off');
  assert.ok(box.name && box.name.length > 0);
  assert.strictEqual(box.choicesInScroll, false);
  assert.ok(box.choicesTop >= box.scrollBottom - 2, 'choices overlap the prose scroller');
  assert.ok(box.buttons.length >= 1);
  for (const b of box.buttons) {
    assert.ok(b.top >= box.scrollBottom - 2, b.text);
    assert.ok(b.left >= -1 && b.right <= box.innerWidth + 1, b.text);
    assert.ok(b.bottom <= box.innerHeight + 1, `${b.text} clipped by the window`);
    assert.strictEqual(b.clipped, false, b.text);
    assert.strictEqual(b.wraps, true);
  }
  if (scroll) assert.ok(box.scrollHeight > box.clientHeight + 8, `longest exchange did not scroll (${box.scrollHeight}<=${box.clientHeight})`);
}

(async () => {
  let failures = 0;
  const check = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failures++; console.log('FAIL', name, e.stack || e.message); } };
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-talk-e2e-'));
  const { app, page } = await launch(ud);
  const files = {};
  try {
    await check('start a seeded run and meet ln05 by resting at Split Rock', async () => {
      await page.evaluate((x) => window.__menuDebug.setGameSeed(x), SEED);
      await page.mouse.move(2, 2);
      await press(page, 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
      await press(page, 'ArrowUp', 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
      await press(page, 'ArrowUp', 'Enter', 'ArrowUp', 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      for (let i = 0; i < 30; i++) {
        const { state: s } = await g(page);
        if (s.phase === 'event' && s.pending && s.pending.catId === 'ln05') break;
        if (s.phase === 'conversation' && s.conversation.pending && s.conversation.pending.catId === 'ln05') break;
        if (s.phase === 'event') {
          const pass = page.locator('#game-event [data-choice="pass"]');
          if (await pass.count()) await pass.click(); else await page.locator('#game-event [data-g="choose"]').first().click();
          await idle(page); continue;
        }
        if (s.phase === 'eventResult') { await page.locator('#game-event [data-g="continue"]').click(); await idle(page); continue; }
        if (s.phase === 'conversation') { await clickChoice(page, 'leave'); continue; }
        await page.locator('[data-g="rest"]').click(); await idle(page);
      }
      const { state: s } = await g(page);
      assert.strictEqual(s.pending && s.pending.catId, 'ln05');
      assert.strictEqual(s.region, 'split_rock');
    });

    let identity;
    await check('greet enters the talk; a double click charges once', async () => {
      await page.locator('#game-event [data-choice="greet"]').click();
      await idle(page);
      const opened = (await g(page)).state;
      assert.strictEqual(opened.phase, 'conversation');
      assert.strictEqual(opened.npcs.ln05.affinity, 0);
      identity = {
        name: opened.npcs.ln05.name, portraitId: opened.npcs.ln05.portraitId,
        look: opened.npcs.ln05.look, personality: opened.npcs.ln05.personality || null,
        playerPortrait: opened.cat.portraitId
      };
      const before = opened.needs.energy;
      await page.evaluate(() => {
        const b = document.querySelector('#game-event [data-choice="company"]');
        b.click(); b.click();
      });
      await idle(page);
      const mid = (await g(page)).state;
      assert.strictEqual(mid.conversation.pending.nodeId, 'company');
      assert.strictEqual(mid.needs.energy, before - 3);
      assert.strictEqual(mid.npcs.ln05.affinity, 0);
      assert.strictEqual(mid.conversation.ledger.length, 1);
    });

    const choiceIds = () => page.evaluate(() => [...document.querySelectorAll('.event-choices [data-g="choose"]')].map((b) => b.dataset.choice));
    await check('save mid-talk and Continue restores the same node and choices', async () => {
      assert.strictEqual(await page.locator('.event-choices [data-g="save"]').count(), 0);
      assert.strictEqual(await page.locator('.talk-utility [data-g="save"]').count(), 1);
      const idsBefore = await choiceIds();
      const variantBefore = (await g(page)).state.conversation.pending.presentation.variantIds;
      files.before = await shot(page, 'conversation-node-before');
      await page.locator('.talk-utility [data-g="save"]').click();
      await page.waitForTimeout(300);
      const before = (await g(page)).state;
      await press(page, 'Escape');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'root');
      await press(page, 'Enter');
      await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
      await page.waitForFunction(() => document.querySelector('.conversation-card'));
      const after = (await g(page)).state;
      assert.strictEqual(after.conversation.pending.nodeId, 'company');
      assert.deepStrictEqual(await choiceIds(), idsBefore);
      assert.deepStrictEqual(after.conversation.pending.presentation.variantIds, variantBefore);
      assert.ok(after.npcs.ln05.personality);
      assert.strictEqual(after.npcs.ln05.portraitId, null);
      assert.strictEqual(after.npcs.ln05.name, identity.name);
      assert.strictEqual(after.npcs.ln05.portraitId, identity.portraitId);
      assert.deepStrictEqual(after.npcs.ln05.look, identity.look);
      assert.deepStrictEqual(after.npcs.ln05.personality || null, identity.personality);
      assert.strictEqual(after.cat.portraitId, identity.playerPortrait);
      assert.strictEqual(after.npcs.ln05.affinity, before.npcs.ln05.affinity);
      assert.strictEqual(after.needs.energy, before.needs.energy);
      assert.strictEqual(after.day, before.day);
      const box = await layout(page);
      assert.strictEqual(box.name, identity.name);
      assert.strictEqual(box.node, 'company');
      assertLayout(box);
      const viewerBefore = (await g(page)).state.conversation.pending.nodeId;
      await page.locator('#game-event [data-g="expandCat"]').click();
      await page.waitForFunction(() => !document.getElementById('cat-viewer').hidden);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      assert.strictEqual((await g(page)).state.conversation.pending.nodeId, viewerBefore);
      assert.strictEqual((await g(page)).state.npcs.ln05.affinity, 0);
      if (!(await page.locator('#cat-viewer').isHidden())) await page.locator('#cat-viewer-close').click();
      await page.waitForFunction(() => document.getElementById('cat-viewer').hidden);
      files.after = await shot(page, 'conversation-node-after');
    });

    await check('the longest exchange scrolls and keeps the choices on screen', async () => {
      await clickChoice(page, 'quiet');
      await page.waitForFunction(() => document.querySelector('.conversation-card')?.dataset.node === 'quiet_walk');
      const box = await layout(page);
      assert.strictEqual(box.name, identity.name);
      assert.strictEqual(box.node, 'quiet_walk');
      const prose = await page.locator('.event-scroll').innerText();
      assert.ok(prose.includes('grass brushing your legs') || prose.includes('slows when you slow'));
      assertLayout(box, { scroll: true });
      files.longest = await shot(page, 'conversation-longest');
      await clickChoice(page, 'return_quiet');
      await page.locator('#game-event [data-g="continue"]').click();
      await idle(page);
      const done = (await g(page)).state;
      assert.strictEqual(done.phase, 'day');
      assert.strictEqual(done.npcs.ln05.affinity, 5);
      assert.strictEqual(done.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'pending');
      assert.ok((await g(page)).available.hunt, 'main action still available');
    });

    await check('a later meeting shows the remembered callback for the same cat', async () => {
      const started = (await g(page)).state.day;
      for (let i = 0; i < 8; i++) {
        const avail = (await g(page)).available;
        const row = (avail.talk || []).find((t) => t.catId === 'ln05');
        if (row && row.allowed) break;
        await page.locator('[data-g="rest"]').click();
        await idle(page);
        let guard = 0;
        while ((await g(page)).state.phase !== 'day' && guard++ < 8) {
          const phase = (await g(page)).state.phase;
          if (phase === 'event') {
            const pass = page.locator('#game-event [data-choice="pass"]');
            if (await pass.count()) await pass.click(); else await page.locator('#game-event [data-g="choose"]').first().click();
          } else if (phase === 'eventResult' || phase === 'conversation') {
            const cont = page.locator('#game-event [data-g="continue"]');
            if (await cont.count()) await cont.click();
            else await page.locator('#game-event [data-choice="leave"], #game-event [data-choice="pause"]').first().click();
          }
          await idle(page);
        }
      }
      const row = (await g(page)).available.talk.find((t) => t.catId === 'ln05');
      assert.strictEqual(row.allowed, true, `not eligible by day ${(await g(page)).state.day} from ${started}`);
      await page.locator('[data-g="talk"][data-cat="ln05"]').click();
      await idle(page);
      await page.waitForFunction(() => document.querySelector('.conversation-card')?.dataset.node === 'followup:quiet_company');
      const box = await layout(page);
      assert.strictEqual(box.name, identity.name);
      const now = (await g(page)).state;
      assert.strictEqual(now.npcs.ln05.name, identity.name);
      assert.strictEqual(now.npcs.ln05.portraitId, identity.portraitId);
      assert.deepStrictEqual(now.npcs.ln05.look, identity.look);
      assert.deepStrictEqual(now.npcs.ln05.personality || null, identity.personality);
      assert.strictEqual(now.day, started + 2);
      assertLayout(box);
      files.callback = await shot(page, 'conversation-callback');
      await clickChoice(page, 'quiet_again');
      await page.locator('#game-event [data-g="continue"]').click();
      await idle(page);
      const kept = (await g(page)).state;
      assert.strictEqual(kept.conversation.cats.ln05.facts.find((f) => f.promiseId === 'return_quiet').promise, 'kept');
      assert.strictEqual(kept.conversation.cats.ln05.followupOutcome, 'quiet_renewed');
      const from = kept.day;
      for (let i = 0; i < 8; i++) {
        const avail = (await g(page)).available;
        const ready = (avail.talk || []).find((t) => t.catId === 'ln05');
        if (ready && ready.allowed) break;
        await page.locator('[data-g="rest"]').click();
        await idle(page);
        let guard = 0;
        while ((await g(page)).state.phase !== 'day' && guard++ < 8) {
          const phase = (await g(page)).state.phase;
          if (phase === 'event') {
            const pass = page.locator('#game-event [data-choice="pass"]');
            if (await pass.count()) await pass.click(); else await page.locator('#game-event [data-g="choose"]').first().click();
          } else if (phase === 'eventResult' || phase === 'conversation') {
            const cont = page.locator('#game-event [data-g="continue"]');
            if (await cont.count()) await cont.click();
            else await page.locator('#game-event [data-choice="leave"], #game-event [data-choice="pause"]').first().click();
          }
          await idle(page);
        }
      }
      await page.locator('[data-g="talk"][data-cat="ln05"]').click();
      await idle(page);
      await page.waitForFunction(() => document.querySelector('.conversation-card')?.dataset.node === 'third:confiding');
      const third = await layout(page);
      assert.strictEqual(third.name, identity.name);
      assert.deepStrictEqual((await g(page)).state.npcs.ln05.personality, identity.personality);
      assert.ok((await g(page)).state.day >= from + 2);
      assertLayout(third);
      files.third = await shot(page, 'conversation-meeting-3');
    });
    console.log('SHOTS', JSON.stringify(files));
  } finally {
    await app.close();
  }
  if (failures) { console.log(`FAIL ${failures}`); process.exit(1); }
  console.log('conversation e2e ok');
})().catch((e) => { console.error(e); process.exit(1); });
