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
