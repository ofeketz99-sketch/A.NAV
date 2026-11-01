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
