  // Direct manipulation: each tab has its own grip and inline edit control.
  // No extra arrangement menu or nested editable input inside a button.
  const tabList=q('tabList');
  for(const btn of [...tabList.querySelectorAll('.tab')]){
    const id=btn.dataset.tab;
    const slot=document.createElement('div');
    slot.className='tab-slot';slot.dataset.tab=id;slot.setAttribute('role','presentation');
    const label=document.createElement('span');label.className='tab-label';
    label.textContent=tabLabels[id];btn.replaceChildren(label);
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
      slot.querySelector('.tab-label').textContent=tabLabels[tab];
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
