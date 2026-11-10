
  // Export / backup / restore / print live in one menu; the original button ids are unchanged.
  (function(){
    const menu=q('dataMenu'),btn=q('dataMenuBtn'),list=q('dataMenuList');
    if(!menu||!btn||!list)return;
    const setOpen=open=>{list.hidden=!open;btn.setAttribute('aria-expanded',String(open));};
    btn.addEventListener('click',e=>{e.stopPropagation();setOpen(list.hidden);});
    list.addEventListener('click',e=>{if(e.target.closest('button'))setOpen(false);});
    document.addEventListener('click',e=>{if(!list.hidden&&!menu.contains(e.target))setOpen(false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!list.hidden){setOpen(false);btn.focus();}});
    q('printBtn').addEventListener('click',()=>{setTimeout(()=>window.print(),50);});
  })();
