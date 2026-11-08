/**
 * Art slots. Swap art by dropping a file in place; no code change needed.
 *   Background: assets/menu/background.(png|jpg|webp)  — first one found wins; none → CSS gradient (theme.css --bg-fallback)
 *   Logo:       assets/menu/logo.png                   — missing → text title
 * Paths are relative to src/renderer/index.html.
 */
const ART = {
  // background.jpg is the approved Milky Way scene. background.png is the older illustration and stays on disk, unused while jpg is present.
  background: ['../../assets/menu/background.jpg', '../../assets/menu/background.png', '../../assets/menu/background.webp'],
  logo: ['../../assets/menu/logo.png']
};

function probeImage(src) {
  return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(true); i.onerror = () => resolve(false); i.src = src; });
}
async function firstExisting(list) { for (const src of list) if (await probeImage(src)) return src; return null; }
/**
 * Background as a window-sized canvas, `cover` at 35% / center (same framing as the old CSS background).
 * Why not CSS `background-size: cover`: with software raster (no GPU, e.g. the QA box) Chromium draws a downscaled background
 * per raster tile and leaves a 1px seam at a tile edge, so a body-coloured crosshair showed at ~53% of the window on every screen.
 * One pre-scaled bitmap has no tile seams. Redrawn on resize.
 */
async function paintBackground(src) {
  const img = new Image(); img.src = src;
  try { await img.decode(); } catch { document.getElementById('bg').style.backgroundImage = `url("${src}")`; return; }
  const host = document.getElementById('bg');
  const c = document.createElement('canvas'); c.id = 'bg-canvas';
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  host.textContent = ''; host.appendChild(c);
  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
    const k = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, (c.width - w) * 0.35, (c.height - h) * 0.5, w, h);
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
