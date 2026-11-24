/** 720 stills: map, region, reputation, council, lore book. */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..');
const out = process.env.UI_SHOTS || '/opt/cursor/artifacts';
const map = require(path.join(root, 'src/renderer/data/map.json'));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-world-'));
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
  const ids = map.regions.map((row) => row.id);
  const claims = {};
  for (const row of map.startClaims) {
    claims[row.regionId] = claims[row.regionId] || {};
    claims[row.regionId][row.prideId] = row.claim;
  }
  await page.evaluate(({ ids, claims }) => {
    const game = window.__menuDebug.game();
    const s = game.state;
    s.map.discovered = ids;
    s.map.visited = ['split_rock', 'salt_flats', 'tallgrass'];
    s.map.claims = Object.assign({}, s.map.claims, claims);
    s.records.pride = { id: 'player', name: 'Ash', denRegionId: 'split_rock' };
    game.render();
  }, { ids, claims });
  await page.waitForTimeout(250);
  const region = path.join(out, 'ui-region-720.png');
  await page.screenshot({ path: region });
  await page.locator('[data-view="map"]').click();
  await page.waitForTimeout(200);
  const board = path.join(out, 'ui-map-720.png');
  await page.screenshot({ path: board });
  await page.evaluate(() => {
    const game = window.__menuDebug.game();
    const s = game.state;
    Reputation.seed(s, 'player', 'mercy', 280);
    Reputation.seed(s, 'player', 'honour', 106);
    Reputation.seed(s, 'player', 'courage', 31);
  });
  await page.locator('[data-view="reputation"]').click();
  await page.waitForTimeout(200);
  const reputation = path.join(out, 'ui-reputation-720.png');
  await page.screenshot({ path: reputation });
  await page.locator('[data-view="lore"]').click();
  await page.waitForTimeout(200);
  const lore = path.join(out, 'ui-lore-720.png');
  await page.screenshot({ path: lore });
  await page.locator('[data-view="home"]').click();
  await page.evaluate(() => {
    const game = window.__menuDebug.game();
    const s = game.state;
    s.day = 20;
    s.world = s.world || {};
    s.world.relations = { 'highcrag>bonefield': -40, 'bonefield>highcrag': -40 };
    s.records.lastCouncilSeason = null;
    Councils.open(s);
    game.render();
  });
  await page.waitForTimeout(250);
  const council = path.join(out, 'ui-council-720.png');
  await page.screenshot({ path: council });
  await app.close();
  console.log([region, board, reputation, lore, council].join('\n'));
})().catch((err) => { console.error(err); process.exit(1); });
