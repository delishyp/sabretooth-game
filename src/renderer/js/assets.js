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
async function applyArt() {
  const bg = await firstExisting(ART.background);
  if (bg) document.getElementById('bg').style.backgroundImage = `url("${bg}")`;
  const logo = await firstExisting(ART.logo);
  if (logo) {
    const img = document.getElementById('logo'); img.src = logo; img.hidden = false;
    document.getElementById('logo-text').hidden = true;
  }
}
