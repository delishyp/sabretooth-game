/** 720 stills: den, dialogue, spar, threat. PREFIX=before|after */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..');
const out = process.env.UI_SHOTS || '/opt/cursor/artifacts';
const prefix = process.env.SHOT_PREFIX || 'before';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-port-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await page.waitForTimeout(400);
  const den = path.join(out, prefix + '-den-720.png');
  await page.screenshot({ path: den });
  await page.evaluate(() => {
    const game = window.__menuDebug.game();
    const s = game.state;
    const npc = Object.values(s.npcs).find((n) => n && n.name);
    s.npcs[npc.id].met = true;
    s.pending = {
      eventId: 'slice.meeting.' + (npc.faction || 'loner'),
      title: npc.name,
      catId: npc.id,
      beats: [{ kind: 'speech', speakerId: npc.id, speaker: npc.name, text: 'You came.' }],
      beatIndex: 0,
      choices: [{ id: 'leave', label: 'Leave' }]
    };
    s.phase = 'event';
    game.render();
  });
  await page.waitForTimeout(300);
  const talk = path.join(out, prefix + '-dialogue-720.png');
  await page.screenshot({ path: talk });
  await page.evaluate(() => {
    const game = window.__menuDebug.game();
    const s = game.state;
    const npc = Object.values(s.npcs).find((n) => n && n.stage === 'adult' && n.name);
    s.npcs[npc.id].met = true;
    s.npcs[npc.id].affinity = 40;
    s.pending = {
      eventId: 'lone.spar',
      title: 'Play-fight',
      catId: npc.id,
      showPortrait: true,
      beats: [{ kind: 'narration', text: 'You and ' + npc.name + ' wrestle.', speakerId: npc.id }],
      beatIndex: 0,
      choices: []
    };
    s.phase = 'event';
    game.render();
  });
  await page.waitForTimeout(300);
  const spar = path.join(out, prefix + '-spar-720.png');
  await page.screenshot({ path: spar });
  await page.evaluate(() => {
    const game = window.__menuDebug.game();
    const s = game.state;
    s.phase = 'encounter';
    s.encounters = s.encounters || { log: [], cooldowns: {}, pending: null };
    s.encounters.pending = {
      encounterId: 'encounter.wolf_pack.v1',
      encounterInstanceId: 'shot',
      assetId: 'old-pack-enemy.png',
      displayName: 'Wolf pack enemy',
      nodeId: 'opening',
      lines: [{ kind: 'narration', text: 'The pack is here.' }],
      choices: [{ id: 'give_ground', label: 'Give ground' }]
    };
    game.render();
  });
  await page.waitForTimeout(300);
  const threat = path.join(out, prefix + '-threat-720.png');
  await page.screenshot({ path: threat });
  await app.close();
  console.log([den, talk, spar, threat].join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });
