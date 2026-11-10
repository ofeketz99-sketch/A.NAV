
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

(function(){
  'use strict';
  const app=document.getElementById('financeApp');
  const q=id=>document.getElementById(id);
  const num=new Intl.NumberFormat('he-IL',{maximumFractionDigits:0});
  // Text shown inside number inputs: at most two decimals, so values like 30.4166666 stay readable.
  const inputText=v=>{const n=Number(v);return Number.isFinite(n)?String(Number(n.toFixed(2))):String(v);};
  const money=n=>(n<0?'−':'')+'₪'+num.format(Math.round(Math.abs(Number.isFinite(n)?n:0)));
  const compactMoney=n=>{
    const val=Math.abs(Number.isFinite(n)?n:0),sign=n<0?'−':'';
    if(val>=1e9)return sign+(val/1e9).toFixed(val>=10e9?0:1).replace(/\.0$/,'')+'B';
    if(val>=1e6)return sign+(val/1e6).toFixed(val>=10e6?0:1).replace(/\.0$/,'')+'M';
    if(val>=1e3)return sign+(val/1e3).toFixed(val>=10e3?0:1).replace(/\.0$/,'')+'K';
    return sign+String(Math.round(val));
  };
  const count=n=>num.format(Math.round(n));
  const pct=n=>(Number.isFinite(n)?n:0).toFixed(1)+'%';
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // A compact 1/2/5 scale, adapted to the number currently shown.
  // Examples: 700 -> 50; 7.5% -> 0.5; 500,000 -> 50,000.
  function adaptiveArrowStep(value,unit,zeroStep=1){
    const magnitude=Math.abs(Number(value));
    const whole=unit==='שנים'||unit==='חודשים';
    const floor=whole?1:0.01;
    if(!Number.isFinite(magnitude)||magnitude===0)return Math.max(floor,Number(zeroStep)||floor);
    const scale=Math.pow(10,Math.floor(Math.log10(magnitude)));
    const digit=magnitude/scale;
    let step=(digit>=5?0.5:digit>=2?0.2:0.1)*scale;
    step=whole?Math.max(1,Math.round(step)):Math.max(floor,step);
    return Number(step.toPrecision(12));
  }
  function adaptiveArrowValue(value,direction,unit,min,max,zeroStep=1){
    const current=Number.isFinite(Number(value))?Number(value):0;
    const increment=adaptiveArrowStep(current,unit,zeroStep);
    return clamp(Number((current+(direction>0?1:-1)*increment).toFixed(10)),min,max);
  }
  const fields=(...xs)=>xs;

  // Default text is shortened for display only; custom labels remain untouched.
  function compactFieldLabel(value){
    const defaults={
      'הכנסה נטו של משק הבית':'הכנסה נטו',
      'שכירות / משכנתא':'דיור',
      'חשבונות והוצאות בית':'חשבונות',
      'מחיה, קניות ותחבורה':'מחיה ותחבורה',
      'הפרשה חודשית לחיסכון':'חיסכון חודשי',
      'תקופת המשכנתא':'תקופה',
      'תקופת ההחזר':'תקופה',
      'החזר נוסף בכל חודש':'החזר נוסף',
      'ריבית שנתית משוערת':'ריבית שנתית',
      'תשואה שנתית נומינלית':'תשואה שנתית',
      'מספר שנות חיסכון':'תקופה',
      'משך ההשקעה':'תקופה',
      'יעד תיק השקעות':'יעד השקעה'
    };
    return defaults[value]||value;
  }
  const helpText={
    mortgage:{price:'מחיר הנכס, לפני עלויות העסקה.',equity:'הון עצמי זמין, ללא הוצאות רכישה.',rate:'ריבית לסימולציה; בפועל תלויה במסלול הבנק.',years:'תקופה ארוכה מפחיתה החזר ומגדילה ריבית.',extra:'החזר נוסף עשוי לקצר את ההלוואה. לא כולל עמלת פירעון.'},
    savings:{rate:'תשואה שנתית משוערת עם צבירה חודשית; אינה מובטחת.',goal:'יעד נומינלי מחושב בהנחת תשואה קבועה. אפשר לנעול אותו ולפתור משתנה אחר.'},
    index:{goal:'יעד שווי נומינלי לפני מס ובלא קיזוז אינפלציה. נעילת היעד תחשב משתנה נבחר.',rate:'ממוצע שנתי משוער, לפני אינפלציה. היסטורית מדד S&P 500 הניב בערך 10% לשנה בדולרים כולל דיבידנדים לאורך עשרות שנים, אך לא ברצף ולא כהבטחה.',fees:'דמי ניהול מקטינים את הצמיחה המצטברת.',inflation:'שחיקת כוח הקנייה; משמשת לחישוב ערך בכסף של היום.'},
    loan:{months:'בחרו את מספר חודשי ההחזר. כל צעד בסליידר הוא חודש אחד.',rate:'ריבית נומינלית שנתית; חישוב חודשי לפי חלוקה ב־12.',extra:'תשלום נוסף להפחתת קרן, לפני עמלות פירעון.'},
    budget:{spending:'הוצאות נוספות.',savings:'חיסכון חודשי.'}
  };
  const secondaryFields={mortgage:['extra'],savings:[],index:['fees','inflation'],loan:['extra'],budget:[]};
  const loanTermYears=s=>Number.isFinite(s?.months)?s.months/12:(Number.isFinite(s?.years)?s.years:5);
  const configs={
    mortgage:{title:'מחשבון משכנתא',subtitle:'החזר משכנתא.',foot:'ריבית קבועה לא צמודה · עלויות נוספות בהגדרות מתקדמות.',fields:fields(
      ['price','מחיר הדירה',800000,5000000,50000,2400000,'₪'],
      ['equity','הון עצמי',0,5000000,25000,300000,'₪'],
      ['rate','ריבית שנתית',1,10,.1,4.8,'%'],
      ['years','תקופה',5,30,1,30,'שנים'],
      ['extra','החזר נוסף',0,5000,100,0,'₪']
    )},
    savings:{title:'מחשבון חיסכון',subtitle:'חיסכון לאורך זמן.',foot:'צבירה חודשית · לפני מס.',fields:fields(
      ['initial','סכום התחלתי',0,500000,5000,20000,'₪'],
      ['monthly','הפקדה חודשית',0,15000,250,2000,'₪'],
      ['years','תקופה',1,80,1,15,'שנים'],
      ['rate','תשואה שנתית',0,12,.25,3.5,'%'],
      ['goal','יעד החיסכון',1000,50000000,25000,500000,'₪']
    )},
    index:{title:'מחשבון השקעה במדד',subtitle:'השקעה במדד.',foot:'סימולציה בשקלים, ללא שינוי מטבע ועמלות מסחר. מס בהגדרות מתקדמות.',fields:fields(
      ['goal','יעד השקעה',1000,1000000,25000,500000,'₪'],
      ['initial','השקעה התחלתית',0,500000,5000,30000,'₪'],
      ['monthly','השקעה חודשית',0,15000,250,1500,'₪'],
      ['years','תקופה',1,80,1,20,'שנים'],
      ['rate','תשואה שנתית',-5,15,.5,7,'%'],
      ['fees','דמי ניהול שנתיים',0,2,.05,.2,'%'],
      ['inflation','אינפלציה שנתית',0,6,.25,2.5,'%']
    )},
    loan:{title:'מחשבון הלוואה',subtitle:'חישוב החזר וריבית.',foot:'מודל שפיצר · תקופת הלוואה בחודשים · ריבית קבועה · ללא הצמדה ועמלות.',fields:fields(
      ['principal','סכום ההלוואה',5000,500000,5000,85000,'₪'],
      ['rate','ריבית שנתית',0,20,.25,7.25,'%'],
      ['months','תקופה',1,180,1,60,'חודשים'],
      ['extra','תשלום נוסף בחודש',0,5000,100,0,'₪']
    )},
    budget:{title:'מחשבון תקציב',subtitle:'הכנסות והוצאות.',foot:'הסכומים חודשיים.',fields:fields(
      ['income','הכנסה נטו',2000,50000,500,18000,'₪'],
      ['housing','דיור',0,20000,100,6100,'₪'],
      ['bills','חשבונות',0,10000,100,1400,'₪'],
      ['living','מחיה ותחבורה',0,20000,250,5500,'₪'],
      ['spending','בזבוזים',0,15000,100,0,'₪'],
      ['savings','חיסכון חודשי',0,15000,250,2000,'₪']
    )}
  };
  // Each calculator keeps its own inputs. The same snapshot is also stored locally
  // so that values survive tab changes, refreshes and reopening the file.
  const STORAGE_KEY='mirvach.finance.calculators.v1';
  let active='mortgage';
  const states={};
  for (const [key,c] of Object.entries(configs)) states[key]=Object.fromEntries(c.fields.map(f=>[f[0],f[5]]));
  states.mortgage.kind='first';
  const allowedKinds=['first','upgrade','invest'];
  const defaultOrder=Object.keys(configs);
  const tabLabels={mortgage:'משכנתא',savings:'חיסכון',index:'השקעה ב־S&P 500',loan:'הלוואה',budget:'תקציב חודשי'};
  const fieldLabels=Object.fromEntries(defaultOrder.map(tab=>[tab,{}]));
  // Missing entries keep the original (factory) reset point.
  const resetPoints=Object.fromEntries(defaultOrder.map(tab=>[tab,{}]));
  function getResetPoint(tab,id){
    const config=configs[tab]?.fields.find(f=>f[0]===id);
    if(!config)return 0;
    const override=resetPoints[tab]?.[id];
    return typeof override==='number'&&Number.isFinite(override)?override:config[5];
  }

  const fieldOrder=Object.fromEntries(defaultOrder.map(tab=>[tab,configs[tab].fields.map(f=>f[0])]));
  // Put the target near the top for first-time users while preserving saved custom order.
  for(const tab of ['savings','index'])fieldOrder[tab]=['goal',...fieldOrder[tab].filter(id=>id!=='goal')];
  let tabOrder=[...defaultOrder];
  let notesText=''; // Existing shared notebook, including notes created in older versions.
  let notesMode='shared';
  const notesByTab=Object.fromEntries(defaultOrder.map(tab=>[tab,'']));
  let notesCollapsed=true;
  const advanced={mortgage:{insurance:0,purchaseCosts:0,stressRise:0,income:0},index:{taxEnabled:false,taxRate:25},budget:{annualItems:[]}};
  const scenarios=Object.fromEntries(defaultOrder.map(tab=>[tab,[]]));
  const compareIds=Object.fromEntries(defaultOrder.map(tab=>[tab,null]));
  const chartModes={savings:false,index:false};
  let budgetFlowMode=false;
  const riskSettings={enabled:false,volatility:18};
  const goalPlans={savings:{locked:false,solve:'monthly'},index:{locked:false,solve:'monthly'}};
  const goalFeedback={savings:null,index:null};
  const goalManuals={savings:null,index:null};
  const goalSolveChoices=[['monthly','הפקדה חודשית'],['years','משך ההשקעה'],['initial','השקעה התחלתית'],['rate','תשואה שנתית']];
  const goalPinned={savings:[],index:[]};
  // Original five accents are preserved exactly; ten extra tones share the same quiet palette.
  const accentBank=[
    // Ordered around the color wheel, from warm earth to green, blue, violet;
    // the achromatic charcoal is deliberately last. IDs remain stable for saved palettes.
    {id:'clay',name:'חמרה כהה',dark:'#744f4d',soft:'#ecddda'},
    {id:'terracotta',name:'טרקוטה',dark:'#935d47',soft:'#f2e3d9'},
    {id:'cognac',name:'קוניאק',dark:'#7a5136',soft:'#eee0d3'},
    {id:'sand',name:'חול עמוק',dark:'#806b58',soft:'#ece3d9'},
    {id:'bronze',name:'ענבר',dark:'#9b6623',soft:'#f1e3cc'},
    {id:'moss',name:'טחב',dark:'#626a42',soft:'#e9eadc'},
    {id:'olive',name:'ירוק עלה',dark:'#4f7a45',soft:'#dfead9'},
    {id:'forest',name:'יער',dark:'#3c6152',soft:'#e1ece5'},
    {id:'teal',name:'טורקיז מעושן',dark:'#396c68',soft:'#dfedeb'},
    {id:'ocean',name:'אוקיינוס',dark:'#2f6f7a',soft:'#d6eaed'},
    {id:'slate',name:'צפחה',dark:'#505e6f',soft:'#e2e7ec'},
    {id:'indigo',name:'אינדיגו',dark:'#3f4f8f',soft:'#dde3f4'},
    {id:'plum',name:'שזיף',dark:'#7d4a6b',soft:'#efdde8'},
    {id:'wine',name:'בורדו',dark:'#76495b',soft:'#efdee5'},
    {id:'charcoal',name:'פחם',dark:'#1f2528',soft:'#e6e0d6'}
  ];
  const legacyTabColors={mortgage:'charcoal',savings:'cognac',index:'olive',loan:'clay',budget:'ocean'};
  const defaultTabColors={mortgage:'indigo',savings:'bronze',index:'olive',loan:'plum',budget:'ocean'};
  const tabColors={...defaultTabColors};
  function applyTabAccent(){
    const tone=accentBank.find(x=>x.id===tabColors[active])||accentBank[0];
    app.style.setProperty('--accent',tone.dark);
    app.style.setProperty('--accent-soft',tone.soft);
    app.style.setProperty('--ambient',tone.dark);
    document.querySelectorAll('.tab').forEach(b=>{
      const t=accentBank.find(x=>x.id===tabColors[b.dataset.tab]);
      if(t){b.style.setProperty('--tab-accent',t.dark);b.style.setProperty('--tab-accent-soft',t.soft);}
    });
    const chip=q('paletteChip');if(chip)chip.style.background=tone.dark;
    const button=q('paletteToggle');if(button)button.title='צבע הלשונית: '+tone.name+' · לחץ להחלפה';
  }
  function renderPalette(){
    const current=accentBank.find(x=>x.id===tabColors[active]);
    q('paletteCurrent').textContent='לשונית: '+tabLabels[active]+' · צבע נוכחי: '+current.name;
    q('paletteGrid').innerHTML=accentBank.map(tone=>{
      const owner=defaultOrder.find(t=>tabColors[t]===tone.id);
      const selected=owner===active,blocked=!!owner&&!selected;
      const subtitle=selected?'נבחר ללשונית זו':blocked?'תפוס: '+tabLabels[owner]:'פנוי';
      const accessible=tone.name+', '+subtitle;
      return `<button type="button" class="palette-choice ${selected?'is-selected':''} ${blocked?'is-occupied':''}" data-color="${tone.id}" aria-label="${escapeHtml(accessible)}" aria-pressed="${selected}" title="${escapeHtml(accessible)}" ${blocked?'disabled':''}><i class="palette-dot" style="background:${tone.dark}" aria-hidden="true"></i><span class="palette-copy"><strong>${tone.name}</strong><small>${escapeHtml(subtitle)}</small></span><span class="palette-mark" aria-hidden="true">${selected?'✓':blocked?'●':''}</span></button>`;
    }).join('');
  }


  // Calendar-free timeline, measured in months since the beginning of the projection.
  // Entries of type monthly replace the recurring contribution from that month onward;
  // entries of type once add a contribution only at that month-end.
  const contributions={savings:[],index:[]};
  // Optional scenario constraints are absent from earlier scenario records.
  function normalizeScenarioLockState(tab,raw){
    if((tab!=='savings'&&tab!=='index')||!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const ids=new Set(configs[tab].fields.map(f=>f[0]).filter(id=>id!=='goal'));
    const pinned=[...new Set(Array.isArray(raw.pinned)?raw.pinned:[])].filter(id=>ids.has(id));
    const allowed=goalSolveChoices.map(([id])=>id).filter(id=>!pinned.includes(id));
    const solve=allowed.includes(raw.solve)?raw.solve:(allowed[0]||'');
    const manuals=raw.manuals&&typeof raw.manuals==='object'&&!Array.isArray(raw.manuals)
      ?Object.fromEntries(goalSolveChoices.map(([id])=>{
        const f=configs[tab].fields.find(x=>x[0]===id);
        return [id,Number.isFinite(raw.manuals[id])?clamp(raw.manuals[id],f[2],f[3]):null];
      })):null;
    return {locked:raw.locked===true,solve,pinned,manuals};
  }
  function restoreSnapshot(saved){
    if(!saved || saved.version!==1 || !saved.values || typeof saved.values!=='object' || Array.isArray(saved.values))throw new Error('פורמט גיבוי לא תקין');
    for(const tab of defaultOrder){
      Object.assign(states[tab],Object.fromEntries(configs[tab].fields.map(f=>[f[0],f[5]])));
      fieldLabels[tab]={};resetPoints[tab]={};fieldOrder[tab]=configs[tab].fields.map(f=>f[0]);
      notesByTab[tab]='';scenarios[tab]=[];compareIds[tab]=null;
      tabLabels[tab]=({mortgage:'משכנתא',savings:'חיסכון',index:'השקעה ב־S&P 500',loan:'הלוואה',budget:'תקציב חודשי'})[tab];
    }
    states.mortgage.kind='first';tabOrder=[...defaultOrder];active='mortgage';notesText='';notesMode='shared';notesCollapsed=false;
    Object.assign(tabColors,defaultTabColors);goalPinned.savings=[];goalPinned.index=[];
    contributions.savings=[];contributions.index=[];
    Object.assign(advanced.mortgage,{insurance:0,purchaseCosts:0,stressRise:0,income:0});
    Object.assign(advanced.index,{taxEnabled:false,taxRate:25});advanced.budget.annualItems=[];
    chartModes.savings=false;chartModes.index=false;
    budgetFlowMode=saved.budgetFlowMode===true;
    riskSettings.enabled=saved.riskSettings?.enabled===true;
    riskSettings.volatility=Number.isFinite(saved.riskSettings?.volatility)?clamp(saved.riskSettings.volatility,5,40):18;
    for(const tab of ['savings','index']){goalPlans[tab]={locked:false,solve:'monthly'};goalFeedback[tab]=null;goalManuals[tab]=null;}
    for(const [tab,config] of Object.entries(configs)) {
      const inputs=saved.values[tab];
      if(!inputs || typeof inputs!=='object')continue;
      for(const [id,,min,max] of config.fields) {
        const previous=tab==='loan'&&id==='months'?inputs.years:undefined;
        const val=tab==='loan'&&id==='months'&&!Number.isFinite(inputs.months)&&Number.isFinite(previous)
          ?Math.round(previous*12):inputs[id];
        if(typeof val==='number' && Number.isFinite(val))states[tab][id]=clamp(val,min,max);
      }
    }
    // The equity limit also depends on the apartment price.
    states.mortgage.equity=Math.min(states.mortgage.equity,states.mortgage.price);
    if(allowedKinds.includes(saved.values.mortgage?.kind))states.mortgage.kind=saved.values.mortgage.kind;
    if(Object.hasOwn(configs,saved.active))active=saved.active;
    if(Array.isArray(saved.tabOrder) && saved.tabOrder.length===defaultOrder.length &&
       new Set(saved.tabOrder).size===defaultOrder.length && saved.tabOrder.every(x=>defaultOrder.includes(x))) {
      tabOrder=[...saved.tabOrder];
    }
    if(saved.tabLabels && typeof saved.tabLabels==='object'){
      for(const tab of defaultOrder){
        if(typeof saved.tabLabels[tab]==='string' && saved.tabLabels[tab].trim() && saved.tabLabels[tab].length<=65)
          tabLabels[tab]=saved.tabLabels[tab].trim();
      }
    }
    if(saved.fieldLabels && typeof saved.fieldLabels==='object'){
      for(const tab of defaultOrder){
        for(const field of configs[tab].fields){
          const label=saved.fieldLabels[tab]?.[field[0]]??(tab==='loan'&&field[0]==='months'?saved.fieldLabels[tab]?.years:undefined);
          if(typeof label==='string' && label.trim() && label.length<=65)fieldLabels[tab][field[0]]=label.trim();
        }
      }
    }
    if(saved.fieldOrder && typeof saved.fieldOrder==='object'){
      for(const tab of defaultOrder){
        const ids=configs[tab].fields.map(f=>f[0]);
        const proposed=saved.fieldOrder[tab];
        if(Array.isArray(proposed)){
          const safe=[...new Set(proposed.map(id=>tab==='loan'&&id==='years'?'months':id).filter(id=>typeof id==='string' && ids.includes(id)))];
          const newlyAdded=tab==='index'&&!safe.includes('goal')?['goal']:[];
          fieldOrder[tab]=[...newlyAdded,...safe,...ids.filter(id=>!safe.includes(id)&&!newlyAdded.includes(id))];
        }
      }
    }
    // Backward compatible: backups from older versions have no resetPoints.
    if(saved.resetPoints && typeof saved.resetPoints==='object' && !Array.isArray(saved.resetPoints)){
      for(const tab of defaultOrder){
        for(const f of configs[tab].fields){
          const previous=tab==='loan'&&f[0]==='months'?saved.resetPoints[tab]?.years:undefined;
          const value=tab==='loan'&&f[0]==='months'&&!Number.isFinite(saved.resetPoints[tab]?.months)&&Number.isFinite(previous)
            ?Math.round(previous*12):saved.resetPoints[tab]?.[f[0]];
          if(typeof value==='number'&&Number.isFinite(value)){
            const safe=clamp(value,f[2],f[3]);
            if(safe!==f[5])resetPoints[tab][f[0]]=safe;
          }
        }
      }
    }
    if(saved.advanced && typeof saved.advanced==='object'){
      for(const key of ['insurance','purchaseCosts','stressRise','income']){
        if(Number.isFinite(saved.advanced.mortgage?.[key]))advanced.mortgage[key]=clamp(saved.advanced.mortgage[key],0,key==='purchaseCosts'?1000000:key==='insurance'?5000:key==='income'?300000:8);
      }
      if(typeof saved.advanced.index?.taxEnabled==='boolean')advanced.index.taxEnabled=saved.advanced.index.taxEnabled;
      if(Number.isFinite(saved.advanced.index?.taxRate))advanced.index.taxRate=clamp(saved.advanced.index.taxRate,0,50);
      if(Array.isArray(saved.advanced.budget?.annualItems))advanced.budget.annualItems=saved.advanced.budget.annualItems.slice(0,30).filter(item=>item&&typeof item.title==='string'&&Number.isFinite(item.amount)&&item.amount>=0&&item.amount<=1000000).map(item=>({id:String(item.id||'annual'+Math.random()),title:item.title.slice(0,70),amount:item.amount}));
    }
    if(saved.scenarios && typeof saved.scenarios==='object'){
      for(const tab of defaultOrder){
        if(!Array.isArray(saved.scenarios[tab]))continue;
        scenarios[tab]=saved.scenarios[tab].slice(0,12).filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.values&&typeof x.values==='object').map(x=>({id:x.id.slice(0,45),name:x.name.slice(0,42),values:tab==='loan'&&Number.isFinite(x.values.years)&&!Number.isFinite(x.values.months)
          ?{...x.values,months:Math.round(x.values.years*12)}:x.values,events:Array.isArray(x.events)?x.events.slice(0,80):[],advanced:x.advanced&&typeof x.advanced==='object'?x.advanced:{},lockState:normalizeScenarioLockState(tab,x.lockState)}));
      }
    }
    if(saved.compareIds && typeof saved.compareIds==='object')for(const tab of defaultOrder){const id=saved.compareIds[tab];if(scenarios[tab].some(x=>x.id===id))compareIds[tab]=id;}
    if(typeof saved.notes==='string')notesText=saved.notes.slice(0,6000);
    if(saved.notesMode==='shared'||saved.notesMode==='separate')notesMode=saved.notesMode;
    if(saved.notesByTab && typeof saved.notesByTab==='object' && !Array.isArray(saved.notesByTab)){
      for(const tab of defaultOrder){
        if(typeof saved.notesByTab[tab]==='string')notesByTab[tab]=saved.notesByTab[tab].slice(0,6000);
      }
    }
    if(typeof saved.notesCollapsed==='boolean')notesCollapsed=saved.notesCollapsed;
    if(saved.contributions && typeof saved.contributions==='object') {
      for(const tab of ['savings','index']){
        if(!Array.isArray(saved.contributions[tab]))continue;
        const loaded=saved.contributions[tab].slice(0,100);
        const seen=new Set();
        for(const e of loaded){
          if(!e || !['monthly','once'].includes(e.type) || !Number.isInteger(e.month) || e.month<1 || e.month>960 ||
             typeof e.amount!=='number' || !Number.isFinite(e.amount) || e.amount<0 || e.amount>10000000)continue;
          if(e.type==='monthly' && seen.has(e.month))continue;
          if(e.type==='monthly')seen.add(e.month);
          const id=typeof e.id==='string' && /^[a-z0-9-]{1,48}$/i.test(e.id)?e.id:'saved-'+tab+'-'+contributions[tab].length;
          contributions[tab].push({id,type:e.type,month:e.month,amount:e.amount});
        }
      }
    }
    // Accept older backups without color data, and never allow two tabs to claim one color.
    if(saved.tabColors && typeof saved.tabColors==='object' && !Array.isArray(saved.tabColors) && !defaultOrder.every(tab=>saved.tabColors[tab]===legacyTabColors[tab])){
      const requested=defaultOrder.map(tab=>[tab,saved.tabColors[tab]]).filter(([tab,id])=>accentBank.some(t=>t.id===id));
      const taken=new Set();
      for(const [tab,id] of requested){if(!taken.has(id)){tabColors[tab]=id;taken.add(id);}}
      for(const tab of defaultOrder){
        if(!taken.has(tabColors[tab])){taken.add(tabColors[tab]);continue;}
        if(requested.some(([name,id])=>name===tab&&id===tabColors[tab]) && requested.find(([name,id])=>id===tabColors[tab])?.[0]===tab)continue;
        const unused=accentBank.find(t=>!taken.has(t.id));
        if(unused){tabColors[tab]=unused.id;taken.add(unused.id);}
      }
    }
    for(const tab of ['savings','index']){
      if(Array.isArray(saved.goalPinned?.[tab]))goalPinned[tab]=[...new Set(saved.goalPinned[tab].filter(id=>configs[tab].fields.some(f=>f[0]===id&&id!=='goal')))];
      if(typeof saved.chartModes?.[tab]==='boolean')chartModes[tab]=saved.chartModes[tab];
      const plan=saved.goalPlans?.[tab];
      if(plan && typeof plan.locked==='boolean')goalPlans[tab].locked=plan.locked;
      if(plan && goalSolveChoices.some(x=>x[0]===plan.solve))goalPlans[tab].solve=plan.solve;
      const manual=saved.goalManuals?.[tab];
      if(manual && typeof manual==='object'){
        goalManuals[tab]={};
        for(const id of ['initial','monthly','years','rate']){
          const f=configs[tab].fields.find(x=>x[0]===id);
          goalManuals[tab][id]=Number.isFinite(manual[id])?clamp(manual[id],f[2],f[3]):states[tab][id];
        }
      }
    }
  }
  let storageAvailable=false;
  try {
    const checkKey=STORAGE_KEY+'.check';
    localStorage.setItem(checkKey,'1');
    localStorage.removeItem(checkKey);
    storageAvailable=true;
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch(parseError){/* Keep storage usable even when an older snapshot is invalid. */}
    if(saved?.version===1 && saved.values)restoreSnapshot(saved);
  } catch(err) {
    // Disabled storage or malformed saved data should never break the calculators.
    storageAvailable=false;
  }
  if(!storageAvailable){
    q('saveStatus').textContent='הנתונים נשמרים במעבר בין לשוניות בלבד';
    q('saveDot').style.background='#bd9569';
  }
  function snapshot(){return {version:1,active,values:states,tabOrder,tabLabels,fieldLabels,fieldOrder,resetPoints,notes:notesText,notesMode,notesByTab,notesCollapsed,contributions,advanced,scenarios,compareIds,chartModes,budgetFlowMode,riskSettings,goalPlans,goalManuals,goalPinned,tabColors};}
  const undoHistory=[];
  let undoGroup=0,lastRecordedGroup=-1,lastCommitted=JSON.stringify(snapshot()),restoring=false;
  const maxUndo=45;
  function setUndoState(){const btn=q('undoBtn');if(btn)btn.disabled=!undoHistory.length;}
  document.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,textarea,select,.field-handle,.tab-grip,.range-touch-layer'))undoGroup++;
  },true);
  let lastKeyAt=0;
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea,[contenteditable=true]')){
      e.preventDefault();undo();return;
    }
    if(e.key==='Tab'||e.key==='Escape'||e.key==='Shift'||e.key==='Control')return;
    if(Date.now()-lastKeyAt>750)undoGroup++;
    lastKeyAt=Date.now();
  },true);
  function saveState(){
    const data=JSON.stringify(snapshot());
    if(data!==lastCommitted){
      if(!restoring&&lastCommitted && lastRecordedGroup!==undoGroup){
        undoHistory.push(lastCommitted);if(undoHistory.length>maxUndo)undoHistory.shift();
        lastRecordedGroup=undoGroup;
      }
      lastCommitted=data;setUndoState();
    }
    // Notify linked tools after any state change, even if browser storage is unavailable.
    document.dispatchEvent(new Event('anav:finance-state-changed'));
    if(!storageAvailable)return;
    try{localStorage.setItem(STORAGE_KEY,data);}
    catch(err){storageAvailable=false;q('saveStatus').textContent='שמירה מקומית אינה זמינה';q('saveDot').style.background='#bd9569';}
  }
  function refreshAllAfterRestore(){
    app.dataset.theme=active;applyTabAccent();refreshTabLabels();applyTabOrder();setNotesCollapsed(notesCollapsed);
    activate(active);renderNotes();
    if(typeof renderScenarioList==='function' && !q('scenarioOverlay').hidden)renderScenarioList();
    if(typeof renderAdvanced==='function' && !q('advancedOverlay').hidden)renderAdvanced();
  }
  function undo(){
    if(!undoHistory.length)return;
    const prior=undoHistory.pop();restoring=true;
    try{restoreSnapshot(JSON.parse(prior));undoGroup++;lastRecordedGroup=-1;lastCommitted=JSON.stringify(snapshot());refreshAllAfterRestore();}
    finally{restoring=false;setUndoState();saveState();}
    q('saveStatus').textContent='הפעולה האחרונה בוטלה';
  }
  q('undoBtn').addEventListener('click',undo);
  // Fully offline Excel (.xlsx) export. No CDN or outside dependencies.
  function exportExcel(){
    const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const sheets=[];
    const addSheet=(name,rows)=>sheets.push({name,rows});
    const now=new Date().toLocaleString('he-IL');
    const overview=[['סקירת המחשבונים','ערך מרכזי','ערך','יחידה'],['עודכן בתאריך',now]];
    for(const tab of defaultOrder){
      const c=configs[tab],s=states[tab];
      const rows=[[tabLabels[tab]],[ 'מועד ייצוא',now],[],['פרמטר','ערך','יחידה','נקודת איפוס']];
      for(const f of c.fields)rows.push([fieldLabels[tab][f[0]]||f[1],s[f[0]],f[6],getResetPoint(tab,f[0])]);
      rows.push([],['מדד','ערך','יחידה']);
      if(tab==='mortgage'||tab==='loan'){
        const debt=tab==='mortgage'?Math.max(0,s.price-s.equity):s.principal;
        const r=schedule(debt,s.rate,tab==='loan'?loanTermYears(s):s.years,s.extra);
        rows.push(['קרן מקורית',debt,'₪'],['החזר חודשי ללא ביטוח',r.payment,'₪'],['סך הריבית',r.interest,'₪'],['מספר חודשי החזר',r.months]);
        if(tab==='mortgage'){
          rows.push(['הון עצמי',s.equity,'₪'],['ביטוח חודשי',advanced.mortgage.insurance,'₪'],['הוצאות רכישה',advanced.mortgage.purchaseCosts,'₪'],['תרחיש עליית ריבית',advanced.mortgage.stressRise,'%'],['הכנסה חודשית נטו (אופציונלי)',advanced.mortgage.income,'₪']);
        }
        rows.push([],['חודש','שנה','יתרת חוב (₪)']);
        r.monthlySeries.forEach((val,month)=>rows.push([month,Math.round(month/12*100)/100,val]));
        overview.push([tabLabels[tab],'החזר חודשי',r.payment,'₪']);
      }else if(tab==='savings'||tab==='index'){
        const r=futureValue(s,s.rate,tab==='index'?s.fees:0,contributions[tab]||[]);
        rows.push(['סך הפקדות',r.contributed,'₪'],['שווי סוף תקופה',r.value,'₪'],['רווח או הפסד',r.value-r.contributed,'₪']);
        if(tab==='index')rows.push(['מס בדוגמה',advanced.index.taxEnabled?Math.max(0,r.value-Math.max(r.contributed,r.inflationBasis||r.contributed))*advanced.index.taxRate/100:0,'₪'],['שיעור מס לדוגמה',advanced.index.taxRate,'%']);
        rows.push([],['חודש','שנה','שווי מצטבר (₪)','סך הפקדות (₪)','רווח / הפסד (₪)']);
        r.monthlySeries.forEach((value,month)=>rows.push([month,Math.round(month/12*100)/100,value,r.contributionSeries[month],value-r.contributionSeries[month]]));
        rows.push([],['שינויים בהפקדות'],['חודש','סוג שינוי','סכום (₪)']);
        for(const e of contributions[tab])rows.push([e.month,e.type==='monthly'?'הפקדה חודשית חדשה':'הפקדה חד פעמית',e.amount]);
        overview.push([tabLabels[tab],'שווי בסוף תקופה',r.value,'₪']);
      }else{
        const extra=advanced.budget.annualItems.reduce((sum,x)=>sum+Number(x.amount||0),0)/12;
        const expense=s.housing+s.bills+s.living+s.spending+extra;
        const free=s.income-expense-s.savings;
        rows.push(['הוצאות חודשיות',expense,'₪'],['חיסכון מתוכנן',s.savings,'₪'],['יתרה חופשית',free,'₪'],['הוצאות שנתיות (ממוצע חודשי)',extra,'₪']);
        rows.push([],['הוצאה שנתית','סכום שנתי (₪)','ממוצע חודשי (₪)']);
        advanced.budget.annualItems.forEach(item=>rows.push([item.title,item.amount,item.amount/12]));
        overview.push([tabLabels[tab],'יתרה חודשית',free,'₪']);
      }
      addSheet(({mortgage:'משכנתא',savings:'חיסכון',index:'השקעות',loan:'הלוואה',budget:'תקציב'}[tab]),rows);
    }
    const scenariosRows=[['לשונית','תרחיש','פרמטר','ערך']];
    for(const tab of defaultOrder)for(const rec of scenarios[tab]||[])for(const [key,value] of Object.entries(rec.values||{}))scenariosRows.push([tabLabels[tab],rec.name,key,value]);
    addSheet('תרחישים',scenariosRows);
    addSheet('סקירה',overview);
    const sheetXml=(rows)=>{
      const colName=i=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="33" customWidth="1"/><col min="2" max="2" width="23" customWidth="1"/><col min="3" max="5" width="22" customWidth="1"/></cols><sheetData>${rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{if(v===undefined||v===null||v==='')return '';const addr=colName(ci)+(ri+1),style=ri===0?1:((typeof v==='string'&&v==='פרמטר')?1:0);if(typeof v==='number'&&Number.isFinite(v))return `<c r="${addr}" s="${style}"><v>${v}</v></c>`;return `<c r="${addr}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
    };
    const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${sheets.map((sh,i)=>`<sheet name="${xml(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
    const links=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((sh,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`;
    const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((sh,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF43565B"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAE0D3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`;
    const files=[['[Content_Types].xml',types],['_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',links],['xl/styles.xml',styles],...sheets.map((sh,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(sh.rows)])];
    // Small standalone ZIP writer (STORE method) for well-formed XLSX archives.
    const encoder=new TextEncoder();const chunks=[];const central=[];let offset=0;
    const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
    const crc32=bytes=>{let crc=0xFFFFFFFF;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;};
    for(const [filename,content] of files){
      const name=encoder.encode(filename),bytes=encoder.encode(content),crc=crc32(bytes);
      const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,0,true);
      v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);
      chunks.push(h,bytes);
      const cd=new Uint8Array(46+name.length),d=new DataView(cd.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);
      d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);cd.set(name,46);
      central.push(cd);offset+=h.length+bytes.length;
    }
    const cdLength=central.reduce((sum,arr)=>sum+arr.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,cdLength,true);ev.setUint32(16,offset,true);
    const blob=new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='finance-export-'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    q('saveStatus').textContent='קובץ Excel נוצר';
  }
  q('excelBtn').addEventListener('click',()=>{try{exportExcel();}catch(error){alert('לא ניתן לייצא ל־Excel: '+error.message);}});

  q('backupBtn').addEventListener('click',()=>{
    const json=JSON.stringify({kind:'finance-calculators-backup',createdAt:new Date().toISOString(),data:snapshot()},null,2);
    const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='finance-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    q('saveStatus').textContent='קובץ גיבוי נוצר';
  });
  q('restoreBtn').addEventListener('click',()=>q('restoreFile').click());
  q('restoreFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>2500000)throw new Error('קובץ גדול מדי');
      const parsed=JSON.parse(await file.text());
      if(parsed.kind!=='finance-calculators-backup'||!parsed.data?.values||parsed.data.version!==1)throw new Error('זה אינו קובץ גיבוי נתמך');
      if(!confirm('לשחזר את הנתונים מהקובץ? הפעולה תחליף את הנתונים הנוכחיים. אפשר לבטל אותה באמצעות כפתור ביטול.'))return;
      undoGroup++;saveState();undoHistory.push(lastCommitted);if(undoHistory.length>maxUndo)undoHistory.shift();
      restoring=true;
      try{restoreSnapshot(parsed.data);lastCommitted=JSON.stringify(snapshot());refreshAllAfterRestore();}
      finally{restoring=false;}
      saveState();setUndoState();q('saveStatus').textContent='הגיבוי שוחזר';
    }catch(err){alert('לא ניתן לשחזר: '+err.message);}
    finally{e.target.value='';}
  });
  const limits={first:.75,upgrade:.70,invest:.50};
  function annuity(principal,annualRate,n){ if(principal<=0)return 0; const r=annualRate/1200; return r===0?principal/n:principal*r/(1-Math.pow(1+r,-n)); }
  function schedule(principal,annualRate,years,extra){
    const maxMonths=Math.round(years*12),base=annuity(principal,annualRate,maxMonths),payment=base+extra,r=annualRate/1200;
    let balance=principal,totalInterest=0,months=0;
    const series=[principal],monthlySeries=[principal];
    while(balance>.00001 && months<maxMonths+1){
      const interest=balance*r;
      totalInterest+=interest;
      balance=Math.max(0,balance+interest-payment);
      months++;
      monthlySeries.push(balance);
      if(months%12===0 || balance===0)series.push(balance);
      if(payment<=interest)break;
    }
    if(series[series.length-1]!==0 && balance<1)series.push(0);
    return {base,payment,interest:totalInterest,months,series,monthlySeries};
  }
  function futureValue(s,annual,fee=0,events=[],goal=null){
    const mrate=Math.pow((1+annual/100)*(1-fee/100),1/12)-1;
    const byMonth=new Map();
    for(const event of events){
      if(event.month>Math.round(s.years*12))continue;
      if(!byMonth.has(event.month))byMonth.set(event.month,[]);
      byMonth.get(event.month).push(event);
    }
    let balance=s.initial,contributed=s.initial,monthly=s.monthly;
    const totalMonths=Math.round(s.years*12);
    let inflationBasis=s.initial*Math.pow(1+(Number(s.inflation)||0)/100,totalMonths/12);
    let reachedMonth=goal!==null && balance>=goal?0:null;
    const series=[balance],monthlySeries=[balance],contributionSeries=[contributed];
    for(let i=1;i<=totalMonths;i++) {
      const changes=byMonth.get(i)||[];
      for(const e of changes)if(e.type==='monthly')monthly=e.amount;
      const extra=changes.filter(e=>e.type==='once').reduce((sum,e)=>sum+e.amount,0);
      balance=balance*(1+mrate)+monthly+extra;
      contributed+=monthly+extra;
      if(Number.isFinite(s.inflation))inflationBasis+=(monthly+extra)*Math.pow(1+s.inflation/100,(totalMonths-i)/12);
      monthlySeries.push(balance);contributionSeries.push(contributed);
      if(reachedMonth===null && goal!==null && balance>=goal)reachedMonth=i;
      if(i%12===0)series.push(balance);
    }
    return {value:balance,series,monthlySeries,contributionSeries,contributed,reachedMonth,inflationBasis};
  }
  // Inverse future-value solver. Uses exactly the same engine as the chart and
  // includes dated deposits and annual management fees; no independent formula drift.
  function goalIsActive(tab=active){return (tab==='savings'||tab==='index') && !!goalPlans[tab].locked;}
  function goalTargetValue(tab,params=states[tab]){
    return futureValue(params,params.rate,tab==='index'?params.fees:0,contributions[tab]||[]).value;
  }
  function yearLabel(years){
    const n=Math.round(years*12),y=Math.floor(n/12),m=n%12;
    return (y?(y===1?'שנה אחת':y+' שנים'):'')+(y&&m?' ו־':'')+(m?(m===1?'חודש אחד':m+' חודשים'):'')||'0 חודשים';
  }
  function goalSolver(tab){
    if(!goalIsActive(tab)) {goalFeedback[tab]=null;return;}
    const pinned=goalPinned[tab];
    const choices=goalSolveChoices.map(x=>x[0]).filter(id=>!pinned.includes(id));
    if(!choices.includes(goalPlans[tab].solve))goalPlans[tab].solve=choices[0]||'';
    const s=states[tab],field=goalPlans[tab].solve,goal=s.goal;
    if(!field){
      const actual=goalTargetValue(tab),gap=goal-actual,reached=actual>=goal-0.51;
      goalFeedback[tab]={reached,limitReached:!reached,actual,
        message:reached?'כל המשתנים קבועים והיעד מושג. שחרר מנעול כדי לחשב משתנה אחר.':
          `כל המשתנים קבועים · חסרים ${money(Math.max(0,gap))} להגעה ליעד. שחרר לפחות מנעול אחד.`};
      return;
    }
    const spec=configs[tab].fields.find(f=>f[0]===field);
    if(!spec)return;
    const min=spec[2],max=spec[3],events=contributions[tab];
    const valueAt=(v)=>goalTargetValue(tab,{...s,[field]:v});
    let value=s[field],note='',limitReached=false;
    if(field==='monthly'||field==='initial'){
      const base=valueAt(0),coefficient=valueAt(1)-base;
      if(coefficient<=1e-8){
        value=min;limitReached=true;
        note=field==='monthly'?'שינוי הפקדות עתידי מחליף את ההפקדה כבר מהחודש הראשון, לכן ההפקדה ההתחלתית לא משפיעה על היעד.':'לא ניתן לחשב את הפרמטר בתנאים האלה.';
      }else{
        const required=(goal-base)/coefficient;
        value=clamp(Math.ceil(Math.max(0,required)*100-1e-7)/100,min,max);
        if(required>max+.001){limitReached=true;note='כדי להגיע ליעד נדרש ערך מעל המקסימום המוגדר בסליידר.';}
        else if(required<min-0.001){note='היעד מושג כבר בערך המינימלי.';}
      }
    }else if(field==='years'){
      const horizon=futureValue({...s,years:max},s.rate,tab==='index'?s.fees:0,events);
      const first=horizon.monthlySeries.findIndex((val,i)=>i>=Math.round(min*12)&&val+0.5>=goal);
      if(first<0){value=max;limitReached=true;note='לא ניתן להגיע ליעד גם בתקופה המרבית של 80 שנה.';}
      else{
        value=Math.max(min,first/12);
        if(first===Math.round(min*12)&&horizon.monthlySeries[12]>goal+0.5)note='היעד הושג כבר במהלך השנה הראשונה.';
      }
    }else if(field==='rate'){
      const vMin=valueAt(min),vMax=valueAt(max);
      if(vMin>=goal-0.5){value=min;note='היעד מושג גם בתשואה המינימלית.';}
      else if(vMax<goal-0.5){value=max;limitReached=true;note='היעד מחייב תשואה גבוהה מהטווח המוגדר בסליידר.';}
      else{
        let lo=min,hi=max;
        for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(valueAt(mid)>=goal)hi=mid;else lo=mid;}
        value=clamp(Math.ceil(hi*100-1e-9)/100,min,max);
      }
    }
    s[field]=Number(value.toFixed(10));
    const actual=goalTargetValue(tab);
    const reached=actual>=goal-0.51;
    if(!reached&&!note){limitReached=true;note='היעד אינו אפשרי בטווח הפרמטר שנבחר.';}
    const gap=goal-actual;
    goalFeedback[tab]={reached,limitReached,actual,note,
      message:!reached?`לא מגיעים ליעד · חסרים ${money(gap)}. ${note}`:
        note||`היעד מושג עם ${field==='years'?yearLabel(s.years):field==='rate'?pct(s.rate):money(s[field])}${field==='monthly'?' בחודש':field==='initial'?' בהתחלה':''}.`};
  }
  function syncReleaseLocksButton(){
    const button=q('unlockAllGoals'),count=q('unlockCount');
    if(!button||!count)return;
    const supported=active==='savings'||active==='index';
    button.hidden=!supported;
    if(!supported)return;
    const total=goalPinned[active].length+(goalIsActive(active)?1:0);
    button.disabled=total===0;
    count.textContent=String(total);
    count.hidden=total===0;
    button.title=total?'שחרר '+total+' נעילות בגיליון '+tabLabels[active]+' · הערכים עצמם לא ישתנו':'אין נעילות לשחרור בגיליון זה';
    button.setAttribute('aria-label',total?'שחרר את כל '+total+' הנעילות בגיליון '+tabLabels[active]:'אין נעילות לשחרור בגיליון '+tabLabels[active]);
  }
  function syncGoalPlanningUI(){
    if(active!=='savings'&&active!=='index')return;
    const locked=goalIsActive(),plan=goalPlans[active],btn=q('goalLock'),selector=q('goalSolve');
    if(!btn||!selector)return;
    btn.setAttribute('aria-pressed',String(locked));
    btn.textContent=locked?'שחרר יעד':'נעל יעד';
    btn.title=locked?'בטל נעילת יעד וחזור לעריכה חופשית':'נעל את סכום היעד וחשב אוטומטית משתנה אחד';
    const opts=q('goalOptions');opts.hidden=!locked;
    const goalRow=q('range-goal')?.closest('.field');if(goalRow)goalRow.classList.toggle('goal-locked',locked);
    const allowed=goalSolveChoices.filter(([id])=>!goalPinned[active].includes(id));
    selector.innerHTML=allowed.length?allowed.map(([id,label])=>`<option value="${id}">${label}</option>`).join(''):'<option value="">אין משתנה פנוי</option>';
    selector.disabled=!allowed.length;
    selector.value=plan.solve||'';
    const info=q('goalFeedback');
    if(locked){
      const f=goalFeedback[active];
      info.textContent=f?.message||'שנה פרמטרים והמערכת תחשב את המשתנה שנבחר.';
      info.dataset.tone=f&&!f.reached?'warn':'good';
    }
    configs[active].fields.forEach(f=>{
      const id=f[0],r=q('range-'+id),n=q('number-'+id);
      if(!r||!n)return;
      const computed=locked&&!!plan.solve&&id===plan.solve;
      const pinned=goalPinned[active].includes(id);
      const lockedTarget=locked&&id==='goal';
      r.disabled=n.disabled=computed||pinned||lockedTarget;
      const row=r.closest('.field');row.classList.toggle('goal-computed',computed);row.classList.toggle('goal-pinned',pinned);
      const pin=row.querySelector('[data-pin-field]');
      if(pin){pin.setAttribute('aria-pressed',String(pinned));pin.setAttribute('aria-label',(pinned?'בטל נעילה':'נעל')+': '+(fieldLabels[active][id]||f[1]));
        pin.title=pinned?'שחרר ערך נעול לעריכה':'נעל את הערך כך שלא ישתנה בחישוב היעד';
        const path=pin.querySelector('path');if(path)path.setAttribute('d',pinned?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 8 0');}
      r.value=String(states[active][id]);n.value=inputText(states[active][id]);
      if(id==='years')r.dataset.slideStep=locked&&plan.solve==='years'?String(1/12):String(f[4]);
      paintSlider(r);
      if(computed){r.title='ערך מחושב לפי יעד נעול · בחר משתנה אחר כדי לשנות אותו';n.title=r.title;}
      else if(pinned){r.title='ערך נעול וקבוע · לחץ על המנעול כדי לאפשר עריכה';n.title=r.title;}
      else{r.removeAttribute('title');n.removeAttribute('title');}
    });
    syncReleaseLocksButton();
  }

  function formatField(v,unit) {return unit==='₪'?money(v):unit==='%'?pct(v):count(v)+' '+unit;}
  function renderControls(){
    const c=configs[active],s=states[active];
    q('controlTitle').textContent='נתונים';q('controlSubtitle').textContent='';
    const isSaving=active==='savings'||active==='index';
    q('controlFoot').innerHTML=isSaving
      ? `<div class="goal-legend" role="note" aria-label="פירוש מצבי המשתנים"><span class="legend-item"><i class="legend-swatch is-open" aria-hidden="true"></i>חופשי</span><span class="legend-item"><i class="legend-swatch is-pinned" aria-hidden="true"></i>נעול</span><span class="legend-item"><i class="legend-swatch is-computed" aria-hidden="true"></i>מחושב</span></div><div>${escapeHtml(c.foot)}</div>`
      : escapeHtml(c.foot);
    q('scheduleToggle').hidden=!isSaving;
    q('advancedToggle').hidden=!['mortgage','index','budget'].includes(active);
    if(isSaving)q('scheduleCount').textContent=contributions[active].length||'';
    let html='';
    if(active==='mortgage')html='<div class="select-field"><label for="propertyKind">סוג הנכס</label><select id="propertyKind"><option value="first">דירה יחידה · 75%</option><option value="upgrade">דירה חליפית · 70%</option><option value="invest">להשקעה · 50%</option></select></div>';
    const byId=Object.fromEntries(c.fields.map(f=>[f[0],f]));
    for(const id of fieldOrder[active]){
      const [,defaultLabel,min,max,step,,unit]=byId[id];
      const rawLabel=fieldLabels[active][id]||defaultLabel;
      const label=compactFieldLabel(rawLabel);
      const upper=active==='mortgage'&&id==='equity'?Math.min(max,s.price):max;
      const val=clamp(s[id],min,upper);s[id]=val;
      const isCustom=Object.hasOwn(resetPoints[active],id);
      const resetLabel=formatField(clamp(getResetPoint(active,id),min,upper),unit);
      const isGoal=isSaving&&id==='goal';
      const goalButton=isGoal?`<button type="button" class="goal-lock-btn" id="goalLock" aria-pressed="${goalIsActive()}">${goalIsActive()?'שחרור':'נעילה'}</button>`:'';
      const pinned=isSaving&&!isGoal&&goalPinned[active].includes(id);
      const pinButton=isSaving&&!isGoal?`<button type="button" class="field-pin-btn" data-pin-field="${id}" aria-pressed="${pinned}" aria-label="${pinned?'בטל נעילה':'נעל'}: ${escapeHtml(label)}" title="${pinned?'שחרר ערך נעול לעריכה':'נעל את הערך כך שלא ישתנה בחישוב היעד'}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${pinned?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 8 0'}"/></svg></button>`:'';
      html+=`<div class="field ${secondaryFields[active]?.includes(id)?'is-secondary':''} ${isGoal?'goal-field':''}" data-field="${id}"><div class="field-top"><div class="field-heading"><button type="button" class="field-handle" aria-label="גרור לשינוי סדר של ${escapeHtml(label)}. במקלדת: חץ למעלה או למטה" title="שנה סדר">⠿</button><label for="range-${id}" title="${escapeHtml(label)}">${escapeHtml(label)}</label>${goalButton}${pinButton}${active==='budget'&&id==='savings'?`<button type="button" class="allocation-field-trigger" data-open-allocation aria-label="פתח פילוח חיסכון חודשי" title="עריכת יעדי חיסכון חודשיים">פילוח ₪</button>`:''}${helpText[active]?.[id]?`<button type="button" class="field-help" aria-label="הסבר על ${escapeHtml(label)}">?<span class="help-pop">${escapeHtml(helpText[active][id])}</span></button>`:''}<button type="button" class="field-reset-point ${isCustom?'is-custom':''}" data-set-reset="${id}" aria-label="קבע את ${escapeHtml(formatField(val,unit))} כנקודת האיפוס של ${escapeHtml(label)}" title="קבע נקודת איפוס · כעת: ${escapeHtml(resetLabel)}">◎</button><button type="button" class="field-reset-original" data-clear-reset="${id}" aria-label="החזר נקודת איפוס מקורית של ${escapeHtml(label)}" title="החזר נקודת איפוס מקורית" ${isCustom?'':'hidden'}>↶</button><button type="button" class="field-rename" data-rename-field="${id}" aria-label="שנה שם ${escapeHtml(label)}" title="עריכת שם">✎</button><button type="button" class="field-mobile-menu" data-field-menu="${id}" aria-label="אפשרויות עבור ${escapeHtml(label)}">⋯</button></div><div class="value-box"><input aria-label="ערך ${escapeHtml(label)}" class="number-input" id="number-${id}" type="number" inputmode="decimal" min="${min}" max="${upper}" step="any" value="${val}"><span>${unit}</span></div></div><div class="range-control"><input id="range-${id}" type="range" min="${min}" max="${upper}" step="any" data-slide-step="${step}" value="${val}" aria-label="${escapeHtml(label)}"><span class="default-tick" title="איפוס: ${escapeHtml(resetLabel)}" aria-hidden="true"></span><div class="range-touch-layer" aria-hidden="true"></div></div><div class="limits"><span>${formatField(min,unit)}</span><span>${formatField(upper,unit)}</span></div>${isGoal?`<div class="goal-options" id="goalOptions" ${goalIsActive()?'':'hidden'}><div class="goal-mode-line"><label for="goalSolve" title="משתנה מחושב">חישוב</label><select id="goalSolve" aria-label="בחר משתנה שיחושב אוטומטית">${goalSolveChoices.map(([key,title])=>`<option value="${key}" ${goalPlans[active].solve===key?'selected':''}>${title}</option>`).join('')}</select></div><div id="goalFeedback" class="goal-feedback" aria-live="polite"></div></div>`:''}</div>`;
    }
    q('controlsBody').innerHTML=html;
    applyViewportLayout();
    if(active==='mortgage')q('propertyKind').value=s.kind;
    for(const [id,,,,,,] of c.fields){
      const slider=q('range-'+id),number=q('number-'+id);
      const spec=byId[id],unit=spec[6],zeroStep=spec[4];
      // Native number spinners use the same changing increment as keyboard arrows.
      // Updating step never rounds or overwrites a typed number.
      const syncNumberStep=()=>{
        const typed=number.value.trim()===''?states[active][id]:Number(number.value);
        number.step=String(adaptiveArrowStep(typed,unit,zeroStep));
      };
      syncNumberStep();
      number.addEventListener('focus',syncNumberStep);
      number.addEventListener('input',syncNumberStep);
      slider.addEventListener('keydown',event=>{
        if(!['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
        event.preventDefault();
        const direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1;
        changeValue(id,adaptiveArrowValue(states[active][id],direction,unit,Number(slider.min),Number(slider.max),zeroStep),'range-arrow');
      });
      slider.addEventListener('input',()=>{
        // Native range controls round an exact typed value to their step.
        // Keep step="any" for precise display, but retain the intended
        // increments when users drag the thumb or use keyboard arrows.
        const min=Number(slider.min),max=Number(slider.max);
        const step=Number(slider.dataset.slideStep)||1;
        const snapped=Number((min+Math.round((Number(slider.value)-min)/step)*step).toFixed(10));
        changeValue(id,clamp(snapped,min,max),'slider');
      });
      // Let the user finish typing before calculating. Updating the input on each
      // keystroke used to clamp partial numbers ("6" -> field minimum) and overwrite
      // the remaining digits, e.g. typing 6400 could produce a much larger number.
      // A normal change event fires on blur or when Enter commits an edited number.
      const commitTypedValue=()=>{
        const raw=number.value.trim();
        const typed=raw===''?NaN:Number(raw);
        if(!Number.isFinite(typed)){
          // An empty/invalid edit should not overwrite the previous valid value.
          number.value=String(states[active][id]);
          return;
        }
        changeValue(id,typed,'number-commit');
      };
      number.addEventListener('change',commitTypedValue);
      number.addEventListener('keydown',event=>{
        if((event.key==='ArrowUp'||event.key==='ArrowDown')&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
          event.preventDefault();
          const raw=number.value.trim();
          const current=raw===''?states[active][id]:Number(raw);
          if(Number.isFinite(current)){
            const direction=event.key==='ArrowUp'?1:-1;
            changeValue(id,adaptiveArrowValue(current,direction,unit,Number(number.min),Number(number.max),zeroStep),'number-arrow');
          }
          return;
        }
        if(event.key==='Enter'){event.preventDefault();number.blur();}
        if(event.key==='Escape'){
          event.preventDefault();
          number.value=String(states[active][id]);
          number.blur();
        }
      });
      paintSlider(slider);
      configureTouchSlider(slider);
      // Double-click is handled once by the delegated range-control handler below.
    }
    if(active==='mortgage')q('propertyKind').addEventListener('change',e=>{s.kind=e.target.value;renderResults();saveState();});
    syncReleaseLocksButton();
    if(isSaving){
      q('controlsBody').querySelectorAll('[data-pin-field]').forEach(button=>button.addEventListener('click',()=>{
        const tab=active,id=button.dataset.pinField,pins=goalPinned[tab];
        if(pins.includes(id))goalPinned[tab]=pins.filter(x=>x!==id);
        else goalPinned[tab]=[...pins,id];
        if(goalIsActive(tab))goalSolver(tab);
        syncGoalPlanningUI();renderResults();saveState();
      }));
      q('goalLock').addEventListener('click',()=>{
        goalPlans[active].locked=!goalPlans[active].locked;
        if(goalIsActive()){
          goalManuals[active]=Object.fromEntries(['initial','monthly','years','rate'].map(id=>[id,states[active][id]]));
          goalSolver(active);
        }else{goalFeedback[active]=null;goalManuals[active]=null;}
        syncGoalPlanningUI();renderResults();saveState();
      });
      q('goalSolve').addEventListener('change',e=>{
        if(goalPinned[active].includes(e.target.value))return;
        const previous=goalPlans[active].solve;
        if(goalManuals[active]&&Number.isFinite(goalManuals[active][previous]))states[active][previous]=goalManuals[active][previous];
        goalPlans[active].solve=e.target.value;
        goalSolver(active);syncGoalPlanningUI();renderResults();saveState();
      });
      syncGoalPlanningUI();
    }
  }
  // A vertical touch on a range control must scroll the page, not adjust the value.
  // Touch controls are layered above the native range to avoid its immediate touchstart jump.
  // The native range remains available for mouse and keyboard on desktop.
  function configureTouchSlider(slider) {
    const layer=slider.nextElementSibling;
    if(!layer || !layer.classList.contains('range-touch-layer'))return;
    let drag=null;
    function setFromPoint(x){
      const r=slider.getBoundingClientRect();
      const min=Number(slider.min), max=Number(slider.max), step=Number(slider.dataset.slideStep)||1;
      const halfThumb=8;
      const fraction=Math.max(0,Math.min(1,(x-r.left-halfThumb)/Math.max(1,r.width-2*halfThumb)));
      const value=Math.max(min,Math.min(max,min+Math.round((fraction*(max-min))/step)*step));
      if(value!==Number(slider.value)){
        slider.value=value;
        slider.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }
    layer.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,mode:null};
      layer.setPointerCapture(event.pointerId);
    });
    layer.addEventListener('pointermove',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.mode){
        if(Math.hypot(dx,dy)<10)return;
        drag.mode=Math.abs(dx)>Math.abs(dy)*1.3?'horizontal':'vertical';
      }
      if(drag.mode==='horizontal')setFromPoint(event.clientX);
    });
    layer.addEventListener('pointerup',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      // A completed stationary tap is also an intentional value selection.
      const tapped=!drag.mode && Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<10;
      if(tapped){
        const now=Date.now();
        if(layer._lastTap && now-layer._lastTap.time<330 && Math.abs(event.clientX-layer._lastTap.x)<18){
          const id=slider.closest('.field')?.dataset.field;
          if(id)changeValue(id,getResetPoint(active,id),'reset');
          layer._lastTap=null;
        } else {setFromPoint(event.clientX);layer._lastTap={time:now,x:event.clientX};}
      }else if(drag.mode==='horizontal')setFromPoint(event.clientX);
      drag=null;
    });
    layer.addEventListener('pointercancel',()=>{drag=null;});
    layer.addEventListener('lostpointercapture',()=>{drag=null;});
  }
  function fById(id){return configs[active].fields.find(f=>f[0]===id);}
  function paintSlider(el){
    const max=Number(el.max),min=Number(el.min),v=Number(el.value);
    el.style.background=`linear-gradient(to right,var(--accent) ${((v-min)/(max-min||1))*100}%,#e9e1d5 0)`;
    const field=el.closest('.field');
    const tick=field?.querySelector('.default-tick');
    if(tick){
      const id=field.dataset.field, f=fById(id);
      const reset=clamp(getResetPoint(active,id),min,max);
      const fraction=clamp((reset-min)/(max-min||1),0,1);
      const thumb=field.classList.contains('is-secondary')?14:18;
      // HTML ranges place the thumb centre between half a thumb and
      // (track width - half a thumb), not at 0..100% of the whole track.
      // CSS calc preserves alignment when the layout is resized.
      tick.style.left=`calc(${(fraction*100).toFixed(5)}% + ${((.5-fraction)*thumb).toFixed(3)}px)`;
      // Align vertically to the actual native range track, not a guessed
      // percentage of its containing element (which has unequal margins).
      tick.style.top=(el.offsetTop+el.offsetHeight/2)+'px';
      tick.title='נקודת איפוס: '+formatField(reset,f[6]);
    }
  }
  function updateResetControls(id){
    const field=q('range-'+id)?.closest('.field');
    if(!field)return;
    const f=fById(id),current=states[active][id];
    const custom=Object.hasOwn(resetPoints[active],id);
    const setButton=field.querySelector('[data-set-reset]');
    const clearButton=field.querySelector('[data-clear-reset]');
    if(setButton){
      setButton.classList.toggle('is-custom',custom);
      setButton.title='קבע את הערך הנוכחי כנקודת איפוס · כעת: '+formatField(getResetPoint(active,id),f[6]);
      setButton.setAttribute('aria-label','קבע את '+formatField(current,f[6])+' כנקודת האיפוס');
    }
    if(clearButton)clearButton.hidden=!custom;
    paintSlider(q('range-'+id));
  }
  function setResetPoint(id,useFactory=false){
    const f=fById(id);if(!f)return;
    if(useFactory)delete resetPoints[active][id];
    else{
      const upper=active==='mortgage'&&id==='equity'?Math.min(f[3],states.mortgage.price):f[3];
      const value=clamp(states[active][id],f[2],upper);
      if(value===f[5])delete resetPoints[active][id];
      else resetPoints[active][id]=value;
    }
    updateResetControls(id);
    updateHeroSecondary();
    saveState();
    q('saveStatus').textContent=useFactory?'נקודת האיפוס המקורית שוחזרה':'נקודת האיפוס עודכנה';
  }
  function changeValue(id,value,origin){
    const c=configs[active],f=c.fields.find(x=>x[0]===id);if(!f)return;
    if((active==='savings'||active==='index')&&goalPinned[active].includes(id))return;
    if(goalIsActive()&&id==='goal')return;
    if(goalIsActive()&&id===goalPlans[active].solve)return;
    const s=states[active],max=active==='mortgage'&&id==='equity'?s.price:f[3];
    s[id]=clamp(value,f[2],max);
    if(goalIsActive()){
      if(goalManuals[active]&&id!=='goal'&&id!==goalPlans[active].solve)goalManuals[active][id]=s[id];
      goalSolver(active);
    }
    if(active==='mortgage'&&id==='price'){
      const fEquity=c.fields.find(x=>x[0]==='equity');
      const equityMax=Math.min(fEquity[3],s.price);
      s.equity=clamp(s.equity,fEquity[2],equityMax);
      const sr=q('range-equity'),nr=q('number-equity');sr.max=nr.max=equityMax;
      sr.closest('.range-control').nextElementSibling.lastElementChild.textContent=money(equityMax);
      sr.value=nr.value=s.equity;paintSlider(sr);
    }
    const slider=q('range-'+id),number=q('number-'+id);
    // Always synchronize both native controls, regardless of the event source.
    // In particular, double-click reset must move the actual range thumb.
    slider.value=String(s[id]);
    number.value=String(s[id]);
    // Keep native number-spinner arrows proportional after updates from every source.
    number.step=String(adaptiveArrowStep(s[id],f[6],f[4]));
    updateResetControls(id);
    if(active==='savings'||active==='index')syncGoalPlanningUI();
    renderResults();
    saveState();
  }
  function renderComposition(){
    const s=states[active];
    let a=0,b=0,al='',bl='',negative=false;
    if(active==='mortgage'){
      a=Math.max(0,s.equity);b=Math.max(0,s.price-s.equity);al='הון עצמי';bl='מימון בנקאי';
    }else if(active==='loan'){
      const result=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      a=s.principal;b=Math.max(0,result.interest);al='קרן';bl='ריבית';
    }else if(active==='savings'||active==='index'){
      const r=futureValue(s,s.rate,active==='index'?s.fees:0,contributions[active]||[]);
      const gain=r.value-r.contributed;
      negative=gain<0;
      if(negative){a=Math.max(0,r.value);b=-gain;al='שווי נוכחי';bl='הפסד משוער';}
      else{a=Math.max(0,r.contributed);b=gain;al='הפקדות';bl='רווח משוער';}
    }else if(active==='budget'){
      const annual=(advanced.budget.annualItems||[]).reduce((sum,e)=>sum+Number(e.amount||0),0)/12;
      const committed=s.housing+s.living+s.bills+s.spending+s.savings+annual;
      negative=committed>s.income;
      if(negative){a=s.income;b=committed-s.income;al='הכנסה';bl='חריגה';}
      else{a=committed;b=Math.max(0,s.income-committed);al='הוצאות וחיסכון';bl='יתרה פנויה';}
    }
    const total=Math.max(.001,a+b),aPct=100*a/total,bPct=100*b/total;
    q('composition').classList.toggle('is-negative',negative);
    q('composition').innerHTML=`<div class="composition-labels"><span><i class="comp-swatch comp-a"></i>${al} <b dir="ltr">${compactMoney(a)}</b></span><span><i class="comp-swatch comp-b"></i>${bl} <b dir="ltr">${compactMoney(b)}</b></span></div><div class="composition-track" role="img" aria-label="${al} ${money(a)}, ${bl} ${money(b)}"><div class="composition-part composition-a" style="width:${aPct}%"></div><div class="composition-part composition-b" style="width:${bPct}%"></div></div>`;
  }

  // Animated, semantic ring indicator: financing / goal / gains / interest / budget utilization.
  const meterCircumference=2*Math.PI*31;
  const meterCircumferenceSecondary=2*Math.PI*39;
  const meterCircumferenceTertiary=2*Math.PI*47;
  const meterProgress=q('meterProgress'),meterProgressSecondary=q('meterProgressSecondary'),meterProgressTertiary=q('meterProgressTertiary'),meterTrackSecondary=q('meterTrackSecondary'),meterTrackTertiary=q('meterTrackTertiary'),meterNumber=q('meterNumber'),meterLabel=q('meterLabel'),meter=q('heroMeter');
  let meterValue=0,meterTarget=0,meterFrame=0,meterFrameStart=0;
  function meterMetric(){
    const s=states[active];
    if(active==='mortgage'){
      const rate=s.price>0?100*Math.max(0,s.price-s.equity)/s.price:0;
      return {value:rate,label:'שיעור מימון',detail:'אחוז ממחיר הנכס שממומן באמצעות משכנתא'};
    }
    if(active==='savings'){
      const r=futureValue(s,s.rate,0,contributions.savings||[],s.goal);
      const rate=s.goal>0?r.value/s.goal*100:0;
      return {value:rate,label:'מהיעד',detail:'אחוז מהיעד שהגדרת שהסימולציה צפויה להשיג'};
    }
    if(active==='index'){
      const r=futureValue(s,s.rate,s.fees,contributions.index||[]);
      const basis=Math.max(r.contributed,r.inflationBasis||r.contributed);
      const tax=advanced.index.taxEnabled?Math.max(0,r.value-basis)*advanced.index.taxRate/100:0;
      const netGain=r.value-r.contributed-tax;
      const cumulativeReturn=r.contributed>0?100*netGain/r.contributed:0;
      return {value:cumulativeReturn,label:'תשואה נטו',detail:advanced.index.taxEnabled?'תשואה מצטברת ביחס לכלל ההפקדות, אחרי דמי ניהול ואומדן מס. לא תשואה שנתית.':'תשואה מצטברת ביחס לכלל ההפקדות, אחרי דמי ניהול ולפני מס. לא תשואה שנתית.'};
    }
    if(active==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      const total=s.principal+r.interest;
      return {value:total>0?100*r.interest/total:0,label:'חלק הריבית',detail:'אחוז הריבית מסך התשלומים לאורך חיי ההלוואה'};
    }
    const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+(Number(item.amount)||0),0)/12;
    const out=s.housing+s.bills+s.living+s.spending+s.savings+annual;
    return {value:s.income>0?100*out/s.income:(out>0?100:0),label:'ניצול הכנסה',detail:'אחוז ההכנסה המיועד להוצאות ולחיסכון; מעל 100% משמעו גירעון'};
  }
  function setMeterRings(totalValue){
    const showMulti=active==='index';
    const first=clamp(totalValue,0,100);
    const second=clamp(totalValue-100,0,100);
    const third=clamp(totalValue-200,0,100);
    const ringCount=showMulti?(totalValue>200?3:(totalValue>100?2:1)):1;
    meter.dataset.rings=String(ringCount);
    meterProgress.style.strokeDashoffset=String(meterCircumference*(1-first/100));
    meterProgress.style.opacity=first>0?'1':'0';
    meterProgressSecondary.style.strokeDashoffset=String(meterCircumferenceSecondary*(1-second/100));
    meterProgressSecondary.style.opacity=showMulti&&totalValue>100&&second>0?'1':'0';
    meterTrackSecondary.style.opacity=showMulti&&totalValue>100?'.82':'0';
    meterProgressTertiary.style.strokeDashoffset=String(meterCircumferenceTertiary*(1-third/100));
    meterProgressTertiary.style.opacity=showMulti&&totalValue>200&&third>0?'1':'0';
    meterTrackTertiary.style.opacity=showMulti&&totalValue>200?'.78':'0';
  }
  // Size the percentage to the usable width inside the INNER ring (r=31/120).
  // This prevents 101%, 153%, 220% and longer values from striking the ring.
  function fitMeterNumber(fromValue,toValue){
    const currentText=meterNumber.textContent;
    meterNumber.style.fontSize='';
    const baseSize=parseFloat(getComputedStyle(meterNumber).fontSize)||23;
    const aperture=meter.getBoundingClientRect().width*0.39;
    let widest=0;
    for(const value of [fromValue,toValue]){
      meterNumber.textContent=Math.round(value)+'%';
      widest=Math.max(widest,meterNumber.getBoundingClientRect().width);
    }
    meterNumber.textContent=currentText;
    const fitted=widest>0?Math.min(baseSize,baseSize*aperture/widest):baseSize;
    meterNumber.style.fontSize=Math.max(10,Math.floor(fitted*10)/10)+'px';
  }
  window.addEventListener('resize',()=>fitMeterNumber(meterValue,meterTarget));
  if(document.fonts?.ready)document.fonts.ready.then(()=>fitMeterNumber(meterValue,meterTarget));

  function updateMeter(){
    const m=meterMetric();
    const raw=Number.isFinite(m.value)?m.value:0;
    const target=Math.max(-999,Math.min(9999,raw));
    meterLabel.textContent=m.label;
    const multiHint=active==='index'&&raw>100?' כל טבעת מלאה מייצגת 100%.':'';
    meter.setAttribute('aria-label',m.label+': '+pct(raw)+'. '+m.detail+multiHint);
    meter.title=m.detail+' · '+pct(raw)+(active==='index'&&raw>100?' · כל טבעת מלאה מייצגת 100%':'');
    setMeterRings(target);
    meter.dataset.state=active==='budget'&&raw>100?'alert':active==='savings'&&raw>=100?'complete':'normal';
    if(meterFrame)cancelAnimationFrame(meterFrame);
    const from=meterValue;
    meterTarget=target;
    fitMeterNumber(from,target);
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      meterValue=target;meterNumber.textContent=Math.round(target)+'%';return;
    }
    const duration=340;
    meterFrameStart=performance.now();
    const animate=(timestamp)=>{
      const t=Math.max(0,Math.min(1,(timestamp-meterFrameStart)/duration));
      const smooth=1-Math.pow(1-t,3);
      const current=from+(meterTarget-from)*smooth;
      meterValue=current;
      meterNumber.textContent=Math.round(current)+'%';
      if(t<1)meterFrame=requestAnimationFrame(animate);else meterFrame=0;
    };
    meterFrame=requestAnimationFrame(animate);
  }

  // The baseline mirrors the actual Reset button: user-configured slider reset
  // points, no scheduled savings deposits, and preserved advanced settings.
  function resetBaseline(tab){
    const values=Object.fromEntries(configs[tab].fields.map(f=>[f[0],getResetPoint(tab,f[0])]));
    if(tab==='mortgage'){
      values.equity=Math.min(values.equity,values.price);
      values.kind='first';
    }
    return values;
  }
  function headlineValue(tab,s,events=[]){
    if(tab==='mortgage')return schedule(Math.max(0,s.price-s.equity),s.rate,s.years,s.extra).payment+advanced.mortgage.insurance;
    if(tab==='loan')return schedule(s.principal,s.rate,loanTermYears(s),s.extra).payment;
    if(tab==='savings'||tab==='index')return futureValue(s,s.rate,tab==='index'?s.fees:0,events).value;
    const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+(Number(item.amount)||0),0)/12;
    return s.income-s.housing-s.bills-s.living-s.spending-s.savings-annual;
  }
  function secondaryMetric(){
    const s=states[active];
    if(active==='mortgage'){
      if(advanced.mortgage.income>0){
        const share=100*headlineValue(active,s)/advanced.mortgage.income;
        return {label:'יחס החזר להכנסה',value:pct(share),detail:'כולל ביטוח, לפי ההכנסה שהוגדרה'};
      }
      const required=s.price*(1-limits[s.kind]);
      return {label:'הון עצמי מינימלי',value:money(required),detail:'לפי תקרת המימון לסוג הנכס'};
    }
    if(active==='savings'){
      const r=futureValue(s,s.rate,0,contributions.savings||[],s.goal);
      if(goalIsActive('savings')&&goalPlans.savings.solve==='years')return {label:'משך החיסכון הנדרש',value:yearLabel(s.years),detail:'תקופת מינימום בחודשים לפי חישוב היעד הנעול'};
      if(r.reachedMonth===null)return {label:'זמן להשגת היעד',value:'לא הושג',detail:'בתקופת החיסכון שנבחרה'};
      if(r.reachedMonth===0)return {label:'זמן להשגת היעד',value:'כבר הושג',detail:'הסכום ההתחלתי מכסה את היעד'};
      return {label:'זמן להשגת היעד',value:Number((r.reachedMonth/12).toFixed(1)).toLocaleString('he-IL')+' שנים',detail:'בהנחת התשואה בסימולציה'};
    }
    if(active==='index'){
      const r=futureValue(s,s.rate,s.fees,contributions.index||[]),gain=r.value-r.contributed;
      if(goalIsActive('index'))return {label:'התקדמות ליעד',value:pct(s.goal>0?r.value/s.goal*100:0),detail:'שווי נומינלי לפני מס ביחס ליעד הנעול'};
      if(r.contributed<=0)return {label:'רווח לכל ₪1,000',value:'—',detail:'נדרשות הפקדות לחישוב היחס'};
      return {label:'רווח לכל ₪1,000',value:money(gain/r.contributed*1000),detail:'שקלים לכל ₪1,000 שהופקדו · לפני מס'};
    }
    if(active==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      return {label:'החזר לכל ₪1,000',value:money(1000*(s.principal+r.interest)/s.principal),detail:'סך החזר קרן וריבית לאורך התקופה'};
    }
    const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+(Number(item.amount)||0),0)/12;
    const monthly=s.income-s.housing-s.bills-s.living-s.spending-s.savings-annual;
    return {label:monthly<0?'גירעון שנתי צפוי':'עודף שנתי צפוי',value:money(monthly*12),detail:'אם התקציב החודשי יישאר קבוע'};
  }
  function updateHeroSecondary(){
    const metric=secondaryMetric();
    q('heroSecondaryLabel').textContent=metric.label;
    q('heroSecondaryNumber').textContent=metric.value;
    q('heroSecondaryDesc').textContent=metric.detail;
    q('heroSecondary').title=metric.label+': '+metric.value+'. '+metric.detail;
    const current=headlineValue(active,states[active],contributions[active]||[]);
    const original=headlineValue(active,resetBaseline(active));
    const difference=current-original;
    const nearlyEqual=Math.abs(difference)<.5;
    const delta=nearlyEqual?'ללא שינוי':(difference>0?'+':'−')+(Math.abs(difference)>=1000000?'₪'+compactMoney(Math.abs(difference)):money(Math.abs(difference)));
    const baseline=q('heroBaselineDelta');
    baseline.textContent=delta;
    baseline.classList.toggle('is-equal',nearlyEqual);
    q('heroBaseline').title='תרחיש הבסיס מבוסס על ערכי האיפוס שהגדרת לסליידרים · תוצאה בסיסית: '+money(original)+' · תוצאה נוכחית: '+money(current)+' · הפרש: '+money(difference);
    q('heroBaseline').setAttribute('aria-label','הפרש מתרחיש בסיס נבחר: '+(nearlyEqual?'ללא שינוי':money(difference)));
  }

  let currentStats=[];
  function show(mainLabel,mainValue,tag,description,stats,chartTitle,chartCaption,chartContent,chartBottom,insight,tone='info',status='מידע'){
    q('heroLabel').textContent=mainLabel;q('heroNumber').textContent=mainValue;q('mobileLabel').textContent=mainLabel;q('mobileNumber').textContent=mainValue;q('heroTag').textContent=tag;q('heroDesc').textContent=description;
    q('stats').innerHTML=stats.map(([label,value,mini],i)=>`<button type="button" class="stat" data-stat-index="${i}" aria-label="פרטים על ${escapeHtml(label)}"><div class="stat-label">${label}</div><div class="stat-number">${value}</div>${mini?`<div class="stat-mini">${mini}</div>`:''}</button>`).join('');currentStats=stats.map(x=>[...x]);
    q('chartTitle').textContent=chartTitle;q('chartCaption').textContent=chartCaption;q('chart').innerHTML=chartContent; if(typeof toolTip!=='undefined')toolTip.hidden=true;
    q('chartBottom').textContent=chartBottom+(goalIsActive()&&goalFeedback[active]&&!goalFeedback[active].reached?' · '+goalFeedback[active].message:'')+comparisonText();renderComposition();updateMeter();
    const heroStatus=q('heroStatus');
    heroStatus.hidden=!status;
    heroStatus.textContent=status||'';
    heroStatus.dataset.tone=tone||'info';
    heroStatus.title=insight||status||'';
    heroStatus.setAttribute('aria-label',(status||'')+(insight?': '+insight:''));
    updateHeroSecondary();updateTransferActions();
    const toggle=q('riskToggle'),volControl=q('riskVolWrap'),riskLine=q('riskSummary');
    toggle.hidden=active!=='index';toggle.setAttribute('aria-pressed',String(riskSettings.enabled));
    toggle.textContent=riskSettings.enabled?'הסתר טווח':'טווח תרחישים';
    volControl.hidden=active!=='index'||!riskSettings.enabled;
    q('riskVolatility').value=String(riskSettings.volatility);
    riskLine.hidden=!(active==='index'&&riskSettings.enabled&&riskLast);
    if(!riskLine.hidden)riskLine.textContent='הדמיה · 10–90%: '+money(riskLast.low.at(-1))+'–'+money(riskLast.high.at(-1))+
      ' · חציון '+money(riskLast.median.at(-1))+' · '+riskLast.goalShare+'% הגיעו ליעד · לא תחזית.';
    const chartToggle=q('chartModeToggle'),isInvest=active==='savings'||active==='index';
    chartToggle.hidden=!isInvest;if(isInvest){chartToggle.setAttribute('aria-pressed',String(chartModes[active]));chartToggle.textContent=chartModes[active]?'הסתר הפקדות':'הפקדות';}
  }

  function scenarioFor(tab){const rec=scenarios[tab].find(x=>x.id===compareIds[tab])||null;return rec&&compareDrafts[tab]?.id===rec.id?compareDrafts[tab]:rec;}
  function scenarioOutput(tab,rec){
    if(!rec)return null;
    const s=rec.values||{};
    if(tab==='mortgage'){const p=Math.max(0,s.price-s.equity),r=schedule(p,s.rate,s.years,s.extra);return {value:r.payment+(rec.advanced?.insurance||0),series:r.monthlySeries,years:r.months/12};}
    if(tab==='loan'){const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);return {value:r.payment,series:r.monthlySeries,years:r.months/12};}
    if(tab==='savings'||tab==='index'){
      const r=futureValue(s,s.rate,tab==='index'?s.fees:0,rec.events||[]);
      const tax=tab==='index'&&rec.advanced?.taxEnabled?Math.max(0,r.value-Math.max(r.contributed,r.inflationBasis||r.contributed))*(Number(rec.advanced.taxRate)||0)/100:0;
      return {value:r.value-tax,series:r.monthlySeries,years:s.years};
    }
    if(tab==='budget'){const a=(rec.advanced?.annualItems||[]).reduce((total,x)=>total+(Number(x.amount)||0),0)/12;return {value:s.income-s.housing-s.bills-s.living-(s.spending||0)-s.savings-a,series:null,years:1};}
    return null;
  }
  function currentScenarioValue(){return scenarioOutput(active,{values:states[active],events:contributions[active]||[],advanced:advanced[active]||{}});}
  function comparisonText(){const rec=scenarioFor(active),base=rec&&scenarioOutput(active,rec),current=currentScenarioValue();if(!base||!current)return '';
    const delta=current.value-base.value;return ` · מול ״${rec.name}״: ${money(base.value)} (פער ${delta>=0?'+':''}${money(delta)})`;
  }
  let hoverChartModel=null;
  function lineChart(data,years,events=[],principalSeries=null){
    const values=data.length?data:[0];
    const compare=scenarioFor(active),other=scenarioOutput(active,compare);
    const horizon=Math.max(.01,years,other?.years||0);
    // Match SVG coordinates to the actual chart region so the plot fills it.
    const plot=q('chart').getBoundingClientRect();
    const w=Math.max(360,Math.round(plot.width)||600);
    const compact=window.matchMedia('(max-width:1050px)').matches;
    const h=compact?Math.max(225,Math.min(320,Math.round(w*.6))):
      Math.max(190,Math.min(345,Math.round(plot.height)||240));
    const x0=34,x1=w-36,y0=h-38,y1=26;
    const risk=active==='index'&&riskSettings.enabled?riskEnvelope(states.index,events,riskSettings.volatility):null;
    riskLast=risk;
    const allValues=[...values,...(other?.series||[]),...(chartModes[active]&&principalSeries?principalSeries:[]),...(risk?.high||[])];
    const max=Math.max(1,...allValues)*1.14;
    const coords=(series,length)=>series.map((v,i)=>[x0+(x1-x0)*(length/horizon)*(i/Math.max(1,series.length-1)),y0-(Math.max(0,v)/max)*(y0-y1)]);
    const coord=coords(values,years);
    const linePath=points=>points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
    const path=linePath(coord),last=coord.at(-1);
    const area=path+` L ${last[0]} ${y0} L ${coord[0][0]} ${y0} Z`;
    const axisColor='#c4b6a6';
    const baseline=`<line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="${axisColor}" stroke-width="1.35"/>`;
    const milestoneCount=Math.min(6,Math.max(4,Math.round(years/5)+3));
    const milestoneIndexes=[...new Set(Array.from({length:milestoneCount},(_,step)=>Math.round((values.length-1)*step/Math.max(1,milestoneCount-1))))].filter(i=>i>=0&&i<coord.length);
    const fmtYear=y=>Number(y.toFixed(1)).toLocaleString('en-US',{maximumFractionDigits:1});
    const axisMarkers=milestoneIndexes.map((i,idx)=>{
      const p=coord[i],v=values[i],x=p[0],actualYear=years*i/Math.max(1,values.length-1);
      // A slight teardrop thickening where an axis marker joins the baseline.
      // Zero vertical slope at its tips makes the point taper naturally into the line.
      const half=8.1,r=2.45;
      const shape=`M ${x-half} ${y0} C ${x-half*.45} ${y0}, ${x-half*.52} ${y0-r}, ${x} ${y0-r} C ${x+half*.52} ${y0-r}, ${x+half*.45} ${y0}, ${x+half} ${y0} C ${x+half*.45} ${y0}, ${x+half*.52} ${y0+r}, ${x} ${y0+r} C ${x-half*.52} ${y0+r}, ${x-half*.45} ${y0}, ${x-half} ${y0} Z`;
      if(i===0)return `<path d="${shape}" fill="${axisColor}"/>`;
      const yearText=fmtYear(actualYear),shiftX=-13,labelX=x+shiftX;
      const labelY=Math.max(14,p[1]-(22+(idx%2)*4));
      const connector=`M ${labelX} ${labelY+4} Q ${x-10} ${Math.max(10,labelY+1)} ${x} ${Math.max(10,p[1]-4)}`;
      const tooltip=`${active==='loan'?'חודש '+Math.round(actualYear*12):'שנה '+yearText} · ${active==='loan'?'יתרה':'שווי'} ${money(v)}`+(principalSeries?.[i]!==undefined?` · הפקדות ${money(principalSeries[i])} · רווח ${money(v-principalSeries[i])}`:'');
      return `<path d="${shape}" fill="${axisColor}"/><line x1="${x}" y1="${y0-4}" x2="${x}" y2="${Math.min(y0-6,p[1]+6)}" stroke="#d8cec0" stroke-width="1" stroke-dasharray="2.4 4.2" opacity=".95"/><path d="${connector}" fill="none" stroke="#bda68b" stroke-width="1.15" stroke-linecap="round" opacity=".9"/><text x="${labelX}" y="${labelY}" direction="ltr" text-anchor="end" fill="#7e7264" font-size="10.5" font-family="Calibri, Carlito, Arial, sans-serif">${compactMoney(v)}</text><text x="${x}" y="${y0+19}" text-anchor="middle" fill="#968677" font-size="10.5" font-family="Calibri, Carlito, Arial, sans-serif">${active==='loan'?Math.round(actualYear*12):yearText}</text><circle cx="${x}" cy="${p[1]}" r="11" opacity="0" fill="#fff" tabindex="0" role="img" aria-label="${tooltip}" data-tip="${tooltip}"/>`;
    }).join('');
    const eventDots=events.filter(e=>e.month<=years*12).map(e=>{
      const p=coord[e.month];if(!p)return '';
      const when=`שנה ${Math.floor((e.month-1)/12)+1}, חודש ${((e.month-1)%12)+1}`;
      const label=e.type==='monthly'?`שינוי הפקדה חודשית ל־${money(e.amount)}`:`הפקדה חד־פעמית של ${money(e.amount)}`;
      const tooltip=`${when} · ${label} · שווי משוער: ${money(values[e.month])}`;
      return `<circle cx="${p[0]}" cy="${p[1]}" r="5.3" fill="#fffdf9" stroke="var(--accent)" stroke-width="2"/><circle cx="${p[0]}" cy="${p[1]}" r="14" fill="transparent" tabindex="0" role="img" aria-label="${tooltip}" data-tip="${tooltip}"/>`;
    }).join('');
    const principalPath=chartModes[active]&&principalSeries?.length===values.length
      ?`<path d="${linePath(coords(principalSeries,years))}" fill="none" stroke="#af8d68" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" opacity=".95"/>`:'';
    const riskArea=risk?(()=>{
      const upper=risk.months.map((month,i)=>[x0+(x1-x0)*month/12/horizon,y0-Math.max(0,risk.high[i])/max*(y0-y1)]);
      const lower=risk.months.map((month,i)=>[x0+(x1-x0)*month/12/horizon,y0-Math.max(0,risk.low[i])/max*(y0-y1)]);
      const median=risk.months.map((month,i)=>[x0+(x1-x0)*month/12/horizon,y0-Math.max(0,risk.median[i])/max*(y0-y1)]);
      const outline=linePath(upper)+' '+lower.reverse().map(p=>'L'+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ')+' Z';
      return '<path d="'+outline+'" fill="#7e9b86" opacity=".23"/>'+
        '<path d="'+linePath(median)+'" fill="none" stroke="#577666" stroke-width="1.8" stroke-dasharray="5 4" opacity=".85"/>';
    })():'';
    const otherPath=other?.series?`<path d="${linePath(coords(other.series,other.years))}" fill="none" stroke="#9a806c" stroke-width="2.2" stroke-dasharray="7 6" stroke-linecap="round" opacity=".78"/>`:'';
    hoverChartModel={values:[...values],years,horizon,x0,x1,y0,y1,max,
      principal:principalSeries?[...principalSeries]:null,
      events:events.map(e=>({...e})),risk:risk?{months:risk.months,low:risk.low,high:risk.high}:null,compare:other?.series?[...other.series]:null,compareYears:other?.years||0};
    return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="גרף שינוי סכום לאורך זמן משמאל לימין"><defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".15"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><rect x="${x0}" y="${y1-12}" width="${x1-x0}" height="${y0-y1+26}" fill="transparent" pointer-events="all"/>${riskArea}<path d="${area}" fill="url(#lineFill)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>${principalPath}${otherPath}${baseline}${axisMarkers}${eventDots}<circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="var(--accent)" stroke="#fffdf9" stroke-width="1.5"/>${(active==='savings'||active==='index')&&!goalPinned[active].includes('monthly')&&!(goalIsActive()&&goalPlans[active].solve==='monthly')&&!events.some(e=>e.type==='monthly'&&e.month===1)?`<circle class="chart-edit-halo" cx="${last[0]}" cy="${last[1]}" r="15" fill="var(--accent-soft)" stroke="var(--accent)" stroke-opacity=".44" stroke-width="1.5" tabindex="0" role="slider" aria-label="גרור כדי לשנות את ההפקדה החודשית" aria-valuemin="${configs[active].fields.find(f=>f[0]==='monthly')[2]}" aria-valuemax="${configs[active].fields.find(f=>f[0]==='monthly')[3]}" aria-valuenow="${states[active].monthly}" data-chart-drag="monthly"><title>גרור מעלה או מטה לשינוי ההפקדה החודשית</title></circle>`:''}<g class="chart-cursor" style="display:none" pointer-events="none"><line class="chart-cursor-line" x1="0" y1="${y0}" x2="0" y2="${y0}" stroke="var(--accent)" stroke-opacity=".38" stroke-dasharray="3 4" stroke-width="1.25"/><circle class="chart-cursor-dot" cx="0" cy="${y0}" r="4.5" fill="var(--accent)" stroke="#fffdfa" stroke-width="2"/></g></svg><div class="chart-axis"><span>${active==='loan'?'חודשים':'שנים'}${chartModes[active]?' · קו מנוקד חום: סך הפקדות':''}${other?' · קו מקווקו: '+escapeHtml(compare.name):''}${risk?' · רצועה: טווח 10–90% מההדמיה':''}</span></div>`;
  }
  function budgetBars(items){hoverChartModel=null;
    const max=Math.max(1,...items.map(i=>i[1]))*1.15;
    const total=items.reduce((sum,item)=>sum+Math.max(0,item[1]),0);
    return `<div class="bar-chart">${items.map(([title,v,id],i)=>`<div class="bar-row" ${id?`data-budget-scale="${max}" data-budget-field="${id}" role="button" aria-label="עריכת ${escapeHtml(title)}"`:""} data-tip="${escapeHtml(title)}: ${money(v)} · ${pct(total?100*v/total:0)} מסך ההוצאות וההפקדות" tabindex="0"><div class="bar-name" title="${escapeHtml(title)}">${escapeHtml(title)}</div><div class="bar-track"><div class="bar-fill" style="width:${100*v/max}%;opacity:${1-i*.12}"></div></div><div class="bar-amount">${money(v)}</div></div>`).join('')}<div class="bar-chart-guide">גרירה לשינוי · לחיצה לעריכה</div></div>`;
  }

  // Stage 6: RTL cash-flow ribbon diagram; every band is derived from monthly budget fields.
  function budgetFlowChart(items,income){
    hoverChartModel=null;
    const chosen=items.map(([title,value,id],i)=>({title:String(title),value:Math.max(0,Number(value)||0),id:id||null,i})).filter(e=>e.value>0);
    const committed=chosen.reduce((sum,e)=>sum+e.value,0);
    const surplus=Math.max(0,income-committed),shortfall=Math.max(0,committed-income);
    if(surplus>0)chosen.push({title:'יתרה פנויה',value:surplus,id:null,i:chosen.length});
    const overall=Math.max(1,committed,income);
    const palette=['#97836c','#b29978','#81927b','#c0ab90','#ab8176','#72867f','#c5ba9f','#91a486'];
    let sourceY=21,destinationY=21;
    const spacing=5.5,totalHeight=154,available=Math.max(60,totalHeight-spacing*Math.max(0,chosen.length-1));
    const parts=chosen.map((item,i)=>{
      const thick=Math.max(1.1,item.value/overall*available);
      const sy=sourceY,dy=destinationY;
      sourceY+=thick;destinationY+=thick+spacing;
      const fill=palette[i%palette.length],title=escapeHtml(item.title),value=money(item.value);
      const path='M 507 '+sy+' C 380 '+sy+' 278 '+dy+' 157 '+dy+
        ' L 157 '+(dy+thick)+' C 278 '+(dy+thick)+' 380 '+(sy+thick)+' 507 '+(sy+thick)+' Z';
      const attr=item.id?' data-budget-field="'+item.id+'" tabindex="0" role="button" aria-label="ערוך '+title+'"':'';
      return '<g class="budget-flow-band"'+attr+' data-tip="'+title+' · '+escapeHtml(value)+'">'+
        '<path d="'+path+'" fill="'+fill+'" opacity=".8"/>'+
        '<rect x="147" y="'+dy+'" width="10" height="'+thick+'" rx="1.5" fill="'+fill+'"/>'+
        '<title>'+title+': '+escapeHtml(value)+'</title></g>';
    }).join('');
    const legend=chosen.map((item,i)=>
      '<div class="flow-legend-item"'+(item.id?' data-budget-field="'+item.id+'" tabindex="0" role="button"':'')+'>'+
      '<i style="background:'+palette[i%palette.length]+'"></i><span>'+escapeHtml(item.title)+'</span><strong>'+money(item.value)+'</strong></div>'
    ).join('');
    return '<div class="budget-flow">'+
      '<div class="budget-flow-head"><strong>הכנסה: '+money(income)+'</strong><span>'+(shortfall?'חריגה מההכנסה: '+money(shortfall):'יתרה פנויה: '+money(surplus))+'</span></div>'+
      '<svg viewBox="0 0 620 195" class="budget-flow-svg" role="group" aria-label="זרימת הכנסה להוצאות, חיסכון ויתרה פנויה" preserveAspectRatio="xMidYMid meet">'+
      '<text x="550" y="17" text-anchor="middle" direction="rtl" font-size="12" fill="#6b5e50">הכנסה</text>'+
      '<text x="120" y="17" text-anchor="middle" direction="rtl" font-size="12" fill="#6b5e50">חלוקה</text>'+
      parts+'<rect x="507" y="21" width="16" height="'+Math.max(1,sourceY-21)+'" rx="3" fill="var(--accent)"/>'+
      '</svg><div class="flow-legend">'+legend+'</div>'+
      '<div class="bar-chart-guide">לחיצה לעריכה</div></div>';
  }
  function renderResults(){
    const s=states[active];
    if(active==='mortgage'){
      const p=Math.max(0,s.price-s.equity),res=schedule(p,s.rate,s.years,s.extra),base=schedule(p,s.rate,s.years,0);
      const ltv=100*p/s.price,cap=limits[s.kind],shortage=Math.max(0,s.price*(1-cap)-s.equity);
      const insurance=advanced.mortgage.insurance,oneTime=advanced.mortgage.purchaseCosts;
      const yearsActual=res.months/12,yearsSaved=Math.max(0,(base.months-res.months)/12);
      const message=shortage>0?`שימו לב: שיעור המימון הוא ${pct(ltv)}. בהנחת תקרת מימון של ${pct(cap*100)}, חסרים עוד ${money(shortage)} בהון העצמי (לפני הוצאות רכישה).`:`שיעור המימון הוא ${pct(ltv)} — בתוך תקרת המימון של ${pct(cap*100)} שנבחרה. עדיין נדרש אישור בנק ובדיקת כושר החזר.`;
      show('החזר חודשי צפוי',money(res.payment+insurance),'משכנתא',`תשלום בסיסי ${money(res.base)} ${s.extra>0?`+ תוספת ${money(s.extra)}`:''}${insurance?` + ביטוח ${money(insurance)}`:''} בכל חודש.`,[
        ['סכום המשכנתא',money(p),'מחיר הנכס פחות ההון העצמי'],['סך הריבית',money(res.interest),'בהנחת ריבית קבועה'],['שיעור מימון',pct(ltv),'מסך מחיר הדירה'],['משך החזר בפועל',`${Number(yearsActual.toFixed(1))} שנים`,yearsSaved?`קיצור של ${Number(yearsSaved.toFixed(1))} שנים`:'ללא פירעון מוקדם']
      ],'יתרת המשכנתא לאורך זמן','סימולציית יתרת קרן',lineChart(res.monthlySeries,yearsActual),`סך ההחזרים הכולל: ${money(p+res.interest+insurance*res.months)}. ${oneTime?`הוצאות רכישה נוספות: ${money(oneTime)}. `:''}${insurance?`ביטוח חודשי: ${money(insurance)}. `:''}${advanced.mortgage.stressRise?`אם הריבית הייתה עולה ב־${pct(advanced.mortgage.stressRise)} נקודות אחוז, ההחזר הבסיסי היה ${money(annuity(p,s.rate+advanced.mortgage.stressRise,s.years*12))}. `:''}${s.extra>0?`חיסכון ריבית לעומת ללא תוספת: ${money(base.interest-res.interest)}.`:''}`,message,shortage>0||advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.4?'warn':advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.3?'info':'good',shortage>0?'חסר הון עצמי':advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.4?'יחס החזר גבוה':advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.3?'בדקו כושר החזר':'בטווח המימון');
    }else if(active==='savings'){
      const events=contributions.savings;
      const r=futureValue(s,s.rate,0,events,s.goal),gain=r.value-r.contributed;
      const reached=r.reachedMonth;
      const activeCount=events.filter(e=>e.month<=s.years*12).length;
      show('סכום החיסכון בסוף התקופה',money(r.value),'חיסכון',`תחזית אחרי ${s.years} שנות חיסכון בריבית שנתית של ${pct(s.rate)}.`,[
        ['כסף שהפקדתם',money(r.contributed),'כולל סכום התחלתי'],['רווחים מריבית',money(gain),'ריבית דריבית'],['שיעור הרווח מסך הצבירה',pct(r.value?gain/r.value*100:0),'ללא מס ועמלות'],['פער מיעד החיסכון',money(Math.abs(s.goal-r.value)),s.goal<=r.value?'מעל היעד':'חסרים ליעד']
      ],'איך החיסכון גדל','צבירה שנתית',lineChart(r.monthlySeries,s.years,events,r.contributionSeries),`הפקדה חודשית התחלתית: ${money(s.monthly)}${activeCount?` · ${activeCount} שינויים עתידיים`:''}. סך הרווח המחושב: ${money(gain)}.`,reached===null?`בסימולציה הנוכחית לא מגיעים ליעד של ${money(s.goal)} בתוך ${s.years} שנים. הגדלת ההפקדה או משך החיסכון יכולה לשנות זאת.`:reached===0?'הסכום ההתחלתי כבר מכסה את יעד החיסכון שהגדרתם.':`את יעד החיסכון של ${money(s.goal)} צפויים להגיע אחרי כ־${(reached/12).toFixed(1)} שנים, בהנחה שהתשואה נשמרת.`,goalIsActive()&&!goalFeedback.savings?.reached?'warn':reached===null?'warn':'good',goalIsActive()?goalFeedback.savings?.reached?'יעד נעול והושג':'יעד מחוץ לטווח':reached===null?'מתחת ליעד':'יעד מושג');
    }else if(active==='index'){
      const events=contributions.index;
      const r=futureValue(s,s.rate,s.fees,events),real=r.value/Math.pow(1+s.inflation/100,s.years),gain=r.value-r.contributed;
      const taxBasis=Math.max(r.contributed,r.inflationBasis||r.contributed),estimatedTax=advanced.index.taxEnabled?Math.max(0,r.value-taxBasis)*advanced.index.taxRate/100:0;
      const low=futureValue(s,s.rate-3,s.fees,events).value,high=futureValue(s,s.rate+3,s.fees,events).value;
      const activeCount=events.filter(e=>e.month<=s.years*12).length;
      show('שווי תיק',money(r.value),'S&P 500',`סימולציה לפי תשואה שנתית של ${pct(s.rate)} לפני דמי ניהול${goalIsActive()?' · יעד נעול '+money(s.goal):''}.`,[
        ['סך ההפקדות',money(r.contributed),'הפקדות'],['רווח / הפסד נומינלי',money(gain),'לפני מס'],['שווי בכסף של היום',money(real),`בהנחת אינפלציה של ${pct(s.inflation)}`],[advanced.index.taxEnabled?'נטו לאחר מס משוער':'עלות השפעת דמי ניהול',money(advanced.index.taxEnabled?r.value-estimatedTax:futureValue(s,s.rate,0,events).value-r.value),advanced.index.taxEnabled?'מס משוער: '+money(estimatedTax):'עלות דמי הניהול']
      ],'צמיחת התיק','תשואה קבועה',lineChart(r.monthlySeries,s.years,events,r.contributionSeries),`${advanced.index.taxEnabled?`מס משוער: ${money(estimatedTax)} · `:''}${activeCount?`${activeCount} שינויים בהפקדות · `:''}תרחיש של תשואה נמוכה ב־3 נקודות אחוז: ${money(low)} · גבוהה ב־3 נקודות: ${money(high)}.`,`התשואה אינה קבועה. קיימים סיכוני ירידות ומטבע; זו סימולציה, לא תחזית.`,goalIsActive()&&!goalFeedback.index?.reached?'warn':gain<0?'warn':'info',goalIsActive()?goalFeedback.index?.reached?'יעד נעול והושג':'יעד מחוץ לטווח':gain<0?'תרחיש הפסד':'השקעה');
    }else if(active==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra),base=schedule(s.principal,s.rate,loanTermYears(s),0),saved=base.interest-r.interest;
      show('החזר חודשי כולל',money(r.payment),'הלוואה',`החזר בסיסי ${money(r.base)} ${s.extra>0?`+ ${money(s.extra)} להקדמת פירעון`:''}.`,[
        ['סך הריבית',money(r.interest),'עלות המימון'],['סה״כ החזרים',money(s.principal+r.interest),'קרן וריבית'],['זמן לסיום',`${count(r.months)} חודשים`,'בכפוף לתשלומים שהוגדרו'],['חיסכון בריבית',money(saved),'ללא עמלות פירעון מוקדם']
      ],'יתרת ההלוואה','לוח סילוקין',lineChart(r.monthlySeries,r.months/12),`עלות ההלוואה ביחס לקרן: ${pct(s.principal?r.interest/s.principal*100:0)}.`,`תשלום נוסף מקצר תקופה; ייתכנו עמלות.`,saved>1?'good':'info',saved>1?'קיצור תקופת ההחזר':'החזר מתוכנן');
    }else{
      const annualMonthly=advanced.budget.annualItems.reduce((sum,item)=>sum+item.amount,0)/12;
      const expenses=s.housing+s.bills+s.living+s.spending+annualMonthly,left=s.income-expenses-s.savings;
      const housingShare=s.income?s.housing/s.income*100:0,saveShare=s.income?s.savings/s.income*100:0;
      show(left>=0?'יתרה פנויה בסוף החודש':'גירעון חודשי',money(left),'תקציב',left>=0?'הכנסה פחות הוצאות וחיסכון.':'הוצאות וחיסכון מעל ההכנסה.',[
        ['הוצאות',money(expenses),'ללא חיסכון'],['חיסכון שנתי',money(s.savings*12),'בקצב קבוע'],['דיור מסך ההכנסה',pct(housingShare),'דיור'],['שיעור החיסכון',pct(saveShare),'מהנטו']
      ],'חלוקת הכנסה','חלוקת תקציב',(budgetFlowMode?budgetFlowChart([['housing','דיור'],['living','מחיה ותחבורה'],['bills','חשבונות'],['spending','בזבוזים'],['savings','חיסכון']].map(([id,label])=>[compactFieldLabel(fieldLabels.budget[id]||label),s[id],id]).concat(annualMonthly?[['הוצאות שנתיות ÷ 12',annualMonthly]]:[]),s.income):budgetBars([['housing','דיור'],['living','מחיה ותחבורה'],['bills','חשבונות'],['spending','בזבוזים'],['savings','חיסכון']].map(([id,label])=>[compactFieldLabel(fieldLabels.budget[id]||label),s[id],id]).concat(annualMonthly?[['הוצאות שנתיות ÷ 12',annualMonthly]]:[]))),`סה״כ הוצאות והפקדות מתוכננות: ${money(expenses+s.savings)} מתוך הכנסה של ${money(s.income)}.`,left<0?`גירעון של ${money(-left)} בחודש. כדאי לצמצם הוצאות או להתאים את החיסכון.`:`אם התקציב יישמר, עודף שנתי: ${money(left*12)}.`,left<0?'warn':left/s.income<.05?'info':'good',left<0?'גירעון חודשי':left/s.income<.05?'מרווח תקציבי נמוך':'עודף תקציבי');
    }
    const budgetToggle=q('budgetChartToggle');budgetToggle.hidden=active!=='budget';
    budgetToggle.setAttribute('aria-pressed',String(budgetFlowMode));
    budgetToggle.textContent=budgetFlowMode?'סרגלים':'תזרים';
  }
  q('chartModeToggle').addEventListener('click',()=>{
    if(active!=='savings'&&active!=='index')return;
    chartModes[active]=!chartModes[active];renderResults();saveState();
  });

  q('budgetChartToggle').addEventListener('click',()=>{
    if(active!=='budget')return;
    budgetFlowMode=!budgetFlowMode;renderResults();saveState();
  });
  // Future contribution planner; each calculator has an independent timeline.
  let plannerType='monthly',editingEventId=null,plannerFrom=null;
  const scheduleOverlay=q('scheduleOverlay');
  const scheduleYear=q('scheduleYear'),scheduleMonth=q('scheduleMonth');
  for(let year=1;year<=80;year++)scheduleYear.add(new Option(`שנה ${year}`,String(year)));
  for(let month=1;month<=12;month++)scheduleMonth.add(new Option(`חודש ${month}`,String(month)));
  const scheduleAmount=q('scheduleAmount'),scheduleRange=q('scheduleRange');
  const scheduleError=q('scheduleError');
  function setPlannerError(message=''){
    scheduleError.hidden=!message;
    scheduleError.textContent=message;
  }
  function setPlannerType(type){
    plannerType=type;
    document.querySelectorAll('.schedule-type-btn').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.kind===type)));
    q('scheduleAmountLabel').textContent=type==='monthly'?'סכום חודשי חדש (₪)':'סכום חד־פעמי (₪)';
    scheduleAmount.step=type==='monthly'?'250':'5000';
    scheduleRange.step=scheduleAmount.step;
    scheduleRange.max=String(Math.max(type==='monthly'?50000:1000000,Math.ceil(Number(scheduleAmount.value)/Number(scheduleRange.step))*Number(scheduleRange.step)));
    scheduleRange.value=String(clamp(Number(scheduleAmount.value)||0,0,Number(scheduleRange.max)));
    paintSlider(scheduleRange);
    q('scheduleHelp').textContent=type==='monthly'?'מהחודש שנבחר ההפקדה החודשית תשתנה לסכום החדש. אפשר להגדיר שינוי נוסף בהמשך.':'סכום נוסף שיופקד רק בסוף החודש שבחרת, מלבד ההפקדה החודשית הרגילה.';
    setPlannerError();
  }
  function resetPlannerForm(){
    editingEventId=null;
    scheduleYear.value=String(Math.min(states[active].years,6));
    scheduleMonth.value='1';
    scheduleAmount.value=String(states[active].monthly);
    setPlannerType('monthly');
    q('scheduleSubmit').textContent='הוסף שינוי';
    q('scheduleCancel').hidden=true;
  }
  function sortedEvents(tab){return [...contributions[tab]].sort((a,b)=>a.month-b.month || (a.type==='monthly'?-1:1));}
  function renderPlannerList(){
    const events=sortedEvents(plannerFrom);
    q('scheduleExistingCount').textContent=`${events.length} שינויים`;
    if(!events.length){q('scheduleList').innerHTML='<div class="schedule-empty">עדיין לא הוגדרו שינויים עתידיים</div>';return;}
    const horizon=states[plannerFrom].years*12;
    q('scheduleList').innerHTML=events.map(e=>{
      const year=Math.floor((e.month-1)/12)+1,month=(e.month-1)%12+1;
      return `<div class="schedule-entry"><div class="schedule-entry-main"><div class="schedule-entry-title">${e.type==='monthly'?'הפקדה חודשית חדשה':'הפקדה חד־פעמית'} · ${money(e.amount)}</div><div class="schedule-entry-meta">שנה ${year}, חודש ${month} · חודש ${e.month} לתוכנית ${e.month>horizon?'<span class="schedule-entry-outside">· מחוץ לתקופה</span>':''}</div></div><div class="schedule-entry-actions"><button type="button" data-action="edit" data-id="${e.id}">ערוך</button><button type="button" data-action="delete" data-id="${e.id}">מחק</button></div></div>`;
    }).join('');
  }
  function openPlanner(){
    if(active!=='savings' && active!=='index')return;
    plannerFrom=active;
    resetPlannerForm();
    renderPlannerList();
    scheduleOverlay.hidden=false;
    document.body.classList.add('schedule-open');
    q('scheduleClose').focus();
  }
  function closePlanner(){
    scheduleOverlay.hidden=true;
    document.body.classList.remove('schedule-open');
    plannerFrom=null;
    if(q('scheduleToggle').offsetParent!==null)q('scheduleToggle').focus();
  }
  function updateContributionUI(){
    if(active==='savings'||active==='index')q('scheduleCount').textContent=contributions[active].length||'';
    if(goalIsActive()){goalSolver(active);syncGoalPlanningUI();}
    renderResults();
    saveState();
  }
  function savePlannerEvent(){
    if(!plannerFrom)return;
    const year=Number(scheduleYear.value),monthOfYear=Number(scheduleMonth.value);
    const month=(year-1)*12+monthOfYear,amount=Number(scheduleAmount.value);
    if(!Number.isFinite(amount)||amount<0||amount>10000000||scheduleAmount.value==='')return setPlannerError('נא להזין סכום תקין בין 0 ל־10,000,000 ₪.');
    if(month>states[plannerFrom].years*12)return setPlannerError('התאריך שבחרת נמצא אחרי סוף התקופה. אפשר להאריך את תקופת החיסכון במחשבון.');
    const entries=contributions[plannerFrom];
    if(plannerType==='monthly' && entries.some(e=>e.type==='monthly' && e.month===month && e.id!==editingEventId))return setPlannerError('כבר קיים שינוי בהפקדה החודשית במועד הזה. אפשר לערוך אותו ברשימה.');
    if(editingEventId){
      const item=entries.find(e=>e.id===editingEventId);
      if(item)Object.assign(item,{type:plannerType,month,amount});
    } else {
      entries.push({id:'e-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),type:plannerType,month,amount});
    }
    resetPlannerForm();
    renderPlannerList();
    updateContributionUI();
  }
  function editPlannerEvent(id){
    const event=contributions[plannerFrom].find(e=>e.id===id);
    if(!event)return;
    editingEventId=id;
    scheduleYear.value=String(Math.floor((event.month-1)/12)+1);
    scheduleMonth.value=String((event.month-1)%12+1);
    scheduleAmount.value=String(event.amount);
    setPlannerType(event.type);
    q('scheduleSubmit').textContent='שמור שינוי';
    q('scheduleCancel').hidden=false;
    scheduleAmount.focus();
  }
  q('scheduleToggle').addEventListener('click',openPlanner);
  q('scheduleClose').addEventListener('click',closePlanner);
  scheduleOverlay.addEventListener('pointerdown',e=>{if(e.target===scheduleOverlay)closePlanner();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && !scheduleOverlay.hidden){e.stopPropagation();closePlanner();}});
  document.querySelectorAll('.schedule-type-btn').forEach(btn=>btn.addEventListener('click',()=>{
    scheduleAmount.value=String(btn.dataset.kind==='monthly'?states[plannerFrom].monthly:25000);
    setPlannerType(btn.dataset.kind);
  }));
  scheduleAmount.addEventListener('input',()=>{
    const val=Number(scheduleAmount.value)||0,step=Number(scheduleRange.step);
    scheduleRange.max=String(Math.max(plannerType==='monthly'?50000:1000000,Math.ceil(val/step)*step));
    scheduleRange.value=String(val);paintSlider(scheduleRange);setPlannerError();
  });
  scheduleRange.addEventListener('input',()=>{scheduleAmount.value=scheduleRange.value;paintSlider(scheduleRange);setPlannerError();});
  configureTouchSlider(scheduleRange);
  q('scheduleSubmit').addEventListener('click',savePlannerEvent);
  q('scheduleCancel').addEventListener('click',resetPlannerForm);
  q('scheduleList').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action]');if(!btn||!plannerFrom)return;
    const id=btn.dataset.id;
    if(btn.dataset.action==='edit')editPlannerEvent(id);
    if(btn.dataset.action==='delete'){
      contributions[plannerFrom]=contributions[plannerFrom].filter(e=>e.id!==id);
      if(editingEventId===id)resetPlannerForm();
      renderPlannerList();updateContributionUI();
    }
  });
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed=()=>!reduceMotion.matches;
  function rectMap(elements){
    return new Map([...elements].map(el=>[el,el.getBoundingClientRect()]));
  }
  function flipElements(before,elements,direction='y'){
    if(!motionAllowed())return;
    for(const el of elements){
      const from=before.get(el),to=el.getBoundingClientRect();
      if(!from)continue;
      const dx=from.left-to.left,dy=from.top-to.top;
      if(Math.abs(dx)<.5 && Math.abs(dy)<.5)continue;
      el.getAnimations().forEach(animation=>{if(animation.effect?.getKeyframes()?.some(f=>f.transform))animation.cancel();});
      el.animate([
        {transform:`translate3d(${dx}px, ${dy}px, 0)`},
        {transform:'translate3d(0,0,0)'}
      ],{duration:direction==='x'?240:210,easing:'cubic-bezier(.22,1,.36,1)'});
    }
  }
  function compactTabName(value){
    return value==='השקעה ב־S&P 500'?'S&P 500':value==='תקציב חודשי'?'תקציב':value;
  }
  // Direct manipulation: each tab has its own grip and inline edit control.
  // No extra arrangement menu or nested editable input inside a button.
  const tabList=q('tabList');
  for(const btn of [...tabList.querySelectorAll('.tab')]){
    const id=btn.dataset.tab;
    const slot=document.createElement('div');
    slot.className='tab-slot';slot.dataset.tab=id;slot.setAttribute('role','presentation');
    const label=document.createElement('span');label.className='tab-label';
    label.textContent=compactTabName(tabLabels[id]);btn.replaceChildren(label);
    const grip=document.createElement('button');grip.type='button';grip.className='tab-grip';
    grip.textContent='⠿';grip.title='גרור כדי לשנות סדר · חצים במקלדת';
    const edit=document.createElement('button');edit.type='button';edit.className='tab-rename';
    edit.dataset.renameTab=id;edit.textContent='✎';edit.title='שנה שם לשונית';
    slot.append(btn,grip,edit);
    tabList.appendChild(slot);
  }
  function refreshTabLabels(){
    for(const slot of tabList.querySelectorAll('.tab-slot')){
      const tab=slot.dataset.tab;
      slot.querySelector('.tab-label').textContent=compactTabName(tabLabels[tab]);
      slot.querySelector('.tab-rename').setAttribute('aria-label','שנה שם '+tabLabels[tab]);
      slot.querySelector('.tab-grip').setAttribute('aria-label','גרור לסידור '+tabLabels[tab]+' או השתמש בחצים');
    }
  }
  function applyTabOrder(animate=false){
    const slots=[...tabList.querySelectorAll(':scope > .tab-slot')];
    if(slots.every((el,i)=>el.dataset.tab===tabOrder[i]))return;
    const before=animate?rectMap(slots):null;
    const existing=Object.fromEntries(slots.map(el=>[el.dataset.tab,el]));
    tabOrder.forEach(tab=>tabList.appendChild(existing[tab]));
    if(before)flipElements(before,slots,'x');
  }
  // Browser RTL layouts visually proceed right-to-left, so ArrowLeft advances to the next tab.
  function moveDirectTab(id,delta){
    const from=tabOrder.indexOf(id),to=from+delta;
    if(from<0||to<0||to>=tabOrder.length)return;
    tabOrder.splice(from,1);tabOrder.splice(to,0,id);
    applyTabOrder(true);saveState();
  }
  let tabSort=null;
  function finishTabSort(cancel=false){
    if(!tabSort)return;
    const drag=tabSort;tabSort=null;
    document.body.classList.remove('sorting-active');
    drag.ghost?.remove();drag.slot.classList.remove('is-placeholder');
    try{if(tabList.hasPointerCapture(drag.pointerId))tabList.releasePointerCapture(drag.pointerId);}catch(e){}
    if(cancel){tabOrder=[...drag.oldOrder];applyTabOrder(true);}
    else if(drag.started){tabOrder=[...tabList.querySelectorAll(':scope > .tab-slot')].map(x=>x.dataset.tab);saveState();}
  }
  tabList.addEventListener('pointerdown',e=>{
    const grip=e.target.closest('.tab-grip');
    if(!grip||e.button!==0||tabSort)return;
    const slot=grip.closest('.tab-slot');
    tabSort={slot,pointerId:e.pointerId,x:e.clientX,y:e.clientY,
      box:slot.getBoundingClientRect(),oldOrder:[...tabOrder],started:false,ghost:null};
    tabList.setPointerCapture(e.pointerId);
  });
  tabList.addEventListener('pointermove',e=>{
    const drag=tabSort;
    if(!drag||drag.pointerId!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.started){
      if(Math.hypot(dx,dy)<5)return;
      drag.started=true;
      const ghost=drag.slot.cloneNode(true);
      ghost.classList.add('tab-sort-ghost');ghost.setAttribute('aria-hidden','true');
      ghost.style.left=drag.box.left+'px';ghost.style.top=drag.box.top+'px';
      ghost.style.width=drag.box.width+'px';ghost.style.height=drag.box.height+'px';
      document.body.appendChild(ghost);drag.ghost=ghost;
      drag.slot.classList.add('is-placeholder');
      document.body.classList.add('sorting-active');
    }
    e.preventDefault();
    drag.ghost.style.transform=`translate3d(${dx}px,${dy}px,0) scale(1.025)`;
    const others=[...tabList.querySelectorAll(':scope > .tab-slot')].filter(el=>el!==drag.slot);
    const target=others.find(el=>{
      const r=el.getBoundingClientRect();
      return e.clientX>r.left+r.width/2;
    })||null;
    // In RTL, appendChild puts the dragged tab at the far left end.
    if(drag.slot.nextElementSibling!==target){
      const before=rectMap([...others,drag.slot]);
      tabList.insertBefore(drag.slot,target);
      flipElements(before,others,'x');
    }
  });
  tabList.addEventListener('pointerup',e=>{if(tabSort&&e.pointerId===tabSort.pointerId)finishTabSort();});
  tabList.addEventListener('pointercancel',e=>{if(tabSort&&e.pointerId===tabSort.pointerId)finishTabSort(true);});
  tabList.addEventListener('lostpointercapture',()=>{if(tabSort)finishTabSort();});
  tabList.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&tabSort){e.preventDefault();finishTabSort(true);return;}
    if(!e.target.matches('.tab-grip'))return;
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();
    moveDirectTab(e.target.closest('.tab-slot').dataset.tab,e.key==='ArrowLeft'?1:-1);
    e.target.focus({preventScroll:true});
  });
  function editInline(host,oldText,onSave,cls='field-inline-edit',limit=65){
    if(host.dataset.editing)return;
    host.dataset.editing='true';
    const input=document.createElement('input');input.type='text';input.maxLength=limit;
    input.className=cls;input.value=oldText;input.setAttribute('aria-label','עריכת כותרת');
    host.replaceWith(input);
    let done=false;
    function finish(save){
      if(done)return;done=true;
      input.replaceWith(host);delete host.dataset.editing;
      const value=input.value.trim();
      if(save&&value)onSave(value);
    }
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();finish(true);}
      else if(e.key==='Escape'){e.preventDefault();finish(false);}
      e.stopPropagation();
    });
    input.addEventListener('blur',()=>finish(true));
    input.focus();input.select();
  }
  function renameTab(id){
    const slot=tabList.querySelector(`.tab-slot[data-tab="${id}"]`);
    if(!slot||slot.querySelector('.tab-inline-edit'))return;
    const input=document.createElement('input');
    input.className='tab-inline-edit';input.type='text';input.maxLength=50;
    input.value=tabLabels[id];input.setAttribute('aria-label','עריכת שם לשונית');
    slot.classList.add('is-editing');slot.appendChild(input);
    let done=false;
    function finish(commit){
      if(done)return;done=true;
      const value=input.value.trim();
      input.remove();slot.classList.remove('is-editing');
      if(commit&&value){tabLabels[id]=value;refreshTabLabels();renderNotes();saveState();}
    }
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();finish(true);}
      if(e.key==='Escape'){e.preventDefault();finish(false);}
      e.stopPropagation();
    });
    input.addEventListener('blur',()=>finish(true));
    input.focus();input.select();
  }
  tabList.addEventListener('click',e=>{
    const edit=e.target.closest('[data-rename-tab]');
    if(edit){e.stopPropagation();renameTab(edit.dataset.renameTab);}
  });
  tabList.addEventListener('dblclick',e=>{
    const btn=e.target.closest('.tab');
    if(btn){e.preventDefault();renameTab(btn.dataset.tab);}
  });
  q('controlsBody').addEventListener('click',e=>{
    const edit=e.target.closest('[data-rename-field]');if(!edit)return;
    const id=edit.dataset.renameField;
    const label=edit.closest('.field-heading').querySelector('label');
    const fallback=configs[active].fields.find(f=>f[0]===id)?.[1]||id;
    editInline(label,fieldLabels[active][id]||fallback,value=>{
      fieldLabels[active][id]=value;
      label.textContent=value;label.title=value;
      edit.setAttribute('aria-label','שנה שם '+value);
      const r=q('range-'+id),n=q('number-'+id);
      r.setAttribute('aria-label',value);n.setAttribute('aria-label','ערך '+value);
      edit.closest('.field').querySelector('.field-handle').setAttribute('aria-label','גרור לשינוי סדר של '+value);
      if(active==='budget')renderResults();
      saveState();
    });
  });
  q('controlsBody').addEventListener('dblclick',e=>{
    if(e.target.tagName!=='LABEL')return;
    e.preventDefault();e.target.closest('.field-heading').querySelector('.field-rename').click();
  });
  // Field reorder runs only from the dedicated grip; vertical touch scroll over ranges remains safe.
  let fieldSort=null;
  const controlList=q('controlsBody');
  function setFieldOrderFromDOM(){fieldOrder[active]=[...controlList.querySelectorAll('.field')].map(x=>x.dataset.field);saveState();}
  function finishFieldSort(cancel=false){
    if(!fieldSort)return;
    const drag=fieldSort;fieldSort=null;
    document.body.classList.remove('sorting-active');
    drag.ghost?.remove();drag.field.classList.remove('is-placeholder');
    try{if(controlList.hasPointerCapture(drag.pointerId))controlList.releasePointerCapture(drag.pointerId);}catch(e){}
    if(cancel){
      const byId=Object.fromEntries([...controlList.querySelectorAll('.field')].map(el=>[el.dataset.field,el]));
      const before=rectMap(Object.values(byId));
      drag.oldOrder.forEach(id=>controlList.appendChild(byId[id]));
      flipElements(before,Object.values(byId));
    }else if(drag.started)setFieldOrderFromDOM();
  }
  controlList.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.field-handle');
    if(!handle || e.button!==0 || fieldSort)return;
    const field=handle.closest('.field');
    fieldSort={handle,field,id:field.dataset.field,pointerId:e.pointerId,x:e.clientX,y:e.clientY,
      box:field.getBoundingClientRect(),oldOrder:[...fieldOrder[active]],started:false,ghost:null};
    controlList.setPointerCapture(e.pointerId);
  });
  controlList.addEventListener('pointermove',e=>{
    const drag=fieldSort;
    if(!drag || e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.started){
      if(Math.hypot(dx,dy)<6)return;
      drag.started=true;
      const ghost=drag.field.cloneNode(true);
      ghost.classList.add('field-sort-ghost');ghost.setAttribute('aria-hidden','true');
      ghost.style.left=drag.box.left+'px';ghost.style.top=drag.box.top+'px';
      ghost.style.width=drag.box.width+'px';ghost.style.height=drag.box.height+'px';
      document.body.append(ghost);drag.ghost=ghost;
      drag.field.classList.add('is-placeholder');
      document.body.classList.add('sorting-active');
    }
    e.preventDefault();
    drag.ghost.style.transform=`translate3d(${dx}px,${dy}px,0) scale(1.014)`;
    const fields=[...controlList.querySelectorAll('.field')];
    const others=fields.filter(field=>field!==drag.field);
    const next=others.find(field=>{
      const r=field.getBoundingClientRect();
      return e.clientY<r.top+r.height/2;
    })||null;
    if(drag.field.nextElementSibling!==next){
      const before=rectMap(fields);
      controlList.insertBefore(drag.field,next);
      flipElements(before,others);
    }
  });
  controlList.addEventListener('pointerup',e=>{if(fieldSort&&e.pointerId===fieldSort.pointerId)finishFieldSort();});
  controlList.addEventListener('pointercancel',e=>{if(fieldSort&&e.pointerId===fieldSort.pointerId)finishFieldSort(true);});
  controlList.addEventListener('lostpointercapture',e=>{
    if(fieldSort && e.target===controlList)finishFieldSort(false);
  },true);
  controlList.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&fieldSort){finishFieldSort(true);return;}
    if(!e.target.matches('.field-handle'))return;
    if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
    e.preventDefault();
    const field=e.target.closest('.field');
    const index=fieldOrder[active].indexOf(field.dataset.field);
    const to=index+(e.key==='ArrowUp'?-1:1);
    if(to<0||to>=fieldOrder[active].length)return;
    const before=rectMap([...controlList.querySelectorAll('.field')]);
    const other=[...controlList.querySelectorAll('.field')][to];
    if(to<index)controlList.insertBefore(field,other);
    else controlList.insertBefore(field,other.nextSibling);
    flipElements(before,[...controlList.querySelectorAll('.field')]);
    setFieldOrderFromDOM();
    e.target.focus();
  });
  function setNotesCollapsed(collapsed){
    if(collapsed && document.getElementById('calcDock')?.classList.contains('is-open'))openCalc(false);
    notesCollapsed=collapsed;
    q('contentLayout').classList.toggle('notes-collapsed',collapsed);
    q('notesBody').hidden=collapsed; // Also remove hidden controls from keyboard and accessibility navigation.
    q('notesToggle').textContent=collapsed?'פתח':'הסתר';
    q('notesToggle').setAttribute('aria-expanded',String(!collapsed));
    if(motionAllowed()){
      const panel=document.querySelector('.notes-panel');
      panel.animate(collapsed?[
        {transform:'scaleX(1)',opacity:1},{transform:'scaleX(.985)',opacity:.94},{transform:'scaleX(1.005)',opacity:1},{transform:'scaleX(1)',opacity:1}
      ]:[
        {transform:'scale(.985)',opacity:.9},{transform:'scale(1.004)',opacity:1},{transform:'scale(1)',opacity:1}
      ] ,{duration:270,easing:'cubic-bezier(.22,1,.36,1)'});
    }
    saveState();
  }
  // Visual direction of a tab change (-1 = target tab lies to the left, 1 = to the right), independent of RTL and tab order.
  function navDirection(from,to){
    if(from===to)return 0;
    const a=document.querySelector('.tab[data-tab="'+from+'"]'),b=document.querySelector('.tab[data-tab="'+to+'"]');
    return a&&b?Math.sign(b.getBoundingClientRect().left-a.getBoundingClientRect().left):0;
  }
  // Content and the ambient glow flow in from the side of the chosen tab.
  // The new tab's colour enters from its own side and pushes the previous colour out the other way.
  function playNavMotion(dir,prevColor){
    app.style.setProperty('--nav-x',String(dir||0));
    if(!dir||!motionAllowed())return;
    if(prevColor)app.style.setProperty('--ambient-prev',prevColor);
    app.dataset.sweep=app.dataset.sweep==='a'?'b':'a';
  }
  // Tab change: with the View Transitions API the outgoing panels leave while the incoming ones arrive, so there is never an empty frame.
  let navTransition=null;
  function activate(tab){
    const navDir=navDirection(active,tab),prevColor=app.style.getPropertyValue('--ambient');
    const apply=inPlace=>{active=tab;app.dataset.theme=tab;applyTabAccent();document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab?'true':'false'));if(goalIsActive()){if(!goalManuals[tab])goalManuals[tab]=Object.fromEntries(['initial','monthly','years','rate'].map(id=>[id,states[tab][id]]));goalSolver(tab);}playNavMotion(navDir,prevColor);renderControls();renderResults();renderNotes();if(inPlace&&motionAllowed()){for(const el of [q('controlsBody'),document.querySelector('.results')]){el.classList.remove('animate-in');void el.offsetWidth;el.classList.add('animate-in');}}saveState();};
    if(navTransition){try{navTransition.skipTransition();}catch(e){}navTransition=null;}
    if(navDir&&motionAllowed()&&typeof document.startViewTransition==='function'){
      const root=document.documentElement;
      root.style.setProperty('--nav-x',String(navDir));
      root.classList.add('nav-vt');
      const transition=navTransition=document.startViewTransition(()=>apply(false));
      transition.finished.catch(()=>{}).then(()=>{if(navTransition===transition){navTransition=null;root.classList.remove('nav-vt');}});
    }else apply(true);
  }
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
  const notesInput=q('notesInput');
  function renderNotes(){
    const isShared=notesMode==='shared';
    const note=isShared?notesText:notesByTab[active];
    if(notesInput.value!==note)notesInput.value=note;
    q('notesCounter').textContent=note.length+' תווים';
    q('notesModeShared').setAttribute('aria-pressed',String(isShared));
    q('notesModeSeparate').setAttribute('aria-pressed',String(!isShared));
    notesInput.setAttribute('aria-label',isShared?'פנקס משותף':'פנקס של '+tabLabels[active]);
    notesInput.placeholder=isShared?'הערות לכל הלשוניות...':'הערות עבור '+tabLabels[active]+'...';
  }
  document.querySelectorAll('[data-notes-mode]').forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.notesMode;
    if(mode===notesMode)return;
    notesMode=mode;
    renderNotes();
    saveState();
  }));
  notesInput.addEventListener('input',()=>{
    if(notesMode==='shared')notesText=notesInput.value;
    else notesByTab[active]=notesInput.value;
    q('notesCounter').textContent=notesInput.value.length+' תווים';
    saveState();
    q('notesSaveStatus').textContent=storageAvailable?'נשמר מקומית':'נשמר רק עד סגירת הדף';
  });
  q('notesToggle').addEventListener('click',()=>setNotesCollapsed(!notesCollapsed));
  q('unlockAllGoals').addEventListener('click',()=>{
    if(active!=='savings'&&active!=='index')return;
    if(!goalPinned[active].length&&!goalIsActive(active))return;
    // Unlocks are purely state changes: keep all current slider values,
    // including the last automatically solved value and custom reset points.
    goalPinned[active]=[];
    goalPlans[active].locked=false;
    goalFeedback[active]=null;
    goalManuals[active]=null;
    syncGoalPlanningUI();
    renderResults();
    saveState();
    q('saveStatus').textContent='כל הנעילות בגיליון שוחררו';
  });
  // Standard reset keeps locked values and scheduled deposits.
  function resetCalculatorValues(tab,full=false){
    const isSaving=tab==='savings'||tab==='index';
    const pinned=!full&&isSaving?goalPinned[tab]:[];
    const locked=!full&&isSaving&&goalPlans[tab].locked;
    const computed=locked?goalPlans[tab].solve:null;
    const values={...states[tab]};
    for(const [id] of configs[tab].fields){
      if(pinned.includes(id)||(locked&&(id==='goal'||id===computed)))continue;
      values[id]=getResetPoint(tab,id);
    }
    if(tab==='mortgage'){values.kind='first';values.equity=Math.min(values.equity,values.price);}
    states[tab]=values;
    if(full){
      compareIds[tab]=null;
      if(tab==='mortgage')Object.assign(advanced.mortgage,{insurance:0,purchaseCosts:0,stressRise:0,income:0});
      if(tab==='index')Object.assign(advanced.index,{taxEnabled:false,taxRate:25});
      if(tab==='budget')advanced.budget.annualItems=[];
      if(isSaving){
        contributions[tab]=[];
        goalPlans[tab]={locked:false,solve:'monthly'};
        goalPinned[tab]=[];
        goalFeedback[tab]=null;
        goalManuals[tab]=null;
      }
    }else if(locked){
      if(!goalManuals[tab])goalManuals[tab]=Object.fromEntries(goalSolveChoices.map(([id])=>[id,states[tab][id]]));
      for(const [id] of goalSolveChoices)if(id!==computed&&!pinned.includes(id))goalManuals[tab][id]=states[tab][id];
      goalSolver(tab);
    }
  }
  q('resetBtn').addEventListener('click',()=>{
    resetCalculatorValues(active,false);activate(active);
    q('saveStatus').textContent='הערכים החופשיים אופסו; נעילות והפקדות נשמרו';
  });
  q('resetAllBtn').addEventListener('click',()=>{
    if(!confirm('לאפס את כל הגיליון? נעילות, שינויי הפקדות והגדרות מתקדמות יימחקו. תרחישים שמורים ונקודות איפוס אישיות יישמרו.'))return;
    resetCalculatorValues(active,true);activate(active);
    q('saveStatus').textContent='הגיליון אופס במלואו; תרחישים שמורים נשמרו';
  });


  // Soft sea-wave layers behind the frame content (decorative, pointer-transparent).
  if(!app.querySelector(':scope > .sea')){const sea=document.createElement('div');sea.className='sea';sea.setAttribute('aria-hidden','true');sea.innerHTML='<i></i><i></i><i></i>';app.insertBefore(sea,app.firstChild);}
  // Details close when another tool opens; focus retained for keyboard users.
  let lastToolOpener=null;
  const toolOverlays=['scenarioOverlay','advancedOverlay','paletteOverlay'];
  function openTool(name){toolOverlays.forEach(id=>{q(id).hidden=id!==name;});lastToolOpener=document.activeElement;
    if(name==='scenarioOverlay')renderScenarioList();if(name==='advancedOverlay')renderAdvanced();if(name==='paletteOverlay')renderPalette();
    document.body.classList.add('schedule-open');q(name).querySelector('.tool-close')?.focus();}
  function closeTool(){toolOverlays.forEach(id=>q(id).hidden=true);document.body.classList.remove('schedule-open');lastToolOpener?.focus?.();}
  q('paletteToggle').addEventListener('click',()=>openTool('paletteOverlay'));
  q('paletteGrid').addEventListener('click',e=>{
    const b=e.target.closest('button[data-color]');if(!b||b.disabled)return;
    const candidate=b.dataset.color,owned=defaultOrder.find(t=>tabColors[t]===candidate);
    if(owned&&owned!==active)return;
    tabColors[active]=candidate;applyTabAccent();renderPalette();renderResults();saveState();
    q('saveStatus').textContent='צבע הלשונית עודכן';
  });
  q('scenarioToggle').addEventListener('click',()=>openTool('scenarioOverlay'));
  q('advancedToggle').addEventListener('click',()=>openTool('advancedOverlay'));
  document.querySelectorAll('[data-close-tool]').forEach(b=>b.addEventListener('click',closeTool));
  toolOverlays.forEach(id=>q(id).addEventListener('pointerdown',e=>{if(e.target===q(id))closeTool();}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toolOverlays.some(id=>!q(id).hidden)){e.preventDefault();closeTool();}});
  function snapshotFor(tab){
    const lockState=normalizeScenarioLockState(tab,tab==='savings'||tab==='index'?{
      locked:goalPlans[tab].locked,solve:goalPlans[tab].solve,
      pinned:goalPinned[tab],manuals:goalManuals[tab]
    }:null);
    return {values:structuredClone(states[tab]),events:structuredClone(contributions[tab]||[]),
      advanced:structuredClone(advanced[tab]||{}),...(lockState?{lockState}:{})};
  }
  // Legacy scenarios have no lockState; never keep unrelated currently active locks.
  function loadScenarioRecord(tab,rec){
    for(const [id,,min,max] of configs[tab].fields)
      if(Number.isFinite(rec.values[id]))states[tab][id]=clamp(rec.values[id],min,max);
    if(tab==='mortgage'){
      if(allowedKinds.includes(rec.values.kind))states.mortgage.kind=rec.values.kind;
      states.mortgage.equity=Math.min(states.mortgage.equity,states.mortgage.price);
    }
    if(tab==='savings'||tab==='index'){
      contributions[tab]=Array.isArray(rec.events)?structuredClone(rec.events):[];
      const locks=normalizeScenarioLockState(tab,rec.lockState);
      goalPinned[tab]=locks?.pinned||[];
      goalPlans[tab]={locked:locks?.locked||false,solve:locks?.solve||'monthly'};
      goalManuals[tab]=locks?.manuals?Object.fromEntries(goalSolveChoices.map(([id])=>[
        id,Number.isFinite(locks.manuals[id])?locks.manuals[id]:states[tab][id]
      ])):null;
      goalFeedback[tab]=null;
    }
    if(advanced[tab]&&rec.advanced)Object.assign(advanced[tab],structuredClone(rec.advanced));
    if((tab==='savings'||tab==='index')&&goalPlans[tab].locked){
      if(!goalManuals[tab])goalManuals[tab]=Object.fromEntries(goalSolveChoices.map(([id])=>[id,states[tab][id]]));
      goalSolver(tab);
    }
  }
  function renderScenarioList(){
    const list=q('scenarioList');const listItems=scenarios[active];
    list.innerHTML=listItems.length?listItems.map(x=>`<div class="scenario-row"><div><strong>${escapeHtml(x.name)}</strong><small>${x.events?.length||0} אירועי הפקדה</small></div><div class="scenario-actions"><button type="button" data-scenario="${x.id}" data-action="load">טען</button><button type="button" data-scenario="${x.id}" data-action="compare" aria-pressed="${compareIds[active]===x.id}">${compareIds[active]===x.id?'בטל השוואה':'השווה'}</button><button type="button" data-scenario="${x.id}" data-action="delete">מחק</button></div></div>`).join(''):'<p class="tool-small">עדיין לא שמרת תרחישים למחשבון הזה.</p>';
    renderCompareWorkbench();
  }

  // Stage 5: a two-column editable comparison. Draft edits never change the saved scenario.
  const compareDrafts=Object.create(null);
  const compareEditableIds={
    mortgage:['price','equity','rate','years'],
    savings:['initial','monthly','years','rate'],
    index:['initial','monthly','years','rate'],
    loan:['principal','rate','months','extra'],
    budget:['income','housing','living','savings']
  };
  function updateCompareSummary(){
    const container=q('compareWorkbench');
    if(container.hidden)return;
    const present=currentScenarioValue(),comparison=scenarioOutput(active,scenarioFor(active));
    if(!present||!comparison)return;
    const delta=present.value-comparison.value;
    q('compareCurrentValue').textContent=money(present.value);
    q('compareDraftValue').textContent=money(comparison.value);
    q('compareDifference').textContent=(delta>=0?'+':'−')+money(Math.abs(delta));
    q('compareDifference').dataset.tone=Math.abs(delta)<.5?'neutral':delta>=0?'positive':'negative';
  }
  function renderCompareWorkbench(){
    const wrapper=q('compareWorkbench'),rec=scenarios[active].find(x=>x.id===compareIds[active]);
    if(!rec){wrapper.hidden=true;wrapper.innerHTML='';delete compareDrafts[active];return;}
    wrapper.hidden=false;
    if(compareDrafts[active]?.id!==rec.id)compareDrafts[active]=structuredClone(rec);
    const draft=compareDrafts[active],fields=compareEditableIds[active].map(id=>configs[active].fields.find(f=>f[0]===id)).filter(Boolean);
    function pane(side,source,title){
      return '<section class="compare-pane"><strong>'+escapeHtml(title)+'</strong>'+
      fields.map(f=>{
        const id=f[0],value=Number.isFinite(source[id])?source[id]:f[5];
        const locked=side==='current'&&(goalPinned[active]?.includes(id)||(goalIsActive()&&goalPlans[active].solve===id));
        const label=compactFieldLabel(fieldLabels[active][id]||f[1]);
        return '<label class="compare-edit-row"><span>'+escapeHtml(label)+'</span><input type="number" inputmode="decimal" data-compare-side="'+side+'" data-compare-id="'+id+'" min="'+f[2]+'" max="'+f[3]+'" step="any" value="'+value+'"'+(locked?' disabled title="ערך נעול או מחושב"':'')+'></label>';
      }).join('')+'</section>';
    }
    wrapper.innerHTML='<div class="compare-workbench-head"><strong>השוואה חיה</strong><span>עריכת הצד השמאלי אינה משנה את התרחיש המקורי עד לשמירה כעותק</span></div>'+
      '<div class="compare-dual">'+pane('current',states[active],'הגיליון הנוכחי')+pane('draft',draft.values,rec.name+' · עותק לעריכה')+'</div>'+
      '<div class="compare-summary"><div><small>נוכחי</small><strong id="compareCurrentValue"></strong></div><div><small>להשוואה</small><strong id="compareDraftValue"></strong></div><div><small>הפרש</small><strong id="compareDifference"></strong></div></div>'+
      '<div class="compare-actions"><button type="button" class="tool-primary" id="compareSaveCopy">שמור את התרחיש הערוך כעותק</button><span>שינויי ההשוואה זמניים עד לשמירה</span></div>';
    updateCompareSummary();
  }
  q('compareWorkbench').addEventListener('input',event=>{
    const input=event.target.closest('[data-compare-id]');if(!input||input.value==='')return;
    const tab=active,id=input.dataset.compareId,f=configs[tab].fields.find(x=>x[0]===id);
    if(!f)return;
    const val=Number(input.value);if(!Number.isFinite(val))return;
    const limited=clamp(val,f[2],tab==='mortgage'&&id==='equity'?Math.min(f[3],input.dataset.compareSide==='draft'?compareDrafts[tab].values.price:states[tab].price):f[3]);
    if(input.dataset.compareSide==='current'){
      changeValue(id,limited,'compare-editor');
    }else{
      const draft=compareDrafts[tab];if(!draft)return;
      draft.values[id]=limited;
      if(tab==='mortgage')draft.values.equity=Math.min(draft.values.equity,draft.values.price);
      renderResults();
    }
    updateCompareSummary();
  });
  q('compareWorkbench').addEventListener('click',event=>{
    if(!event.target.closest('#compareSaveCopy'))return;
    const tab=active,draft=compareDrafts[tab];if(!draft)return;
    if(scenarios[tab].length>=12){q('scenarioMessage').textContent='יש מקום לעד 12 תרחישים. מחק תרחיש כדי לשמור עותק.';return;}
    const copy=structuredClone(draft);copy.id='s'+Date.now()+Math.floor(Math.random()*10000);
    copy.name=(draft.name+' · עותק').slice(0,42);
    if(copy.lockState)copy.lockState={locked:false,solve:'monthly',pinned:[],manuals:null};
    scenarios[tab].push(copy);compareIds[tab]=copy.id;delete compareDrafts[tab];
    q('scenarioMessage').textContent='ההשוואה הערוכה נשמרה כתרחיש חדש.';
    renderScenarioList();renderResults();saveState();
  });
  q('scenarioSave').addEventListener('click',()=>{
    const name=q('scenarioName').value.trim();if(!name){q('scenarioMessage').textContent='יש להזין שם לתרחיש.';return;}
    if(scenarios[active].length>=12){q('scenarioMessage').textContent='אפשר לשמור עד 12 תרחישים למחשבון.';return;}
    const x={id:'s'+Date.now()+Math.floor(Math.random()*9999),name:name.slice(0,42),...snapshotFor(active)};
    scenarios[active].push(x);q('scenarioName').value='';q('scenarioMessage').textContent='התרחיש נשמר.';renderScenarioList();saveState();
  });
  q('scenarioList').addEventListener('click',e=>{
    const b=e.target.closest('button[data-scenario]');if(!b)return;
    const tab=active,rec=scenarios[tab].find(x=>x.id===b.dataset.scenario);if(!rec)return;
    if(b.dataset.action==='compare'){compareIds[tab]=compareIds[tab]===rec.id?null:rec.id;delete compareDrafts[tab];renderScenarioList();renderResults();saveState();return;}
    if(b.dataset.action==='delete'){scenarios[tab]=scenarios[tab].filter(x=>x.id!==rec.id);if(compareIds[tab]===rec.id){compareIds[tab]=null;delete compareDrafts[tab];}renderScenarioList();renderResults();saveState();return;}
    if(b.dataset.action==='load'){
      loadScenarioRecord(tab,rec);
      closeTool();activate(tab);saveState();
    }
  });
  function renderAdvanced(){
    const body=q('advancedBody');
    if(active==='mortgage'){
      body.innerHTML=`<div class="advanced-grid"><div class="adv-field"><label for="adv-insurance">ביטוח משכנתא חודשי (₪)</label><input id="adv-insurance" data-advanced="insurance" type="number" min="0" max="5000" step="10" value="${advanced.mortgage.insurance}"></div><div class="adv-field"><label for="adv-purchaseCosts">הוצאות רכישה חד־פעמיות (₪)</label><input id="adv-purchaseCosts" data-advanced="purchaseCosts" type="number" min="0" max="1000000" step="1000" value="${advanced.mortgage.purchaseCosts}"></div><div class="adv-field"><label for="adv-stressRise">בדיקת רגישות: עליית ריבית (נקודות %)</label><input id="adv-stressRise" data-advanced="stressRise" type="number" min="0" max="8" step="0.25" value="${advanced.mortgage.stressRise}"></div><div class="adv-field"><label for="adv-income">הכנסה חודשית נטו (אופציונלי, ₪)</label><input id="adv-income" data-advanced="income" type="number" min="0" max="300000" step="500" value="${advanced.mortgage.income}"></div></div><p class="adv-note">החישוב הבסיסי הוא מסלול אחד בריבית קבועה ולא צמודה. בדיקת הרגישות מציגה החזר היפותטי בריבית גבוהה יותר ואינה מדמה שינוי באמצע תקופת ההלוואה. הוצאות הרכישה הן בנוסף להון העצמי הדרוש לרכישה.</p>`;
    }else if(active==='index'){
      body.innerHTML=`<div class="adv-box"><label class="adv-check"><input type="checkbox" data-advanced="taxEnabled" ${advanced.index.taxEnabled?'checked':''}>להציג אומדן מס רווחי הון</label></div><div class="advanced-grid"><div class="adv-field"><label for="adv-taxRate">שיעור מס לדוגמה (%)</label><input id="adv-taxRate" data-advanced="taxRate" type="number" min="0" max="50" step="1" value="${advanced.index.taxRate}"></div></div><p class="adv-note">ברירת המחדל היא 25% לצורך הדגמה בלבד. האומדן מחושב על רווח חיובי מעל בסיס עלות מוצמד לאינפלציה; בפועל חישוב המס עשוי להתבסס על מטבע, ניכויים, מכירות חלקיות וסוג נייר הערך. אין כאן חישוב מס אישי או ייעוץ מס.</p>`;
    }else if(active==='budget'){
      body.innerHTML=`<p class="adv-note">הוספת הוצאות שנתיות חד־פעמיות או תקופתיות (כמו ביטוח רכב, טסט וחופשה). סך ההוצאות יחולק ב־12 ויובא בחשבון בתקציב החודשי.</p><div class="tool-save"><input id="annualTitle" placeholder="שם ההוצאה" maxlength="70" aria-label="שם הוצאה שנתית"><input id="annualAmount" style="width:110px;flex:none" type="number" min="0" max="1000000" step="100" placeholder="₪ לשנה" aria-label="סכום שנתי"><button id="annualAdd" class="tool-primary" type="button">הוסף</button></div><div id="annualList"></div><p class="adv-note" id="annualAverage"></p>`;
      renderAnnual();
    }
    body.querySelectorAll('[data-advanced]').forEach(el=>el.addEventListener('input',()=>{
      const key=el.dataset.advanced;
      if(el.type==='checkbox')advanced[active][key]=el.checked;
      else if(el.value!==''&&Number.isFinite(Number(el.value)))advanced[active][key]=clamp(Number(el.value),Number(el.min),Number(el.max));
      renderResults();saveState();
    }));
    q('annualAdd')?.addEventListener('click',()=>{
      const title=q('annualTitle').value.trim(),amount=Number(q('annualAmount').value);
      if(!title||!Number.isFinite(amount)||amount<=0||amount>1000000||advanced.budget.annualItems.length>=30)return;
      advanced.budget.annualItems.push({id:'a'+Date.now(),title:title.slice(0,70),amount});q('annualTitle').value='';q('annualAmount').value='';renderAnnual();renderResults();saveState();
    });
  }
  function renderAnnual(){
    const list=q('annualList');if(!list)return;
    list.innerHTML=advanced.budget.annualItems.map(item=>`<div class="annual-row"><span style="flex:1;font-size:12px;min-width:0">${escapeHtml(item.title)}</span><span style="font-size:12px">${money(item.amount)}</span><button type="button" data-annual-delete="${escapeHtml(item.id)}">מחק</button></div>`).join('');
    const total=advanced.budget.annualItems.reduce((a,i)=>a+i.amount,0);
    q('annualAverage').textContent=`הוצאות שנתיות: ${money(total)} · הפרשה חודשית ממוצעת: ${money(total/12)}.`;
  }
  q('advancedBody').addEventListener('click',e=>{
    const b=e.target.closest('[data-annual-delete]');if(!b)return;
    advanced.budget.annualItems=advanced.budget.annualItems.filter(item=>item.id!==b.dataset.annualDelete);renderAnnual();renderResults();saveState();
  });
  // Graph tooltip: explicit event descriptions and exact amounts.
  const toolTip=document.createElement('div');toolTip.className='chart-tooltip';toolTip.hidden=true;document.querySelector('.chart-panel').append(toolTip);
  const chart=q('chart');
  function showChartTip(target){const hit=target.closest?.('[data-tip]');if(!hit)return hideChartTip();
    toolTip.textContent=hit.dataset.tip;toolTip.hidden=false;
    const chartPanel=document.querySelector('.chart-panel'),p=chartPanel.getBoundingClientRect(),b=hit.getBoundingClientRect();
    const relY=b.top-p.top;
    const half=Math.min(p.width/2-9,toolTip.offsetWidth/2+8);
    const relX=clamp((b.left+b.width/2)-p.left,half,p.width-half);
    toolTip.dataset.placement=relY<88?'below':'above';
    toolTip.style.left=relX+'px';toolTip.style.top=(relY<88?relY+8:relY-5)+'px';
  }
  function hideChartTip(){toolTip.hidden=true;}
  chart.addEventListener('pointerover',e=>{if(e.target.closest('[data-tip]'))showChartTip(e.target);});
  chart.addEventListener('focusin',e=>showChartTip(e.target));
  chart.addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))hideChartTip();});
  chart.addEventListener('focusout',hideChartTip);
  chart.addEventListener('click',e=>{if(e.target.closest('[data-tip]')){showChartTip(e.target);setTimeout(hideChartTip,2800);}});
  // Continuous, accurate hover along the whole SVG line, including months between milestones.
  function hoverAt(clientX,clientY){
    const svg=chart.querySelector('svg.line-chart'),m=hoverChartModel;
    if(!svg||!m)return;
    const ctm=svg.getScreenCTM();if(!ctm)return;
    const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
    const pt=point.matrixTransform(ctm.inverse());
    if(pt.x<m.x0-5||pt.x>m.x0+(m.x1-m.x0)*(m.years/m.horizon)+5||pt.y<m.y1-12||pt.y>m.y0+25){hideChartTip();svg.querySelector('.chart-cursor').style.display='none';return;}
    const index=Math.max(0,Math.min(m.values.length-1,Math.round((pt.x-m.x0)/((m.x1-m.x0)*(m.years/m.horizon))*(m.values.length-1))));
    const month=Math.round(index/(m.values.length-1||1)*m.years*12);
    const x=m.x0+(m.x1-m.x0)*(m.years/m.horizon)*index/(m.values.length-1||1);
    const value=m.values[index];
    const y=m.y0-(Math.max(0,value)/m.max)*(m.y0-m.y1);
    const cursor=svg.querySelector('.chart-cursor');cursor.style.display='';
    const guide=cursor.querySelector('line'),dot=cursor.querySelector('circle');
    guide.setAttribute('x1',x);guide.setAttribute('x2',x);guide.setAttribute('y1',m.y0);guide.setAttribute('y2',y);
    dot.setAttribute('cx',x);dot.setAttribute('cy',y);
    let detail=`${active==='loan'?'חודש '+month:'שנה '+(month/12).toFixed(1).replace(/\.0$/,'')+' · חודש '+month} · ${active==='mortgage'||active==='loan'?'יתרה':'שווי'}: ${money(value)}`;
    if(m.principal){const invested=m.principal[index]??0;detail+=` · הפקדות: ${money(invested)} · ${value-invested>=0?'רווח':'הפסד'}: ${money(Math.abs(value-invested))}`;}
    if(m.compare){const j=Math.round(month/12/(m.compareYears||1)*(m.compare.length-1));if(j>=0&&j<m.compare.length)detail+=` · תרחיש להשוואה: ${money(m.compare[j])}`;}
    if(m.risk&&active==='index'){
      const i=m.risk.months.reduce((best,value,j)=>Math.abs(value-month)<Math.abs(m.risk.months[best]-month)?j:best,0);
      detail+=' · תרחישים מדומים 10–90%: '+money(m.risk.low[i])+'–'+money(m.risk.high[i]);
    }
    const nearby=m.events.filter(e=>Math.abs(e.month-month)<=.6);
    if(nearby.length)detail+=' · '+nearby.map(e=>e.type==='monthly'?`הפקדה חודשית עודכנה ל־${money(e.amount)}`:`הפקדה חד־פעמית ${money(e.amount)}`).join(' · ');
    const pp=svg.createSVGPoint();pp.x=x;pp.y=y;const screen=pp.matrixTransform(ctm);
    const panel=document.querySelector('.chart-panel').getBoundingClientRect();
    toolTip.textContent=detail;toolTip.hidden=false;
    const half=Math.min(panel.width/2-9,toolTip.offsetWidth/2+8),relY=screen.y-panel.top;
    toolTip.dataset.placement=relY<88?'below':'above';
    toolTip.style.left=clamp(screen.x-panel.left,half,panel.width-half)+'px';
    toolTip.style.top=(relY<88?relY+8:relY-5)+'px';
  }
  chart.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
    if(e.target.closest('[data-tip]'))return;
    hoverAt(e.clientX,e.clientY);
  });
  chart.addEventListener('pointerleave',()=>{hideChartTip();const cursor=chart.querySelector('.chart-cursor');if(cursor)cursor.style.display='none';});
  chart.addEventListener('click',e=>{
    if(e.target.closest('[data-tip]'))return;
    if(chart.querySelector('svg.line-chart')){hoverAt(e.clientX,e.clientY);if(e.pointerType!=='mouse')setTimeout(()=>{hideChartTip();const cursor=chart.querySelector('.chart-cursor');if(cursor)cursor.style.display='none';},2600);}
  });
  // Touch contextual actions instead of relying on hover or tiny drag handles.
  const menu=document.createElement('div');menu.className='action-menu';menu.hidden=true;document.body.append(menu);
  function showActionMenu(anchor,items){
    menu.replaceChildren();items.forEach(([text,action])=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>{menu.hidden=true;action();});menu.append(b);});
    menu.hidden=false;const r=anchor.getBoundingClientRect();menu.style.top=Math.min(window.innerHeight-170,r.bottom+5)+'px';menu.style.left=Math.max(10,Math.min(window.innerWidth-160,r.left))+'px';
  }
  document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!e.target.closest('.field-mobile-menu,.tab-mobile-menu'))menu.hidden=true;});
  controlList.addEventListener('click',e=>{
    const set=e.target.closest('[data-set-reset]');
    if(set){e.preventDefault();setResetPoint(set.dataset.setReset);return;}
    const clear=e.target.closest('[data-clear-reset]');
    if(clear){e.preventDefault();setResetPoint(clear.dataset.clearReset,true);return;}
    const btn=e.target.closest('[data-field-menu]');if(!btn)return;
    const id=btn.dataset.fieldMenu,field=btn.closest('.field');
    const items=[
      ['קבע ערך נוכחי כנקודת איפוס',()=>setResetPoint(id)],
      ...(Object.hasOwn(resetPoints[active],id)?[['שחזר נקודת איפוס מקורית',()=>setResetPoint(id,true)]]:[]),
      ['עריכת שם',()=>field.querySelector('.field-rename').click()],
      ['הזז למעלה',()=>moveFieldByButton(id,-1)],
      ['הזז למטה',()=>moveFieldByButton(id,1)]
    ];
    showActionMenu(btn,items);
  });
  function moveFieldByButton(id,delta){
    const order=fieldOrder[active],from=order.indexOf(id),to=from+delta;
    if(to<0||to>=order.length)return;
    const before=rectMap([...controlList.querySelectorAll('.field')]);
    order.splice(from,1);order.splice(to,0,id);
    const byId=Object.fromEntries([...controlList.querySelectorAll('.field')].map(el=>[el.dataset.field,el]));
    order.forEach(key=>controlList.append(byId[key]));flipElements(before,Object.values(byId));saveState();
  }
  for(const slot of tabList.querySelectorAll('.tab-slot')){
    const btn=document.createElement('button');btn.className='tab-mobile-menu';btn.type='button';btn.textContent='⋯';btn.setAttribute('aria-label','אפשרויות לשונית');slot.append(btn);
  }
  tabList.addEventListener('click',e=>{
    const btn=e.target.closest('.tab-mobile-menu');if(!btn)return;
    const id=btn.closest('.tab-slot').dataset.tab;
    showActionMenu(btn,[['עריכת שם',()=>btn.closest('.tab-slot').querySelector('.tab-rename').click()],['הזז שמאלה',()=>moveDirectTab(id,1)],['הזז ימינה',()=>moveDirectTab(id,-1)]]);
  });
  // Lightweight arithmetic parser, no eval or arbitrary code execution.
  const calcDisplay=q('calcDisplay'),calcBox=q('quickCalc');
  const calcDock=q('calcDock'),calcToggle=q('quickCalcToggle');
  function openCalc(open){
    if(open && notesCollapsed)setNotesCollapsed(false);
    calcDock.classList.toggle('is-open',open);
    calcToggle.setAttribute('aria-expanded',String(open));
    calcToggle.setAttribute('aria-label',open?'סגירת מחשבון כיס':'פתיחת מחשבון כיס');
    calcBox.inert=!open;
    calcBox.setAttribute('aria-hidden',String(!open));
    // Preserve the scroll position on mobile; the accordion opens in place.
  }
  calcToggle.addEventListener('click',()=>openCalc(!calcDock.classList.contains('is-open')));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&calcDock.classList.contains('is-open')){openCalc(false);calcToggle.focus();}});
  function evalMath(expression){
    const input=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!/^[0-9+*/().-]{1,120}$/.test(input))throw new Error('ביטוי לא תקין');
    let pos=0;
    function num(){let start=pos;while(/[0-9.]/.test(input[pos]||''))pos++;if(start===pos)throw Error();const n=Number(input.slice(start,pos));if(!Number.isFinite(n))throw Error();return n;}
    function primary(){if(input[pos]==='+'){pos++;return primary();}if(input[pos]==='-'){pos++;return -primary();}if(input[pos]==='('){pos++;const v=expr();if(input[pos++]!==')')throw Error();return v;}return num();}
    function term(){let v=primary();while(input[pos]==='*'||input[pos]==='/'){const op=input[pos++],r=primary();v=op==='*'?v*r:v/r;if(!Number.isFinite(v))throw Error();}return v;}
    function expr(){let v=term();while(input[pos]==='+'||input[pos]==='-'){const op=input[pos++],r=term();v=op==='+'?v+r:v-r;}return v;}
    const result=expr();if(pos!==input.length||!Number.isFinite(result))throw Error();return result;
  }
  function calcEquals(){try{const n=evalMath(calcDisplay.value);calcDisplay.value=String(Number(n.toPrecision(12)));q('calcError').textContent='';}catch(e){q('calcError').textContent='תרגיל לא תקין';}}
  q('calcKeys').addEventListener('click',e=>{const key=e.target.closest('[data-calc]')?.dataset.calc;if(!key)return;
    if(key==='C')calcDisplay.value='';else if(key==='back')calcDisplay.value=calcDisplay.value.slice(0,-1);else if(key==='=')calcEquals();else calcDisplay.value+=key;
    calcDisplay.focus();
  });
  calcDisplay.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calcEquals();}});

  // Interactive result cards and budget chart direct editing.
  const statExplanations={
    mortgage:['מחיר הדירה פחות ההון העצמי.','סך הריבית לאורך תקופת המשכנתא.','יחס סכום המשכנתא למחיר הדירה.','משך ההחזר בפועל.'],
    savings:['הסכום ההתחלתי וכל ההפקדות.','ההפרש בין שווי החיסכון לסך ההפקדות.','הרווח מתוך השווי הסופי של החיסכון.','הפער בין הצבירה העתידית ליעד.'],
    index:['סך ההפקדות לתיק.','הרווח המשוער מעבר להפקדות.','שווי עתידי במונחי כוח קנייה של היום.','עלות דמי הניהול או השפעת המס בהגדרות.'],
    loan:['סך הריבית שתשולם.','הקרן והריבית יחד.','מספר שנות ההחזר בפועל.','פער ריבית לעומת תרחיש ללא תשלום נוסף.'],
    budget:['הוצאות חודשיות, כולל חלק יחסי של הוצאות שנתיות, ללא חיסכון.','ההפרשה החודשית כפול 12.','עלויות הדיור כאחוז מההכנסה.','החיסכון החודשי כאחוז מההכנסה.']
  };

  // Live, model-derived drill-downs; do not reuse fixed illustrative figures.
  function metricBreakdown(tab,index){
    const s=states[tab],rows=[];
    const add=(title,value)=>rows.push([title,String(value)]);
    if(tab==='mortgage'){
      const principal=Math.max(0,s.price-s.equity);
      const result=schedule(principal,s.rate,s.years,s.extra);
      const standard=schedule(principal,s.rate,s.years,0);
      if(index===0){add('מחיר הנכס',money(s.price));add('הון עצמי',money(s.equity));add('יתרת מימון',money(principal));}
      else if(index===1){add('סך הריבית',money(result.interest));add('ללא תוספת החזר',money(standard.interest));add('חיסכון ריבית',money(Math.max(0,standard.interest-result.interest)));}
      else if(index===2){add('סכום המימון',money(principal));add('מחיר הנכס',money(s.price));add('תקרת המימון שנבחרה',pct(limits[s.kind]*100));}
      else{add('חודשי החזר',count(result.months));add('תקופה ללא תוספת',count(standard.months)+' חודשים');add('חודשים שנחסכו',count(Math.max(0,standard.months-result.months)));}
    }else if(tab==='savings'||tab==='index'){
      const events=contributions[tab]||[];
      const r=futureValue(s,s.rate,tab==='index'?s.fees:0,events);
      const gain=r.value-r.contributed;
      if(index===0){add('הפקדה התחלתית',money(s.initial));add('כל ההפקדות יחד',money(r.contributed));add('אירועי הפקדה מתוכננים',count(events.filter(x=>x.month<=s.years*12).length));}
      else if(index===1){add('שווי סופי',money(r.value));add('סך ההפקדות',money(r.contributed));add(gain<0?'הפסד נומינלי':'רווח נומינלי',money(Math.abs(gain)));}
      else if(index===2&&tab==='savings'){add('שווי סופי',money(r.value));add('רווח נומינלי',money(gain));add('חלק הרווחים בתיק',pct(r.value?100*gain/r.value:0));}
      else if(index===2){add('שווי נומינלי',money(r.value));add('אינפלציה שנתית',pct(s.inflation));add('שווי בכסף של היום',money(r.value/Math.pow(1+s.inflation/100,s.years)));}
      else if(tab==='savings'){add('יעד חיסכון',money(s.goal));add('תחזית צבירה',money(r.value));add(r.value>=s.goal?'עודף ביחס ליעד':'חסר ביחס ליעד',money(Math.abs(r.value-s.goal)));}
      else{
        const withoutFees=futureValue(s,s.rate,0,events).value;
        const basis=Math.max(r.contributed,r.inflationBasis||r.contributed);
        const tax=advanced.index.taxEnabled?Math.max(0,r.value-basis)*advanced.index.taxRate/100:0;
        if(advanced.index.taxEnabled){add('שווי לפני מס',money(r.value));add('מס משוער',money(tax));add('שווי לאחר מס משוער',money(r.value-tax));}
        else{add('שווי ללא דמי ניהול',money(withoutFees));add('עלות מצטברת של דמי הניהול',money(withoutFees-r.value));add('שווי לאחר דמי ניהול',money(r.value));}
      }
    }else if(tab==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      const base=schedule(s.principal,s.rate,loanTermYears(s),0);
      if(index===0){add('קרן ההלוואה',money(s.principal));add('ריבית שנתית',pct(s.rate));add('ריבית מצטברת',money(r.interest));}
      else if(index===1){add('סכום הקרן',money(s.principal));add('סך הריבית',money(r.interest));add('עלות כוללת',money(s.principal+r.interest));}
      else if(index===2){add('חודשי החזר',count(r.months));add('ללא תוספת החזר',count(base.months)+' חודשים');add('חודשים שנחסכו',count(Math.max(0,base.months-r.months)));}
      else{add('ללא תוספת החזר',money(base.interest));add('עם התשלום הנוסף',money(r.interest));add('חיסכון ריבית משוער',money(Math.max(0,base.interest-r.interest)));}
    }else if(tab==='budget'){
      const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+Number(item.amount||0),0)/12;
      const total=s.housing+s.living+s.bills+s.spending+annual;
      if(index===0){add('דיור',money(s.housing));add('מחיה ותחבורה',money(s.living));add('חשבונות ופנאי',money(s.bills+s.spending));add('הוצאות שנתיות בחישוב חודשי',money(annual));add('סה״כ הוצאות',money(total));}
      else if(index===1){add('חיסכון חודשי',money(s.savings));add('חיסכון שנתי',money(s.savings*12));add('חלק מההכנסה',pct(s.income?100*s.savings/s.income:0));}
      else if(index===2){add('עלות דיור חודשית',money(s.housing));add('הכנסה נטו',money(s.income));add('שיעור הדיור',pct(s.income?100*s.housing/s.income:0));}
      else{add('הכנסה נטו',money(s.income));add('חיסכון חודשי',money(s.savings));add('יתרה פנויה לאחר הכול',money(s.income-total-s.savings));}
    }
    return rows;
  }
  let statOpener=null;
  function closeStatDetail(){q('statOverlay').hidden=true;document.body.classList.remove('schedule-open');statOpener?.focus?.();}
  q('stats').addEventListener('click',e=>{
    const btn=e.target.closest('[data-stat-index]');if(!btn)return;
    const idx=Number(btn.dataset.statIndex),stat=currentStats[idx];if(!stat)return;
    statOpener=btn;q('statDetailTitle').textContent=stat[0];q('statDetailValue').textContent=stat[1];
    q('statDetailInfo').textContent=statExplanations[active]?.[idx]||stat[2]||'מדד מחושב.';
    q('statDetailBreakdown').innerHTML=metricBreakdown(active,idx).map(([label,value])=>
      '<div class="stat-detail-row"><span>'+escapeHtml(label)+'</span><strong dir="auto">'+escapeHtml(value)+'</strong></div>'
    ).join('');
    q('statDetailFooter').textContent=(stat[2]||'')+' · כל הסכומים מתעדכנים לפי הנחות הסימולציה.';
    q('statOverlay').hidden=false;document.body.classList.add('schedule-open');q('statClose').focus();
  });
  q('statClose').addEventListener('click',closeStatDetail);
  q('statOverlay').addEventListener('pointerdown',e=>{if(e.target===q('statOverlay'))closeStatDetail();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('statOverlay').hidden){e.preventDefault();closeStatDetail();}});
  function focusBudgetField(id){
    if(active!=='budget'||!id)return;const input=q('number-'+id);if(!input)return;
    const field=input.closest('.field');field.classList.remove('field-attention');void field.offsetWidth;field.classList.add('field-attention');
    field.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'nearest'});
    if(!input.readOnly&&!input.disabled)input.focus({preventScroll:true});
    setTimeout(()=>field.classList.remove('field-attention'),1200);
  }
  q('chart').addEventListener('click',e=>{const bar=e.target.closest('[data-budget-field]');if(bar)focusBudgetField(bar.dataset.budgetField);});
  q('chart').addEventListener('keydown',e=>{
    const bar=e.target.closest('[data-budget-field]');if(bar&&(e.key==='Enter'||e.key===' ')){e.preventDefault();focusBudgetField(bar.dataset.budgetField);}
  });

  // Stage 4: edit budget categories and investment contributions directly in a chart.
  let chartDrag=null,chartSuppressClick=false;
  function chartFieldSpec(tab,id){return configs[tab].fields.find(f=>f[0]===id);}
  chart.addEventListener('pointerdown',event=>{
    if(event.button!==0||chartDrag)return;
    const handle=event.target.closest('[data-chart-drag]');
    const track=event.target.closest('.bar-track');
    const budgetRow=track?.closest('[data-budget-field]');
    if(!handle&&!budgetRow)return;
    if(handle){
      const tab=active,s=states[tab],f=chartFieldSpec(tab,'monthly');
      const ctm=handle.ownerSVGElement?.getScreenCTM(),model=hoverChartModel;
      if(!f||!ctm||!model)return;
      const events=contributions[tab]||[];
      const base=futureValue({...s,monthly:0},s.rate,tab==='index'?s.fees:0,events).value;
      const sensitivity=futureValue({...s,monthly:1},s.rate,tab==='index'?s.fees:0,events).value-base;
      if(!Number.isFinite(sensitivity)||sensitivity<=1e-8)return;
      chartDrag={type:'line',tab,id:'monthly',pointerId:event.pointerId,svg:handle.ownerSVGElement,ctm,model:{...model},base,sensitivity,field:f,x:event.clientX,y:event.clientY,moved:false};
    }else if(active==='budget'){
      const id=budgetRow.dataset.budgetField,f=chartFieldSpec(active,id);
      if(!f)return;
      chartDrag={type:'budget',tab:active,id,pointerId:event.pointerId,rect:track.getBoundingClientRect(),scale:Number(budgetRow.dataset.budgetScale),field:f,x:event.clientX,y:event.clientY,moved:false};
    }
    if(chartDrag){try{chart.setPointerCapture(event.pointerId);}catch(e){}event.preventDefault();}
  });
  chart.addEventListener('pointermove',event=>{
    const drag=chartDrag;
    if(!drag||drag.pointerId!==event.pointerId||active!==drag.tab)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4)return;
    drag.moved=true;
    let value;
    if(drag.type==='budget'){
      const ratio=clamp((drag.rect.right-event.clientX)/Math.max(1,drag.rect.width),0,1);
      value=ratio*drag.scale;
    }else{
      const point=drag.svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const p=point.matrixTransform(drag.ctm.inverse()),m=drag.model;
      const requested=clamp((m.y0-p.y)/(m.y0-m.y1)*m.max,0,m.max*1.12);
      value=(requested-drag.base)/drag.sensitivity;
    }
    const f=drag.field,step=f[4]||1;
    value=clamp(f[2]+Math.round((value-f[2])/step)*step,f[2],f[3]);
    if(Number.isFinite(value)&&Math.abs(states[drag.tab][drag.id]-value)>1e-7){
      changeValue(drag.id,Number(value.toFixed(10)),'chart-drag');
      hideChartTip();
    }
  });
  function finishChartDrag(event){
    if(!chartDrag||event.pointerId!==chartDrag.pointerId)return;
    chartSuppressClick=chartDrag.moved;
    chartDrag=null;
    try{chart.releasePointerCapture(event.pointerId);}catch(e){}
  }
  chart.addEventListener('pointerup',finishChartDrag);
  chart.addEventListener('pointercancel',finishChartDrag);
  chart.addEventListener('click',event=>{
    if(!chartSuppressClick)return;
    chartSuppressClick=false;event.preventDefault();event.stopImmediatePropagation();
  },true);
  chart.addEventListener('keydown',event=>{
    const handle=event.target.closest('[data-chart-drag]');
    const bar=event.target.closest('[data-budget-field]');
    if((!handle&&!bar)||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const id=handle?'monthly':bar.dataset.budgetField,f=chartFieldSpec(active,id);
    if(!f||goalPinned[active]?.includes(id))return;
    const sign=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1;
    event.preventDefault();event.stopImmediatePropagation();
    changeValue(id,adaptiveArrowValue(states[active][id],sign,f[6],f[2],f[3],f[4]),'chart-keyboard');
    const target=chart.querySelector(handle?'[data-chart-drag]':'[data-budget-field="'+id+'"]');
    target?.focus();
  });

  // Stage 7: explicit, one-time transfers. Never couple calculator values implicitly.
  function availableTransfers(tab){
    if(tab==='mortgage')return [{id:'mortgage-budget',to:'budget',field:'housing',label:'החזר ← תקציב',hint:'שכירות / משכנתא'}];
    if(tab==='budget')return [
      {id:'budget-savings',to:'savings',field:'monthly',label:'חיסכון ← תוכנית',hint:'הפקדה חודשית'},
      {id:'budget-index',to:'index',field:'monthly',label:'חיסכון ← השקעות',hint:'השקעה חודשית'}
    ];
    if(tab==='savings')return [{id:'savings-index',to:'index',field:'monthly',label:'הפקדה ← השקעות',hint:'השקעה חודשית'}];
    return [];
  }
  function transferValue(tab,route){
    if(tab==='mortgage'){
      const s=states.mortgage,r=schedule(Math.max(0,s.price-s.equity),s.rate,s.years,s.extra);
      return Math.round(r.payment+advanced.mortgage.insurance);
    }
    if(tab==='budget')return states.budget.savings;
    if(tab==='savings')return states.savings.monthly;
    return 0;
  }
  function updateTransferActions(){
    const holder=q('transferActions'),routes=availableTransfers(active);
    holder.hidden=!routes.length;
    if(!routes.length){holder.innerHTML='';return;}
    holder.innerHTML='<span class="transfer-prefix">העברת נתונים:</span>'+
      routes.map(route=>'<button type="button" class="transfer-button" data-transfer="'+route.id+'" title="העברה חד־פעמית">'+escapeHtml(route.label)+'</button>').join('');
  }
  q('transferActions').addEventListener('click',event=>{
    const button=event.target.closest('[data-transfer]');if(!button)return;
    const source=active,route=availableTransfers(source).find(x=>x.id===button.dataset.transfer);
    if(!route)return;
    const f=configs[route.to].fields.find(x=>x[0]===route.field);if(!f)return;
    const value=transferValue(source,route);
    if(!Number.isFinite(value)||value<f[2]||value>f[3]){
      alert('לא ניתן להעביר '+money(value)+' · הערך מחוץ לטווח הקלט של המחשבון המקבל. ניתן להזין ערך מתאים ידנית.');
      return;
    }
    if(goalPinned[route.to]?.includes(route.field)||
      (goalPlans[route.to]?.locked&&goalPlans[route.to].solve===route.field)){
      alert('המשתנה במחשבון המקבל נעול או מחושב אוטומטית. שחרר נעילה תחילה.');
      return;
    }
    const old=states[route.to][route.field],label=fieldLabels[route.to][route.field]||f[1];
    if(!confirm('להעביר '+money(value)+' מ־'+compactTabName(tabLabels[source])+' אל '+compactTabName(tabLabels[route.to])+'?'+
      '\nהשדה: '+label+'\nערך קודם: '+money(old)+
      '\nהעברה חד־פעמית.'))return;
    states[route.to][route.field]=value;
    if(goalPlans[route.to]?.locked){
      if(!goalManuals[route.to])goalManuals[route.to]=Object.fromEntries(goalSolveChoices.map(([id])=>[id,states[route.to][id]]));
      goalManuals[route.to][route.field]=value;
      goalSolver(route.to);
    }
    activate(route.to);
    q('saveStatus').textContent='הועבר '+money(value)+' אל '+compactTabName(tabLabels[route.to])+' · ניתן לבטל באמצעות ביטול פעולה';
  });

  // Stage 8: deterministic Monte Carlo illustration, not an investment forecast.
  let riskLast=null;
  function riskEnvelope(s,events=[],volatility=18,samples=220){
    const totalMonths=Math.round(s.years*12),months=[0];
    for(let i=12;i<=totalMonths;i+=12)months.push(i);
    if(months[months.length-1]!==totalMonths)months.push(totalMonths);
    const buckets=months.map(()=>[]);
    const monthIndex=new Map(months.map((month,i)=>[month,i]));
    const byMonth=new Map();
    for(const e of events){
      if(!Number.isInteger(e.month)||e.month<1||e.month>totalMonths)continue;
      if(!byMonth.has(e.month))byMonth.set(e.month,[]);
      byMonth.get(e.month).push(e);
    }
    let hits=0;
    for(let run=0;run<samples;run++){
      let seed=(0x9E3779B9 ^ Math.imul(run+1,0x85EBCA6B))>>>0;
      const random=()=>{
        seed=(seed+0x6D2B79F5)>>>0;
        let t=seed;
        t=Math.imul(t^(t>>>15),t|1);
        t^=t+Math.imul(t^(t>>>7),t|61);
        return ((t^(t>>>14))>>>0)/4294967296;
      };
      let balance=s.initial,monthly=s.monthly,growth=1;
      buckets[0].push(balance);
      for(let month=1;month<=totalMonths;month++){
        if((month-1)%12===0){
          const u=Math.max(1e-9,random()),v=random();
          const normal=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
          const annualGross=Math.max(.03,1+(s.rate+volatility*normal)/100)*(1-s.fees/100);
          growth=Math.pow(annualGross,1/12);
        }
        let extra=0;
        for(const event of byMonth.get(month)||[]){
          if(event.type==='monthly')monthly=event.amount;
          else if(event.type==='once')extra+=event.amount;
        }
        balance=Math.max(0,balance*growth+monthly+extra);
        const at=monthIndex.get(month);
        if(at!==undefined)buckets[at].push(balance);
      }
      if(balance>=s.goal)hits++;
    }
    const percentile=(arr,p)=>{
      const n=(arr.length-1)*p,i=Math.floor(n);
      return arr[i]+(arr[Math.min(i+1,arr.length-1)]-arr[i])*(n-i);
    };
    const low=[],median=[],high=[];
    for(const bucket of buckets){
      bucket.sort((a,b)=>a-b);
      low.push(percentile(bucket,.10));
      median.push(percentile(bucket,.50));
      high.push(percentile(bucket,.90));
    }
    return {months,low,median,high,goalShare:Math.round(100*hits/samples),runs:samples,volatility};
  }
  q('riskToggle').addEventListener('click',()=>{
    if(active!=='index')return;
    riskSettings.enabled=!riskSettings.enabled;
    renderResults();saveState();
  });
  q('riskVolatility').addEventListener('change',event=>{
    const v=Number(event.target.value);
    if(!Number.isFinite(v)||v<5||v>40)return;
    riskSettings.volatility=v;renderResults();saveState();
  });

  // Fixed-screen navigation: no wheel- or touch-scrolling required on any viewport.
  let screenPanel='inputs';
  let currentFieldPage=0;
  let layoutTab=null;
  const panels=['inputs','summary','chart','notes'];
  function setScreenPanel(panel){
    if(!panels.includes(panel))return;
    screenPanel=panel;
    document.body.dataset.screenPanel=panel;
    q('screenViews').querySelectorAll('[data-screen-panel]').forEach(button=>{
      const selected=button.dataset.screenPanel===panel;
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    });
    // A chart rendered while hidden has no measurable geometry.
    if(panel==='chart'&&typeof renderResults==='function')renderResults();
  }
  function applyViewportLayout(){
    const root=q('controlsBody');
    if(!root)return;
    const fields=[...root.children];
    if(layoutTab!==active){layoutTab=active;currentFieldPage=0;}
    root.dataset.count=String(fields.length);
    const mobile=window.matchMedia('(max-width:1050px)').matches;
    const available=window.innerHeight;
    // Page through inputs on narrow displays. All inputs remain mounted.
    const perPage=!mobile?fields.length:
      available<=640?2:available<=820?3:4;
    const pages=Math.max(1,Math.ceil(fields.length/Math.max(1,perPage)));
    currentFieldPage=Math.min(Math.max(0,currentFieldPage),pages-1);
    fields.forEach((element,index)=>{
      element.hidden=mobile&&(index<currentFieldPage*perPage||index>=(currentFieldPage+1)*perPage);
    });
    root.style.setProperty('--visible-count',String(mobile?Math.min(perPage,fields.length-currentFieldPage*perPage):fields.length));
    q('fieldPager').hidden=!mobile||pages===1;
    q('fieldPageLabel').textContent=(currentFieldPage+1)+' / '+pages;
    q('fieldPagePrev').disabled=currentFieldPage===0;
    q('fieldPageNext').disabled=currentFieldPage===pages-1;
    if(!mobile){
      document.body.dataset.screenPanel='desktop';
    }else{
      document.body.dataset.screenPanel=screenPanel;
    }
  }
  q('screenViews').addEventListener('click',event=>{
    const button=event.target.closest('[data-screen-panel]');
    if(button)setScreenPanel(button.dataset.screenPanel);
  });
  q('fieldPagePrev').addEventListener('click',()=>{
    currentFieldPage=Math.max(0,currentFieldPage-1);applyViewportLayout();
  });
  q('fieldPageNext').addEventListener('click',()=>{
    currentFieldPage++;applyViewportLayout();
  });
  let layoutFrame=null;
  window.addEventListener('resize',()=>{
    if(layoutFrame)cancelAnimationFrame(layoutFrame);
    layoutFrame=requestAnimationFrame(()=>{
      layoutFrame=null;applyViewportLayout();
      if(!window.matchMedia('(max-width:1050px)').matches||screenPanel==='chart')renderResults();
    });
  });

  // Overlay paging: forms stay fully reachable without free scrolling.
  const modalPages=new WeakMap();
  const paginatedOverlayIds=['scenarioOverlay','advancedOverlay','paletteOverlay','scheduleOverlay'];
  function updateModalPage(overlay){
    if(overlay.hidden)return;
    const state=modalPages.get(overlay);
    if(!state)return;
    const height=state.content.clientHeight;
    if(height<=0)return;
    const full=state.inner.scrollHeight;
    const step=Math.max(90,height-16);
    const maxOffset=Math.max(0,full-height);
    const pageCount=Math.max(1,Math.ceil(maxOffset/step)+1);
    state.page=Math.min(Math.max(0,state.page),pageCount-1);
    const offset=Math.min(maxOffset,state.page*step);
    state.inner.style.transform='translate3d(0,'+(-offset)+'px,0)';
    state.pager.hidden=pageCount<=1;
    state.label.textContent=(state.page+1)+' / '+pageCount;
    state.previous.disabled=state.page===0;
    state.next.disabled=state.page===pageCount-1;
  }
  function ensureModalPager(overlay){
    if(overlay.hidden)return;
    let state=modalPages.get(overlay);
    if(!state){
      const dialog=overlay.querySelector('.tool-dialog,.schedule-dialog');
      const content=dialog?.querySelector('.tool-content,.schedule-body');
      if(!dialog||!content)return;
      const inner=document.createElement('div');
      inner.className='modal-page-inner';
      while(content.firstChild)inner.appendChild(content.firstChild);
      content.appendChild(inner);
      const pager=document.createElement('nav');
      pager.className='modal-pager';
      pager.setAttribute('aria-label','עמודי חלונית');
      pager.innerHTML='<button type="button" data-modal-prev aria-label="הקודם">הקודם</button>'+
        '<span class="modal-page-count" aria-live="polite"></span>'+
        '<button type="button" data-modal-next aria-label="הבא">הבא</button>';
      dialog.appendChild(pager);
      state={
        content,inner,pager,page:0,
        label:pager.querySelector('.modal-page-count'),
        previous:pager.querySelector('[data-modal-prev]'),
        next:pager.querySelector('[data-modal-next]')
      };
      modalPages.set(overlay,state);
      state.previous.addEventListener('click',()=>{state.page=Math.max(0,state.page-1);updateModalPage(overlay);});
      state.next.addEventListener('click',()=>{state.page++;updateModalPage(overlay);});
      let raf=null;
      const observer=new MutationObserver(()=>{
        if(raf)cancelAnimationFrame(raf);
        raf=requestAnimationFrame(()=>{raf=null;updateModalPage(overlay);});
      });
      observer.observe(inner,{childList:true,subtree:true,characterData:true});
    }
    state.page=0;
    requestAnimationFrame(()=>updateModalPage(overlay));
  }
  paginatedOverlayIds.forEach(id=>{
    const overlay=q(id);
    const observer=new MutationObserver(()=>{
      if(!overlay.hidden)ensureModalPager(overlay);
    });
    observer.observe(overlay,{attributes:true,attributeFilter:['hidden']});
  });
  window.addEventListener('resize',()=>{
    paginatedOverlayIds.forEach(id=>{
      const overlay=q(id);
      if(!overlay.hidden)requestAnimationFrame(()=>updateModalPage(overlay));
    });
  });

  // Each destination stores its own monthly amount. Changes flow only to the budget.
  (() => {
    const STORAGE='anav.allocation.planner.v1',MAX=24,PAGE=4,LIMIT=configs.budget.fields.find(f=>f[0]==='savings')[3];
    const colors=['#387d82','#a78e6e','#7289a5','#b57868','#7b8671','#9b7aa0','#c29c57'];
    const currency=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:2});
    const clean=n=>Math.round(Math.max(0,Math.min(LIMIT,Number(n)||0))*100)/100;
    const defaults=()=>({version:2,items:[]});
    function normalize(raw){
      if(!raw||typeof raw!=='object')return defaults();
      const rows=Array.isArray(raw.items)?raw.items.slice(0,MAX):[];
      let amounts;
      if(raw.version===2)amounts=rows.map(x=>clean(x?.amount));
      else{
        const weights=rows.map(x=>Math.max(0,Number(x?.pct)||0));
        const sum=weights.reduce((a,b)=>a+b,0);
        const total=Math.round(clean(raw.linkedToBudget?states.budget.savings:raw.amount)*100);
        let left=total;
        amounts=rows.map((x,i)=>{const cents=i===rows.length-1?left:Math.min(left,Math.round(total*(sum?weights[i]/sum:1/rows.length)));left-=cents;return cents/100;});
      }
      let left=LIMIT;
      const items=rows.map((x,i)=>{
        const amount=Math.min(left,amounts[i]);left=Math.round((left-amount)*100)/100;
        return {id:i+1,name:typeof x?.name==='string'?x.name.slice(0,60):'יעד '+(i+1),amount};
      });
      return {version:2,items};
    }
    let allocation;
    try{allocation=normalize(JSON.parse(localStorage.getItem(STORAGE)||'null'));}catch(_){allocation=defaults();}
    let page=0,opener=null;
    const get=id=>document.getElementById(id);
    const total=()=>Math.round(allocation.items.reduce((sum,item)=>sum+Math.round(item.amount*100),0))/100;
    const persist=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(allocation));}catch(_){}};
    const remaining=i=>Math.max(0,Math.round((LIMIT-total()+allocation.items[i].amount)*100)/100);
    function syncBudget(){if(active==='budget')changeValue('savings',total(),'allocation');}
    const overlay=document.createElement('div');overlay.id='allocationOverlay';overlay.className='tool-overlay allocation-overlay';overlay.hidden=true;
    overlay.innerHTML=`<section class="tool-dialog allocation-dialog" role="dialog" aria-modal="true" aria-labelledby="allocationTitle">
      <header class="tool-head"><div><h2 id="allocationTitle">פילוח החיסכון החודשי</h2><p>יעדי חיסכון אישיים בסכומים חודשיים</p></div><button type="button" class="tool-close" id="allocationClose" aria-label="סגירה">×</button></header>
      <div class="allocation-content">
        <div class="allocation-summary"><span>סה״כ מוקצה</span><strong id="allocationAssigned"></strong><small id="allocationBudgetNote" aria-live="polite"></small></div>
        <div class="allocation-bar" id="allocationBar" role="img" aria-label="פילוח יעדי חיסכון"></div>
        <div class="allocation-list-head"><strong>יעדי החיסכון</strong><small id="allocationCount"></small></div>
        <div class="allocation-list" id="allocationList"></div>
        <nav class="allocation-pager" id="allocationPager" aria-label="עמודי יעדים"><button type="button" id="allocationPrev">הקודם</button><span id="allocationPage"></span><button type="button" id="allocationNext">הבא</button></nav>
        <div class="allocation-actions"><button type="button" class="tool-primary" id="allocationAdd">+ הוסף יעד</button><button type="button" class="allocation-reset" id="allocationReset">נקה פילוח</button></div>
        <p class="tool-hint">שינוי סכום באחד היעדים מעדכן את החיסכון הראשי בתקציב. שינוי ידני של החיסכון הראשי לא משנה את היעדים.</p>
      </div>
    </section>`;
    document.body.appendChild(overlay);
    function summary(){
      const sum=total();
      get('allocationAssigned').textContent=currency.format(sum);
      const budget=states.budget.savings;
      get('allocationBudgetNote').textContent=Math.abs(budget-sum)<.005?'תואם לתקציב':'חיסכון ראשי: '+currency.format(budget)+' · הוגדר עצמאית';
      get('allocationCount').textContent=allocation.items.length+' יעדים';
      const bar=get('allocationBar');bar.replaceChildren();
      allocation.items.forEach((item,i)=>{
        if(!sum||!item.amount)return;
        const piece=document.createElement('span');piece.style.width=(100*item.amount/sum)+'%';piece.style.background=colors[i%colors.length];
        piece.title=(item.name||'יעד '+(i+1))+': '+currency.format(item.amount);bar.append(piece);
      });
    }
    function setAmount(i,n){
      const amount=Math.min(clean(n),remaining(i));
      allocation.items[i].amount=amount;
      persist();syncBudget();summary();
      return amount;
    }
    function render(){
      const pages=Math.max(1,Math.ceil(allocation.items.length/PAGE));
      page=Math.min(page,pages-1);summary();
      const list=get('allocationList');list.replaceChildren();
      if(!allocation.items.length){const empty=document.createElement('p');empty.className='allocation-empty';empty.textContent='לא הוגדרו יעדים. הוסף יעד והזן את סכום החיסכון החודשי שלו.';list.append(empty);}
      allocation.items.slice(page*PAGE,(page+1)*PAGE).forEach((item,offset)=>{
        const i=page*PAGE+offset;
        const row=document.createElement('div');row.className='allocation-row';
        const head=document.createElement('div');head.className='allocation-row-head';
        const dot=document.createElement('i');dot.className='allocation-dot';dot.style.background=colors[i%colors.length];
        const name=document.createElement('input');name.className='allocation-name';name.type='text';name.maxLength=60;name.value=item.name;name.setAttribute('aria-label','שם יעד '+(i+1));
        name.addEventListener('input',()=>{item.name=name.value;persist();summary();});
        const value=document.createElement('strong');value.className='allocation-value';value.textContent=currency.format(item.amount);
        const del=document.createElement('button');del.type='button';del.className='allocation-delete';del.textContent='×';del.title='מחק יעד';del.setAttribute('aria-label','מחק יעד '+(i+1));
        del.addEventListener('click',()=>{allocation.items.splice(i,1);persist();syncBudget();render();});
        head.append(dot,name,value,del);
        const bottom=document.createElement('div');bottom.className='allocation-row-bottom';
        const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max=String(remaining(i));slider.step='any';slider.value=String(item.amount);slider.setAttribute('aria-label','סכום חודשי עבור '+item.name);
        const amount=document.createElement('input');amount.type='number';amount.inputMode='decimal';amount.min='0';amount.max=String(remaining(i));amount.step=String(adaptiveArrowStep(item.amount,'₪',50));amount.value=String(item.amount);amount.className='allocation-amount-input';amount.setAttribute('aria-label','סכום בשקלים ליעד '+(i+1));
        const applyArrow=(event,target)=>{
          const isNumber=target===amount;
          const keys=isNumber?['ArrowUp','ArrowDown']:['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
          if(!keys.includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return false;
          event.preventDefault();
          const direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1;
          const valueNow=Number(target.value);
          const saved=setAmount(i,adaptiveArrowValue(valueNow,direction,'₪',0,remaining(i),50));
          amount.value=String(saved);amount.step=String(adaptiveArrowStep(saved,'₪',50));
          slider.value=String(saved);value.textContent=currency.format(saved);
          // Keep other destinations' limits accurate without replacing the focused input.
          list.querySelectorAll('.allocation-row').forEach((visible,j)=>{
            const other=page*PAGE+j,maxValue=String(remaining(other));
            visible.querySelector('.allocation-amount-input').max=maxValue;
            visible.querySelector('input[type=range]').max=maxValue;
          });
          return true;
        };
        amount.addEventListener('input',()=>{amount.step=String(adaptiveArrowStep(Number(amount.value),'₪',50));});
        slider.addEventListener('keydown',event=>applyArrow(event,slider));
        slider.addEventListener('input',()=>{const n=Math.round(Number(slider.value)/10)*10;const saved=setAmount(i,n);amount.value=String(saved);value.textContent=currency.format(saved);});
        slider.addEventListener('change',render);
        amount.addEventListener('change',()=>{setAmount(i,amount.value);render();});
        amount.addEventListener('keydown',e=>{
          if(applyArrow(e,amount))return;
          if(e.key==='Enter'){e.preventDefault();amount.blur();}
        });
        const unit=document.createElement('span');unit.textContent='₪';
        bottom.append(slider,amount,unit);row.append(head,bottom);list.append(row);
      });
      get('allocationPager').hidden=pages<=1;get('allocationPage').textContent=(page+1)+' / '+pages;
      get('allocationPrev').disabled=page===0;get('allocationNext').disabled=page===pages-1;
      get('allocationAdd').disabled=allocation.items.length>=MAX;
    }
    function close(){overlay.hidden=true;document.body.classList.remove('schedule-open');opener?.focus?.();}
    get('controlsBody').addEventListener('click',e=>{
      if(!e.target.closest('[data-open-allocation]')||active!=='budget')return;
      document.querySelectorAll('.tool-overlay:not([hidden])').forEach(el=>el.hidden=true);
      opener=document.activeElement;overlay.hidden=false;document.body.classList.add('schedule-open');render();get('allocationClose').focus();
    });
    get('allocationClose').addEventListener('click',close);
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){e.preventDefault();e.stopImmediatePropagation();close();}},{capture:true});
    get('allocationAdd').addEventListener('click',()=>{
      if(allocation.items.length>=MAX)return;
      const i=allocation.items.length;allocation.items.push({id:i+1,name:'יעד '+(i+1),amount:0});
      page=Math.floor(i/PAGE);persist();render();get('allocationList').querySelector('.allocation-row:last-child .allocation-name')?.focus();
    });
    get('allocationReset').addEventListener('click',()=>{
      if(!window.confirm('למחוק את כל יעדי החיסכון ולאפס את החיסכון הראשי לאפס?'))return;
      allocation=defaults();page=0;persist();syncBudget();render();
    });
    get('allocationPrev').addEventListener('click',()=>{page--;render();});
    get('allocationNext').addEventListener('click',()=>{page++;render();});
  })();

  // Export / backup / restore / print live in one menu; the original button ids are unchanged.
  (function(){
    const menu=q('dataMenu'),btn=q('dataMenuBtn'),list=q('dataMenuList');
    if(!menu||!btn||!list)return;
    const setOpen=open=>{list.hidden=!open;btn.setAttribute('aria-expanded',String(open));};
    btn.addEventListener('click',e=>{e.stopPropagation();setOpen(list.hidden);});
    list.addEventListener('click',e=>{if(e.target.closest('button'))setOpen(false);});
    document.addEventListener('click',e=>{if(!list.hidden&&!menu.contains(e.target))setOpen(false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!list.hidden){setOpen(false);btn.focus();}});
    q('printBtn').addEventListener('click',()=>{setTimeout(()=>window.print(),50);});
  })();

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
  // Double click a slider, including its surrounding track, restores its factory default.
  controlList.addEventListener('dblclick',e=>{
    if(e.target.closest('.range-control')){const field=e.target.closest('.field');if(field){e.preventDefault();const id=field.dataset.field;changeValue(id,getResetPoint(active,id),'reset');}}
  });
  // Tap on help in mobile, focus/hover remains native on desktop.
  controlList.addEventListener('click',e=>{
    const btn=e.target.closest('.field-help');
    if(btn){e.preventDefault();controlList.querySelectorAll('.field-help').forEach(x=>{if(x!==btn)x.classList.remove('is-open')});btn.classList.toggle('is-open');}
  });
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.field-help'))controlList.querySelectorAll('.field-help.is-open').forEach(x=>x.classList.remove('is-open'));});

  // The mobile bottom summary appears only after the main result scrolls off screen.
  const mobileBar=document.querySelector('.mobile-summary');
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      mobileBar.classList.toggle('is-hidden',entries[0].isIntersecting);
    },{threshold:.15});
    observer.observe(document.querySelector('.hero-result'));
  }
  refreshTabLabels();
  applyTabOrder();
  setNotesCollapsed(notesCollapsed);
  if(!storageAvailable)q('notesSaveStatus').textContent='נשמר רק עד סגירת הדף';
  activate(active);
})();
