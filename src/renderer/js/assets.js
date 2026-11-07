/**
 * Art slots. Swap art by dropping a file in place; no code change needed.
 *   Background: assets/menu/background.(png|jpg|webp)  — first one found wins; none → CSS gradient (theme.css --bg-fallback)
 *   Logo:       assets/menu/logo.png                   — missing → text title
 * Paths are relative to src/renderer/index.html.
 */
const ART = {
  background: ['../../assets/menu/background.png', '../../assets/menu/background.jpg', '../../assets/menu/background.webp'],
  logo: ['../../assets/menu/logo.png']
};

function probeImage(src) {
  return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(true); i.onerror = () => resolve(false); i.src = src; });
}
async function firstExisting(list) { for (const src of list) if (await probeImage(src)) return src; return null; }
/**
 * Background as a window-sized canvas, cover-scaled, not stretched.
 * Why not CSS `background-size: cover`: with software raster (no GPU, e.g. the QA box) Chromium draws a downscaled background
 * per raster tile and leaves a 1px seam at a tile edge, so a body-coloured crosshair showed at ~53% of the window on every screen.
 * One pre-scaled bitmap has no tile seams. Redrawn on resize.
 * MenuFrame skips the approved plate's black side bars and keeps the cat on the right.
 */
async function paintBackground(src) {
  const img = new Image(); img.src = src;
  try { await img.decode(); } catch { document.getElementById('bg').style.backgroundImage = `url("${src}")`; return; }
  const host = document.getElementById('bg');
  const c = document.createElement('canvas'); c.id = 'bg-canvas';
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  host.textContent = ''; host.appendChild(c);
  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const box = MenuFrame.place(c.width, c.height, img.naturalWidth, img.naturalHeight);
    g.drawImage(img, box.sx, box.sy, box.sw, box.sh, box.dx, box.dy, box.dw, box.dh);
  };
  draw(); addEventListener('resize', draw);
}
async function applyArt() {
  const bg = await firstExisting(ART.background);
  if (bg) await paintBackground(bg);
  const logo = await firstExisting(ART.logo);
  if (logo) {
    const img = document.getElementById('logo'); img.src = logo; img.hidden = false;
    document.getElementById('logo-text').hidden = true;
  }
}
