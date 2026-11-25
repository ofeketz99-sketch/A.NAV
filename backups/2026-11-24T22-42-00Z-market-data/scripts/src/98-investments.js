
  // Investments workspace: the Excel workflow as screens. Every number on screen comes from PortfolioEngine.compute(),
  // so the log, holdings, cash, charts and the Excel export always agree.
  // Storage: anav.portfolio.v1 (user data), anav.market.v1 (prices typed by the user, later a price provider).
  (function(){
    const root=q('investApp');
    if(!root||typeof PortfolioEngine==='undefined')return;
    const E=PortfolioEngine;
    const PF_KEY='anav.portfolio.v1',MK_KEY='anav.market.v1',PREV_KEY='anav.portfolio.prev';
    const readJson=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(_){return null;}};
    let pf=E.normalize(readJson(PF_KEY));
    let mk=normalizeMarket(readJson(MK_KEY));
    let calc=null;
    const ui={logMode:'trades',filter:'all',search:'',sort:{key:'startDate',dir:-1},open:new Set(),range:'all',holdBy:'value'};
    function normalizeMarket(raw){
      const m={quotes:{},fx:{}};
      for(const [s,v] of Object.entries(raw?.quotes||{}))if(Number.isFinite(v?.price)&&v.price>0)m.quotes[E.cleanSymbol(s)]={price:v.price,asOf:String(v.asOf||''),source:String(v.source||'manual')};
      if(Number.isFinite(raw?.fx?.USDILS?.rate)&&raw.fx.USDILS.rate>0)m.fx.USDILS={rate:raw.fx.USDILS.rate,asOf:String(raw.fx.USDILS.asOf||''),source:String(raw.fx.USDILS.source||'manual')};
      return m;
    }
    function persist(){
      try{localStorage.setItem(PF_KEY,JSON.stringify(pf));localStorage.setItem(MK_KEY,JSON.stringify(mk));return true;}
      catch(_){toast('השמירה בדפדפן נכשלה. כדאי להוריד גיבוי.');return false;}
    }

    // ---------- formatting ----------
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const NF={USD:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}),ILS:new Intl.NumberFormat('en-US',{style:'currency',currency:'ILS'})};
    const DASH='<span class="inv-na" title="אין נתון">—</span>';
    const tone=v=>v>0?' inv-pos':v<0?' inv-neg':'';
    function money(c,cur,opt){
      if(c===null||c===undefined||!Number.isFinite(c))return DASH;
      const signed=opt?.signed,txt=NF[cur].format(Math.abs(c)/100);
      const sign=c<0?'−':signed&&c>0?'+':'';
      return '<bdi class="inv-num'+(signed?tone(c):'')+'">'+sign+txt+'</bdi>';
    }
    const compact=(c,cur)=>{const v=Math.abs(c)/100,s=(c<0?'−':'')+(cur==='USD'?'$':'₪');return s+(v>=1e6?(v/1e6).toFixed(2).replace(/.?0+$/,'')+'M':v>=1e5?Math.round(v/1e3)+'K':v>=1e3?(v/1e3).toFixed(1).replace(/.0$/,'')+'K':Math.round(v));};
    const num=(v,d=8)=>v===null||v===undefined?DASH:'<bdi class="inv-num">'+Number(v).toLocaleString('en-US',{maximumFractionDigits:d})+'</bdi>';
    const pct=(v,opt)=>v===null||v===undefined||!Number.isFinite(v)?DASH:'<bdi class="inv-num'+(opt?.signed?tone(v):'')+'">'+(v<0?'−':opt?.signed&&v>0?'+':'')+Math.abs(v).toFixed(opt?.d??2)+'%</bdi>';
    const date=d=>d?'<bdi class="inv-num">'+d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(2,4)+'</bdi>':DASH;
    const sym=s=>'<bdi class="inv-sym" dir="ltr">'+esc(s)+'</bdi>';
    const TYPE_LABEL={buy:'קנייה',sell:'מכירה',deposit:'הפקדה',withdrawal:'משיכה',fx:'המרת מט״ח',dividend:'דיבידנד',fee:'עמלה'};
    const CUR_LABEL={USD:'$',ILS:'₪'};
    const parseNum=v=>{const s=String(v??'').replace(/[,\s₪$]/g,'');if(s==='')return undefined;const n=Number(s);return Number.isFinite(n)?n:NaN;};
    const kpi=(label,value,note,cls)=>'<div class="invest-kpi'+(cls?' '+cls:'')+'"><span>'+label+'</span><strong>'+value+'</strong><small>'+(note||'&nbsp;')+'</small></div>';
    const empty=(icon,title,text,action)=>'<div class="invest-empty">'+icon+'<strong>'+title+'</strong><p>'+text+'</p>'+(action||'')+'</div>';
    const ICON={
      log:'<svg class="invest-empty-icon" viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="7" width="30" height="34" rx="5"/><path d="M16 17h16M16 24h16M16 31h9"/></svg>',
      pie:'<svg class="invest-empty-icon" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><path d="M24 9v15l11 10"/></svg>',
      line:'<svg class="invest-empty-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 38h32"/><path d="M11 31l8-9 7 5 11-14"/></svg>',
      cash:'<svg class="invest-empty-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 18h22l-6-6M34 30H12l6 6"/></svg>'
    };
    const PALETTE=['#2f6461','#c08a3e','#5b6fa8','#9a5b7a','#6b8f4e','#b4654a','#4f8a9a','#7d6b9e','#a08f4a','#5f7f6a'];

    // ---------- rendering ----------
    function refresh(){
      calc=E.compute(pf,mk);
      renderLog();renderHoldings();renderPerformance();renderCash();
      const list=q('invSymbols');if(list)list.innerHTML=Object.keys(pf.instruments).sort().map(s=>'<option value="'+esc(s)+'">').join('');
    }
    function curTotals(map,signed=true){return ['USD','ILS'].filter(c=>map[c]).map(c=>money(map[c],c,{signed})).join(' · ')||money(0,'USD');}

    function renderLog(){
      const box=q('investBody-log'),s=calc.summary;
      if(!pf.transactions.length){box.innerHTML=empty(ICON.log,'עדיין אין פעולות','כל קנייה ומכירה שתרשום כאן הופכת אוטומטית לעסקה, לאחזקה ולתנועת מזומן. אין צורך בנוסחאות.','<div class="inv-quick"><button type="button" class="invest-btn invest-primary" data-act="add" data-type="buy">+ רישום קנייה ראשונה</button><button type="button" class="invest-btn" data-act="import">ייבוא מהאקסל שלי</button></div>');return;}
      const u=s.byCurrency.USD,i=s.byCurrency.ILS;
      const net={USD:u.net,ILS:i.net},fees={USD:u.fees,ILS:i.fees};
      let h='<div class="invest-kpis">'+
        kpi('רווח נטו בעסקאות סגורות',curTotals(net),'אחרי כל העמלות')+
        kpi('אחוז הצלחה',pct(s.winRate,{d:0}),s.closed?(s.closed-(u.closed-u.wins)-(i.closed-i.wins))+' מתוך '+s.closed+' עסקאות סגורות ברווח':'אין עדיין עסקאות סגורות')+
        kpi('עמלות ששולמו',curTotals(fees,false),s.trades+' עסקאות · '+s.symbols+' ניירות')+
        kpi('ממוצע ימי החזקה',s.avgDaysClosed===null?DASH:'<bdi class="inv-num">'+s.avgDaysClosed.toFixed(1)+'</bdi>',s.open?s.open+' עסקאות פתוחות לא נכללות':'עסקאות סגורות')+
        '</div>';
      h+=tradeBars();
      h+='<div class="inv-toolbar"><div class="inv-chips" role="group" aria-label="תצוגה">'+
        chip('logMode','trades','לפי עסקאות')+chip('logMode','actions','כל הפעולות')+'</div>'+
        (ui.logMode==='trades'?'<div class="inv-chips" role="group" aria-label="סינון">'+chip('filter','all','הכול')+chip('filter','open','פתוחות')+chip('filter','closed','סגורות')+chip('filter','win','ברווח')+chip('filter','loss','בהפסד')+'</div>':'')+
        '<input type="search" class="inv-search" id="invSearch" placeholder="חיפוש סימול או הערה" value="'+esc(ui.search)+'" aria-label="חיפוש"></div>';
      h+=ui.logMode==='trades'?tradesTable():actionsTable(pf.transactions);
      if(calc.issues.length)h='<div class="inv-alert" role="alert">'+calc.issues.map(x=>esc(x.message)).join('<br>')+' · הפעולה לא נכללה בחישוב. כדאי לתקן אותה.</div>'+h;
      box.innerHTML=h;
    }
    function chip(key,val,label){return '<button type="button" class="inv-chip" data-act="ui" data-key="'+key+'" data-val="'+val+'" aria-pressed="'+(ui[key]===val)+'">'+label+'</button>';}
    function matches(text){const s=ui.search.trim().toLowerCase();return !s||text.toLowerCase().includes(s);}
    function tradesTable(){
      const byId=Object.fromEntries(pf.transactions.map(t=>[t.id,t]));
      let rows=calc.trades.filter(t=>{
        if(ui.filter==='open'&&t.status!=='open')return false;
        if(ui.filter==='closed'&&t.status!=='closed')return false;
        if(ui.filter==='win'&&!(t.net>0))return false;
        if(ui.filter==='loss'&&!(t.net<0))return false;
        return matches(t.symbol+' '+t.txIds.map(id=>byId[id]?.note||'').join(' '));
      });
      const {key,dir}=ui.sort;
      rows=rows.slice().sort((a,b)=>{const x=a[key],y=b[key];if(x===y)return 0;if(x===null||x===undefined)return 1;if(y===null||y===undefined)return -1;return (x<y?-1:1)*dir;});
      if(!rows.length)return '<p class="inv-none">אין עסקאות שמתאימות לסינון.</p>';
      const th=(k,l)=>'<th scope="col"><button type="button" data-act="sort" data-key="'+k+'" aria-sort="'+(key===k?(dir>0?'ascending':'descending'):'none')+'">'+l+(key===k?(dir>0?' ▲':' ▼'):'')+'</button></th>';
      let h='<div class="inv-table-wrap"><table class="inv-table"><thead><tr>'+th('symbol','נייר')+th('status','מצב')+th('startDate','פתיחה')+th('endDate','סגירה')+th('days','ימים')+
        th('buyCost','השקעה')+th('sellProceeds','תמורה')+th('fees','עמלות')+th('net','נטו')+th('returnPct','תשואה')+'</tr></thead><tbody>';
      for(const t of rows){
        const isOpen=ui.open.has(t.id);
        h+='<tr class="inv-trade'+(isOpen?' is-open':'')+'" data-act="toggle" data-id="'+t.id+'" tabindex="0" aria-expanded="'+isOpen+'"><td><span class="inv-caret" aria-hidden="true"></span>'+sym(t.symbol)+' <small class="inv-tag">'+E.MARKETS[t.market].label+'</small></td>'+
          '<td><span class="inv-status inv-'+t.status+'">'+(t.status==='open'?'פתוחה':'סגורה')+'</span></td><td>'+date(t.startDate)+'</td><td>'+date(t.endDate)+'</td>'+
          '<td>'+num(t.days)+(t.status==='open'?' <small class="inv-muted">עד היום</small>':'')+'</td><td>'+money(t.buyCost,t.currency)+'</td><td>'+money(t.sells?t.sellProceeds:null,t.currency)+'</td>'+
          '<td>'+money(t.fees,t.currency)+'</td><td>'+(t.status==='closed'?money(t.net,t.currency,{signed:true}):'<small class="inv-muted" title="רווח ממומש עד עכשיו לפי עלות ממוצעת">ממומש '+money(t.realized,t.currency,{signed:true})+'</small>')+'</td><td>'+pct(t.returnPct,{signed:true})+'</td></tr>';
        if(isOpen)h+='<tr class="inv-sub"><td colspan="10">'+actionsTable(t.txIds.map(id=>byId[id]).filter(Boolean),true)+'</td></tr>';
      }
      return h+'</tbody></table></div>';
    }
    function actionsTable(list,nested){
      const rows=E.ordered(list).reverse().filter(t=>nested||matches((t.symbol||'')+' '+t.note+' '+TYPE_LABEL[t.type]));
      if(!rows.length)return '<p class="inv-none">אין פעולות שמתאימות לחיפוש.</p>';
      let h='<div class="inv-table-wrap"><table class="inv-table inv-actions"><thead><tr><th>תאריך</th><th>פעולה</th>'+(nested?'':'<th>נייר</th>')+'<th>כמות</th><th>מחיר</th><th>עמלה</th><th>השפעה על המזומן</th><th>רווח ממומש</th><th>הערה</th><th><span class="inv-sr">פעולות</span></th></tr></thead><tbody>';
      for(const t of rows){
        const info=calc.txInfo[t.id]||{},trade=t.type==='buy'||t.type==='sell',cur=trade?E.instrumentOf(pf,t.symbol).currency:null;
        const flows=(info.cash||[]).map(([c,v])=>money(v,c,{signed:true})).join(' ');
        h+='<tr'+(info.ignored?' class="inv-bad" title="לא נכלל בחישוב"':'')+'><td>'+date(t.date)+'</td><td><span class="inv-type inv-type-'+t.type+'">'+TYPE_LABEL[t.type]+'</span></td>'+(nested?'':'<td>'+(t.symbol?sym(t.symbol):DASH)+'</td>')+
          '<td>'+(trade?num(t.qty):DASH)+'</td><td>'+(trade?money(E.cents(t.price),cur):t.type==='fx'?'<small>שער</small> '+num(t.rate,4):DASH)+'</td><td>'+(trade?money(E.cents(t.fee),cur):DASH)+'</td>'+
          '<td>'+(flows||DASH)+'</td><td>'+(info.realized!==undefined?money(info.realized,cur,{signed:true})+(info.realizedIls!==undefined?'<small class="inv-muted"> · ₪ '+money(info.realizedIls,'ILS',{signed:true})+(info.fxEffect?' (מזה דולר '+money(info.fxEffect,'ILS',{signed:true})+')':'')+'</small>':''):DASH)+'</td>'+
          '<td class="inv-note">'+esc(t.note)+'</td><td class="inv-row-tools"><button type="button" data-act="edit" data-id="'+t.id+'" aria-label="עריכה">עריכה</button><button type="button" data-act="delete" data-id="'+t.id+'" aria-label="מחיקה">מחיקה</button></td></tr>';
      }
      return h+'</tbody></table></div>';
    }
    // Net result of each closed trade as a bar, oldest to newest (the Excel "שינוי נטו" column at a glance).
    function tradeBars(){
      const closed=calc.trades.filter(t=>t.status==='closed'&&t.currency==='USD').sort((a,b)=>a.endDate<b.endDate?-1:1);
      if(closed.length<2)return '';
      const W=Math.max(320,(q('investBody-log').clientWidth||800)-2),H=120,pad=6,max=Math.max(...closed.map(t=>Math.abs(t.net)))||1;
      const bw=Math.min(28,(W-pad*2)/closed.length*0.7),gap=(W-pad*2)/closed.length,mid=H/2;
      const bars=closed.map((t,i)=>{const hgt=Math.max(1.5,Math.abs(t.net)/max*(mid-10));const x=pad+gap*(i+.5)-bw/2;
        return '<rect x="'+x.toFixed(1)+'" y="'+(t.net>=0?mid-hgt:mid).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hgt.toFixed(1)+'" rx="2" class="'+(t.net>=0?'inv-bar-pos':'inv-bar-neg')+'" data-act="toggle" data-id="'+t.id+'"><title>'+esc(t.symbol)+' · '+NF.USD.format(t.net/100)+' · '+t.endDate+'</title></rect>';}).join('');
      return '<figure class="inv-chart inv-bars"><figcaption>רווח נטו לכל עסקה סגורה ($), מהישנה (משמאל) לחדשה · לחיצה על עמודה פותחת את העסקה</figcaption><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="רווח נטו לפי עסקה" dir="ltr"><line x1="0" x2="'+W+'" y1="'+mid+'" y2="'+mid+'" class="inv-axis"/>'+bars+'</svg></figure>';
    }

    function renderHoldings(){
      const box=q('investBody-holdings'),c=calc;
      const rate=mk.fx.USDILS;
      const unreal={USD:0,ILS:0};let unrealKnown=true;
      for(const h of c.holdings){if(h.unrealized===null)unrealKnown=false;else unreal[h.currency]+=h.unrealized;}
      let h='<div class="invest-kpis">'+
        kpi('שווי תיק (₪)',c.totalIls===null?DASH:money(c.totalIls,'ILS'),c.totalIls===null?(c.missingPrices.length?'חסר מחיר: '+c.missingPrices.map(esc).join(', '):'חסר שער דולר'):'כולל מזומן')+
        kpi('מזומן',money(c.cash.USD,'USD')+' · '+money(c.cash.ILS,'ILS'),c.cash.USD<0?'<span class="inv-neg">מזומן דולרי שלילי: חסרה המרת מט״ח?</span>':'נגזר מכל הפעולות')+
        kpi('רווח שטרם מומש',unrealKnown?curTotals(unreal):DASH,unrealKnown?'לפי המחירים שהוזנו':'חסרים מחירים')+
        '<div class="invest-kpi"><span>שער דולר (USDILS)</span><strong><input class="inv-inline" type="text" inputmode="decimal" data-act="fx" value="'+(rate?rate.rate:'')+'" placeholder="הזן שער" aria-label="שער דולר"></strong><small>'+(rate?(rate.source==='excel'?'מהאקסל, כדאי לעדכן':'הוזן ידנית · '+date(rate.asOf)):'נדרש לשווי בשקלים')+'</small></div>'+
        '</div>';
      if(!c.holdings.length){box.innerHTML=h+empty(ICON.pie,'אין כרגע אחזקות','אחזקות מחושבות אוטומטית מהקניות והמכירות בלוג.');return;}
      h+='<div class="inv-split">'+donut()+'<div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>נייר</th><th>כמות</th><th>עלות ממוצעת</th><th>עלות</th><th>מחיר נוכחי</th><th>שווי</th><th>רווח / הפסד</th><th>משקל</th></tr></thead><tbody>';
      for(const x of c.holdings){
        h+='<tr><td>'+sym(x.symbol)+' <small class="inv-tag">'+E.MARKETS[x.market].label+'</small></td><td>'+num(x.qty)+'</td><td>'+money(x.avgCost===null?null:E.cents(x.avgCost),x.currency)+'</td><td>'+money(x.cost,x.currency)+'</td>'+
          '<td><input class="inv-inline" type="text" inputmode="decimal" data-act="price" data-symbol="'+esc(x.symbol)+'" value="'+(x.price??'')+'" placeholder="מחיר" aria-label="מחיר נוכחי של '+esc(x.symbol)+'"><small class="inv-muted inv-src">'+(x.price===null?'חסר':x.priceSource==='excel'?'מהאקסל':'ידני · '+date(x.priceAsOf))+'</small></td>'+
          '<td>'+money(x.value,x.currency)+'</td><td>'+money(x.unrealized,x.currency,{signed:true})+' <small>'+pct(x.unrealizedPct,{signed:true})+'</small></td><td>'+pct(x.weight,{d:1})+'</td></tr>';
      }
      h+='</tbody></table></div></div><p class="inv-foot">משקל = שווי הנייר בשקלים מתוך כלל התיק <b>כולל מזומן</b>. המחירים הוזנו ידנית, וחיבור לספק מחירים יתווסף בהמשך. עלות כוללת עמלות קנייה (שיטת עלות ממוצעת).</p>';
      box.innerHTML=h;
    }
    function donut(){
      const c=calc;let parts,title;
      if(c.totalIls){
        parts=c.holdings.map(h=>({label:h.symbol,v:h.valueIls}));
        const cashIls=c.cashIls;if(cashIls>0)parts.push({label:'מזומן',v:cashIls,cash:true});
        title='חלוקה לפי שווי (₪, כולל מזומן)';
      }else{
        const usd=c.holdings.filter(h=>h.currency==='USD');if(!usd.length)return '';
        parts=usd.map(h=>({label:h.symbol,v:h.cost}));title='חלוקה לפי עלות ($) · יוצג לפי שווי כשיוזנו מחירים ושער';
      }
      const total=parts.reduce((s,p)=>s+Math.max(0,p.v),0);if(!total)return '';
      let a=-Math.PI/2;const R=62,r=40,cx=70,cy=70;
      const arcs=parts.map((p,i)=>{
        const frac=Math.max(0,p.v)/total,a2=a+frac*Math.PI*2,large=frac>.5?1:0,col=p.cash?'#cfc6b8':PALETTE[i%PALETTE.length];
        const pt=(rad,ang)=>(cx+rad*Math.cos(ang)).toFixed(2)+' '+(cy+rad*Math.sin(ang)).toFixed(2);
        const d=frac>=.9999?'M'+pt(R,0)+' A'+R+' '+R+' 0 1 1 '+pt(R,Math.PI)+' A'+R+' '+R+' 0 1 1 '+pt(R,0)+' M'+pt(r,0)+' A'+r+' '+r+' 0 1 0 '+pt(r,Math.PI)+' A'+r+' '+r+' 0 1 0 '+pt(r,0)+'Z'
          :'M'+pt(R,a)+' A'+R+' '+R+' 0 '+large+' 1 '+pt(R,a2)+' L'+pt(r,a2)+' A'+r+' '+r+' 0 '+large+' 0 '+pt(r,a)+'Z';
        a=a2;return {d,col,label:p.label,frac};
      });
      return '<figure class="inv-chart inv-donut"><figcaption>'+title+'</figcaption><div class="inv-donut-row"><svg viewBox="0 0 140 140" role="img" aria-label="'+title+'">'+arcs.map(x=>'<path d="'+x.d+'" fill="'+x.col+'" fill-rule="evenodd"><title>'+esc(x.label)+' '+(x.frac*100).toFixed(1)+'%</title></path>').join('')+'</svg>'+
        '<ul class="inv-legend">'+arcs.map(x=>'<li><i style="background:'+x.col+'"></i><bdi dir="ltr">'+esc(x.label)+'</bdi><b>'+(x.frac*100).toFixed(1)+'%</b></li>').join('')+'</ul></div></figure>';
    }

    function renderPerformance(){
      const box=q('investBody-performance'),p=calc.performance,rows=p.rows;
      const last=rows[rows.length-1];
      const form='<form class="inv-snap" data-form="snapshot"><label>שווי החשבון לפי הברוקר<input name="value" type="text" inputmode="decimal" placeholder="₪" required></label><label>תאריך<input name="date" type="date" value="'+E.todayIso()+'" max="'+E.todayIso()+'" required></label><button type="submit" class="invest-btn invest-primary">רישום שווי</button><span class="inv-form-msg" aria-live="polite"></span></form>';
      let h='<div class="invest-kpis">'+
        kpi('שווי אחרון',last?money(last.value,'ILS'):DASH,last?'לפי הברוקר · '+date(last.date):'עדיין לא נרשם')+
        kpi('הפקדות נטו',money(calc.netDeposits.ILS,'ILS'),'הפקדות פחות משיכות (₪)')+
        kpi('רווח / הפסד כספי',last?money(last.profit,'ILS',{signed:true}):DASH,'שווי פחות הפקדות נטו')+
        kpi('תשואה מצטברת',pct(p.twr,{signed:true}),last&&last.daily!==null?'מהרישום הקודם: '+pct(last.daily,{signed:true}):'שרשור התשואות בין הרישומים, בלי הפקדות')+
        '</div>'+form;
      if(rows.length<2){box.innerHTML=h+empty(ICON.line,'אין עדיין מספיק נקודות לגרף','רשום את שווי החשבון מהברוקר (כמו בגיליון סה״כ באקסל). מספיקות שתי נקודות כדי לראות קו. ימים שלא נרשמו לא ממולאים ולא מוצגים כאפס.');return;}
      const cut={'1m':30,'3m':91,'1y':365}[ui.range];
      const from=cut?new Date(Date.now()-cut*864e5).toISOString().slice(0,10):'';
      const view=rows.filter(r=>r.date>=from);
      h+='<div class="inv-toolbar"><div class="inv-chips" role="group" aria-label="טווח">'+chip('range','1m','חודש')+chip('range','3m','3 חודשים')+chip('range','1y','שנה')+chip('range','all','הכול')+'</div></div>';
      h+=view.length<2?'<p class="inv-none">אין מספיק נקודות בטווח הזה.</p>':equityChart(view);
      h+='<details class="inv-details"><summary>כל הרישומים ('+rows.length+')</summary><div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>תאריך</th><th>שווי</th><th>הפקדה / משיכה</th><th>הפקדות נטו</th><th>רווח / הפסד</th><th>שינוי מהרישום הקודם</th><th></th></tr></thead><tbody>'+
        rows.slice().reverse().map(r=>'<tr><td>'+date(r.date)+'</td><td>'+money(r.value,'ILS')+'</td><td>'+(r.flow?money(r.flow,'ILS',{signed:true}):DASH)+'</td><td>'+money(r.netDeposits,'ILS')+'</td><td>'+money(r.profit,'ILS',{signed:true})+'</td><td>'+pct(r.daily,{signed:true})+'</td><td class="inv-row-tools"><button type="button" data-act="del-snap" data-id="'+r.id+'">מחיקה</button></td></tr>').join('')+
        '</tbody></table></div></details><p class="inv-foot">שינוי = (שווי − הפקדות ומשיכות מאז הרישום הקודם) ÷ שווי ברישום הקודם − 1, כמו "תנועה אחוזית" באקסל. ברישום יומי זה השינוי היומי. התשואה המצטברת משרשרת את השינויים, כך שהפקדות לא נספרות כרווח.</p>';
      box.innerHTML=h;
    }
    // Account value vs net deposits (the Excel line chart), with daily % bars underneath.
    function equityChart(rows){
      const W=Math.max(320,(q('investBody-performance').clientWidth||800)-2),H=230,B=64,L=56,R=10,T=12;
      const vals=rows.flatMap(r=>[r.value,r.netDeposits]),min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
      const t0=Date.parse(rows[0].date),t1=Date.parse(rows[rows.length-1].date),ts=t1-t0||1;
      // Time runs left → right, the usual convention for financial charts (also on Hebrew sites).
      const X=d=>L+(Date.parse(d)-t0)/ts*(W-L-R),Y=v=>T+(1-(v-min)/span)*(H-T-22);
      const path=k=>rows.map((r,i)=>(i?'L':'M')+X(r.date).toFixed(1)+' '+Y(r[k]).toFixed(1)).join(' ');
      const ticks=[0,1,2,3].map(i=>min+span*i/3);
      const dates=[rows[0],rows[Math.floor(rows.length/2)],rows[rows.length-1]];
      const dmax=Math.max(.5,...rows.map(r=>Math.abs(r.daily||0)));
      const bw=Math.max(1,Math.min(10,(W-L-R)/rows.length*.7)),bmid=H+B/2;
      const bars=rows.filter(r=>r.daily!==null).map(r=>{const hh=Math.abs(r.daily)/dmax*(B/2-6);return '<rect x="'+(X(r.date)-bw/2).toFixed(1)+'" y="'+(r.daily>=0?bmid-hh:bmid).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(.8,hh).toFixed(1)+'" class="'+(r.daily>=0?'inv-bar-pos':'inv-bar-neg')+'"><title>'+r.date+' · '+r.daily.toFixed(2)+'%</title></rect>';}).join('');
      return '<figure class="inv-chart inv-equity"><figcaption><span><i class="inv-key inv-key-value"></i>שווי החשבון</span><span><i class="inv-key inv-key-dep"></i>הפקדות נטו</span><span><i class="inv-key inv-key-bar"></i>שינוי מהרישום הקודם %</span></figcaption>'+
        '<svg viewBox="0 0 '+W+' '+(H+B)+'" role="img" aria-label="שווי החשבון מול הפקדות נטו" dir="ltr">'+
        ticks.map(v=>'<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'" class="inv-grid"/><text x="'+(L-6)+'" y="'+(Y(v)+3).toFixed(1)+'" class="inv-tick" text-anchor="end">'+compact(v,'ILS')+'</text>').join('')+
        dates.map((r,i)=>'<text x="'+X(r.date).toFixed(1)+'" y="'+(H-6)+'" class="inv-tick" text-anchor="'+['start','middle','end'][i]+'">'+r.date.slice(8,10)+'/'+r.date.slice(5,7)+'/'+r.date.slice(2,4)+'</text>').join('')+
        '<path d="'+path('netDeposits')+'" class="inv-line-dep"/><path d="'+path('value')+'" class="inv-line-value"/>'+
        '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+bmid+'" y2="'+bmid+'" class="inv-axis"/>'+bars+'</svg></figure>';
    }

    function renderCash(){
      const box=q('investBody-cash'),c=calc;
      const moves=pf.transactions.filter(t=>['deposit','withdrawal','fx','dividend','fee'].includes(t.type));
      let h='<div class="invest-kpis">'+
        kpi('מזומן בשקלים',money(c.cash.ILS,'ILS'),'אחרי כל הפעולות')+
        kpi('מזומן בדולרים',money(c.cash.USD,'USD'),c.cash.USD<0?'<span class="inv-neg">שלילי: נרשמו קניות בלי המרת מט״ח</span>':'אחרי קניות, מכירות והמרות')+
        kpi('הפקדות נטו',money(c.netDeposits.ILS,'ILS'),'הפקדות פחות משיכות')+
        '</div><div class="inv-quick">'+
        '<button type="button" class="invest-btn" data-act="add" data-type="deposit">+ הפקדה</button><button type="button" class="invest-btn" data-act="add" data-type="withdrawal">+ משיכה</button><button type="button" class="invest-btn" data-act="add" data-type="fx">+ המרת מט״ח</button></div>';
      h+=moves.length?actionsTable(moves,false):empty(ICON.cash,'אין עדיין תנועות','רשום הפקדות ומשיכות מהבנק, והמרות משקלים לדולרים. קניות ומכירות כבר משנות את המזומן לבד, אין צורך לרשום אותן כאן.');
      box.innerHTML=h;
    }

    // ---------- transaction dialog ----------
    document.body.insertAdjacentHTML('beforeend',
      '<datalist id="invSymbols"></datalist>'+
      '<div class="tool-overlay inv-overlay" id="invTxOverlay" hidden><section class="tool-dialog inv-dialog" role="dialog" aria-modal="true" aria-labelledby="invTxTitle">'+
      '<header class="tool-head"><div><h2 id="invTxTitle">פעולה חדשה</h2><p>הסכום, העמלה וההשפעה על המזומן מחושבים אוטומטית.</p></div><button type="button" class="tool-close" data-inv-close aria-label="סגירה">×</button></header>'+
      '<form class="tool-content inv-form" id="invTxForm" novalidate><div class="inv-seg" role="radiogroup" aria-label="סוג פעולה">'+
      ['buy','sell','deposit','withdrawal','fx'].map(t=>'<button type="button" role="radio" data-type="'+t+'" aria-checked="false">'+TYPE_LABEL[t]+'</button>').join('')+
      '</div><div class="inv-grid" id="invTxFields"></div><div class="inv-preview" id="invTxPreview" aria-live="polite"></div>'+
      '<div class="inv-form-actions"><button type="submit" class="tool-primary">שמירה</button><button type="button" class="inv-ghost" data-inv-close>ביטול</button><button type="button" class="inv-danger" id="invTxDelete" hidden>מחיקה</button></div></form></section></div>'+
      '<div class="tool-overlay inv-overlay" id="invSetOverlay" hidden><section class="tool-dialog inv-dialog" role="dialog" aria-modal="true" aria-labelledby="invSetTitle">'+
      '<header class="tool-head"><div><h2 id="invSetTitle">עמלות ברירת מחדל</h2><p>ממולאות אוטומטית בכל פעולה חדשה, ואפשר לשנות בכל פעולה. שינוי כאן לא משנה פעולות קיימות.</p></div><button type="button" class="tool-close" data-inv-close aria-label="סגירה">×</button></header>'+
      '<form class="tool-content inv-form" id="invSetForm"><div class="inv-grid"></div><div class="inv-form-actions"><button type="submit" class="tool-primary">שמירה</button><button type="button" class="inv-ghost" data-inv-close>ביטול</button></div></form></section></div>'+
      '<div class="inv-toast" id="invToast" role="status" hidden><span></span><button type="button">ביטול</button></div>');
    const overlay=q('invTxOverlay'),form=q('invTxForm');
    let draft=null,editing=null,feeTouched=false,opener=null;
    const field=(name,label,input,hint)=>'<label class="inv-field'+(name==='note'?' inv-wide':'')+'" data-field="'+name+'"><span>'+label+'</span>'+input+'<em class="inv-err" data-err="'+name+'"></em>'+(hint?'<small>'+hint+'</small>':'')+'</label>';
    const inp=(name,val,attrs)=>'<input name="'+name+'" value="'+esc(val??'')+'" '+(attrs||'type="text" inputmode="decimal"')+'>';
    function marketFor(symbol){
      const s=E.cleanSymbol(symbol);
      if(pf.instruments[s])return pf.instruments[s].market;
      return /^(BTC|ETH|SOL|XRP|ADA|DOGE)(USD|USDT)?$/.test(s)?'CRYPTO':'US';
    }
    function renderFields(){
      const t=draft.type,trade=t==='buy'||t==='sell';
      form.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.type===t)));
      const dateField=field('date','תאריך',inp('date',draft.date,'type="date" max="'+E.todayIso()+'"'));
      let h='';
      if(trade){
        const market=draft.market||marketFor(draft.symbol),cur=E.MARKETS[market].currency,c=CUR_LABEL[cur];
        const held=draft.symbol?E.heldOn(pf,E.cleanSymbol(draft.symbol),draft.date||E.todayIso(),editing):null;
        h+=field('symbol','נייר',inp('symbol',draft.symbol,'type="text" list="invSymbols" autocomplete="off" dir="ltr" placeholder="AAPL" autocapitalize="characters"'),t==='sell'&&draft.symbol?'מוחזקות בתאריך: '+held:'');
        h+=dateField;
        const marketField=field('market','שוק','<select name="market"'+(t==='sell'||pf.instruments[E.cleanSymbol(draft.symbol)]?' disabled':'')+'>'+Object.entries(E.MARKETS).map(([k,m])=>'<option value="'+k+'"'+(k===market?' selected':'')+'>'+m.label+' ('+CUR_LABEL[m.currency]+')</option>').join('')+'</select>');
        h+=field('qty','כמות',inp('qty',draft.qty));
        h+=field('price','מחיר ליחידה ('+c+')',inp('price',draft.price));
        h+=field('fee','עמלה ('+c+')',inp('fee',draft.fee),'ברירת מחדל ל'+E.MARKETS[market].label+': '+pf.settings.fees[market]+' '+c);
        if(cur==='USD')h+=field('fxRate','שער דולר ביום העסקה',inp('fxRate',draft.fxRate),'לא חובה. מאפשר לחשב רווח בשקלים ולהפריד את השפעת הדולר.');
        h+=marketField;
      }else if(t==='fx'){
        h+=dateField;
        h+=field('from','כיוון','<select name="from"><option value="ILS"'+(draft.from!=='USD'?' selected':'')+'>משקלים לדולרים</option><option value="USD"'+(draft.from==='USD'?' selected':'')+'>מדולרים לשקלים</option></select>');
        h+=field('amount','סכום ('+(draft.from==='USD'?'$':'₪')+')',inp('amount',draft.amount));
        h+=field('rate','שער (₪ לדולר)',inp('rate',draft.rate));
      }else{
        h+=dateField;
        h+=field('amount','סכום',inp('amount',draft.amount));
        h+=field('currency','מטבע','<select name="currency"><option value="ILS"'+(draft.currency!=='USD'?' selected':'')+'>₪ שקל</option><option value="USD"'+(draft.currency==='USD'?' selected':'')+'>$ דולר</option></select>');
      }
      h+=field('note',t==='buy'?'הערה / סיבת הכניסה':t==='sell'?'הערה / סיבת היציאה':'הערה','<textarea name="note" rows="2" maxlength="2000">'+esc(draft.note)+'</textarea>');
      q('invTxFields').innerHTML=h;
      preview();
    }
    function buildTx(){
      const t=draft.type,tx={id:editing||E.uid(),type:t,date:draft.date,note:String(draft.note||'').trim()};
      if(t==='buy'||t==='sell'){
        tx.symbol=E.cleanSymbol(draft.symbol);tx.qty=parseNum(draft.qty);tx.price=parseNum(draft.price);tx.fee=parseNum(draft.fee)??0;
        const fx=parseNum(draft.fxRate);if(fx!==undefined)tx.fxRate=fx;
        const old=editing&&pf.transactions.find(x=>x.id===editing);if(old?.tradePlan)tx.tradePlan=old.tradePlan;
      }else if(t==='fx'){tx.from=draft.from==='USD'?'USD':'ILS';tx.amount=parseNum(draft.amount);tx.rate=parseNum(draft.rate);}
      else{tx.currency=draft.currency==='USD'?'USD':'ILS';tx.amount=parseNum(draft.amount);}
      return tx;
    }
    function candidateState(tx){
      const instruments={...pf.instruments};
      if(tx.symbol&&!instruments[tx.symbol]){const m=draft.market||marketFor(tx.symbol);instruments[tx.symbol]={symbol:tx.symbol,market:m,currency:E.MARKETS[m].currency,name:'',sector:'',kind:''};}
      const list=editing?pf.transactions.map(x=>x.id===editing?tx:x):[...pf.transactions,tx];
      return {...pf,instruments,transactions:list};
    }
    function preview(){
      const tx=buildTx(),box=q('invTxPreview');
      const ok=(tx.type==='buy'||tx.type==='sell')?tx.qty>0&&tx.price>0&&tx.symbol:tx.amount>0&&(tx.type!=='fx'||tx.rate>0);
      if(!ok){box.innerHTML='';return;}
      const st=candidateState(tx),r=E.compute(st,mk),info=r.txInfo[tx.id]||{};
      const flows=(info.cash||[]).map(([c,v])=>money(v,c,{signed:true})).join(' ו־');
      let h='<span>השפעה על המזומן: '+(flows||DASH)+'</span>';
      if(tx.type==='sell'&&info.realized!==undefined)h+='<span>רווח ממומש (עלות ממוצעת): '+money(info.realized,E.instrumentOf(st,tx.symbol).currency,{signed:true})+'</span>';
      if(tx.type==='sell'){const tr=r.trades.find(x=>x.id===info.tradeId);if(tr&&tr.status==='closed'&&tr.endDate===tx.date)h+='<span>העסקה נסגרת: נטו '+money(tr.net,tr.currency,{signed:true})+' ב־'+tr.days+' ימים</span>';}
      box.innerHTML=h;
    }
    function openTx(type,id){
      opener=document.activeElement;editing=id||null;feeTouched=!!id;
      const t=id&&pf.transactions.find(x=>x.id===id);
      if(t){draft={...t,market:t.symbol?E.instrumentOf(pf,t.symbol).market:undefined,qty:t.qty,price:t.price,fee:t.fee,fxRate:t.fxRate,amount:t.amount,rate:t.rate};}
      else{draft={type:type||'buy',date:E.todayIso(),note:'',currency:'ILS',from:'ILS'};draft.market='US';draft.fee=pf.settings.fees.US;}
      q('invTxTitle').textContent=t?'עריכת '+TYPE_LABEL[t.type]:'פעולה חדשה';
      q('invTxDelete').hidden=!t;
      form.querySelectorAll('.inv-seg button').forEach(b=>b.disabled=!!t&&((t.type==='buy'||t.type==='sell')!==(b.dataset.type==='buy'||b.dataset.type==='sell')));
      renderFields();overlay.hidden=false;document.body.classList.add('schedule-open');
      setTimeout(()=>form.querySelector(t?'[name="qty"],[name="amount"]':'[name="symbol"],[name="amount"]')?.focus(),30);
    }
    function closeOverlays(){overlay.hidden=true;q('invSetOverlay').hidden=true;document.body.classList.remove('schedule-open');opener?.focus?.();}
    form.addEventListener('click',e=>{
      const b=e.target.closest('.inv-seg [data-type]');if(!b||b.disabled)return;
      const prevTrade=draft.type==='buy'||draft.type==='sell';draft.type=b.dataset.type;
      if(!editing&&(draft.type==='buy'||draft.type==='sell')&&!prevTrade){draft.market=marketFor(draft.symbol);if(!feeTouched)draft.fee=pf.settings.fees[draft.market];}
      renderFields();
    });
    form.addEventListener('input',e=>{
      const n=e.target.name;if(!n)return;
      draft[n]=e.target.value;
      if(n==='fee')feeTouched=true;
      if(n==='symbol'||n==='market'){
        if(n==='symbol')draft.symbol=e.target.value.toUpperCase();
        const m=n==='market'?e.target.value:marketFor(draft.symbol);draft.market=m;
        if(!feeTouched&&!editing)draft.fee=pf.settings.fees[m];
        const pos=e.target.selectionStart;renderFields();const el=form.querySelector('[name="'+n+'"]');el?.focus();if(n==='symbol')try{el.setSelectionRange(pos,pos);}catch(_){}
        return;
      }
      if(n==='date'||n==='from'||n==='currency'){renderFields();form.querySelector('[name="'+n+'"]')?.focus();return;}
      form.querySelector('[data-err="'+n+'"]').textContent='';
      preview();
    });
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const tx=buildTx(),st=candidateState(tx);
      const errors=E.validate(st,tx,mk);
      if(!Object.keys(errors).length){
        const issue=E.compute(st,mk).issues.find(i=>!calc.issues.some(o=>o.txId===i.txId));
        if(issue)errors[(tx.type==='buy'||tx.type==='sell')?'qty':'date']='השינוי יוצר מכירה ללא אחזקה: '+issue.message;
      }
      form.querySelectorAll('[data-err]').forEach(x=>x.textContent=errors[x.dataset.err]||'');
      if(Object.keys(errors).length){form.querySelector('[data-field="'+Object.keys(errors)[0]+'"] input,[data-field="'+Object.keys(errors)[0]+'"] select')?.focus();return;}
      pf=E.normalize(st);persist();closeOverlays();refresh();
      if(tx.type==='buy'||tx.type==='sell'){const tr=calc.txInfo[tx.id]?.tradeId;if(tr)ui.open.add(tr);renderLog();}
      toast(editing?'הפעולה עודכנה':'הפעולה נשמרה');
    });
    q('invTxDelete').addEventListener('click',()=>{const id=editing;closeOverlays();removeTx(id);});
    document.querySelectorAll('[data-inv-close]').forEach(b=>b.addEventListener('click',closeOverlays));
    ['invTxOverlay','invSetOverlay'].forEach(id=>q(id).addEventListener('pointerdown',e=>{if(e.target===q(id))closeOverlays();}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!overlay.hidden||!q('invSetOverlay').hidden)){e.preventDefault();closeOverlays();}});

    // Deleting keeps a one-step undo; nothing is lost silently.
    function removeTx(id){
      const idx=pf.transactions.findIndex(t=>t.id===id);if(idx<0)return;
      const removed=pf.transactions[idx],next={...pf,transactions:pf.transactions.filter(t=>t.id!==id)};
      const broken=E.compute(next,mk).issues.filter(i=>!calc.issues.some(o=>o.txId===i.txId));
      if(broken.length&&!confirm('מחיקת הפעולה תשאיר מכירה בלי אחזקה ('+broken[0].message+'). למחוק בכל זאת?'))return;
      pf=next;persist();refresh();
      toast(TYPE_LABEL[removed.type]+(removed.symbol?' '+removed.symbol:'')+' נמחקה',()=>{pf={...pf,transactions:[...pf.transactions.slice(0,idx),removed,...pf.transactions.slice(idx)]};persist();refresh();toast('המחיקה בוטלה');});
    }
    let toastTimer=null;
    function toast(text,undo){
      const t=q('invToast');t.querySelector('span').textContent=text;const b=t.querySelector('button');
      b.hidden=!undo;b.onclick=()=>{t.hidden=true;undo&&undo();};t.hidden=false;
      clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},undo?7000:2600);
    }

    // ---------- settings ----------
    function openSettings(){
      opener=document.activeElement;
      const f=q('invSetForm');
      f.querySelector('.inv-grid').innerHTML=Object.entries(E.MARKETS).map(([k,m])=>field(k,'עמלה לפעולה ב'+m.label+' ('+CUR_LABEL[m.currency]+')',inp(k,pf.settings.fees[k]))).join('');
      q('invSetOverlay').hidden=false;document.body.classList.add('schedule-open');f.querySelector('input')?.focus();
    }
    q('invSetForm').addEventListener('submit',e=>{
      e.preventDefault();const f=e.currentTarget,fees={...pf.settings.fees};let bad=false;
      for(const k of Object.keys(E.MARKETS)){const v=parseNum(f.querySelector('[name="'+k+'"]').value);const err=f.querySelector('[data-err="'+k+'"]');
        if(!(v>=0)){err.textContent='0 או יותר';bad=true;}else{err.textContent='';fees[k]=v;}}
      if(bad)return;
      pf={...pf,settings:{...pf.settings,fees}};persist();closeOverlays();refresh();toast('ברירות המחדל עודכנו. פעולות קיימות לא השתנו.');
    });

    // ---------- page events ----------
    root.addEventListener('click',e=>{
      const el=e.target.closest('[data-act]');if(!el)return;
      const act=el.dataset.act;
      if(act==='add')openTx(el.dataset.type);
      else if(act==='edit')openTx(null,el.dataset.id);
      else if(act==='delete')removeTx(el.dataset.id);
      else if(act==='toggle'){const id=el.dataset.id;ui.open.has(id)?ui.open.delete(id):ui.open.add(id);if(ui.logMode!=='trades')ui.logMode='trades';renderLog();
        if(el.tagName==='rect'){activateView('log');q('investBody-log').querySelector('[data-id="'+id+'"].inv-trade')?.scrollIntoView({block:'center'});}}
      else if(act==='ui'){ui[el.dataset.key]=el.dataset.val;refresh();}
      else if(act==='sort'){const k=el.dataset.key;ui.sort=ui.sort.key===k?{key:k,dir:-ui.sort.dir}:{key:k,dir:k==='symbol'?1:-1};renderLog();}
      else if(act==='del-snap'){const id=el.dataset.id,i=pf.snapshots.findIndex(s=>s.id===id),rem=pf.snapshots[i];if(i<0)return;pf={...pf,snapshots:pf.snapshots.filter(s=>s.id!==id)};persist();refresh();
        toast('רישום השווי נמחק',()=>{pf={...pf,snapshots:[...pf.snapshots,rem]};persist();refresh();});}
      else if(act==='import')q('invImportFile').click();
      else if(act==='export-xlsx')exportXlsx();
      else if(act==='backup')downloadBackup();
      else if(act==='restore')q('invRestoreFile').click();
      else if(act==='settings')openSettings();
      if(el.closest('#invMenu'))setMenu(false);
    });
    root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-act="toggle"]')){e.preventDefault();e.target.click();}});
    root.addEventListener('input',e=>{if(e.target.id==='invSearch'){ui.search=e.target.value;const pos=e.target.selectionStart;renderLog();const s=q('invSearch');s.focus();s.setSelectionRange(pos,pos);}});
    root.addEventListener('change',e=>{
      const el=e.target;
      if(el.dataset.act==='price'||el.dataset.act==='fx'){
        const v=parseNum(el.value),now=E.todayIso();
        if(el.value.trim()===''){if(el.dataset.act==='price')delete mk.quotes[el.dataset.symbol];else delete mk.fx.USDILS;}
        else if(!(v>0)){el.setCustomValidity('ערך חיובי');el.reportValidity();return;}
        else if(el.dataset.act==='price')mk.quotes[el.dataset.symbol]={price:v,asOf:now,source:'manual'};
        else mk.fx.USDILS={rate:v,asOf:now,source:'manual'};
        persist();refresh();
      }
    });
    root.addEventListener('submit',e=>{
      const f=e.target;if(f.dataset.form!=='snapshot')return;e.preventDefault();
      const value=parseNum(f.elements.value.value),d=f.elements.date.value,msg=f.querySelector('.inv-form-msg');
      if(!(value>=0)){msg.textContent='שווי לא תקין';return;}
      if(!E.isDate(d)||d>E.todayIso()){msg.textContent='תאריך לא תקין';return;}
      const existing=pf.snapshots.find(s=>s.date===d);
      if(existing&&!confirm('כבר נרשם שווי ל־'+d+'. להחליף אותו?'))return;
      pf={...pf,snapshots:[...pf.snapshots.filter(s=>s.date!==d),{id:E.uid('s'),date:d,value,currency:'ILS',note:''}]};
      persist();refresh();toast('השווי נרשם');
    });
    q('invAdd').addEventListener('click',()=>openTx('buy'));
    const menuBtn=q('invMenuBtn'),menu=q('invMenu');
    function setMenu(open){menu.hidden=!open;menuBtn.setAttribute('aria-expanded',String(open));}
    menuBtn.addEventListener('click',()=>setMenu(menu.hidden));
    document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('.invest-menu'))setMenu(false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){setMenu(false);menuBtn.focus();}});
    function activateView(v){q('investTab-'+v)?.click();}
    // Charts measure their container; redraw when a view becomes visible or the window size changes.
    window.addEventListener('anav:invest-view',()=>{if(calc)refresh();});
    let rz=null;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(!root.hidden&&calc)refresh();},150);});

    // ---------- backup / restore ----------
    function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
    function downloadBackup(){
      const data={format:'anav-portfolio-backup',version:1,exportedAt:new Date().toISOString(),portfolio:pf,market:mk};
      download('anav-portfolio-'+E.todayIso()+'.json',new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));
    }
    q('invRestoreFile').addEventListener('change',async e=>{
      const file=e.target.files[0];e.target.value='';if(!file)return;
      try{
        const data=JSON.parse(await file.text());
        if(data?.format!=='anav-portfolio-backup')throw Error('זה לא קובץ גיבוי של תיק ההשקעות');
        const next=E.normalize(data.portfolio);
        if(!confirm('לשחזר '+next.transactions.length+' פעולות ו־'+next.snapshots.length+' רישומי שווי? הנתונים הנוכחיים יוחלפו (עותק שלהם נשמר בדפדפן).'))return;
        try{localStorage.setItem(PREV_KEY,JSON.stringify({savedAt:new Date().toISOString(),portfolio:pf,market:mk}));}catch(_){}
        pf=next;mk=normalizeMarket(data.market);persist();refresh();toast('הגיבוי שוחזר');
      }catch(err){toast('השחזור נכשל: '+(err.message||'קובץ לא תקין'));}
    });

    // ---------- Excel import: preview first, then one confirmed write with undo ----------
    document.body.insertAdjacentHTML('beforeend','<div class="tool-overlay inv-overlay" id="invImpOverlay" hidden><section class="tool-dialog inv-dialog inv-import" role="dialog" aria-modal="true" aria-labelledby="invImpTitle">'+
      '<header class="tool-head"><div><h2 id="invImpTitle">ייבוא מאקסל</h2><p id="invImpSub"></p></div><button type="button" class="tool-close" data-imp-close aria-label="סגירה">×</button></header>'+
      '<div class="tool-content inv-imp-body" id="invImpBody"></div>'+
      '<footer class="inv-imp-foot"><span id="invImpSum" aria-live="polite"></span><button type="button" class="inv-ghost" data-imp-close>ביטול</button><button type="button" class="tool-primary" id="invImpGo">ייבוא</button></footer></section></div>');
    const STATUS={new:['חדש','inv-st-new'],dup:['קיים','inv-st-dup'],error:['שגיאה','inv-st-err'],conflict:['התנגשות','inv-st-warn'],skip:['דילוג','inv-st-dup']};
    let imp=null;
    q('invImportFile').addEventListener('change',async e=>{
      const file=e.target.files[0];e.target.value='';if(!file)return;
      try{await openImport(file.name,await file.arrayBuffer());}
      catch(err){toast('לא הצלחתי לקרוא את הקובץ: '+(err.message||err));}
    });
    async function openImport(name,buffer){
      opener=document.activeElement;
      const wb=ExcelImport.readWorkbook(await ExcelImport.unzip(buffer));
      imp={file:name,plan:ExcelImport.plan(pf,wb,mk),active:0,filter:'all'};
      imp.active=Math.max(0,imp.plan.sheets.findIndex(s=>s.kind));
      renderImport();q('invImpOverlay').hidden=false;document.body.classList.add('schedule-open');q('invImpGo').focus();
    }
    function impCell(sh,r){
      const x=r.excel||{},rec=r.record||{};
      if(sh.kind==='trades')return [rec.date?date(rec.date):esc(x.date),esc(x.type),rec.symbol?sym(rec.symbol):esc(x.symbol),num(x.qty),num(x.price),rec.fee!==undefined?num(rec.fee):DASH];
      if(sh.kind==='cashflows')return [rec.date?date(rec.date):esc(x.date),esc(x.type),'',num(x.amount),'',''];
      if(sh.kind==='equity')return [rec.date?date(rec.date):esc(x.date),'','',num(x.value,2),'',''];
      return ['',rec.fx?'שער דולר':'מחיר',esc(x.symbol),num(x.price,4),'',''];
    }
    function renderImport(){
      const P=imp.plan,sheets=P.sheets;
      q('invImpSub').textContent=imp.file+' · שום דבר לא נשמר עד שלוחצים "ייבוא", ואפשר לבטל גם אחרי.';
      let h='<div class="inv-imp-sheets" role="list">';
      sheets.forEach((sh,i)=>{
        const c=ExcelImport.counts(sh),on=sh.include!==false;
        const chips=sh.kind?'<span class="inv-imp-counts">'+(c.new?'<i class="inv-st-new">'+c.new+' חדשות</i>':'')+(c.dup?'<i class="inv-st-dup">'+c.dup+' קיימות</i>':'')+(c.conflict?'<i class="inv-st-warn">'+c.conflict+' התנגשויות</i>':'')+(c.error?'<i class="inv-st-err">'+c.error+' שגיאות</i>':'')+(c.skip?'<i class="inv-st-dup">'+c.skip+' דילוג</i>':'')+'</span>':'';
        h+='<div class="inv-imp-sheet'+(i===imp.active?' is-active':'')+(sh.kind?'':' is-off')+(on?'':' is-excluded')+'" role="listitem">'+
          (sh.kind?'<label class="inv-imp-check" title="לכלול בייבוא"><input type="checkbox" data-imp-include="'+i+'"'+(on?' checked':'')+'><span class="inv-sr">לייבא את '+esc(sh.name)+'</span></label>':'')+
          '<button type="button" class="inv-imp-sheet-btn" data-imp-sheet="'+i+'"'+(sh.kind?'':' disabled')+'><strong>'+esc(sh.name)+'</strong><small>'+(sh.kind?sh.label:'לא זוהה, לא ייובא')+'</small>'+chips+'</button></div>';
      });
      h+='</div>';
      const sh=sheets[imp.active];
      if(sh&&sh.kind){
        if(sh.notes.length)h+='<ul class="inv-imp-notes">'+sh.notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>';
        const c=ExcelImport.counts(sh);
        h+='<div class="inv-toolbar"><div class="inv-chips" role="group" aria-label="סינון שורות">'+
          [['all','הכול ('+sh.rows.length+')'],['new','חדשות ('+c.new+')'],['problem','לבדיקה ('+(c.error+c.conflict)+')'],['dup','קיימות ('+(c.dup+c.skip)+')']].map(([k,l])=>'<button type="button" class="inv-chip" data-imp-filter="'+k+'" aria-pressed="'+(imp.filter===k)+'">'+l+'</button>').join('')+'</div></div>';
        const rows=sh.rows.filter(r=>imp.filter==='all'||(imp.filter==='new'&&r.status==='new')||(imp.filter==='problem'&&(r.status==='error'||r.status==='conflict'))||(imp.filter==='dup'&&(r.status==='dup'||r.status==='skip')));
        const heads=sh.kind==='trades'?['תאריך','סוג','נייר','כמות','מחיר','עמלה']:sh.kind==='cashflows'?['תאריך','סוג','','סכום','','']:sh.kind==='equity'?['תאריך','','','שווי','','']:['','','נייר','מחיר','',''];
        h+=rows.length?'<div class="inv-table-wrap inv-imp-table"><table class="inv-table"><thead><tr><th>שורה</th>'+heads.map(x=>'<th>'+x+'</th>').join('')+'<th>מצב</th><th>הערה</th></tr></thead><tbody>'+
          rows.slice(0,400).map(r=>{const st=STATUS[r.status]||STATUS.skip;return '<tr><td>'+num(r.row)+'</td>'+impCell(sh,r).map(x=>'<td>'+(x||'')+'</td>').join('')+'<td><span class="inv-st '+st[1]+'">'+st[0]+'</span></td><td class="inv-note">'+esc([r.message,r.note].filter(Boolean).join(' · '))+'</td></tr>';}).join('')+
          '</tbody></table></div>'+(rows.length>400?'<p class="inv-none">מוצגות 400 השורות הראשונות מתוך '+rows.length+'.</p>':''):'<p class="inv-none">אין שורות בסינון הזה.</p>';
      }
      q('invImpBody').innerHTML=h;
      const c=ExcelImport.merge(pf,P).counts;
      const parts=[c.transactions&&c.transactions+' פעולות',c.snapshots&&c.snapshots+' רישומי שווי',c.prices&&c.prices+' מחירים'].filter(Boolean);
      q('invImpSum').textContent=parts.length?'ייובאו: '+parts.join(', '):'אין שורות חדשות לייבוא';
      q('invImpGo').disabled=!parts.length;
    }
    q('invImpOverlay').addEventListener('click',e=>{
      const s=e.target.closest('[data-imp-sheet]');if(s){imp.active=+s.dataset.impSheet;imp.filter='all';renderImport();return;}
      const f=e.target.closest('[data-imp-filter]');if(f){imp.filter=f.dataset.impFilter;renderImport();return;}
      if(e.target.closest('[data-imp-close]'))closeImport();
    });
    q('invImpOverlay').addEventListener('change',e=>{
      const i=e.target.dataset.impInclude;if(i===undefined)return;
      imp.plan.sheets[+i].include=e.target.checked;ExcelImport.revalidate(pf,imp.plan);renderImport();
    });
    q('invImpOverlay').addEventListener('pointerdown',e=>{if(e.target===q('invImpOverlay'))closeImport();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('invImpOverlay').hidden){e.preventDefault();closeImport();}});
    function closeImport(){q('invImpOverlay').hidden=true;document.body.classList.remove('schedule-open');imp=null;opener?.focus?.();}
    q('invImpGo').addEventListener('click',()=>{
      if(!imp)return;
      const m=ExcelImport.merge(pf,imp.plan),before={pf,mk:JSON.parse(JSON.stringify(mk))};
      try{localStorage.setItem(PREV_KEY,JSON.stringify({savedAt:new Date().toISOString(),reason:'import',portfolio:pf,market:mk}));}catch(_){}
      pf=E.normalize(m.state);
      // Prices from the sheet never replace a price already entered on the site.
      for(const [sy,price] of Object.entries(m.quotes))if(!mk.quotes[sy])mk.quotes[sy]={price,asOf:'',source:'excel'};
      if(m.fx&&!mk.fx.USDILS)mk.fx.USDILS={rate:m.fx,asOf:'',source:'excel'};
      persist();closeImport();refresh();
      const c=m.counts;
      toast('יובאו '+c.transactions+' פעולות ו־'+c.snapshots+' רישומי שווי',()=>{pf=before.pf;mk=before.mk;persist();refresh();toast('הייבוא בוטל');});
    });

    // ---------- Excel export: real numbers and dates, one sheet per table ----------
    function exportXlsx(){
      const c=calc,D=d=>d?{d}:'',M=v=>v===null||v===undefined?'':{n:v/100},N=v=>v===null||v===undefined?'':{n:v},P=v=>v===null||v===undefined||!Number.isFinite(v)?'':{p:v/100};
      const sheets=[];
      sheets.push({name:'פעולות',rows:[['תאריך','פעולה','נייר','שוק','מטבע','כמות','מחיר','עמלה','שער דולר','השפעה על מזומן ₪','השפעה על מזומן $','רווח ממומש','רווח ממומש ₪','מזהה עסקה','הערה'],
        ...E.ordered(pf.transactions).map(t=>{const i=c.txInfo[t.id]||{},tr=t.type==='buy'||t.type==='sell',ins=tr?E.instrumentOf(pf,t.symbol):null,f=Object.fromEntries(i.cash||[]);
          return [D(t.date),TYPE_LABEL[t.type],t.symbol||'',ins?E.MARKETS[ins.market].label:'',ins?ins.currency:t.type==='fx'?t.from:t.currency,tr?N(t.qty):'',tr?N(t.price):t.type==='fx'?N(t.rate):'',tr?N(t.fee):'',N(t.fxRate),M(f.ILS),M(f.USD),M(i.realized),M(i.realizedIls),i.tradeId||'',t.note];})]});
      sheets.push({name:'עסקאות',rows:[['נייר','מצב','פתיחה','סגירה','ימים','קניות','מכירות','כמות מרבית','השקעה','תמורה','עמלות','נטו','ברוטו','תשואה','מטבע'],
        ...c.trades.map(t=>[t.symbol,t.status==='open'?'פתוחה':'סגורה',D(t.startDate),D(t.endDate),N(t.days),N(t.buys),N(t.sells),N(t.maxQty),M(t.buyCost),M(t.sellProceeds),M(t.fees),M(t.net),M(t.gross),P(t.returnPct),t.currency])]});
      sheets.push({name:'אחזקות',rows:[['נייר','שוק','מטבע','כמות','עלות ממוצעת','עלות','מחיר','תאריך מחיר','שווי','רווח לא ממומש','רווח %','שווי ₪','משקל (כולל מזומן)'],
        ...c.holdings.map(h=>[h.symbol,E.MARKETS[h.market].label,h.currency,N(h.qty),N(h.avgCost),M(h.cost),N(h.price),D(h.priceAsOf),M(h.value),M(h.unrealized),P(h.unrealizedPct),M(h.valueIls),P(h.weight)]),
        [],['מזומן ₪',M(c.cash.ILS)],['מזומן $',M(c.cash.USD)],['שער דולר',N(c.usdIls)],['שווי תיק ₪',M(c.totalIls)]]});
      sheets.push({name:'שווי חשבון',rows:[['תאריך','שווי','הפקדה / משיכה','הפקדות נטו','רווח / הפסד','שינוי מהרישום הקודם'],
        ...c.performance.rows.map(r=>[D(r.date),M(r.value),M(r.flow||null),M(r.netDeposits),M(r.profit),P(r.daily)])]});
      const s=c.summary,u=s.byCurrency.USD,i=s.byCurrency.ILS;
      sheets.push({name:'סיכום',rows:[['מדד','ערך','הגדרה'],['עסקאות',N(s.trades),'מהקנייה הראשונה ועד שהכמות חוזרת לאפס'],['סגורות',N(s.closed),''],['פתוחות',N(s.open),''],['ניירות שונים',N(s.symbols),''],
        ['אחוז הצלחה',P(s.winRate),'עסקאות סגורות עם נטו חיובי ÷ כל הסגורות'],['ממוצע ימי החזקה',N(s.avgDaysClosed),'עסקאות סגורות בלבד'],
        ['נטו $',M(u.net),'תמורות פחות השקעות, אחרי כל העמלות'],['עמלות $',M(u.fees),''],['נפח קניות $',M(u.buyVolume),''],['נפח מכירות $',M(u.sellVolume),''],
        ['נטו ₪',M(i.net),''],['עמלות ₪',M(i.fees),''],['תשואה מצטברת (TWR)',P(c.performance.twr),'שרשור תשואות יומיות לפי רישומי השווי'],['הופק',D(E.todayIso()),'']]});
      download('anav-investments-'+E.todayIso()+'.xlsx',xlsx(sheets));
    }
    function xlsx(sheets){
      const x=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
      const col=i=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
      const serial=d=>(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))-Date.UTC(1899,11,30))/864e5;
      const cell=(v,r,c,head)=>{const a=col(c)+(r+1);if(v===''||v===null||v===undefined)return '';
        if(head)return '<c r="'+a+'" s="1" t="inlineStr"><is><t>'+x(v)+'</t></is></c>';
        if(typeof v==='object'&&'d' in v)return '<c r="'+a+'" s="2"><v>'+serial(v.d)+'</v></c>';
        if(typeof v==='object'&&'n' in v)return '<c r="'+a+'" s="3"><v>'+v.n+'</v></c>';
        if(typeof v==='object'&&'p' in v)return '<c r="'+a+'" s="4"><v>'+v.p+'</v></c>';
        return '<c r="'+a+'" t="inlineStr"><is><t xml:space="preserve">'+x(v)+'</t></is></c>';};
      const sheetXml=rows=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="20" width="15" customWidth="1"/></cols><sheetData>'+
        rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((v,c)=>cell(v,r,c,r===0)).join('')+'</row>').join('')+'</sheetData></worksheet>';
      const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
      const files=[
        ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'],
        ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
        ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="'+rel+'"><sheets>'+sheets.map((s,i)=>'<sheet name="'+x(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+rel+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="'+rel+'/styles" Target="styles.xml"/></Relationships>'],
        ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEBE8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>'],
        ...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheetXml(s.rows)])
      ];
      return new Blob([zip(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    }
    // Minimal STORE-method ZIP writer (no compression, no dependencies).
    function zip(files){
      const enc=new TextEncoder(),table=new Uint32Array(256);
      for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[n]=c>>>0;}
      const crc=b=>{let c=0xFFFFFFFF;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
      const parts=[],central=[];let off=0;
      const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
      for(const [name,text] of files){
        const nb=enc.encode(name),data=enc.encode(text),c=crc(data);
        const head=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(c),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0)]);
        parts.push(head,nb,data);
        central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(c),...u32(data.length),...u32(data.length),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nb);
        off+=head.length+nb.length+data.length;
      }
      const size=central.reduce((s,p)=>s+p.length,0);
      return new Blob([...parts,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(size),...u32(off),...u16(0)])]);
    }

    refresh();
  })();
