/** 720 live shots next to Ochre's mockups. */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const out = process.env.UI_SHOTS || '/opt/cursor/artifacts';
const mocks = path.join(root, 'docs/design/mockups');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-layout-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
  const shot = async (name) => {
    const file = path.join(out, 'live-' + name + '-720.png');
    await page.screenshot({ path: file });
    return file;
  };
  const quiet = () => page.evaluate(() => {
    const g = window.__menuDebug.game();
    if (g.state.tutorial) g.state.tutorial.off = true;
    const card = document.getElementById('tutorial-card');
    if (card) card.remove();
    g.render();
  });

  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  await page.locator('[data-cnav="next"]').click();
  await page.waitForTimeout(300);
  const traits = await shot('traits');
  for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
  await quiet();
  const day1 = await shot('den-day1');
  await page.locator('[data-g="openActions"]').click();
  await page.waitForTimeout(200);
  const actions = await shot('den-actions');
  const more = await shot('den-more-actions');
  await page.locator('[data-view="breeding"]').click();
  await page.waitForTimeout(200);
  const locked = await shot('den-locked');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    const s = g.state;
    s.records.pride = { id: 'player', name: 'Ash pride' };
    s.unlocks = s.unlocks || { seen: [], used: [] };
    for (const id of ['pride', 'den', 'breeding']) if (!s.unlocks.seen.includes(id)) s.unlocks.seen.push(id);
    for (const id of ['bf01', 'mw04', 'hc07']) if (s.npcs[id]) s.npcs[id].met = true;
    document.querySelector('[data-view="home"]').click();
  });
  await page.waitForTimeout(300);
  const later = await shot('den-later');
  if (await page.locator('#game-actions').isHidden()) await page.locator('[data-g="openActions"]').click();
  const laterActions = await shot('den-later-actions');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    const s = g.state;
    const npc = s.npcs.hc07;
    s.phase = 'event';
    s.pending = {
      eventId: 'layout.talk', title: npc.name, catId: npc.id,
      beats: [{ kind: 'speech', speakerId: npc.id, speaker: npc.name, text: 'You came.' }],
      beatIndex: 0, choices: []
    };
    g.render();
  });
  await page.waitForTimeout(400);
  const talk = await shot('dialogue');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    const s = g.state;
    const npc = s.npcs.hc07;
    s.pending.choices = [
      { id: 'a', label: 'I will walk with you.' },
      { id: 'b', label: 'Not today.' },
      { id: 'c', label: 'Tell me what you saw.' }
    ];
    s.pending.beats = [{ kind: 'speech', speakerId: npc.id, speaker: npc.name, text: 'Will you walk?' }];
    g.render();
  });
  await page.waitForTimeout(300);
  const choices = await shot('dialogue-choices');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    const s = g.state;
    s.phase = 'encounter';
    s.encounters = s.encounters || { log: [], cooldowns: {}, pending: null };
    s.encounters.pending = {
      encounterId: 'encounter.wolf_pack.v1', encounterInstanceId: 'shot',
      assetId: 'old-pack-enemy.png', displayName: 'Wolf pack enemy', nodeId: 'opening',
      lines: [{ kind: 'narration', text: 'The pack is here.' }],
      choices: [{ id: 'give_ground', label: 'Give ground' }]
    };
    g.render();
  });
  await page.waitForTimeout(300);
  const encounter = await shot('encounter');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    g.state.phase = 'day';
    g.state.pending = null;
    g.state.encounters.pending = null;
    document.querySelector('[data-view="map"]').click();
  });
  await page.waitForTimeout(300);
  const map = await shot('map');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    const s = g.state;
    s.phase = 'day';
    s.pending = null;
    if (s.encounters) s.encounters.pending = null;
    s.cat.lifeStage = 'cub';
    document.querySelector('[data-view="home"]').click();
  });
  await page.waitForTimeout(500);
  const cubDen = await shot('cub-den');
  await page.evaluate(() => {
    const g = window.__menuDebug.game();
    const s = g.state;
    const cub = Object.values(s.npcs).find((n) => n && n.stage === 'cub') || s.npcs.hc10;
    cub.stage = 'cub';
    cub.name = cub.name || 'Little Reed';
    s.phase = 'event';
    s.pending = {
      eventId: 'layout.cub', title: cub.name, catId: cub.id,
      beats: [{ kind: 'speech', speakerId: cub.id, speaker: cub.name, text: 'The cub looks up.' }],
      beatIndex: 0, choices: [{ id: 'stay', label: 'Stay with the cub.' }]
    };
    g.render();
  });
  await page.waitForTimeout(500);
  const cubTalk = await shot('cub-dialogue');
  await app.close();
  console.log(cubDen);
  console.log(cubTalk);
  const pairs = { traits, 'den-day1': day1, 'den-actions': actions, 'den-more-actions': more, 'den-locked': locked, 'den-later': later, 'den-later-actions': laterActions, dialogue: talk, 'dialogue-choices': choices, encounter, map };
  const py = spawnSync('python3', ['-c', `
from PIL import Image
import os
out = ${JSON.stringify(out)}
mocks = ${JSON.stringify(mocks)}
pairs = ${JSON.stringify(pairs)}
for name, live in pairs.items():
    mock = os.path.join(mocks, name + '-720.png')
    if not os.path.exists(mock):
        print('missing', mock); continue
    a = Image.open(mock).convert('RGB'); b = Image.open(live).convert('RGB')
    a = a.resize((1280, 720)); b = b.resize((1280, 720))
    canvas = Image.new('RGB', (2580, 770), (20, 14, 10))
    canvas.paste(a, (0, 25)); canvas.paste(b, (1300, 25))
    dest = os.path.join(out, 'compare-' + name + '-720.jpg')
    canvas.save(dest, quality=85)
    print(dest)
`], { encoding: 'utf8' });
  process.stdout.write(py.stdout || '');
  if (py.status) { process.stderr.write(py.stderr || ''); process.exit(py.status); }
})().catch((err) => { console.error(err); process.exit(1); });
