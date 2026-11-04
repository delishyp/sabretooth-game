# Minimal Real-ESRGAN (RRDBNet) inference on CPU, tiled. Weights: xinntao/Real-ESRGAN releases.
import sys, torch, torch.nn as nn, torch.nn.functional as F, numpy as np
from PIL import Image
class RDB(nn.Module):
    def __init__(s,nf=64,gc=32):
        super().__init__()
        s.conv1=nn.Conv2d(nf,gc,3,1,1);s.conv2=nn.Conv2d(nf+gc,gc,3,1,1);s.conv3=nn.Conv2d(nf+2*gc,gc,3,1,1)
        s.conv4=nn.Conv2d(nf+3*gc,gc,3,1,1);s.conv5=nn.Conv2d(nf+4*gc,nf,3,1,1);s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        x1=s.l(s.conv1(x));x2=s.l(s.conv2(torch.cat((x,x1),1)));x3=s.l(s.conv3(torch.cat((x,x1,x2),1)))
        x4=s.l(s.conv4(torch.cat((x,x1,x2,x3),1)));x5=s.conv5(torch.cat((x,x1,x2,x3,x4),1));return x5*0.2+x
class RRDB(nn.Module):
    def __init__(s,nf,gc=32):
        super().__init__();s.rdb1=RDB(nf,gc);s.rdb2=RDB(nf,gc);s.rdb3=RDB(nf,gc)
    def forward(s,x): return s.rdb3(s.rdb2(s.rdb1(x)))*0.2+x
class RRDBNet(nn.Module):
    def __init__(s,nb=23,nf=64):
        super().__init__()
        s.conv_first=nn.Conv2d(3,nf,3,1,1);s.body=nn.Sequential(*[RRDB(nf) for _ in range(nb)])
        s.conv_body=nn.Conv2d(nf,nf,3,1,1);s.conv_up1=nn.Conv2d(nf,nf,3,1,1);s.conv_up2=nn.Conv2d(nf,nf,3,1,1)
        s.conv_hr=nn.Conv2d(nf,nf,3,1,1);s.conv_last=nn.Conv2d(nf,3,3,1,1);s.l=nn.LeakyReLU(0.2,True)
    def forward(s,x):
        f=s.conv_first(x);f=f+s.conv_body(s.body(f))
        f=s.l(s.conv_up1(F.interpolate(f,scale_factor=2,mode='nearest')))
        f=s.l(s.conv_up2(F.interpolate(f,scale_factor=2,mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))
def run(inp,out,weights,nb,tile=256,pad=12):
    torch.set_num_threads(8)
    m=RRDBNet(nb=nb);sd=torch.load(weights,map_location='cpu');sd=sd.get('params_ema',sd.get('params',sd))
    m.load_state_dict(sd,strict=True);m.eval()
    img=np.asarray(Image.open(inp).convert('RGB')).astype(np.float32)/255
    H,W,_=img.shape;o=np.zeros((H*4,W*4,3),np.float32)
    x=torch.from_numpy(img).permute(2,0,1)[None]
    with torch.no_grad():
        for y0 in range(0,H,tile):
            for x0 in range(0,W,tile):
                ya,xa=max(0,y0-pad),max(0,x0-pad);yb,xb=min(H,y0+tile+pad),min(W,x0+tile+pad)
                r=m(x[:,:,ya:yb,xa:xb])[0].permute(1,2,0).numpy()
                ty,tx=(y0-ya)*4,(x0-xa)*4;hh,ww=(min(H,y0+tile)-y0)*4,(min(W,x0+tile)-x0)*4
                o[y0*4:y0*4+hh,x0*4:x0*4+ww]=r[ty:ty+hh,tx:tx+ww]
                print('tile',y0,x0,flush=True)
    Image.fromarray((np.clip(o,0,1)*255+0.5).astype(np.uint8)).save(out)
if __name__=='__main__':
    run(sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]))
