/**
 * Root menu uses the approved Milky Way jpg. Creator and den files stay on their own paths.
 * FIXTURE is not used here: this is the fresh root screen.
 */
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs'); const os = require('os'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const SHOTS = process.env.MENU_SHOTS || '/opt/cursor/artifacts/root-menu-milky-way';
const APPROVED = 'e6b3f85f5bfcdcb5c03e9358bf0f05c0ce55e2b88850d134684e93cb0eb5a9ad';
const SUPERSEDED = '615d44a0cee5993ffa486ddb48c63db8a967bf64a060bec624e2cef663025205';
fs.mkdirSync(SHOTS, { recursive: true });
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

(async () => {
  assert.strictEqual(sha('assets/menu/background.jpg'), APPROVED);
  assert.strictEqual(sha('assets/menu/background.png'), SUPERSEDED);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sabre-menu-'));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', '--force-device-scale-factor=1', root],
    env: { ...process.env, SABRETOOTH_USERDATA: ud }
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__menuDebug);
  await page.waitForFunction(() => document.getElementById('bg-canvas'), null, { timeout: 8000 });
  const resize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s.w, s.h), { w, h });
    await page.waitForTimeout(300);
    const got = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    assert.deepStrictEqual(got, { w, h });
  };
  const sample = async () => page.evaluate(async () => {
    const canvas = document.getElementById('bg-canvas');
    const load = async (src) => { const img = new Image(); img.src = src; await img.decode(); return img; };
    const approved = await load('../../assets/menu/background.jpg');
    const old = await load('../../assets/menu/background.png');
    const fx = 0.72, fy = 0.55;
    const mapped = (img) => {
      const k = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      const sx = ((fx * canvas.width) - (canvas.width - w) * 0.35) / k;
      const sy = ((fy * canvas.height) - (canvas.height - h) * 0.5) / k;
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      c.getContext('2d').drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
      return [...c.getContext('2d').getImageData(0, 0, 1, 1).data];
    };
    const shown = [...canvas.getContext('2d').getImageData(Math.floor(canvas.width * fx), Math.floor(canvas.height * fy), 1, 1).data];
    return {
      shown,
      approved: mapped(approved),
      old: mapped(old),
      creator: document.querySelector('.creator-scene').getAttribute('src'),
      den: document.getElementById('home-landscape').getAttribute('src'),
      screen: window.__menuDebug.state().state
    };
  });
  for (const [w, h, tag] of [[1280, 720, '720'], [1920, 1080, '1080']]) {
    await resize(w, h);
    await page.waitForTimeout(200);
    const info = await sample();
    assert.strictEqual(info.screen, 'root');
    assert.ok(info.creator.includes('assets/menu/night/work/bg1920.png'));
    assert.ok(info.den.includes('assets/game/home-landscape.png'));
    const dist = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0);
    assert.ok(dist(info.shown, info.approved) < 40, JSON.stringify({ shown: info.shown, approved: info.approved }));
    assert.ok(dist(info.shown, info.approved) < dist(info.shown, info.old), JSON.stringify({ shown: info.shown, old: info.old }));
    await page.screenshot({ path: path.join(SHOTS, `root-menu-${tag}.png`) });
    console.log('root menu', tag, info.shown.join(','));
  }
  await app.close();
  console.log('root menu scene passed', SHOTS);
})().catch((e) => { console.error(e); process.exit(1); });
