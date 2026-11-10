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
    if(saved.tabColors && typeof saved.tabColors==='object' && !Array.isArray(saved.tabColors)){
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
