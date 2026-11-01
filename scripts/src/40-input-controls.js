  function formatField(v,unit) {return unit==='₪'?money(v):unit==='%'?pct(v):count(v)+' '+unit;}
  function renderControls(){
    const c=configs[active],s=states[active];
    q('controlTitle').textContent='נתונים';q('controlSubtitle').textContent='';
    const isSaving=active==='savings'||active==='index';
    q('controlFoot').innerHTML=isSaving
      ? `<div class="goal-legend" role="note" aria-label="פירוש מצבי המשתנים"><span class="legend-item"><i class="legend-swatch is-open" aria-hidden="true"></i>פתוח: משנים ידנית</span><span class="legend-item"><i class="legend-swatch is-pinned" aria-hidden="true"></i>נעול: נשאר קבוע</span><span class="legend-item"><i class="legend-swatch is-computed" aria-hidden="true"></i>מחושב: משתנה כדי להגיע ליעד</span></div><div>${escapeHtml(c.foot)}</div>`
      : escapeHtml(c.foot);
    q('scheduleToggle').hidden=!isSaving;
    q('advancedToggle').hidden=!['mortgage','index','budget'].includes(active);
    if(isSaving)q('scheduleCount').textContent=contributions[active].length||'';
    let html='';
    if(active==='mortgage')html='<div class="select-field"><label for="propertyKind">סוג הנכס / תקרת מימון משוערת</label><select id="propertyKind"><option value="first">דירה יחידה · עד 75%</option><option value="upgrade">דירה חליפית · עד 70%</option><option value="invest">דירה להשקעה · עד 50%</option></select></div>';
    const byId=Object.fromEntries(c.fields.map(f=>[f[0],f]));
    for(const id of fieldOrder[active]){
      const [,defaultLabel,min,max,step,,unit]=byId[id];
      const label=fieldLabels[active][id]||defaultLabel;
      const upper=active==='mortgage'&&id==='equity'?Math.min(max,s.price):max;
      const val=clamp(s[id],min,upper);s[id]=val;
      const isCustom=Object.hasOwn(resetPoints[active],id);
      const resetLabel=formatField(clamp(getResetPoint(active,id),min,upper),unit);
      const isGoal=isSaving&&id==='goal';
      const goalButton=isGoal?`<button type="button" class="goal-lock-btn" id="goalLock" aria-pressed="${goalIsActive()}">${goalIsActive()?'שחרר יעד':'נעל יעד'}</button>`:'';
      const pinned=isSaving&&!isGoal&&goalPinned[active].includes(id);
      const pinButton=isSaving&&!isGoal?`<button type="button" class="field-pin-btn" data-pin-field="${id}" aria-pressed="${pinned}" aria-label="${pinned?'בטל נעילה':'נעל'}: ${escapeHtml(label)}" title="${pinned?'שחרר ערך נעול לעריכה':'נעל את הערך כך שלא ישתנה בחישוב היעד'}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${pinned?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 8 0'}"/></svg></button>`:'';
      html+=`<div class="field ${secondaryFields[active]?.includes(id)?'is-secondary':''} ${isGoal?'goal-field':''}" data-field="${id}"><div class="field-top"><div class="field-heading"><button type="button" class="field-handle" aria-label="גרור לשינוי סדר של ${escapeHtml(label)}. במקלדת: חץ למעלה או למטה" title="גרור לסידור · חצים במקלדת">⠿</button><label for="range-${id}" title="${escapeHtml(label)}">${escapeHtml(label)}</label>${goalButton}${pinButton}${helpText[active]?.[id]?`<button type="button" class="field-help" aria-label="הסבר על ${escapeHtml(label)}">?<span class="help-pop">${escapeHtml(helpText[active][id])}</span></button>`:''}<button type="button" class="field-reset-point ${isCustom?'is-custom':''}" data-set-reset="${id}" aria-label="קבע את ${escapeHtml(formatField(val,unit))} כנקודת האיפוס של ${escapeHtml(label)}" title="קבע את הערך הנוכחי כנקודת איפוס · כעת: ${escapeHtml(resetLabel)}">◎</button><button type="button" class="field-reset-original" data-clear-reset="${id}" aria-label="החזר נקודת איפוס מקורית של ${escapeHtml(label)}" title="החזר נקודת איפוס מקורית" ${isCustom?'':'hidden'}>↶</button><button type="button" class="field-rename" data-rename-field="${id}" aria-label="שנה שם ${escapeHtml(label)}" title="עריכת שם">✎</button><button type="button" class="field-mobile-menu" data-field-menu="${id}" aria-label="אפשרויות עבור ${escapeHtml(label)}">⋯</button></div><div class="value-box"><input aria-label="ערך ${escapeHtml(label)}" class="number-input" id="number-${id}" type="number" inputmode="decimal" min="${min}" max="${upper}" step="any" value="${val}"><span>${unit}</span></div></div><div class="range-control"><input id="range-${id}" type="range" min="${min}" max="${upper}" step="any" data-slide-step="${step}" value="${val}" aria-label="${escapeHtml(label)}"><span class="default-tick" title="נקודת איפוס: ${escapeHtml(resetLabel)}" aria-hidden="true"></span><div class="range-touch-layer" aria-hidden="true"></div></div><div class="limits"><span>${formatField(min,unit)}</span><span>${formatField(upper,unit)}</span></div>${isGoal?`<div class="goal-options" id="goalOptions" ${goalIsActive()?'':'hidden'}><div class="goal-mode-line"><label for="goalSolve" title="המשתנה שהמערכת משנה אוטומטית כדי להגיע ליעד">מה לחשב?</label><select id="goalSolve" aria-label="בחר משתנה שיחושב אוטומטית">${goalSolveChoices.map(([key,title])=>`<option value="${key}" ${goalPlans[active].solve===key?'selected':''}>${title}</option>`).join('')}</select></div><div id="goalFeedback" class="goal-feedback" aria-live="polite"></div></div>`:''}</div>`;
    }
    q('controlsBody').innerHTML=html;
    if(active==='mortgage')q('propertyKind').value=s.kind;
    for(const [id,,,,,,] of c.fields){
      const slider=q('range-'+id),number=q('number-'+id);
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
