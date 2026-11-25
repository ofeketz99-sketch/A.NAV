
  // Chart data layer: typed datasets built from the portfolio, aggregation rules, chart-type rules and drill-down.
  // Pure (no DOM). Money is kept in minor units per currency; a metric never mixes ₪ and $.
  const ChartData=(()=>{
    const UNIT={ILS:{label:'₪',money:true},USD:{label:'$',money:true},pct:{label:'%'},days:{label:'ימים'},count:{label:'מספר'},qty:{label:'יח׳'}};
    const TYPE_LABEL={buy:'קנייה',sell:'מכירה',deposit:'הפקדה',withdrawal:'משיכה',fx:'המרת מט״ח',dividend:'דיבידנד',fee:'עמלה'};
    const KIND={stock:'מניה',etf:'קרן סל',crypto:'קריפטו',bond:'אג״ח',fund:'קרן',other:'אחר'};
    const AGGS={sum:'סכום',avg:'ממוצע',count:'ספירה',cum:'מצטבר',last:'ערך אחרון',min:'מינימום',max:'מקסימום'};
    // Which aggregations make sense per unit: percentages and levels are never summed.
    function aggsFor(field){
      if(!field)return ['count'];
      if(field.level)return ['last','avg','min','max'];
      if(field.unit==='pct')return ['avg','min','max','count'];
      if(field.unit==='days')return ['avg','min','max','sum','count'];
      return ['sum','avg','cum','min','max','count'];
    }
    // ---------- datasets ----------
    function build(ctx){
      const {pf,calc,daily,E}=ctx;
      const ins=s=>E.instrumentOf(pf,s);
      const ds={};
      ds.trades={label:'עסקאות',key:'trades',fields:{
          endDate:{label:'תאריך סגירה',type:'date'},startDate:{label:'תאריך פתיחה',type:'date'},
          symbol:{label:'נייר',type:'cat'},market:{label:'שוק',type:'cat'},sector:{label:'סקטור',type:'cat'},kind:{label:'סוג נכס',type:'cat'},
          status:{label:'מצב',type:'cat'},result:{label:'תוצאה',type:'cat'},tag:{label:'תגית',type:'cat'},
          netUSD:{label:'נטו ($)',type:'num',unit:'USD'},netILS:{label:'נטו (₪)',type:'num',unit:'ILS'},
          feesUSD:{label:'עמלות ($)',type:'num',unit:'USD'},returnPct:{label:'תשואה לעסקה',type:'num',unit:'pct'},days:{label:'ימי החזקה',type:'num',unit:'days'}},
        rows:calc.trades.map(t=>{const i=ins(t.symbol),tags=t.plan?.tags||[];return {id:t.id,endDate:t.endDate,startDate:t.startDate,symbol:t.symbol,market:E.MARKETS[t.market].label,
          sector:i.sector||'לא מוגדר',kind:KIND[i.kind]||(t.market==='CRYPTO'?'קריפטו':'לא מוגדר'),status:t.status==='open'?'פתוחה':'סגורה',
          result:t.status!=='closed'?'פתוחה':t.net>0?'רווח':t.net<0?'הפסד':'איזון',tag:tags[0]||'ללא תגית',tags,
          netUSD:t.status==='closed'&&t.currency==='USD'?t.net:null,netILS:t.status==='closed'&&t.currency==='ILS'?t.net:null,
          feesUSD:t.currency==='USD'?t.fees:null,returnPct:t.returnPct,days:t.days};})};
      ds.actions={label:'פעולות',key:'actions',fields:{
          date:{label:'תאריך',type:'date'},type:{label:'סוג פעולה',type:'cat'},symbol:{label:'נייר',type:'cat'},
          cashUSD:{label:'השפעה על המזומן ($)',type:'num',unit:'USD'},cashILS:{label:'השפעה על המזומן (₪)',type:'num',unit:'ILS'},
          feeUSD:{label:'עמלה ($)',type:'num',unit:'USD'},feeILS:{label:'עמלה (₪)',type:'num',unit:'ILS'},
          depositsILS:{label:'הפקדות פחות משיכות (₪)',type:'num',unit:'ILS'},realizedUSD:{label:'רווח ממומש ($)',type:'num',unit:'USD'}},
        rows:pf.transactions.map(t=>{const info=calc.txInfo[t.id]||{},f=Object.fromEntries(info.cash||[]),cur=t.symbol?ins(t.symbol).currency:t.currency;
          const trade=t.type==='buy'||t.type==='sell',fee=trade?E.cents(t.fee):null;
          return {id:t.id,date:t.date,type:TYPE_LABEL[t.type],symbol:t.symbol||'—',cashUSD:f.USD??null,cashILS:f.ILS??null,
            feeUSD:trade&&cur==='USD'?fee:null,feeILS:trade&&cur==='ILS'?fee:null,
            depositsILS:(t.type==='deposit'||t.type==='withdrawal')&&t.currency==='ILS'?f.ILS:null,realizedUSD:cur==='USD'&&info.realized!==undefined?info.realized:null};})};
      ds.holdings={label:'אחזקות',key:'holdings',fields:{
          symbol:{label:'נייר',type:'cat'},sector:{label:'סקטור',type:'cat'},kind:{label:'סוג נכס',type:'cat'},currency:{label:'מטבע',type:'cat'},market:{label:'שוק',type:'cat'},
          valueIls:{label:'שווי (₪)',type:'num',unit:'ILS'},weight:{label:'משקל בתיק',type:'num',unit:'pct'},
          unrealizedUSD:{label:'רווח לא ממומש ($)',type:'num',unit:'USD'},unrealizedPct:{label:'רווח לא ממומש %',type:'num',unit:'pct'}},
        rows:calc.holdings.map(h=>{const i=ins(h.symbol);return {id:h.symbol,symbol:h.symbol,sector:i.sector||'לא מוגדר',kind:KIND[i.kind]||(h.market==='CRYPTO'?'קריפטו':'לא מוגדר'),
          currency:h.currency==='USD'?'דולר':'שקל',market:E.MARKETS[h.market].label,valueIls:h.valueIls,weight:h.weight,
          unrealizedUSD:h.currency==='USD'?h.unrealized:null,unrealizedPct:h.unrealizedPct};})};
      ds.daily={label:'שווי יומי מחושב',key:'daily',fields:{
          date:{label:'תאריך',type:'date'},value:{label:'שווי התיק (₪)',type:'num',unit:'ILS',level:true},
          daily:{label:'שינוי יומי',type:'num',unit:'pct'},flow:{label:'הפקדות ומשיכות (₪)',type:'num',unit:'ILS'}},
        rows:(daily?.rows||[]).filter(r=>r.value!==null).map(r=>({id:r.date,date:r.date,value:r.value,daily:r.daily,flow:r.flow||null}))};
      ds.broker={label:'שווי לפי הברוקר',key:'broker',fields:{
          date:{label:'תאריך',type:'date'},value:{label:'שווי החשבון (₪)',type:'num',unit:'ILS',level:true},
          netDeposits:{label:'הפקדות נטו מצטברות (₪)',type:'num',unit:'ILS',level:true},profit:{label:'רווח / הפסד (₪)',type:'num',unit:'ILS',level:true},
          daily:{label:'שינוי מהרישום הקודם',type:'num',unit:'pct'}},
        rows:calc.performance.rows.map(r=>({id:r.id||r.date,date:r.date,value:r.value,netDeposits:r.netDeposits,profit:r.profit,daily:r.daily}))};
      return ds;
    }
    // ---------- bucketing ----------
    const GRAINS={day:'יום',week:'שבוע',month:'חודש',quarter:'רבעון',year:'שנה'};
    function bucket(d,g){
      if(!d)return null;
      if(g==='day')return d;
      if(g==='month')return d.slice(0,7);
      if(g==='year')return d.slice(0,4);
      if(g==='quarter')return d.slice(0,4)+'-Q'+(Math.floor((+d.slice(5,7)-1)/3)+1);
      const dt=new Date(d+'T00:00:00Z'),wd=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-wd);return dt.toISOString().slice(0,10);
    }
    // ---------- validation and suggestions ----------
    const TYPES={line:'קו',area:'שטח',bar:'עמודות',stacked:'עמודות מוערמות',donut:'טבעת',scatter:'פיזור',heatmap:'מפת חום',kpi:'כרטיס מדד',table:'טבלה מסכמת'};
    function check(cfg,ds){
      const d=ds[cfg.dataset],errors=[],why={};
      if(!d)return {errors:['מקור נתונים לא קיים'],types:[],why};
      const xf=cfg.x?d.fields[cfg.x]:null,gf=cfg.group?d.fields[cfg.group]:null;
      const ms=(cfg.metrics||[]).filter(m=>m&&(m.agg==='count'||d.fields[m.field]));
      if(!ms.length)errors.push('צריך לבחור מדד');
      for(const m of ms){if(m.agg!=='count'&&!aggsFor(d.fields[m.field]).includes(m.agg))errors.push('"'+AGGS[m.agg]+'" לא מתאים ל"'+d.fields[m.field].label+'"');}
      const units=[...new Set(ms.map(m=>m.agg==='count'?'count':d.fields[m.field].unit))];
      if(units.length>2)errors.push('אפשר לשלב לכל היותר שתי יחידות מידה (ציר ימני ושמאלי)');
      if(units.includes('ILS')&&units.includes('USD'))errors.push('אין לערבב שקלים ודולרים באותו גרף');
      const types=[];
      const allow=(t,ok,reason)=>{if(ok)types.push(t);else why[t]=reason;};
      allow('line',xf?.type==='date'&&ms.length>=1,'קו מתאים לציר זמן');
      allow('area',xf?.type==='date'&&ms.length===1&&units.length===1,'שטח מתאים למדד אחד על ציר זמן');
      allow('bar',!!xf&&ms.length>=1,'צריך ציר קטגוריה או זמן');
      allow('stacked',!!xf&&!!gf&&ms.length===1&&!ms.some(m=>d.fields[m.field]?.unit==='pct'||d.fields[m.field]?.level||m.agg==='avg'),'מוערמות דורשות פיצול לקבוצות ומדד שאפשר לחבר');
      allow('donut',xf?.type==='cat'&&!gf&&ms.length===1&&!ms.some(m=>d.fields[m.field]?.unit==='pct'||m.agg==='avg'||m.agg==='cum'),'טבעת מתאימה לחלוקה של סכום אחד לפי קטגוריה');
      allow('scatter',!xf&&ms.length===2&&ms.every(m=>m.agg!=='count'),'פיזור דורש שני מדדים, בלי ציר X (כל רשומה היא נקודה)');
      allow('heatmap',!!xf&&!!gf&&ms.length===1,'מפת חום דורשת ציר ופיצול לקבוצות');
      allow('kpi',ms.length===1&&!xf,'כרטיס מדד מציג מספר אחד, בלי ציר');
      allow('table',ms.length>=1,'');
      if(cfg.type&&!types.includes(cfg.type))errors.push('סוג הגרף "'+TYPES[cfg.type]+'" לא מתאים: '+(why[cfg.type]||''));
      return {errors,types,why,units};
    }
    function suggest(cfg,ds){
      const c=check({...cfg,type:null},ds),t=c.types;
      const d=ds[cfg.dataset],xf=cfg.x?d?.fields[cfg.x]:null;
      const pref=!xf?(t.includes('scatter')?'scatter':'kpi'):xf.type==='date'?(cfg.group&&t.includes('stacked')?'stacked':(cfg.metrics||[]).some(m=>d.fields[m.field]?.level||m.agg==='cum')?'line':'bar'):t.includes('donut')?'donut':'bar';
      return t.includes(pref)?pref:t[0]||'table';
    }
    // ---------- aggregation ----------
    function agg(kind,vals,prev){
      const v=vals.filter(x=>x!==null&&x!==undefined&&Number.isFinite(x));
      if(kind==='count')return vals.length;
      if(!v.length)return null;
      if(kind==='sum'||kind==='cum')return v.reduce((s,x)=>s+x,0);
      if(kind==='avg')return v.reduce((s,x)=>s+x,0)/v.length;
      if(kind==='min')return Math.min(...v);
      if(kind==='max')return Math.max(...v);
      if(kind==='last')return v[v.length-1];
      return null;
    }
    // Rows → series. Each point keeps the ids of its records for drill-down.
    function compute(cfg,ds,opts){
      const d=ds[cfg.dataset];const c=check(cfg,ds);if(c.errors.length)return {errors:c.errors};
      const xf=cfg.x?d.fields[cfg.x]:null,dateKey=Object.keys(d.fields).find(k=>d.fields[k].type==='date');
      let rows=d.rows.slice();
      // shared period filter on the dataset's date field
      const from=opts?.from||cfg.from,to=opts?.to||cfg.to;
      const dk=xf?.type==='date'?cfg.x:dateKey;
      if(dk&&(from||to))rows=rows.filter(r=>r[dk]&&(!from||r[dk]>=from)&&(!to||r[dk]<=to));
      for(const f of cfg.filters||[])if(f&&f.field&&f.value!==undefined&&f.value!=='')rows=rows.filter(r=>String(r[f.field])===String(f.value)||(f.field==='tag'&&(r.tags||[]).includes(f.value)));
      if(xf?.type==='date')rows.sort((a,b)=>a[cfg.x]<b[cfg.x]?-1:1);
      const ms=cfg.metrics.map(m=>({...m,f:m.agg==='count'?{label:'מספר רשומות',unit:'count'}:d.fields[m.field]}));
      const units=[...new Set(ms.map(m=>m.f.unit))];
      if(cfg.type==='scatter'){
        const pts=rows.filter(r=>Number.isFinite(r[ms[0].field])&&Number.isFinite(r[ms[1].field])).map(r=>({x:r[ms[0].field],y:r[ms[1].field],ids:[r.id],label:r.symbol||r.date||''}));
        return {kind:'scatter',xMetric:ms[0],yMetric:ms[1],points:pts,count:rows.length};
      }
      if(!xf){
        return {kind:'single',series:ms.map(m=>({name:(AGGS[m.agg]||'')+' '+m.f.label,unit:m.f.unit,points:[{x:'',y:agg(m.agg,rows.map(r=>m.agg==='count'?1:r[m.field])),ids:rows.map(r=>r.id)}]})),count:rows.length};
      }
      const keyOf=r=>xf.type==='date'?bucket(r[cfg.x],cfg.grain||'month'):String(r[cfg.x]??'—');
      const groups=cfg.group?[...new Set(rows.map(r=>String(r[cfg.group]??'—')))]:[null];
      const xs=[...new Set(rows.map(keyOf))].filter(x=>x!==null);
      if(xf.type!=='date'&&ms.length){const tot=x=>agg(ms[0].agg==='count'?'count':'sum',rows.filter(r=>keyOf(r)===x).map(r=>ms[0].agg==='count'?1:r[ms[0].field]))||0;xs.sort((a,b)=>tot(b)-tot(a));}
      const series=[];
      for(const m of ms)for(const g of groups){
        const pts=[];let run=0;
        for(const x of xs){
          const rs=rows.filter(r=>keyOf(r)===x&&(g===null||String(r[cfg.group]??'—')===g));
          let y=rs.length?agg(m.agg==='cum'?'sum':m.agg,rs.map(r=>m.agg==='count'?1:r[m.field])):null;
          if(m.agg==='cum'){run+=y||0;y=run;}
          pts.push({x,y,ids:rs.map(r=>r.id)});
        }
        series.push({name:(g!==null?g+' · ':'')+(ms.length>1||g===null?(AGGS[m.agg]+' '+m.f.label):''),group:g,metric:m.field,agg:m.agg,unit:m.f.unit,axis:units.indexOf(m.f.unit),points:pts});
      }
      return {kind:xf.type==='date'?'time':'cat',xs,series,units,count:rows.length,grain:cfg.grain||'month'};
    }
    return {build,check,suggest,compute,aggsFor,bucket,UNIT,AGGS,TYPES,GRAINS};
  })();
