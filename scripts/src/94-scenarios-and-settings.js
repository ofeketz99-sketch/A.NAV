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
        const label=fieldLabels[active][id]||f[1];
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
