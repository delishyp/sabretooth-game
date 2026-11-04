#!/usr/bin/env python3
"""DEV ONLY. Generates PLACEHOLDER portrait layers from the approved base JPGs (no transparency).
Ochre's real masks overwrite these files at the same paths. Usage: python3 scripts/gen-placeholder-portraits.py <male.jpg> <female.jpg>"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

W, H = 1152, 864
# Crude hand-placed feature boxes (full-res px), read off the bases. Placeholder only.
FEAT = {
  'portrait-male':   {'eye': (1026, 122), 'sabers': [[(1047,237),(1066,237),(1043,312),(1035,318)], [(1071,240),(1086,240),(1080,322),(1075,322)]]},
  'portrait-female': {'eye': (1022, 124), 'sabers': [[(1047,237),(1066,237),(1043,312),(1035,318)], [(1082,258),(1096,258),(1076,320),(1071,321)]]},
}

def build(src, pose):
    out = f'assets/portraits/{pose}'; os.makedirs(out, exist_ok=True)
    g = np.asarray(Image.open(src).convert('L').resize((W, H)), dtype=np.float32)
    ink = g < 110
    # lineart: black ink, alpha from darkness (soft edge)
    a = np.clip((200 - g) / 120, 0, 1); a[g > 200] = 0
    la = np.zeros((H, W, 4), np.uint8); la[..., 3] = (a * 255).astype(np.uint8)
    Image.fromarray(la, 'RGBA').save(f'{out}/lineart.png')
    # silhouette: fill everything not reachable from the border through non-ink (ink dilated to close gaps)
    wall = ndi.binary_dilation(ink, iterations=7)
    lab, _ = ndi.label(~wall)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(border))
    body = ndi.binary_fill_holes(~outside)
    body = ndi.binary_erosion(body, iterations=6)
    body = ndi.binary_opening(body, iterations=2)
    def save_mask(name, m, shade=None, blur=1.5):
        m = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
        s = np.full((H, W), 255, np.uint8) if shade is None else shade
        rgba = np.dstack([s, s, s, np.asarray(m)])
        Image.fromarray(rgba, 'RGBA').save(f'{out}/{name}.png')
    ys, xs = np.mgrid[0:H, 0:W]
    # base_coat shading: light top, darker belly (crude)
    y0, y1 = ys[body].min(), ys[body].max()
    shade = (255 - 70 * np.clip((ys - y0) / max(1, y1 - y0), 0, 1)).astype(np.uint8)
    save_mask('base_coat', body, shade)
    # shadow: ground ellipse under the feet, multiplied
    sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
    xb = xs[body]; d.ellipse([xb.min() + 40, y1 - 30, xb.max() - 20, y1 + 25], fill=150)
    sh = np.asarray(sh.filter(ImageFilter.GaussianBlur(14)))
    Image.fromarray(np.dstack([np.full((H, W), 60, np.uint8)] * 3 + [sh]), 'RGBA').save(f'{out}/shadow.png')
    rng = np.random.default_rng(7)
    sp = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sp)
    for _ in range(260):
        x, y = rng.integers(xb.min(), xb.max()), rng.integers(y0, y1)
        r = rng.integers(6, 13); d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=255)
    save_mask('markings_spotted', (np.asarray(sp) > 0) & body, None, 2)
    stripes = (np.sin((xs + 0.35 * ys) / 18.0) > 0.75) & body & (ys < y0 + 0.75 * (y1 - y0))
    save_mask('markings_faintstripe', stripes, None, 3)
    ex, ey = FEAT[pose]['eye']
    e = Image.new('L', (W, H), 0); ImageDraw.Draw(e).ellipse([ex - 11, ey - 6, ex + 11, ey + 6], fill=255)
    save_mask('eye_left', np.asarray(e) > 0, None, 1)
    # far eye is hidden behind the muzzle in this 3/4 view: placeholder is an empty (transparent) mask
    save_mask('eye_right', np.zeros_like(body), None, 0)
    sp_ = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sp_)
    for poly in FEAT[pose]['sabers']: d.polygon(poly, fill=255)
    sab = np.asarray(sp_) > 0
    save_mask('sabers', sab, None, 1)
    json.dump({
      'pose': pose, 'size': [W, H], 'placeholder': True,
      'lineart': 'lineart.png',
      'layers': [
        {'id': 'shadow', 'file': 'shadow.png', 'blend': 'multiply', 'tintFrom': None},
        {'id': 'base_coat', 'file': 'base_coat.png', 'blend': 'normal', 'tintFrom': 'coat'},
        {'id': 'markings_spotted', 'file': 'markings_spotted.png', 'blend': 'normal', 'tintFrom': 'marking'},
        {'id': 'markings_faintstripe', 'file': 'markings_faintstripe.png', 'blend': 'normal', 'tintFrom': 'marking'},
        {'id': 'eye_left', 'file': 'eye_left.png', 'blend': 'normal', 'tintFrom': 'eyes'},
        {'id': 'eye_right', 'file': 'eye_right.png', 'blend': 'normal', 'tintFrom': 'eyes'},
        {'id': 'sabers', 'file': 'sabers.png', 'blend': 'normal', 'tintFrom': 'saber'},
      ]}, open(f'{out}/manifest.json', 'w'), indent=2)
    print(pose, 'body px', int(body.sum()), 'saber px', int(sab.sum()))

build(sys.argv[1], 'portrait-male'); build(sys.argv[2], 'portrait-female')
