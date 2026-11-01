  // Double click a slider, including its surrounding track, restores its factory default.
  controlList.addEventListener('dblclick',e=>{
    if(e.target.closest('.range-control')){const field=e.target.closest('.field');if(field){e.preventDefault();const id=field.dataset.field;changeValue(id,getResetPoint(active,id),'reset');}}
  });
  // Tap on help in mobile, focus/hover remains native on desktop.
  controlList.addEventListener('click',e=>{
    const btn=e.target.closest('.field-help');
    if(btn){e.preventDefault();controlList.querySelectorAll('.field-help').forEach(x=>{if(x!==btn)x.classList.remove('is-open')});btn.classList.toggle('is-open');}
  });
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.field-help'))controlList.querySelectorAll('.field-help.is-open').forEach(x=>x.classList.remove('is-open'));});

  // The mobile bottom summary appears only after the main result scrolls off screen.
  const mobileBar=document.querySelector('.mobile-summary');
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      mobileBar.classList.toggle('is-hidden',entries[0].isIntersecting);
    },{threshold:.15});
    observer.observe(document.querySelector('.hero-result'));
  }
  refreshTabLabels();
  applyTabOrder();
  setNotesCollapsed(notesCollapsed);
  if(!storageAvailable)q('notesSaveStatus').textContent='נשמר רק עד סגירת הדף';
  activate(active);
})();
