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
