
  // Market data layer: one interface over several providers, so the portfolio never depends on a specific vendor.
  // - Crypto (BTC, ETH…): Coinbase public API, no key, live spot price.
  // - USD/ILS: ECB reference rate via Frankfurter, no key, one rate per business day.
  // - Stocks and ETFs (US, TASE): a keyed provider behind the site's own server function (/api/market),
  //   so the API key never reaches the browser or the repository. Until it is configured, stocks keep manual prices.
  // Every quote keeps its source, the time of the price, and when it was fetched; old quotes are marked stale, never hidden.
  const MarketData=(()=>{
    const CRYPTO=/^(BTC|ETH|SOL|XRP|ADA|DOGE|LTC|AVAX|LINK|DOT)(USD|USDT)?$/;
    const HOUR=36e5,DAY=864e5;
    // How old a price may be before it is shown as stale. Stocks: the last close is valid over a weekend.
    const MAX_AGE={crypto:HOUR,fx:4*DAY,stock:4*DAY};
    // How often to ask again (separate from staleness): live crypto often, stocks every 15 minutes, the daily FX rate a few times a day.
    const REFRESH_AFTER={crypto:5*6e4,fx:6*HOUR,stock:15*6e4};
    const needsRefresh=(q,kind,now)=>!q||['manual','excel'].includes(q.source)||!(now-Date.parse(q.fetchedAt||q.asOf||0)<REFRESH_AFTER[kind]);
    const SOURCES={
      manual:{label:'הוזן ידנית'},excel:{label:'מהאקסל'},
      coinbase:{label:'Coinbase',url:'https://www.coinbase.com',note:'מחיר ספוט חי'},
      ecb:{label:'ECB (Frankfurter)',url:'https://www.frankfurter.app',note:'שער ייחוס יומי של הבנק המרכזי האירופי'},
      twelvedata:{label:'Twelve Data',url:'https://twelvedata.com',note:'לפי תנאי התוכנית'}
    };
    const kindOf=(symbol,market)=>market==='CRYPTO'||CRYPTO.test(symbol)?'crypto':'stock';
    const baseCoin=s=>s.replace(/(USD|USDT)$/,'');
    function isStale(q,kind,now){
      if(!q||!q.asOf)return true;
      if(q.source==='manual'||q.source==='excel')return false;   // the user's own number: shown with its date, not judged
      const t=Date.parse(q.asOf);
      return !Number.isFinite(t)||now-t>MAX_AGE[kind];
    }
    // Same request twice at once → one network call.
    const inflight=new Map();
    function once(key,fn){if(inflight.has(key))return inflight.get(key);const p=Promise.resolve().then(fn).finally(()=>inflight.delete(key));inflight.set(key,p);return p;}
    async function getJson(fetchFn,url,timeout=9000){
      const ctl=typeof AbortController==='function'?new AbortController():null;
      const t=ctl?setTimeout(()=>ctl.abort(),timeout):null;
      try{
        const r=await fetchFn(url,ctl?{signal:ctl.signal}:undefined);
        if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e;}
        return await r.json();
      }finally{if(t)clearTimeout(t);}
    }
    const providers={
      async crypto(symbols,fetchFn){
        const out={};
        await Promise.all(symbols.map(async s=>{
          const j=await once('cb:'+s,()=>getJson(fetchFn,'https://api.exchange.coinbase.com/products/'+baseCoin(s)+'-USD/ticker'));
          const price=Number(j.price);
          if(Number.isFinite(price)&&price>0)out[s]={price,asOf:j.time||new Date().toISOString(),source:'coinbase',currency:'USD'};
        }));
        return out;
      },
      async fx(fetchFn){
        const j=await once('fx',()=>getJson(fetchFn,'https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS'));
        const rate=Number(j?.rates?.ILS);
        if(!(rate>0))throw new Error('אין שער בתשובה');
        return {rate,asOf:j.date,source:'ecb'};
      },
      // Daily USD/ILS history (ECB). Used to suggest the rate on a trade date; missing days stay missing.
      async fxHistory(from,to,fetchFn){
        const j=await once('fxh:'+from+':'+to,()=>getJson(fetchFn,'https://api.frankfurter.dev/v1/'+from+'..'+to+'?base=USD&symbols=ILS'));
        const out={};for(const [d,v] of Object.entries(j?.rates||{}))if(v?.ILS>0)out[d]=v.ILS;return out;
      },
      async stocks(items,fetchFn,endpoint){
        const qs=items.map(i=>i.market==='TASE'?i.symbol+':TASE':i.symbol).join(',');
        const j=await once('st:'+qs,()=>getJson(fetchFn,endpoint+'?symbols='+encodeURIComponent(qs),12000));
        const out={};
        for(const x of j?.quotes||[]){
          const s=String(x.symbol||'').split(':')[0].toUpperCase();
          if(Number.isFinite(x.price)&&x.price>0)out[s]={price:x.price,asOf:x.asOf||null,source:x.source||'twelvedata',currency:x.currency||null,previousClose:Number.isFinite(x.previousClose)?x.previousClose:null};
        }
        return {quotes:out,errors:j?.errors||[]};
      },
      async stockStatus(fetchFn,endpoint){
        try{const j=await once('ping',()=>getJson(fetchFn,endpoint+'?ping=1',5000));return {available:!!j?.ok,provider:j?.provider||null};}
        catch(e){return {available:false,provider:null,error:e.status===404?'no-function':'unreachable'};}
      }
    };
    // Refresh what the portfolio needs. Failures keep the previous quote and record the error next to it.
    async function refresh(state,market,opts){
      const fetchFn=opts?.fetch||(typeof fetch==='function'?fetch.bind(globalThis):null);
      const now=opts?.now??Date.now(),force=!!opts?.force,endpoint=opts?.endpoint||'/api/market';
      const next={quotes:{...market.quotes},fx:{...market.fx},status:{...(market.status||{})}};
      const report={updated:[],failed:[],unsupported:[],fresh:[]};
      const symbols=opts?.symbols||[];
      const want=symbols.map(s=>({symbol:s,market:state.instruments[s]?.market||(CRYPTO.test(s)?'CRYPTO':'US')}));
      const due=want.filter(i=>force||needsRefresh(next.quotes[i.symbol],kindOf(i.symbol,i.market),now));
      for(const i of want)if(!due.includes(i))report.fresh.push(i.symbol);
      const jobs=[];
      const crypto=due.filter(i=>kindOf(i.symbol,i.market)==='crypto').map(i=>i.symbol);
      if(crypto.length)jobs.push(providers.crypto(crypto,fetchFn).then(q=>{for(const s of crypto){if(q[s]){next.quotes[s]={...q[s],fetchedAt:new Date(now).toISOString()};report.updated.push(s);}else report.failed.push(s);}})
        .catch(e=>{for(const s of crypto){report.failed.push(s);next.status[s]={error:String(e.message||e),at:new Date(now).toISOString()};}}));
      const stocks=due.filter(i=>kindOf(i.symbol,i.market)==='stock');
      if(stocks.length)jobs.push(providers.stockStatus(fetchFn,endpoint).then(async st=>{
        next.stockProvider=st;
        if(!st.available){for(const i of stocks)report.unsupported.push(i.symbol);return;}
        const r=await providers.stocks(stocks,fetchFn,endpoint);
        for(const i of stocks){if(r.quotes[i.symbol]){next.quotes[i.symbol]={...r.quotes[i.symbol],fetchedAt:new Date(now).toISOString()};report.updated.push(i.symbol);}else report.failed.push(i.symbol);}
      }).catch(e=>{for(const i of stocks)report.failed.push(i.symbol);}));
      // Like stock prices: a typed or imported rate is a fallback until a provider answers.
      const cur=next.fx.USDILS;
      const fxDue=opts?.fx!==false&&(force||needsRefresh(cur,'fx',now));
      if(fxDue)jobs.push(providers.fx(fetchFn).then(fx=>{next.fx.USDILS={...fx,fetchedAt:new Date(now).toISOString()};report.updated.push('USDILS');}).catch(()=>report.failed.push('USDILS')));
      await Promise.all(jobs);
      for(const s of report.updated)delete next.status[s];
      next.lastRefresh=new Date(now).toISOString();
      return {market:next,report};
    }
    // ---------- daily history for trade analysis ----------
    // Bars: [date, open, high, low, close]. Stocks through the site function (provider key stays on the server),
    // crypto from Coinbase in chunks of up to 300 days.
    async function fetchHistory(symbol,market,from,to,opts){
      const fetchFn=opts?.fetch||(typeof fetch==='function'?fetch.bind(globalThis):null),endpoint=opts?.endpoint||'/api/market';
      if(kindOf(symbol,market)==='crypto'){
        const out=[];let start=from;
        while(start<=to){
          const endD=new Date(Date.parse(start+'T00:00:00Z')+289*DAY).toISOString().slice(0,10),stop=endD<to?endD:to;
          const rows=await once('cbh:'+symbol+start+stop,()=>getJson(fetchFn,'https://api.exchange.coinbase.com/products/'+baseCoin(symbol)+'-USD/candles?granularity=86400&start='+start+'T00:00:00Z&end='+stop+'T23:59:59Z'));
          for(const r of rows||[])out.push([new Date(r[0]*1000).toISOString().slice(0,10),r[3],r[2],r[1],r[4]]);
          start=new Date(Date.parse(stop+'T00:00:00Z')+DAY).toISOString().slice(0,10);
        }
        return {bars:mergeBars([],out),source:'coinbase'};
      }
      const s=market==='TASE'?symbol+':TASE':symbol;
      const r=await fetchFn(endpoint+'?history='+encodeURIComponent(s)+'&start='+from+'&end='+to);
      if(r.status===429){const e=new Error('rate-limit');e.rateLimit=true;throw e;}
      if(r.status===503){const e=new Error('not-configured');e.notConfigured=true;throw e;}
      if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e;}
      const j=await r.json();
      return {bars:Array.isArray(j.bars)?j.bars:[],source:j.provider||'twelvedata',error:j.error||null};
    }
    function mergeBars(a,b){const m=new Map();for(const x of a||[])m.set(x[0],x);for(const x of b||[])m.set(x[0],x);return [...m.values()].sort((x,y)=>x[0]<y[0]?-1:1);}
    // A stored entry covers [from, to] when it was fetched for that range; a range ending today is refreshed after 12 hours.
    function covers(entry,from,to,today,now){
      if(!entry)return false;
      if(entry.from>from||entry.to<to)return false;
      if(to>=today&&now-Date.parse(entry.fetchedAt||0)>12*HOUR)return false;
      return true;
    }
    return {refresh,isStale,needsRefresh,kindOf,SOURCES,MAX_AGE,REFRESH_AFTER,providers,CRYPTO,fetchHistory,mergeBars,covers};
  })();
