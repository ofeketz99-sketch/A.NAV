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
  function playNavMotion(dir){
    app.style.setProperty('--nav-x',String(dir||0));
    if(!dir||!motionAllowed())return;
    app.style.setProperty('--sx-from',dir<0?'-20%':'120%');
    app.style.setProperty('--sx-to',dir<0?'120%':'-20%');
    app.dataset.sweep=app.dataset.sweep==='a'?'b':'a';
  }
  function activate(tab){const navDir=navDirection(active,tab);active=tab;app.dataset.theme=tab;applyTabAccent();document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab?'true':'false'));if(goalIsActive()){if(!goalManuals[tab])goalManuals[tab]=Object.fromEntries(['initial','monthly','years','rate'].map(id=>[id,states[tab][id]]));goalSolver(tab);}playNavMotion(navDir);renderControls();renderResults();renderNotes();if(motionAllowed()){for(const el of [q('controlsBody'),document.querySelector('.results')]){el.classList.remove('animate-in');void el.offsetWidth;el.classList.add('animate-in');}}saveState();}
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

