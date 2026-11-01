  // Field reorder runs only from the dedicated grip; vertical touch scroll over ranges remains safe.
  let fieldSort=null;
  const controlList=q('controlsBody');
  function setFieldOrderFromDOM(){fieldOrder[active]=[...controlList.querySelectorAll('.field')].map(x=>x.dataset.field);saveState();}
  function finishFieldSort(cancel=false){
    if(!fieldSort)return;
    const drag=fieldSort;fieldSort=null;
    document.body.classList.remove('sorting-active');
    drag.ghost?.remove();drag.field.classList.remove('is-placeholder');
    try{if(controlList.hasPointerCapture(drag.pointerId))controlList.releasePointerCapture(drag.pointerId);}catch(e){}
    if(cancel){
      const byId=Object.fromEntries([...controlList.querySelectorAll('.field')].map(el=>[el.dataset.field,el]));
      const before=rectMap(Object.values(byId));
      drag.oldOrder.forEach(id=>controlList.appendChild(byId[id]));
      flipElements(before,Object.values(byId));
    }else if(drag.started)setFieldOrderFromDOM();
  }
  controlList.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('.field-handle');
    if(!handle || e.button!==0 || fieldSort)return;
    const field=handle.closest('.field');
    fieldSort={handle,field,id:field.dataset.field,pointerId:e.pointerId,x:e.clientX,y:e.clientY,
      box:field.getBoundingClientRect(),oldOrder:[...fieldOrder[active]],started:false,ghost:null};
    controlList.setPointerCapture(e.pointerId);
  });
  controlList.addEventListener('pointermove',e=>{
    const drag=fieldSort;
    if(!drag || e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.started){
      if(Math.hypot(dx,dy)<6)return;
      drag.started=true;
      const ghost=drag.field.cloneNode(true);
      ghost.classList.add('field-sort-ghost');ghost.setAttribute('aria-hidden','true');
      ghost.style.left=drag.box.left+'px';ghost.style.top=drag.box.top+'px';
      ghost.style.width=drag.box.width+'px';ghost.style.height=drag.box.height+'px';
      document.body.append(ghost);drag.ghost=ghost;
      drag.field.classList.add('is-placeholder');
      document.body.classList.add('sorting-active');
    }
    e.preventDefault();
    drag.ghost.style.transform=`translate3d(${dx}px,${dy}px,0) scale(1.014)`;
    const fields=[...controlList.querySelectorAll('.field')];
    const others=fields.filter(field=>field!==drag.field);
    const next=others.find(field=>{
      const r=field.getBoundingClientRect();
      return e.clientY<r.top+r.height/2;
    })||null;
    if(drag.field.nextElementSibling!==next){
      const before=rectMap(fields);
      controlList.insertBefore(drag.field,next);
      flipElements(before,others);
    }
  });
  controlList.addEventListener('pointerup',e=>{if(fieldSort&&e.pointerId===fieldSort.pointerId)finishFieldSort();});
  controlList.addEventListener('pointercancel',e=>{if(fieldSort&&e.pointerId===fieldSort.pointerId)finishFieldSort(true);});
  controlList.addEventListener('lostpointercapture',e=>{
    if(fieldSort && e.target===controlList)finishFieldSort(false);
  },true);
  controlList.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&fieldSort){finishFieldSort(true);return;}
    if(!e.target.matches('.field-handle'))return;
    if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
    e.preventDefault();
    const field=e.target.closest('.field');
    const index=fieldOrder[active].indexOf(field.dataset.field);
    const to=index+(e.key==='ArrowUp'?-1:1);
    if(to<0||to>=fieldOrder[active].length)return;
    const before=rectMap([...controlList.querySelectorAll('.field')]);
    const other=[...controlList.querySelectorAll('.field')][to];
    if(to<index)controlList.insertBefore(field,other);
    else controlList.insertBefore(field,other.nextSibling);
    flipElements(before,[...controlList.querySelectorAll('.field')]);
    setFieldOrderFromDOM();
    e.target.focus();
  });
