#!/usr/bin/env python3
"""Quality gate for the redesign mockups. For each screen at 1920x1080 and 3440x1440, loads the page in headless Chrome
with an injected DOM probe and checks: text overflow/clipping, panels overlapping or leaving the safe area/viewport,
tooltips covering panels, literal '{' tokens, '[Saga:' placeholders (allowed, listed), min font size, and WCAG AA contrast
of every text run against its solid panel background (text sitting directly on scene art is a fail)."""
import json, pathlib, subprocess, re, html, sys
R = pathlib.Path(__file__).parent
SIZES = {'1080': (1920, 1080), 'ultrawide': (3440, 1440)}
PROBE = r"""<script>
window.addEventListener('load',()=>setTimeout(()=>{
const out={overflow:[],overlap:[],outside:[],tipcover:[],brace:[],saga:[],contrast:[],small:[],bare:[]};
const s=innerHeight/1080, vw=innerWidth, vh=innerHeight;
const safe=document.querySelector('.safe').getBoundingClientRect();
const rgb=c=>{const m=c.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1}};
const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
const bgOf=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c.a>=0.95)return c;} return null};
const name=e=>(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:e.tagName)+' "'+(e.textContent||'').trim().slice(0,40)+'"';
const inside=(a,b,t=0.5)=>a.left>=b.left-t&&a.top>=b.top-t&&a.right<=b.right+t&&a.bottom<=b.bottom+t;
// overflow on every element (tooltips are positioned outside their rail on purpose; they are checked separately below)
const tips=[...document.querySelectorAll('[data-tip]')];tips.forEach(t=>t.style.display='none');
for(const e of document.querySelectorAll('.safe *')){ if(e.tagName==='IMG'||e.tagName==='svg'||e.closest('svg'))continue;
  const cs=getComputedStyle(e); if(cs.display==='inline')continue;
  if(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1) out.overflow.push(name(e)+` ${e.scrollWidth}x${e.scrollHeight} > ${e.clientWidth}x${e.clientHeight}`);}
tips.forEach(t=>t.style.display='');
// text runs: inside their panel, contrast, size
const w=document.createTreeWalker(document.querySelector('.safe'),NodeFilter.SHOW_TEXT);let n;
while(n=w.nextNode()){const t=n.textContent.trim(); if(!t)continue; const el=n.parentElement; const cs=getComputedStyle(el);
  const r=document.createRange();r.selectNodeContents(n);const rr=r.getBoundingClientRect();
  const host=el.closest('[data-panel],[data-tip],.btn,.choice');
  if(!host){out.bare.push(t.slice(0,40));continue}
  if(!inside(rr,host.getBoundingClientRect(),1)) out.overflow.push('text outside its panel: "'+t.slice(0,40)+'"');
  if(rr.right>vw+0.5||rr.bottom>vh+0.5||rr.left<-0.5||rr.top<-0.5) out.overflow.push('text off-screen: "'+t.slice(0,40)+'"');
  const fs=parseFloat(cs.fontSize); if(fs<18*s-0.5) out.small.push(`${(fs/s).toFixed(1)}u "${t.slice(0,30)}"`);
  const bg=bgOf(el); if(!bg){out.bare.push(t.slice(0,40));continue}
  const fg=rgb(cs.color); const big=fs>=24*s||(fs>=18.66*s&&parseInt(cs.fontWeight)>=700);
  const cr=ratio(fg,bg); const need=big?3:4.5; if(cr<need) out.contrast.push(`${cr.toFixed(2)} < ${need} "${t.slice(0,40)}"`);
  out._min=Math.min(out._min||99,cr);
}
// panels
const P=[...document.querySelectorAll('[data-panel]')].map(e=>[e,e.getBoundingClientRect()]);
for(let i=0;i<P.length;i++){const [a,ra]=P[i]; if(!inside(ra,safe,1)) out.outside.push(name(a)+' leaves safe area');
  for(let j=i+1;j<P.length;j++){const [b,rb]=P[j];const ix=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left),iy=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);
    if(ix>0.5&&iy>0.5) out.overlap.push(name(a)+' x '+name(b));}}
for(const t of document.querySelectorAll('[data-tip]')){const rt=t.getBoundingClientRect();const own=t.closest('[data-panel]');
  for(const [p,rp] of P){ if(p===own)continue; const ix=Math.min(rt.right,rp.right)-Math.max(rt.left,rp.left),iy=Math.min(rt.bottom,rp.bottom)-Math.max(rt.top,rp.top); if(ix>0.5&&iy>0.5) out.tipcover.push(name(t)+' covers '+name(p));}}
const txt=document.body.innerText; if(txt.includes('{')||txt.includes('}')) out.brace.push((txt.match(/.{0,30}[{}].{0,30}/g)||[]).join(' | '));
out.saga=(txt.match(/\[Saga:[^\]]*\]/g)||[]);
out.minContrast=out._min;delete out._min;
const pre=document.createElement('pre');pre.id='RESULT';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
},600));</script>"""
def run():
    report = {}; fails = 0
    tmpdir = R/'.check'; tmpdir.mkdir(exist_ok=True)
    for f in sorted(R.glob('[0-9][0-9]*-*.html')):
        src = f.read_text().replace('</body>', PROBE + '</body>')
        tf = R/('_check_' + f.name); tf.write_text(src)
        for key, (w, h) in SIZES.items():
            dom = subprocess.run(['/usr/bin/google-chrome','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1',
                                  '--virtual-time-budget=4000',f'--window-size={w},{h}','--dump-dom',tf.as_uri()],capture_output=True,text=True).stdout
            m = re.search(r'<pre id="RESULT">(.*?)</pre>', dom, re.S)
            res = json.loads(html.unescape(m.group(1))) if m else {'error': ['probe did not run']}
            bad = {k: v for k, v in res.items() if k not in ('saga', 'minContrast') and v}
            fails += bool(bad)
            report[f'{key}/{f.stem}'] = res
            print(f'{"FAIL" if bad else "PASS"}  {key:9s} {f.stem:22s} minContrast={res.get("minContrast",0):.2f}  saga={len(res.get("saga",[]))}' + (f'  {json.dumps(bad)}' if bad else ''))
        tf.unlink()
    (R/'check-report.json').write_text(json.dumps(report, indent=1))
    sagas = sorted({s for r in report.values() for s in r.get('saga', [])})
    print('\n[Saga:] placeholders (allowed, listed):'); [print('  ', s) for s in sagas]
    print(f'\n{"ALL PASS" if not fails else str(fails)+" FAIL"}'); return fails
sys.exit(1 if run() else 0)
