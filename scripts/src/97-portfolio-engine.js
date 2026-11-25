
  // Portfolio engine: pure calculations (no DOM). Tables, cards, charts and the Excel export all read compute().
  // Source data = transactions + broker snapshots + settings. Market prices live in a separate layer.
  // Money is summed in integer minor units (cents/agorot) so totals never drift; quantities keep 8 decimals.
  const PortfolioEngine=(()=>{
    const SCHEMA=1;
    const MARKETS={
      US:{label:'ארה״ב',currency:'USD'},
      TASE:{label:'ת״א',currency:'ILS'},
      CRYPTO:{label:'קריפטו',currency:'USD'}
    };
    const TYPES=['buy','sell','deposit','withdrawal','fx','dividend','fee'];
    const CURRENCIES=['USD','ILS'];
    const EPS=1e-9;
    const cents=x=>Math.round((Number(x)||0)*100);
    const q8=x=>Math.round((Number(x)||0)*1e8)/1e8;
    const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
    const dayDiff=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);
    const todayIso=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    const uid=p=>(p||'t')+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    const cleanSymbol=s=>String(s||'').trim().toUpperCase().replace(/\s+/g,'');

    // Trade plan kept on the trade's first buy: reason, tags, target, stop, planned holding days, exit reason.
    function normalizePlan(p){
      if(!p||typeof p!=='object')return null;
      const txt=(v,n)=>String(v??'').trim().slice(0,n);
      const pos=v=>{const x=Number(v);return Number.isFinite(x)&&x>0?x:null;};
      const out={reason:txt(p.reason,600),tags:(Array.isArray(p.tags)?p.tags:String(p.tags||'').split(','))
        .map(x=>txt(x,30)).filter(Boolean).slice(0,10),target:pos(p.target),stop:pos(p.stop),
        horizonDays:pos(p.horizonDays)?Math.round(pos(p.horizonDays)):null,exitReason:txt(p.exitReason,600)};
      return out.reason||out.tags.length||out.target||out.stop||out.horizonDays||out.exitReason?out:null;
    }
    function defaults(){
      return {schema:SCHEMA,settings:{fees:{US:7.5,TASE:7,CRYPTO:0}},instruments:{},transactions:[],snapshots:[]};
    }
    // Accepts anything (old versions, partial backups) and returns a valid state; unknown records are dropped, never guessed.
    function normalize(raw){
      const s=defaults();
      if(!raw||typeof raw!=='object')return s;
      const fees=raw.settings?.fees||{};
      for(const m of Object.keys(MARKETS))if(Number.isFinite(fees[m])&&fees[m]>=0)s.settings.fees[m]=fees[m];
      for(const [sym,ins] of Object.entries(raw.instruments||{})){
        const symbol=cleanSymbol(sym);if(!symbol||!ins)continue;
        const market=MARKETS[ins.market]?ins.market:'US';
        s.instruments[symbol]={symbol,market,currency:MARKETS[market].currency,name:String(ins.name||''),sector:String(ins.sector||''),kind:String(ins.kind||'')};
      }
      for(const t of Array.isArray(raw.transactions)?raw.transactions:[]){
        if(!t||!TYPES.includes(t.type)||!isDate(t.date))continue;
        const tx={id:String(t.id||uid()),type:t.type,date:t.date,note:String(t.note||'').slice(0,2000)};
        if(t.type==='buy'||t.type==='sell'){
          tx.symbol=cleanSymbol(t.symbol);if(!tx.symbol)continue;
          tx.qty=q8(t.qty);tx.price=Number(t.price)||0;tx.fee=Math.max(0,Number(t.fee)||0);
          if(Number.isFinite(t.fxRate)&&t.fxRate>0){tx.fxRate=t.fxRate;if(t.fxSource==='ecb')tx.fxSource='ecb';}
          const plan=normalizePlan(t.tradePlan);if(plan)tx.tradePlan=plan;
          if(t.type==='buy'&&t.opening===true)tx.opening=true;
        }else if(t.type==='fx'){
          tx.from=CURRENCIES.includes(t.from)?t.from:'ILS';tx.amount=Number(t.amount)||0;tx.rate=Number(t.rate)||0;
        }else{
          tx.currency=CURRENCIES.includes(t.currency)?t.currency:'ILS';tx.amount=Number(t.amount)||0;
          if(t.symbol)tx.symbol=cleanSymbol(t.symbol);
        }
        if(t.source)tx.source=String(t.source);
        if(t.importKey)tx.importKey=String(t.importKey);
        s.transactions.push(tx);
      }
      for(const p of Array.isArray(raw.snapshots)?raw.snapshots:[]){
        if(!p||!isDate(p.date)||!Number.isFinite(Number(p.value)))continue;
        s.snapshots.push({id:String(p.id||uid('s')),date:p.date,value:Number(p.value),currency:'ILS',note:String(p.note||'')});
      }
      return s;
    }
    function instrumentOf(state,symbol){
      return state.instruments[symbol]||{symbol,market:'US',currency:'USD',name:'',sector:'',kind:''};
    }
    // Chronological order; same-day records keep the order they were entered in.
    function ordered(list){return list.map((t,i)=>[t,i]).sort((a,b)=>a[0].date<b[0].date?-1:a[0].date>b[0].date?1:a[1]-b[1]).map(x=>x[0]);}

    // Cash effect of one transaction, per currency, in minor units. Trades create their own cash flow,
    // so a deposit is never also typed as a cash movement for a purchase (no double counting).
    function cashFlows(tx,state){
      if(tx.type==='buy'||tx.type==='sell'){
        // A holding from before tracking began: its cost was paid outside the tracked cash.
        if(tx.opening)return [];
        const cur=instrumentOf(state,tx.symbol).currency,gross=cents(tx.qty*tx.price),fee=cents(tx.fee);
        return [[cur,tx.type==='buy'?-(gross+fee):gross-fee]];
      }
      if(tx.type==='fx'){
        const to=tx.from==='ILS'?'USD':'ILS';
        const out=tx.from==='ILS'?tx.amount/tx.rate:tx.amount*tx.rate;
        return [[tx.from,-cents(tx.amount)],[to,cents(out)]];
      }
      const sign=tx.type==='deposit'||tx.type==='dividend'?1:-1;
      return [[tx.currency,sign*cents(Math.abs(tx.amount))]];
    }

    function compute(raw,market,opts){
      const state=raw&&raw.schema===SCHEMA?raw:normalize(raw);
      const today=opts?.today||todayIso();
      const quotes=market?.quotes||{},usdIls=market?.fx?.USDILS?.rate;
      const cash={USD:0,ILS:0},netDeposits={USD:0,ILS:0},openingCapital={USD:0,ILS:0},depositEvents=[];
      const pos={},trades=[],issues=[],txInfo={};
      for(const tx of ordered(state.transactions)){
        const flows=cashFlows(tx,state);
        for(const [cur,c] of flows)cash[cur]+=c;
        txInfo[tx.id]={cash:flows};
        if(tx.type==='deposit'||tx.type==='withdrawal'){
          const c=flows[0][1];netDeposits[tx.currency]+=c;depositEvents.push({date:tx.date,currency:tx.currency,cents:c});
        }
        if(tx.type!=='buy'&&tx.type!=='sell')continue;
        // Opening holdings count as capital brought in (at cost), so profit is not inflated by their value.
        if(tx.opening){
          const cur=instrumentOf(state,tx.symbol).currency,c=cents(tx.qty*tx.price)+cents(tx.fee);
          openingCapital[cur]+=c;
          if(cur==='ILS')depositEvents.push({date:tx.date,currency:'ILS',cents:c,opening:true});
          else if(tx.fxRate)depositEvents.push({date:tx.date,currency:'ILS',cents:Math.round(c*tx.fxRate),opening:true});
        }
        const ins=instrumentOf(state,tx.symbol);
        const p=pos[tx.symbol]||(pos[tx.symbol]={symbol:tx.symbol,currency:ins.currency,qty:0,cost:0,costIls:0,ilsKnown:true,realized:0,realizedIls:0,realizedIlsKnown:true,fees:0,trade:null});
        const gross=cents(tx.qty*tx.price),fee=cents(tx.fee);
        if(tx.type==='buy'){
          if(!p.trade){
            p.trade={id:'tr-'+tx.id,symbol:tx.symbol,currency:ins.currency,market:ins.market,txIds:[],startDate:tx.date,endDate:null,status:'open',
              buys:0,sells:0,boughtQty:0,soldQty:0,buyCost:0,sellProceeds:0,fees:0,realized:0,maxQty:0,plan:tx.tradePlan||null};
            trades.push(p.trade);
          }
          p.qty=q8(p.qty+tx.qty);p.cost+=gross+fee;p.fees+=fee;
          if(ins.currency==='USD'){if(tx.fxRate)p.costIls+=Math.round((gross+fee)*tx.fxRate);else p.ilsKnown=false;}
          const t=p.trade;t.txIds.push(tx.id);t.buys++;t.boughtQty=q8(t.boughtQty+tx.qty);t.buyCost+=gross+fee;t.fees+=fee;t.maxQty=Math.max(t.maxQty,p.qty);
          txInfo[tx.id].tradeId=t.id;
        }else{
          if(tx.qty>p.qty+EPS){issues.push({txId:tx.id,code:'oversell',held:p.qty,message:'מכירה של '+tx.qty+' '+tx.symbol+' כשמוחזקות רק '+p.qty});cash[ins.currency]-=flows[0][1];txInfo[tx.id].cash=[];txInfo[tx.id].ignored=true;continue;}
          const closing=Math.abs(tx.qty-p.qty)<=EPS;
          const removed=closing?p.cost:Math.round(p.cost*tx.qty/p.qty);
          const proceeds=gross-fee,gain=proceeds-removed;
          p.realized+=gain;p.fees+=fee;
          if(ins.currency==='USD'){
            const removedIls=closing?p.costIls:Math.round(p.costIls*tx.qty/p.qty);
            if(p.ilsKnown&&tx.fxRate){const g=Math.round(proceeds*tx.fxRate)-removedIls;p.realizedIls+=g;txInfo[tx.id].realizedIls=g;txInfo[tx.id].fxEffect=g-Math.round(gain*tx.fxRate);}
            else p.realizedIlsKnown=false;
            p.costIls-=removedIls;
          }
          p.cost-=removed;p.qty=closing?0:q8(p.qty-tx.qty);
          const t=p.trade;
          if(t){t.txIds.push(tx.id);t.sells++;t.soldQty=q8(t.soldQty+tx.qty);t.sellProceeds+=proceeds;t.fees+=fee;t.realized+=gain;txInfo[tx.id].tradeId=t.id;}
          txInfo[tx.id].realized=gain;
          if(p.qty===0){
            if(t){t.status='closed';t.endDate=tx.date;}
            p.trade=null;p.cost=0;p.costIls=0;p.ilsKnown=true;
          }
        }
      }
      // Trade metrics: net = everything received − everything paid, after fees (the Excel "שינוי נטו", fees always included).
      for(const t of trades){
        t.net=t.status==='closed'?t.sellProceeds-t.buyCost:null;
        t.days=dayDiff(t.startDate,t.endDate||today);
        t.gross=t.net===null?null:t.net+t.fees;
        t.returnPct=t.net===null||!t.buyCost?null:t.net/t.buyCost*100;
      }
      // Holdings with market value. A missing price stays missing: value, profit and weight are null, never 0.
      const holdings=Object.values(pos).filter(p=>p.qty>EPS).map(p=>{
        const ins=instrumentOf(state,p.symbol),quote=quotes[p.symbol];
        const price=quote&&Number.isFinite(quote.price)?quote.price:null;
        const value=price===null?null:cents(p.qty*price);
        const unrealized=value===null?null:value-p.cost;
        const fx=ins.currency==='USD'?usdIls:1;
        return {symbol:p.symbol,market:ins.market,currency:ins.currency,name:ins.name,sector:ins.sector,kind:ins.kind,qty:p.qty,cost:p.cost,
          avgCost:p.qty?p.cost/100/p.qty:null,price,priceAsOf:quote?.asOf||null,priceSource:quote?.source||null,value,unrealized,
          unrealizedPct:unrealized===null||!p.cost?null:unrealized/p.cost*100,realized:p.realized,
          valueIls:value===null||!Number.isFinite(fx)?null:Math.round(value*fx),
          costIls:ins.currency==='USD'?(p.ilsKnown?p.costIls:null):p.cost,
          tradeId:p.trade?.id||null};
      }).sort((a,b)=>(b.valueIls??-1)-(a.valueIls??-1)||a.symbol.localeCompare(b.symbol));
      const cashIls=Number.isFinite(usdIls)?cash.ILS+Math.round(cash.USD*usdIls):null;
      const missing=holdings.filter(h=>h.valueIls===null).map(h=>h.symbol);
      const totalIls=cashIls===null||missing.length?null:cashIls+holdings.reduce((s,h)=>s+h.valueIls,0);
      for(const h of holdings)h.weight=totalIls?h.valueIls/totalIls*100:null;
      const closed=trades.filter(t=>t.status==='closed');
      const byCur=cur=>{
        const c=closed.filter(t=>t.currency===cur),all=trades.filter(t=>t.currency===cur);
        return {closed:c.length,wins:c.filter(t=>t.net>0).length,net:c.reduce((s,t)=>s+t.net,0),
          fees:all.reduce((s,t)=>s+t.fees,0),buyVolume:all.reduce((s,t)=>s+t.buyCost,0),sellVolume:all.reduce((s,t)=>s+t.sellProceeds,0)};
      };
      const summary={
        trades:trades.length,open:trades.length-closed.length,closed:closed.length,
        symbols:new Set(trades.map(t=>t.symbol)).size,
        winRate:closed.length?closed.filter(t=>t.net>0).length/closed.length*100:null,
        avgDaysClosed:closed.length?closed.reduce((s,t)=>s+t.days,0)/closed.length:null,
        byCurrency:{USD:byCur('USD'),ILS:byCur('ILS')}
      };
      return {state,today,cash,cashIls,netDeposits,holdings,trades,issues,txInfo,summary,totalIls,missingPrices:missing,usdIls:Number.isFinite(usdIls)?usdIls:null,
        openingCapital,openingIlsMissing:state.transactions.some(t=>t.opening&&instrumentOf(state,t.symbol).currency==='USD'&&!t.fxRate),
        performance:performance(state.snapshots,depositEvents)};
    }

    // Broker snapshots vs deposits (the Excel equity sheet). Daily return removes the day's deposits/withdrawals,
    // exactly like the sheet's "תנועה אחוזית": r = (V − F) / V_prev − 1. Period return chains the daily returns (TWR).
    function performance(snapshots,depositEvents){
      const snaps=ordered(snapshots).filter((s,i,a)=>i===a.length-1||a[i+1].date!==s.date);
      const ils=depositEvents.filter(e=>e.currency==='ILS');
      let k=0,cum=0,prev=null;const rows=[];
      for(const s of snaps){
        let flow=0;
        while(k<ils.length&&ils[k].date<=s.date){if(!prev||ils[k].date>prev.date)flow+=ils[k].cents;cum+=ils[k].cents;k++;}
        const value=cents(s.value);
        const daily=prev&&prev.value?((value-flow)/prev.value-1)*100:null;
        rows.push({date:s.date,value,netDeposits:cum,profit:value-cum,flow,daily,id:s.id});
        prev={date:s.date,value};
      }
      let twr=null;
      for(const r of rows)if(r.daily!==null)twr=((twr===null?1:1+twr/100)*(1+r.daily/100)-1)*100;
      return {rows,twr};
    }

    // Validation for the form: runs the whole ledger with the candidate so a sale can be checked against what was held on that date.
    function validate(state,tx,market){
      const errors={};
      if(!isDate(tx.date))errors.date='צריך תאריך';
      else if(tx.date>todayIso())errors.date='תאריך עתידי';
      if(tx.type==='buy'||tx.type==='sell'){
        if(!cleanSymbol(tx.symbol))errors.symbol='צריך סימול';
        if(!(tx.qty>0))errors.qty='כמות חיובית';
        if(!(tx.price>0))errors.price='מחיר חיובי';
        if(!(tx.fee>=0))errors.fee='עמלה 0 או יותר';
        if(tx.fxRate!==undefined&&!(tx.fxRate>0))errors.fxRate='שער חיובי';
      }else if(tx.type==='fx'){
        if(!(tx.amount>0))errors.amount='סכום חיובי';
        if(!(tx.rate>0))errors.rate='שער חיובי';
      }else if(!(tx.amount>0))errors.amount='סכום חיובי';
      if(!Object.keys(errors).length&&tx.type==='sell'){
        const others=state.transactions.filter(t=>t.id!==tx.id);
        const r=compute({...state,transactions:[...others,tx]},market,{});
        const bad=r.issues.find(i=>i.txId===tx.id);
        if(bad)errors.qty='מוחזקות רק '+bad.held+' יחידות בתאריך זה';
        // Editing an earlier sale must not break a later one either.
        const later=r.issues.find(i=>i.txId!==tx.id);
        if(!bad&&later)errors.qty='השינוי יוצר מכירה ללא אחזקה בהמשך ('+later.message+')';
      }
      return errors;
    }
    function heldOn(state,symbol,date,excludeId){
      let qty=0;
      for(const t of ordered(state.transactions)){
        if(t.id===excludeId||t.symbol!==symbol||t.date>date)continue;
        if(t.type==='buy')qty=q8(qty+t.qty);else if(t.type==='sell')qty=Math.max(0,q8(qty-t.qty));
      }
      return qty;
    }
    return {SCHEMA,MARKETS,TYPES,defaults,normalize,normalizePlan,compute,validate,heldOn,cashFlows,instrumentOf,ordered,cleanSymbol,isDate,todayIso,uid,cents,dayDiff};
  })();
