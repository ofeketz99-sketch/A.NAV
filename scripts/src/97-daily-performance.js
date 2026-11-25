
  // Daily portfolio value rebuilt from the ledger and daily closes (no broker figures needed). Pure, no DOM.
  // Value(day) = Σ quantity × close × (USD/ILS for dollar assets) + cash in ₪ + cash in $ × USD/ILS, in agorot.
  // A day is left out (null), never filled with zero, when a held asset has no close within CARRY days or the dollar rate is missing.
  // Daily change removes that day's deposits, withdrawals and opening holdings: (V − F) / V_prev − 1; the period return chains them.
  const DailyPerformance=(()=>{
    const CARRY_DAYS=5,FX_CARRY_DAYS=7;
    const dayNum=d=>Date.parse(d+'T00:00:00Z')/864e5;
    // last bar on or before the date, if it is recent enough
    function lastOnOrBefore(bars,date,maxAge){
      let lo=0,hi=bars.length;while(lo<hi){const m=(lo+hi)>>1;if(bars[m][0]<=date)lo=m+1;else hi=m;}
      const b=bars[lo-1];return b&&dayNum(date)-dayNum(b[0])<=maxAge?b:null;
    }
    function compute(state,hist,opts){
      const E=PortfolioEngine,today=opts?.today||E.todayIso();
      const txs=E.ordered(state.transactions);
      const empty={rows:[],twr:null,complete:0,days:0,missing:{}};
      if(!txs.length)return empty;
      const from=opts?.from||txs[0].date;
      const fx=(hist.USDILS&&hist.USDILS.bars)||[];
      const symbols=[...new Set(txs.filter(t=>t.symbol&&(t.type==='buy'||t.type==='sell')).map(t=>t.symbol))];
      // Split adjustment per holding period (from first buy until flat), so a split between two trades is handled too.
      const periods={};
      for(const s of symbols){
        const list=[],tx=txs.filter(t=>t.symbol===s&&(t.type==='buy'||t.type==='sell'));let q=0,cur=null;
        for(const t of tx){if(!cur){cur={start:t.date,end:null,txs:[]};list.push(cur);}cur.txs.push(t);q+=t.type==='buy'?t.qty:-t.qty;if(q<=1e-9){cur.end=t.date;cur=null;q=0;}}
        for(const p of list)p.factor=typeof TradeAnalysis!=='undefined'?TradeAnalysis.scaleFor(p.txs,hist[s]?.bars||[]).factor:1;
        periods[s]=list;
      }
      const factorOn=(s,d)=>{for(const p of periods[s]||[])if(d>=p.start&&(!p.end||d<=p.end))return p.factor;return 1;};
      const set=new Set();
      for(const s of symbols)for(const b of hist[s]?.bars||[])if(b[0]>=from&&b[0]<=today)set.add(b[0]);
      for(const b of fx)if(b[0]>=from&&b[0]<=today)set.add(b[0]);
      const dates=[...set].sort();
      if(!dates.length)return empty;
      // Flows are accumulated since the last complete day, so a gap is bridged in one step instead of being dropped.
      const qty={},cash={USD:0,ILS:0};let k=0,prev=null,twr=null,pending=0,broken=false;const rows=[],missing={};
      for(const d of dates){
        let flow=0;
        const rateBar=lastOnOrBefore(fx,d,FX_CARRY_DAYS),rate=rateBar?rateBar[4]:null;
        while(k<txs.length&&txs[k].date<=d){
          const t=txs[k++];
          for(const [cur,c] of E.cashFlows(t,state))cash[cur]+=c;
          if(t.type==='buy')qty[t.symbol]=(qty[t.symbol]||0)+t.qty;
          if(t.type==='sell')qty[t.symbol]=Math.max(0,(qty[t.symbol]||0)-t.qty);
          // Money that entered or left the portfolio is not a gain or loss.
          if(t.type==='deposit'||t.type==='withdrawal'){const c=(t.type==='deposit'?1:-1)*E.cents(Math.abs(t.amount));flow+=t.currency==='ILS'?c:rate?Math.round(c*rate):NaN;}
          if(t.opening){const ins=E.instrumentOf(state,t.symbol),c=E.cents(t.qty*t.price)+E.cents(t.fee);flow+=ins.currency==='ILS'?c:rate?Math.round(c*rate):NaN;}
        }
        let value=Math.round(cash.ILS),miss=[];
        const usdExposure=cash.USD!==0||symbols.some(s=>qty[s]>1e-9&&E.instrumentOf(state,s).currency==='USD');
        if(usdExposure){if(rate)value+=Math.round(cash.USD*rate);else miss.push('USDILS');}
        for(const s of symbols){
          if(!(qty[s]>1e-9))continue;
          const b=lastOnOrBefore(hist[s]?.bars||[],d,CARRY_DAYS);
          if(!b){miss.push(s);continue;}
          const v=qty[s]*b[4]*factorOn(s,d)*100,cur=E.instrumentOf(state,s).currency;
          value+=Math.round(cur==='USD'?(rate?v*rate:NaN):v);
        }
        const ok=!miss.length&&Number.isFinite(value)&&Number.isFinite(flow);
        for(const s of miss)missing[s]=(missing[s]||0)+1;
        if(Number.isFinite(flow))pending+=flow;else broken=true;
        let daily=null,since=null;
        if(ok&&prev&&prev.value&&!broken){daily=((value-pending)/prev.value-1)*100;since=prev.date;}
        if(daily!==null)twr=((twr===null?1:1+twr/100)*(1+daily/100)-1)*100;
        const row={date:d,value:ok?value:null,flow:Number.isFinite(flow)?flow:null,daily,since,missing:miss};
        rows.push(row);
        if(ok){prev=row;pending=0;broken=false;}
      }
      const complete=rows.filter(r=>r.value!==null).length;
      return {rows,twr,complete,days:rows.length,missing};
    }
    return {compute,CARRY_DAYS,FX_CARRY_DAYS};
  })();
