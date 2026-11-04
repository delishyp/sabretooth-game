# Composites the APPROVED Smilodon base silhouettes onto AI backgrounds (backgrounds contain no cats/text).
from PIL import Image, ImageFilter, ImageChops, ImageOps, ImageEnhance
import numpy as np
from scipy import ndimage
R='refs/'; B='backgrounds/'
W,H=1920,1080
def load_bg(n): return Image.open(B+f'raw-{n}.jpg').convert('RGB').resize((W,H),Image.LANCZOS)
def cat(n, h, mirror=False):
    m=Image.open(R+f'mask-{n}-clean.png').convert('L')
    l=Image.open(R+f'smilodon-{n}-base.jpg').convert('L')
    bbox=m.getbbox(); m=m.crop(bbox); l=l.crop(bbox)
    if mirror: m=ImageOps.mirror(m); l=ImageOps.mirror(l)
    s=h/m.height; sz=(int(m.width*s),h)
    return m.resize(sz,Image.LANCZOS), l.resize(sz,Image.LANCZOS)
rng=np.random.default_rng(3)
def noise(sz,scale=6):
    n=rng.random((sz[1]//scale+2,sz[0]//scale+2))
    return Image.fromarray((n*255).astype('uint8')).resize(sz,Image.BICUBIC)

# ---------- A: cave painting on the wall (mirrored so pride faces the menu) ----------
bg=load_bg('a-cave-wall'); base=np.asarray(bg).astype(float)/255
for n,h,x,ybot,mir in [('male',300,960,812,True),('female',262,1545,836,True)]:
    m,l=cat(n,h,mir)
    # rough pigment edge
    mn=np.asarray(m).astype(float)/255
    nz=np.asarray(noise(m.size,4)).astype(float)/255
    rough=np.clip((mn*0.85+nz*0.3-0.55)*6,0,1)
    rough=ndimage.gaussian_filter(rough,0.8)
    ln=1-np.asarray(l).astype(float)/255  # ink
    ln=np.clip(ln*1.6,0,1)
    grain=np.asarray(noise(m.size,2)).astype(float)/255
    fill=np.array([0.72,0.40,0.18])  # red ochre
    y0=ybot-h; x0=x
    reg=base[y0:y0+m.height, x0:x0+m.width]
    a=(rough*(0.55+0.25*grain))[...,None]
    reg=reg*(1-a)+reg*fill*a*1.25   # multiply-ish pigment that keeps rock texture
    ink=(ln*rough*0.85)[...,None]
    reg=reg*(1-ink)+np.array([0.10,0.07,0.05])*ink
    base[y0:y0+m.height, x0:x0+m.width]=reg
Image.fromarray((np.clip(base,0,1)*255).astype('uint8')).save(B+'bg-a-cave-wall.png')

# ---------- B: backlit silhouettes on the moonlit ridge ----------
bg=load_bg('b-frost-steppe'); im=bg.copy()
for n,h,x,ybot,mir in [('female',150,1330,560,True),('male',178,1560,548,True)]:
    m,l=cat(n,h,mir)
    glow=m.filter(ImageFilter.GaussianBlur(6))
    rim=ImageChops.subtract(m.filter(ImageFilter.MaxFilter(5)),m)
    y0=ybot-h
    im.paste(Image.new('RGB',m.size,(200,215,245)),(x,y0),ImageEnhance.Brightness(glow).enhance(0.35))
    im.paste(Image.new('RGB',m.size,(225,232,250)),(x,y0),ImageEnhance.Brightness(rim.filter(ImageFilter.GaussianBlur(1))).enhance(0.8))
    im.paste(Image.new('RGB',m.size,(18,22,40)),(x,y0),m)
im.save(B+'bg-b-frost-steppe.png')

# ---------- C: tinted lineart cats standing on the snow either side of the campfire ----------
bg=load_bg('c-aurora'); base=np.asarray(bg).astype(float)/255
FIRE=(1472,925)
for n,h,x,ybot,mir in [('female',265,1060,958,True),('male',300,1505,968,True)]:
    m,l=cat(n,h,mir)
    mb=np.asarray(m).astype(float)/255>0.5
    mn=np.asarray(m.filter(ImageFilter.GaussianBlur(0.7))).astype(float)/255
    ln=np.asarray(l).astype(float)/255
    H_,W_=mn.shape; y0=ybot-h
    yy=np.linspace(0,1,H_)[:,None]; xx=np.arange(W_)[None,:]+x; yabs=np.arange(H_)[:,None]+y0
    dist=ndimage.distance_transform_edt(mb); vol=np.clip(dist/18,0,1)**0.5
    coat=np.array([0.52,0.39,0.26])*(0.55+0.45*vol)[...,None]*(0.85+0.15*(1-yy))[...,None]
    coat=coat*np.array([0.70,0.76,0.98])
    d=np.sqrt((xx-FIRE[0])**2+(yabs-FIRE[1])**2)
    warm=np.clip(1-d/520,0,1)**1.5
    edge=np.clip(1-dist/10,0,1)*warm
    col=coat+ (warm*0.22+edge*0.55)[...,None]*np.array([1.0,0.55,0.15])
    col=np.clip(col,0,1)*(ln[...,None]*0.9+0.1)
    # soft elliptical contact shadow on snow
    Y,X=np.mgrid[0:H,0:W]
    cx=x+W_/2; ell=((X-cx)/(W_*0.55))**2+((Y-ybot)/14)**2
    shd=np.clip(1-ell,0,1)*0.5
    base*=(1-shd)[...,None]
    reg=base[y0:y0+H_, x:x+W_]
    col=ndimage.gaussian_filter(col,(0.6,0.6,0))
    reg=reg*(1-mn[...,None])+col*mn[...,None]
    base[y0:y0+H_, x:x+W_]=reg
im=Image.fromarray((np.clip(base,0,1)*255).astype('uint8'))
im.save(B+'bg-c-aurora.png')
