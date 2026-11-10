
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
    const fngColor=v=>`hsl(${Math.round(Math.max(0,Math.min(100,v))*1.2)} 55% 36%)`;
    function drawFng(list){
      const tile=q('mkFng'),line=q('mkFngLine'),val=q('mkFngVal');
      const values=list.map(item=>Number(item.value)).filter(Number.isFinite).reverse();
      if(values.length<2){tile.classList.add('mk-offline');return;}
      const now=values[values.length-1];
      line.setAttribute('points',values.map((v,i)=>(i/(values.length-1)*100).toFixed(1)+','+(28-v/100*26).toFixed(1)).join(' '));
      line.style.stroke=fngColor(now);
      val.textContent=String(Math.round(now));val.style.color=fngColor(now);
      tile.title='מדד פחד וחמדנות: '+Math.round(now)+(list[0].value_classification?' · '+list[0].value_classification:'')+' · 30 הימים האחרונים';
      tile.classList.remove('mk-offline');
    }
    function loadFng(){
      const KEY='anav.fng.v1';let cached=null;
      try{cached=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
      if(cached&&cached.data&&Date.now()-cached.t<3600000){drawFng(cached.data);return;}
      fetch('https://api.alternative.me/fng/?limit=30&format=json').then(r=>r.json()).then(json=>{
        if(!json||!Array.isArray(json.data))throw new Error('bad payload');
        drawFng(json.data);
        try{localStorage.setItem(KEY,JSON.stringify({t:Date.now(),data:json.data}));}catch(e){}
      }).catch(()=>{if(cached&&cached.data)drawFng(cached.data);else q('mkFng').classList.add('mk-offline');});
    }
    function start(){
      if(!strip.getClientRects().length)return; // hidden in narrow layouts: do not load anything
      strip.querySelectorAll('.mk[data-symbol]').forEach(mountChart);
      loadFng();
    }
    const later=()=>('requestIdleCallback' in window?requestIdleCallback(start,{timeout:4000}):setTimeout(start,1500));
    if(document.readyState==='complete')later();else window.addEventListener('load',later,{once:true});
  })();
