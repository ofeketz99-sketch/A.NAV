
  // Trade analysis on daily bars ([date, open, high, low, close]). Pure calculations, no DOM.
  // Everything is measured on end-of-day data: highs and lows are the day's extremes, so on the entry and exit days
  // they may come from before the purchase or after the sale. Results say so instead of claiming intraday precision.
  const TradeAnalysis=(()=>{
    // Thresholds for patterns, shown to the user next to each pattern.
    const TH={upThenLoss:5,ranAfter:10,droppedAfter:-10,nearLevel:0.5};
    const HORIZONS=[['d1',1,'יום מסחר'],['w1',5,'שבוע (5 ימי מסחר)'],['m1',21,'חודש (21 ימי מסחר)']];
    const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
    // Range of history a trade needs: a little before entry, and enough after exit for a month plus a custom period.
    function windowFor(trade,today,customDays){
      const after=Math.max(45,(customDays||0)+15);
      const end=trade.endDate?addDays(trade.endDate,after):today;
      return {from:addDays(trade.startDate,-20),to:end>today?today:end};
    }
    const firstAfter=(bars,date)=>{let lo=0,hi=bars.length;while(lo<hi){const m=(lo+hi)>>1;if(bars[m][0]>date)hi=m;else lo=m+1;}return lo;};
    const firstOnOrAfter=(bars,date)=>{let lo=0,hi=bars.length;while(lo<hi){const m=(lo+hi)>>1;if(bars[m][0]>=date)hi=m;else lo=m+1;}return lo;};
    const pct=(a,b)=>b?(a/b-1)*100:null;

    function analyze(trade,txs,bars,opts){
      const today=opts?.today,customDays=opts?.customDays||63;
      const list=(txs||[]).filter(t=>t&&(t.type==='buy'||t.type==='sell')).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
      const buys=list.filter(t=>t.type==='buy'),sells=list.filter(t=>t.type==='sell');
      const bq=buys.reduce((s,t)=>s+t.qty,0);
      const avgEntry=bq?buys.reduce((s,t)=>s+t.qty*t.price,0)/bq:null;
      const sq=sells.reduce((s,t)=>s+t.qty,0);
      const avgExit=sq?sells.reduce((s,t)=>s+t.qty*t.price,0)/sq:null;
      const B=Array.isArray(bars)?bars:[];
      const end=trade.endDate||today;
      const hold=B.filter(b=>b[0]>=trade.startDate&&b[0]<=end);
      const res={tradeId:trade.id,symbol:trade.symbol,currency:trade.currency,status:trade.status,startDate:trade.startDate,endDate:trade.endDate,days:trade.days,
        net:trade.net,returnPct:trade.returnPct,avgEntry,avgExit,coverage:hold.length?'ok':B.length?'partial':'none',bars:B.length,
        mfe:null,mae:null,exits:[],after:{},hypothetical:{},plan:null,adherence:{},patterns:[]};
      if(hold.length&&avgEntry){
        let hi=hold[0],lo=hold[0];for(const b of hold){if(b[2]>hi[2])hi=b;if(b[3]<lo[3])lo=b;}
        res.mfe={pct:pct(hi[2],avgEntry),price:hi[2],date:hi[0]};
        res.mae={pct:pct(lo[3],avgEntry),price:lo[3],date:lo[0]};
      }
      // After each sale: k trading days later (close), and a custom number of calendar days.
      for(const s of sells){
        const i=firstAfter(B,s.date),row={txId:s.id,date:s.date,qty:s.qty,price:s.price,after:{}};
        for(const [key,k] of HORIZONS){const b=B[i+k-1];row.after[key]=b?{date:b[0],close:b[4],pct:pct(b[4],s.price)}:null;}
        const cb=B[firstOnOrAfter(B,addDays(s.date,customDays))];
        row.after.custom=cb&&cb[0]>s.date?{date:cb[0],close:cb[4],pct:pct(cb[4],s.price),days:customDays}:null;
        res.exits.push(row);
      }
      // Weighted by quantity sold; a horizon counts only exits that already have data, and says how many.
      for(const key of [...HORIZONS.map(h=>h[0]),'custom']){
        const have=res.exits.filter(e=>e.after[key]);
        const q=have.reduce((s,e)=>s+e.qty,0);
        res.after[key]=have.length?{pct:have.reduce((s,e)=>s+e.qty*e.after[key].pct,0)/q,exits:have.length,of:res.exits.length}:null;
        // Hypothetical: the sold quantity kept until then, sold at that close. No extra fees, no dividends.
        res.hypothetical[key]=have.length?{diff:Math.round(have.reduce((s,e)=>s+e.qty*(e.after[key].close-e.price),0)*100),exits:have.length,of:res.exits.length}:null;
      }
      // Plan and how the trade followed it (the plan is judged on its own terms, not by what happened later).
      const p=trade.plan||null;
      if(p){
        res.plan=p;
        const target=Number(p.target)||null,stop=Number(p.stop)||null,tol=TH.nearLevel/100;
        if(target){const b=hold.find(x=>x[2]>=target);res.adherence.targetReached=b?{date:b[0]}:false;}
        if(stop){const b=hold.find(x=>x[3]<=stop);res.adherence.stopTouched=b?{date:b[0]}:false;}
        if(trade.status==='closed'&&avgExit){
          const last=sells[sells.length-1].price;
          res.adherence.exit=target&&last>=target*(1-tol)?'target':stop&&last<=stop*(1+tol)?(last<stop*(1-tol)?'below-stop':'stop'):target?'before-target':stop?'above-stop':'no-levels';
        }
        if(p.horizonDays>0&&trade.days!==null){
          const r=trade.days/p.horizonDays;
          res.adherence.holding=trade.status==='open'?(r>1?'over-plan':'within-plan'):r<0.75?'shorter':r>1.25?'longer':'as-planned';
        }
      }
      // Patterns with explicit definitions (see PATTERNS).
      if(trade.status==='closed'){
        if(trade.net<0&&res.mfe&&res.mfe.pct>=TH.upThenLoss)res.patterns.push('upThenLoss');
        if(res.after.m1&&res.after.m1.pct>=TH.ranAfter)res.patterns.push('ranAfter');
        if(res.after.m1&&res.after.m1.pct<=TH.droppedAfter)res.patterns.push('droppedAfter');
        if(res.adherence.exit==='before-target')res.patterns.push('beforeTarget');
        if(res.adherence.exit==='below-stop')res.patterns.push('belowStop');
      }
      if(!p)res.patterns.push('noPlan');
      return res;
    }
    const PATTERNS={
      upThenLoss:{label:'עלתה ונסגרה בהפסד',def:'עסקה סגורה עם נטו שלילי, שבמהלכה הגבוה היומי הגיע ל־'+TH.upThenLoss+'% ומעלה מעל מחיר הכניסה הממוצע.'},
      ranAfter:{label:'המשיכה לעלות אחרי היציאה',def:'חודש (21 ימי מסחר) אחרי המכירות, מחיר הסגירה גבוה ב־'+TH.ranAfter+'% ומעלה ממחיר המכירה (ממוצע משוקלל לפי כמות). זו תוצאה בדיעבד, לא בהכרח טעות.'},
      droppedAfter:{label:'ירדה אחרי היציאה',def:'חודש אחרי המכירות, מחיר הסגירה נמוך ב־'+Math.abs(TH.droppedAfter)+'% ומעלה ממחיר המכירה.'},
      beforeTarget:{label:'יצאה לפני היעד',def:'נקבע יעד, והמכירה האחרונה הייתה מתחתיו ומעל הסטופ.'},
      belowStop:{label:'נסגרה מתחת לסטופ',def:'המכירה האחרונה נעשתה במחיר נמוך מהסטופ שנקבע (מעבר לסטייה של '+TH.nearLevel+'%).'},
      noPlan:{label:'בלי תוכנית',def:'לא נרשמו לעסקה יעד, סטופ, סיבה או תקופה מתוכננת.'}
    };
    function summarize(list){
      const done=list.filter(a=>a.status==='closed');
      const avg=key=>{const v=done.map(a=>a.after[key]?.pct).filter(x=>x!==null&&x!==undefined);return v.length?{pct:v.reduce((s,x)=>s+x,0)/v.length,n:v.length}:null;};
      const counts={};for(const k of Object.keys(PATTERNS))counts[k]=list.filter(a=>a.patterns.includes(k)).length;
      const withMfe=done.filter(a=>a.mfe);
      return {closed:done.length,withHistory:done.filter(a=>a.coverage!=='none').length,counts,
        after:{d1:avg('d1'),w1:avg('w1'),m1:avg('m1')},
        avgMfe:withMfe.length?withMfe.reduce((s,a)=>s+a.mfe.pct,0)/withMfe.length:null,
        avgMae:withMfe.length?withMfe.reduce((s,a)=>s+a.mae.pct,0)/withMfe.length:null};
    }
    return {analyze,summarize,windowFor,PATTERNS,HORIZONS,TH,addDays};
  })();
