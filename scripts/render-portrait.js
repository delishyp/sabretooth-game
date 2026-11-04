// DEV ONLY: renders sample cats with the real compositor to screenshots/portrait-*.png.
// Run: npx electron scripts/render-portrait.js --no-sandbox   (needs a display or xvfb-run)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const path = require('path'); const os = require('os');
const root = path.join(__dirname, '..');
const g = (coat, marking, eyes) => ({ v: 1, loci: { coat: [coat, coat], dilute: ['D', 'D'], marking: [marking, marking], dorsal: ['ds', 'ds'],
  intensity: ['I+', 'I-'], white: ['none', 'none'], eyes: [eyes, eyes], saber: ['ivory', 'ivory'] }, hetero: false, mutations: [] });
const samples = [];
for (const sex of ['male', 'female']) {
  for (const coat of ['tawny', 'greydun', 'russet', 'melan']) samples.push({ name: `${sex}-${coat}-plain-amber`, sex, genes: g(coat, 'plain', 'amber') });
  samples.push({ name: `${sex}-tawny-spotted-amber`, sex, genes: g('tawny', 'spotted', 'amber') });
  samples.push({ name: `${sex}-greydun-faintstripe-green`, sex, genes: g('greydun', 'faintstripe', 'green') });
  samples.push({ name: `${sex}-melan-spotted-gold`, sex, genes: g('melan', 'spotted', 'gold') });
}
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  const html = path.join(os.tmpdir(), 'sabretooth-render-portrait.html');
  fs.writeFileSync(html, `<canvas id=c></canvas><script src="file://${root}/src/renderer/js/compositor.js"></script>`);
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false, offscreen: true } });
  await win.loadFile(html);
  fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
  for (const s of samples) {
    const url = await win.webContents.executeJavaScript(`(async () => {
      const base = ${JSON.stringify('file://' + root)};
      const r = await Compositor.loadPoseManifest(${JSON.stringify(s.sex)}, 'adult', { base: base + '/assets/portraits',
        loadJson: (p) => fetch(p).then((x) => x.json()) });
      const cv = document.getElementById('c');
      const loadImage = (p) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('load ' + p)); i.src = p; });
      const res = await Compositor.compose(r.manifest, ${JSON.stringify(s.genes)}, { canvas: cv, loadImage, dir: r.dir });
      const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
      const o = out.getContext('2d'); o.fillStyle = '#1d2733'; o.fillRect(0, 0, out.width, out.height); o.drawImage(cv, 0, 0);
      return JSON.stringify({ res, url: out.toDataURL('image/png') });
    })()`);
    const { res, url: data } = JSON.parse(url);
    fs.writeFileSync(path.join(root, 'screenshots', `portrait-${s.name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(s.name, 'drawn', res.drawn.join(','), res.skipped.length ? 'SKIPPED ' + res.skipped : '');
  }
  app.quit();
});
