// DEV ONLY: opens the modular appearance preview. Does not launch the game menu.
// Run: npx electron scripts/appearance-preview.js --no-sandbox
//      npx electron scripts/appearance-preview.js --no-sandbox --screenshot
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
const root = path.join(__dirname, '..');
const shot = process.argv.includes('--screenshot');

function fail(err) {
  console.error(err && err.stack ? err.stack : err);
  app.exit(1);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1680, height: 1050, show: true, backgroundColor: '#10161c', autoHideMenuBar: true,
    title: 'Sabretooth — appearance preview',
    // Dev-only window. webSecurity is off so the page can read assets/appearance next to src/.
    // The game window in src/main/main.js stays sandboxed and does not load this page.
    webPreferences: { webSecurity: false, contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 2) console.error(message); });
  await win.loadFile(path.join(root, 'src/renderer/appearance-preview.html'));
  let info = null;
  for (let i = 0; i < 100; i++) {
    const raw = await win.webContents.executeJavaScript('window.__appearancePreview ? JSON.stringify(window.__appearancePreview) : ""');
    if (raw) { info = JSON.parse(raw); break; }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!info) throw new Error('appearance preview did not report a result');
  if (info.error) throw new Error(info.error);
  if (!info.matchesMaster) throw new Error('default render does not match the master pixels');
  if (!info.cutouts || info.cutouts.differs !== 0 || info.cutouts.alphaZero < 1) throw new Error('eye/nose cutouts were not preserved: ' + JSON.stringify(info.cutouts));
  if (info.masksApplied.length !== 0) throw new Error('default preview applied a mask: ' + JSON.stringify(info.masksApplied));
  const painted = JSON.parse(await win.webContents.executeJavaScript(`(() => {
    const c = document.getElementById('view');
    const px = c.getContext('2d').getImageData(544, 385, 1, 1).data;
    const hole = c.getContext('2d').getImageData(1304, 144, 1, 1).data;
    return JSON.stringify({ css: [c.style.width, c.style.height], body: [...px], hole: [...hole], readout: document.getElementById('canvas-readout').textContent, eyes: document.querySelector('#slot-eyes select') && document.querySelector('#slot-eyes select').disabled });
  })()`));
  if (painted.body[3] !== 255 || painted.hole[3] !== 0) throw new Error('on-canvas samples are not the untouched master: ' + JSON.stringify(painted));
  if (!painted.eyes) throw new Error('eyes slot was not shown as unavailable');
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await new Promise((r) => setTimeout(r, 300));
  console.log('preview', JSON.stringify({ selection: info.selection, native: info.native, fit: info.fit, masksApplied: info.masksApplied, cutouts: info.cutouts, stack: info.stack, painted }));
  if (shot) {
    const png = (await win.webContents.capturePage()).toPNG();
    const out = path.join(root, 'screenshots', 'appearance-preview.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png);
    console.log('wrote', out);
    app.quit();
  }
}).catch(fail);

app.on('window-all-closed', () => app.quit());
