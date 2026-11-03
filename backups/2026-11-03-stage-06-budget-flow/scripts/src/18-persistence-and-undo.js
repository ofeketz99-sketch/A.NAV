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
  function snapshot(){return {version:1,active,values:states,tabOrder,tabLabels,fieldLabels,fieldOrder,resetPoints,notes:notesText,notesMode,notesByTab,notesCollapsed,contributions,advanced,scenarios,compareIds,chartModes,goalPlans,goalManuals,goalPinned,tabColors};}
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
