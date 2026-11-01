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
  function activate(tab){active=tab;app.dataset.theme=tab;applyTabAccent();document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab?'true':'false'));if(goalIsActive()){if(!goalManuals[tab])goalManuals[tab]=Object.fromEntries(['initial','monthly','years','rate'].map(id=>[id,states[tab][id]]));goalSolver(tab);}renderControls();renderResults();renderNotes();if(motionAllowed()){for(const el of [q('controlsBody'),document.querySelector('.results')]){el.classList.remove('animate-in');void el.offsetWidth;el.classList.add('animate-in');}}saveState();}
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
  q('resetBtn').addEventListener('click',()=>{states[active]=Object.fromEntries(configs[active].fields.map(f=>[f[0],getResetPoint(active,f[0])]));if(active==='mortgage')states.mortgage.kind='first';if(active==='savings'||active==='index'){contributions[active]=[];goalPlans[active].locked=false;goalPinned[active]=[];goalFeedback[active]=null;goalManuals[active]=null;}activate(active);});

