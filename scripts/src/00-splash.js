
  // Entry splash: shown on the first visit after a few minutes away, after a site update, or on reload.
  (function(){
    const el=document.getElementById('splash');
    if(!el)return;
    const KEY='anav.splash.v1',AWAY=5*60*1000;
    let show=true,record=null;
    try{
      const now=Date.now(),saved=JSON.parse(localStorage.getItem(KEY)||'null')||{};
      const lm=Date.parse(document.lastModified),ver=Number.isFinite(lm)&&Math.abs(now-lm)>5000?String(lm):'';
      const nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
      show=!saved.t||now-saved.t>AWAY||saved.v!==ver||(nav&&nav.type==='reload');
      record=()=>{try{localStorage.setItem(KEY,JSON.stringify({t:Date.now(),v:ver}));}catch(e){}};
      record();
      window.addEventListener('pagehide',record);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)record();});
    }catch(e){show=true;}
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)show=false;
    if(!show){el.remove();return;}
    // Measure the resting layout first so the shine band can be positioned per piece, then start once fonts are ready.
    const start=()=>{
      if(!el.isConnected)return;
      const word=el.querySelector('.splash-word');
      if(word){
        const wr=word.getBoundingClientRect();
        word.style.setProperty('--ww',wr.width+'px');
        word.style.setProperty('--s0',(-wr.width*.45)+'px');
        word.style.setProperty('--s1',(wr.width*1.05)+'px');
        word.querySelectorAll('.sp').forEach(piece=>piece.style.setProperty('--ox',(piece.getBoundingClientRect().left-wr.left)+'px'));
      }
      document.documentElement.classList.add('splash-run');
    };
    const fontsReady=document.fonts&&document.fonts.ready?Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,500))]):Promise.resolve();
    fontsReady.then(start);
    const done=()=>{el.remove();document.documentElement.classList.remove('splash-run');};
    el.addEventListener('animationend',e=>{if(e.target===el)done();});
    el.addEventListener('click',done);
    document.addEventListener('keydown',done,{once:true});
    setTimeout(done,5500);
  })();
