
  // Overlay paging: forms stay fully reachable without free scrolling.
  const modalPages=new WeakMap();
  const paginatedOverlayIds=['scenarioOverlay','advancedOverlay','paletteOverlay','scheduleOverlay'];
  function updateModalPage(overlay){
    if(overlay.hidden)return;
    const state=modalPages.get(overlay);
    if(!state)return;
    const height=state.content.clientHeight;
    if(height<=0)return;
    const full=state.inner.scrollHeight;
    const step=Math.max(90,height-16);
    const maxOffset=Math.max(0,full-height);
    const pageCount=Math.max(1,Math.ceil(maxOffset/step)+1);
    state.page=Math.min(Math.max(0,state.page),pageCount-1);
    const offset=Math.min(maxOffset,state.page*step);
    state.inner.style.transform='translate3d(0,'+(-offset)+'px,0)';
    state.pager.hidden=pageCount<=1;
    state.label.textContent=(state.page+1)+' / '+pageCount;
    state.previous.disabled=state.page===0;
    state.next.disabled=state.page===pageCount-1;
  }
  function ensureModalPager(overlay){
    if(overlay.hidden)return;
    let state=modalPages.get(overlay);
    if(!state){
      const dialog=overlay.querySelector('.tool-dialog,.schedule-dialog');
      const content=dialog?.querySelector('.tool-content,.schedule-body');
      if(!dialog||!content)return;
      const inner=document.createElement('div');
      inner.className='modal-page-inner';
      while(content.firstChild)inner.appendChild(content.firstChild);
      content.appendChild(inner);
      const pager=document.createElement('nav');
      pager.className='modal-pager';
      pager.setAttribute('aria-label','עמודי חלונית');
      pager.innerHTML='<button type="button" data-modal-prev aria-label="הקודם">הקודם</button>'+
        '<span class="modal-page-count" aria-live="polite"></span>'+
        '<button type="button" data-modal-next aria-label="הבא">הבא</button>';
      dialog.appendChild(pager);
      state={
        content,inner,pager,page:0,
        label:pager.querySelector('.modal-page-count'),
        previous:pager.querySelector('[data-modal-prev]'),
        next:pager.querySelector('[data-modal-next]')
      };
      modalPages.set(overlay,state);
      state.previous.addEventListener('click',()=>{state.page=Math.max(0,state.page-1);updateModalPage(overlay);});
      state.next.addEventListener('click',()=>{state.page++;updateModalPage(overlay);});
      let raf=null;
      const observer=new MutationObserver(()=>{
        if(raf)cancelAnimationFrame(raf);
        raf=requestAnimationFrame(()=>{raf=null;updateModalPage(overlay);});
      });
      observer.observe(inner,{childList:true,subtree:true,characterData:true});
    }
    state.page=0;
    requestAnimationFrame(()=>updateModalPage(overlay));
  }
  paginatedOverlayIds.forEach(id=>{
    const overlay=q(id);
    const observer=new MutationObserver(()=>{
      if(!overlay.hidden)ensureModalPager(overlay);
    });
    observer.observe(overlay,{attributes:true,attributeFilter:['hidden']});
  });
  window.addEventListener('resize',()=>{
    paginatedOverlayIds.forEach(id=>{
      const overlay=q(id);
      if(!overlay.hidden)requestAnimationFrame(()=>updateModalPage(overlay));
    });
  });
