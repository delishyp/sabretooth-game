# Composites the reposed lineart Smilodon (lying_b2.jpg, derived from the APPROVED male base) onto B's raw night background.
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage
W,H=1920,1080
bg=np.asarray(Image.open('bg1920.png').convert('RGB')).astype(float)/255
src=np.asarray(Image.open('lying_b2.jpg').convert('RGB')).astype(float)/255
mn=src.min(2)
# exterior = near-white region connected to the border
light=mn>0.80
lab,_=ndimage.label(light)
border=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
ext=np.isin(lab,list(border))
cat=~ext
cat=ndimage.binary_fill_holes(cat)
# keep only biggest component (the cat)
l2,n=ndimage.label(cat); sizes=ndimage.sum(cat,l2,range(1,n+1)); cat=l2==(np.argmax(sizes)+1)
a_cat=ndimage.gaussian_filter(cat.astype(float),0.6)
# whiskers / antialiased ink in the exterior
a_line=np.clip((0.86-mn)/0.55,0,1)*ext
alpha=np.maximum(a_cat,a_line)
ys,xs=np.where(alpha>0.05); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
def build(target_w, x_left, y_bottom, mirror, out):
    s=src[y0:y1,x0:x1].copy(); a=alpha[y0:y1,x0:x1].copy(); al=a_line[y0:y1,x0:x1]; c=cat[y0:y1,x0:x1]
    # exterior ink pixels: dark line colour
    s=np.where((~c)[...,None], np.array([0.10,0.09,0.12]), s)
    S=lambda arr,mode: np.asarray(Image.fromarray((np.clip(arr,0,1)*255).astype('uint8'),mode))
    img=Image.fromarray((s*255).astype('uint8')); am=Image.fromarray((a*255).astype('uint8')); cm=Image.fromarray((c*255).astype('uint8'))
    if mirror: img,am,cm=[ImageOps.mirror(i) for i in (img,am,cm)]
    h=int(round(img.height*target_w/img.width))
    img=img.resize((target_w,h),Image.LANCZOS); am=am.resize((target_w,h),Image.LANCZOS); cm=cm.resize((target_w,h),Image.LANCZOS)
    s=np.asarray(img).astype(float)/255; a=np.asarray(am).astype(float)/255; c=np.asarray(cm).astype(float)/255>0.5
    # ---- moonlight grade ----
    lum=s.mean(2,keepdims=True)
    ink=np.clip((0.35-lum)/0.25,0,1)                       # protect linework
    yy=np.linspace(0,1,h)[:,None,None]
    tint=np.array([0.80,0.74,0.86])                         # cool ambient
    g=s*tint*(1.02-0.30*yy)                                 # darker toward the belly/ground
    g=g*0.78+lum*np.array([0.50,0.56,0.80])*0.22            # mild desaturation
    # rim light from the moon (behind/above the cat)
    dist=ndimage.distance_transform_edt(c)
    up=np.zeros_like(c); 
    sh=np.roll(c,12,axis=0); sh[:12]=False
    rim=(c & ~sh & (dist>2.5)).astype(float)
    rim=ndimage.gaussian_filter(rim,1.8)*np.clip(1.15-yy[...,0]*1.5,0,1)
    rim=np.clip(rim*1.6,0,1)[...,None]
    g=g*(1-ink)+s*np.array([0.55,0.58,0.75])*ink
    g=g+rim*(1-ink)*np.array([0.26,0.36,0.58])
    # eye glint kept: amber pixels stay warm
    out_bg=out
    X0=x_left; Y0=y_bottom-h
    # contact shadow on the snow
    sm=np.zeros((H,W)); bot=np.where(c.any(1))[0].max()
    cols=np.where(c[bot-int(h*0.08):bot].any(0))[0]
    cx0,cx1=X0+cols.min(),X0+cols.max()
    yyg,xxg=np.mgrid[0:H,0:W]
    e=((xxg-(cx0+cx1)/2)/((cx1-cx0)/2*1.02))**2+((yyg-(Y0+bot+4))/14)**2
    sm=np.clip(1-e,0,1); sm=ndimage.gaussian_filter(sm,8)
    out_bg*= (1-0.45*sm)[...,None]*np.array([1,1,1])+0
    reg=out_bg[Y0:Y0+h,X0:X0+target_w]
    rows=np.arange(h)[:,None]
    lowest=np.where(c.any(0), h-1-np.argmax(c[::-1],axis=0), 0)[None,:]
    lip=None
    A=a[...,None]
    reg[:]=reg*(1-A)+g*A
    # snow drift over the very bottom of the cat so it sinks into the snow (soft, wavy edge)
    rng=np.random.default_rng(7)
    wav=ndimage.gaussian_filter1d(rng.normal(0,1,target_w),9)*9
    base_line=np.percentile(lowest[0][c.any(0)],70)
    top=(base_line-6+wav).astype(float)
    drift=np.clip((rows-top[None,:])/3,0,1)*a
    drift=ndimage.gaussian_filter(drift.astype(float),1.0)[...,None]
    snow=np.array([0.70,0.75,0.89])
    shade=np.clip((rows-top[None,:])/10,0,1)[...,None]
    reg[:]=reg*(1-drift)+(snow*(1-0.18*shade))*drift
    # snow lip: a few px of soft snow over the very bottom so the cat sits IN the snow
    return out_bg
import sys
def save(arr,fn): Image.fromarray((np.clip(arr,0,1)*255).astype('uint8')).save(fn)
v1=build(560,1300,566,False,bg.copy()); save(v1,'../night-bg-v1-moongaze.png')
v2=build(600,1225,562,True,bg.copy()); save(v2,'../night-bg-v2-skygaze.png')
