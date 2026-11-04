const puppeteer=require('puppeteer-core');const fs=require('fs');
(async()=>{
 const v=process.argv[2]||'2', out=process.argv[3], frames=+process.argv[4]||240;
 fs.mkdirSync(out,{recursive:true});
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--hide-scrollbars']});
 const p=await b.newPage(); await p.setViewport({width:1920,height:1080});
 await p.evaluateOnNewDocument(()=>{ // deterministic virtual clock so every frame is exactly 1/30 s
   let now=0,id=1;const timers=new Map(),rafs=new Map();
   performance.now=()=>now; Date.now=()=>now;
   window.setTimeout=(f,d)=>{const i=id++;timers.set(i,{f,t:now+(d||0)});return i};
   window.clearTimeout=i=>timers.delete(i);
   window.requestAnimationFrame=f=>{const i=id++;rafs.set(i,f);return i};
   window.cancelAnimationFrame=i=>rafs.delete(i);
   window.__step=ms=>{now+=ms;for(const [i,t] of [...timers]) if(t.t<=now){timers.delete(i);t.f()}
     const r=[...rafs];rafs.clear();for(const [i,f] of r) f(now);};
   let s=12345;Math.random=()=>((s=(s*16807)%2147483647)/2147483647);
 });
 await p.goto(`file://${process.cwd()}/../html/menu-night.html?v=${v}&min=700&max=1900`,{waitUntil:'load'});
 await new Promise(r=>setTimeout(r,500));
 for(let i=0;i<frames;i++){await p.evaluate(()=>window.__step(1000/30));
   await p.screenshot({path:`${out}/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:90});}
 await b.close();
})();
