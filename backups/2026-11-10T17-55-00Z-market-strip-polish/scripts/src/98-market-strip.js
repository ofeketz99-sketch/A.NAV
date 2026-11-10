
  // Header market strip: two TradingView mini charts (chart only) and a self-drawn Fear & Greed sparkline.
  // Everything is decorative and loaded after the page; failures leave a quiet placeholder.
  (function(){
    const strip=q('marketStrip');
    if(!strip)return;
    const conn=navigator.connection;
    if(conn&&conn.saveData)return;
    const TV='https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    function mountChart(tile){
      const box=document.createElement('div');box.className='tradingview-widget-container mk-chart';
      const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';
      box.appendChild(widget);tile.appendChild(box);
      const script=document.createElement('script');
      script.src=TV;script.async=true;
      script.textContent=JSON.stringify({symbol:tile.dataset.symbol,width:'100%',height:'100%',locale:'en',dateRange:'1M',colorTheme:'light',isTransparent:true,autosize:true,largeChartUrl:'',chartOnly:true,noTimeScale:true,trendLineColor:'rgba(40, 37, 33, 1)',underLineColor:'rgba(40, 37, 33, 0.10)',underLineBottomColor:'rgba(40, 37, 33, 0)'});
      box.appendChild(script);
      setTimeout(()=>{if(!box.querySelector('iframe'))tile.classList.add('mk-offline');},9000);
    }
    const fngColor=v=>`hsl(${Math.round(Math.max(0,Math.min(100,v))*1.2)} 62% 38%)`;
    const rate=v=>v<25?'EXTREME FEAR':v<45?'FEAR':v<55?'NEUTRAL':v<75?'GREED':'EXTREME GREED';
    // points: oldest first, numbers 0-100
    function drawFng(points,label,source){
      const tile=q('mkFng'),line=q('mkFngLine'),val=q('mkFngVal'),lbl=q('mkFngLbl'),pin=q('mkFngPin');
      const values=points.filter(Number.isFinite);
      if(!values.length){tile.classList.add('mk-offline');return;}
      const now=Math.max(0,Math.min(100,values[values.length-1]));
      if(values.length>1)line.setAttribute('points',values.map((v,i)=>(i/(values.length-1)*100).toFixed(1)+','+(28-v/100*26).toFixed(1)).join(' '));
      const col=fngColor(now);
      line.style.stroke=col;val.textContent=String(Math.round(now));val.style.color=col;
      lbl.textContent=label||rate(now);lbl.style.color=col;
      pin.style.insetInlineStart=now+'%';
      tile.title='Fear & Greed '+Math.round(now)+' · '+lbl.textContent+(source==='crypto'?' · crypto index':' · CNN');
      tile.classList.toggle('mk-crypto',source==='crypto');
      tile.classList.remove('mk-offline');
    }
    const CNN='https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
    const ROUTES=[CNN,'https://corsproxy.io/?'+encodeURIComponent(CNN),'https://api.allorigins.win/raw?url='+encodeURIComponent(CNN)];
    async function fromCnn(){
      for(const url of ROUTES){
        try{
          const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),7000);
          const r=await fetch(url,{signal:ctl.signal});clearTimeout(t);
          const j=await r.json();
          const score=Number(j&&j.fear_and_greed&&j.fear_and_greed.score);
          const hist=((j&&j.fear_and_greed_historical&&j.fear_and_greed_historical.data)||[]).slice(-30).map(d=>Number(d.y));
          if(Number.isFinite(score)){
            if(hist.length)hist[hist.length-1]=score;else hist.push(score);
            const rating=String(j.fear_and_greed.rating||'').replace(/_/g,' ').toUpperCase();
            return {points:hist,label:rating&&rating!=='UNDEFINED'?rating:rate(score),source:'cnn'};
          }
        }catch(e){}
      }
      throw new Error('cnn unavailable');
    }
    async function fromCrypto(){
      const r=await fetch('https://api.alternative.me/fng/?limit=30&format=json');
      const j=await r.json();
      const pts=j.data.map(d=>Number(d.value)).reverse();
      return {points:pts,label:rate(pts[pts.length-1]),source:'crypto'};
    }
    async function loadFng(){
      const KEY='anav.fng.v2';let cached=null;
      try{cached=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
      if(cached&&cached.res&&Date.now()-cached.t<1800000){drawFng(cached.res.points,cached.res.label,cached.res.source);return;}
      let res=null;
      try{res=await fromCnn();}catch(e){try{res=await fromCrypto();}catch(e2){}}
      if(res){drawFng(res.points,res.label,res.source);try{localStorage.setItem(KEY,JSON.stringify({t:Date.now(),res}));}catch(e){}}
      else if(cached&&cached.res)drawFng(cached.res.points,cached.res.label,cached.res.source);
      else q('mkFng').classList.add('mk-offline');
    }
    function start(){
      if(!strip.getClientRects().length)return; // hidden in narrow layouts: do not load anything
      strip.querySelectorAll('.mk[data-symbol]').forEach(mountChart);
      loadFng();
    }
    const later=()=>('requestIdleCallback' in window?requestIdleCallback(start,{timeout:4000}):setTimeout(start,1500));
    if(document.readyState==='complete')later();else window.addEventListener('load',later,{once:true});
  })();
