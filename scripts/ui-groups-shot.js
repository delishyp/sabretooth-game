/**
 * Capture one UI group at 1280×720 and 1920×1080.
 * Usage: node scripts/ui-groups-shot.js <group>
 * group: log | encounter | directory | map | lore
 */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..');
const out = process.env.UI_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });
const group = process.argv[2] || 'log';

async function start(page) {
  await page.locator('[data-action="newGame"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'newGameSetup');
  await page.locator('[data-nav="begin"]').click();
  await page.waitForFunction(() => window.__menuDebug.state().state === 'creator');
  for (const k of ['ArrowUp', 'Enter', 'ArrowUp', 'Enter']) await page.keyboard.press(k);
  await page.waitForFunction(() => window.__menuDebug.state().state === 'game');
}

async function prime(page) {
  await page.evaluate((which) => {
    const game = window.__menuDebug.game();
    const s = game.state;
    const npc = s.npcs.ln05;
    npc.met = true;
    if (which === 'log') {
      s.phase = 'event';
      s.pending = {
        eventId: 'ui.shot', title: 'A mixed line', kind: 'first_meeting', catId: 'ln05', catName: npc.name,
        day: s.day, hostile: false, choiceId: null, beatIndex: 0,
        beats: [{ speaker: 'ln05', parts: [{ beat: 'The grass moves.' }, { say: 'You came alone.' }] }]
      };
    } else if (which === 'encounter') {
      s.phase = 'encounter';
      s.encounters = s.encounters || { schema: 1, log: [], cooldowns: {}, pending: null, rendezvous: null };
      s.encounters.pending = {
        encounterId: 'encounter.giant_deer.v1', assetId: 'giant-deer.png', displayName: 'Giant deer',
        nodeId: 'opening', lines: [{ kind: 'narration', text: 'A deer stands in the open.' }],
        terminal: false, encounterInstanceId: 'shot',
        absDay: s.day, regionId: s.region, meter: { kind: 'hunt', band: 1 }
      };
    } else if (which === 'directory') {
      s.phase = 'day'; s.pending = null;
      window.__uiShotView = 'cats';
    } else if (which === 'map') {
      s.phase = 'day'; s.pending = null;
      s.map.discovered = ['ice_wall', 'frost_tongue', 'blue_caves', 'wind_scree', 'north_pass', 'highcrag', 'horse_meadows', 'upper_greywater', 'greywater_ford', 'salt_flats', 'bonefield', 'herd_trail', 'tallgrass', 'south_range', 'split_rock', 'twin_forks', 'reedbank', 'mistwood', 'fog_paths', 'west_spur', 'drowned_mere', 'mere_shore', 'island_mere', 'east_saddle', 'bears_throat', 'claw_gorge', 'tar_seeps', 'ash_hills', 'wolf_run', 'camel_ridge'];
      s.map.visited = ['split_rock'];
      window.__uiShotView = 'map';
    } else if (which === 'lore') {
      s.phase = 'day'; s.pending = null;
      window.__uiShotView = 'lore';
    }
    game.render();
    const view = { directory: 'cats', map: 'map', lore: 'lore' }[which];
    if (view) {
      const button = document.querySelector('[data-view="' + view + '"]');
      if (button) button.click();
    }
  }, group);
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-ui-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud, SABRETOOTH_MENU_UNLOCK: '1' }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await start(page);
  await prime(page);
  if (group === 'map' || group === 'lore') {
    await page.evaluate((which) => {
      const game = window.__menuDebug.game();
      const t = game.state.tutorial;
      if (t) { t.off = true; t.active = null; }
      game.render();
      const button = document.querySelector('[data-view="' + which + '"]');
      if (button) button.click();
    }, group);
  }
  await page.waitForTimeout(300);
  const files = [];
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.w, size.h), { w, h });
    await page.waitForTimeout(250);
    const file = path.join(out, `ui-${group}-${tag}.png`);
    await page.screenshot({ path: file });
    files.push(file);
  }
  await app.close();
  console.log(files.join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });
