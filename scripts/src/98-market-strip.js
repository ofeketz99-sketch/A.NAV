
  // Header market strip: live S&P 500 and BTC quotes with daily change colour, and the CNN Fear & Greed gauge.
  // Everything is decorative and loaded after the page; failures leave a quiet placeholder.
  (function(){
    const strip=q('marketStrip');
    if(!strip)return;
    const conn=navigator.connection;
    if(conn&&conn.saveData)return;
    // Live quotes: price plus daily change, coloured by direction. Direct request first, then public CORS proxies.
    function viaProxies(url){return [url,'https://corsproxy.io/?'+encodeURIComponent(url),'https://api.allorigins.win/raw?url='+encodeURIComponent(url)];}
    async function getJson(urls){
      for(const url of urls){
        try{
          const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),7000);
          const r=await fetch(url,{signal:ctl.signal});clearTimeout(t);
          if(r.ok)return await r.json();
        }catch(e){}
      }
      throw new Error('unreachable');
    }
    function setQuote(id,price,pct,digits,prefix){
      const tile=q(id);
      if(!Number.isFinite(price)||!Number.isFinite(pct)){tile.classList.add('mk-offline');return;}
      tile.querySelector('.mk-val').textContent=prefix+price.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
      tile.querySelector('.mk-chg').textContent=(pct>=0?'▲ ':'▼ ')+Math.abs(pct).toFixed(2)+'%';
      tile.classList.remove('mk-offline','mk-up','mk-down');
      tile.classList.add(pct>=0?'mk-up':'mk-down');
    }
    async function loadSpx(){
      if(lastSpx){setQuote('mkSpx',lastSpx[0],(lastSpx[0]/lastSpx[1]-1)*100,2,'');return;}
      try{
        const j=await getJson(viaProxies('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d'));
        const m=j.chart.result[0].meta;
        setQuote('mkSpx',m.regularMarketPrice,(m.regularMarketPrice/(m.chartPreviousClose||m.previousClose)-1)*100,2,'');
      }catch(e){if(!q('mkSpx').classList.contains('mk-up')&&!q('mkSpx').classList.contains('mk-down'))q('mkSpx').classList.add('mk-offline');}
    }
    async function loadBtc(){
      try{
        const j=await getJson(['https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT']);
        setQuote('mkBtc',Number(j.lastPrice),Number(j.priceChangePercent),0,'$');
      }catch(e){
        try{
          const j=await getJson(['https://api.exchange.coinbase.com/products/BTC-USD/stats']);
          const last=Number(j.last),open=Number(j.open);
          setQuote('mkBtc',last,(last/open-1)*100,0,'$');
        }catch(e2){if(!q('mkBtc').classList.contains('mk-up')&&!q('mkBtc').classList.contains('mk-down'))q('mkBtc').classList.add('mk-offline');}
      }
    }
    const rate=v=>v<25?'EXTREME FEAR':v<45?'FEAR':v<55?'NEUTRAL':v<75?'GREED':'EXTREME GREED';
    const BANDS=[0,25,45,55,75,100];
    const NS='http://www.w3.org/2000/svg';
    function pt(v,r){const a=Math.PI*(1-v/100);return [(50+r*Math.cos(a)).toFixed(2),(50-r*Math.sin(a)).toFixed(2)];}
    function arc(v0,v1,r){const p0=pt(v0,r),p1=pt(v1,r);return 'M'+p0.join(' ')+' A'+r+' '+r+' 0 0 1 '+p1.join(' ');}
    function el(name,attrs){const e=document.createElementNS(NS,name);for(const k in attrs)e.setAttribute(k,attrs[k]);return e;}
    // CNN style half-circle gauge in one neutral tone: the active band is dark, the needle shows the exact value.
    function drawDial(now){
      const svg=q('mkDial');svg.textContent='';
      const gap=1.2;
      BANDS.slice(0,-1).forEach((lo,i)=>{
        const hi=BANDS[i+1],active=now>=lo&&(now<hi||(i===BANDS.length-2&&now<=hi));
        svg.appendChild(el('path',{d:arc(lo+gap,hi-gap,41),fill:'none','stroke-width':active?8:6,'stroke-linecap':'butt',stroke:active?'#3f372f':'rgba(60,45,30,.20)'}));
      });
      const tip=pt(now,33);
      svg.appendChild(el('line',{x1:50,y1:50,x2:tip[0],y2:tip[1],stroke:'#3f372f','stroke-width':2.2,'stroke-linecap':'round'}));
      svg.appendChild(el('circle',{cx:50,cy:50,r:3.2,fill:'#3f372f'}));
    }
    // points: oldest first, numbers 0-100
    function drawFng(points,label,source){
      const tile=q('mkFng'),val=q('mkFngVal'),lbl=q('mkFngLbl');
      const values=points.filter(Number.isFinite);
      if(!values.length){tile.classList.add('mk-offline');return;}
      const now=Math.max(0,Math.min(100,values[values.length-1]));
      val.textContent=String(Math.round(now));
      lbl.textContent=label||rate(now);
      drawDial(now);
      tile.title='Fear & Greed '+Math.round(now)+' · '+lbl.textContent+(source==='crypto'?' · crypto index':' · CNN');
      tile.classList.toggle('mk-crypto',source==='crypto');
      tile.classList.remove('mk-offline');
    }
    let lastSpx=null;
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
          const sp=((j&&j.market_momentum_sp500&&j.market_momentum_sp500.data)||[]).map(d=>Number(d.y)).filter(Number.isFinite);
          if(sp.length>1)lastSpx=[sp[sp.length-1],sp[sp.length-2]];
          if(Number.isFinite(score)){
            if(hist.length)hist[hist.length-1]=score;else hist.push(score);
            const rating=String(j.fear_and_greed.rating||'').replace(/_/g,' ').toUpperCase();
            return {points:hist,label:rating&&rating!=='UNDEFINED'?rating:rate(score),source:'cnn',spx:lastSpx};
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
      const KEY='anav.fng.v3';let cached=null;
      try{cached=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
      if(cached&&cached.res&&(cached.res.spx||cached.res.source==='crypto')&&Date.now()-cached.t<1800000){lastSpx=cached.res.spx||null;drawFng(cached.res.points,cached.res.label,cached.res.source);return;}
      let res=null;
      try{res=await fromCnn();}catch(e){try{res=await fromCrypto();}catch(e2){}}
      if(res){drawFng(res.points,res.label,res.source);try{localStorage.setItem(KEY,JSON.stringify({t:Date.now(),res}));}catch(e){}}
      else if(cached&&cached.res)drawFng(cached.res.points,cached.res.label,cached.res.source);
      else q('mkFng').classList.add('mk-offline');
    }
    function start(){
      if(!strip.getClientRects().length)return; // hidden in narrow layouts: do not load anything
      loadBtc();loadFng().then(loadSpx);
      setInterval(()=>{if(!document.hidden)loadBtc();},120000);
      setInterval(()=>{if(!document.hidden){try{localStorage.removeItem('anav.fng.v3');}catch(e){}loadFng().then(loadSpx);}},600000);
    }
    const later=()=>('requestIdleCallback' in window?requestIdleCallback(start,{timeout:4000}):setTimeout(start,1500));
    if(document.readyState==='complete')later();else window.addEventListener('load',later,{once:true});
  })();
