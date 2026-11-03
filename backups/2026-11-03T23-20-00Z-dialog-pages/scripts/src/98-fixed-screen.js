
  // Fixed-screen navigation: no wheel- or touch-scrolling required on any viewport.
  let screenPanel='inputs';
  let currentFieldPage=0;
  let layoutTab=null;
  const panels=['inputs','summary','chart','notes'];
  function setScreenPanel(panel){
    if(!panels.includes(panel))return;
    screenPanel=panel;
    document.body.dataset.screenPanel=panel;
    q('screenViews').querySelectorAll('[data-screen-panel]').forEach(button=>{
      const selected=button.dataset.screenPanel===panel;
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    });
    // A chart rendered while hidden has no measurable geometry.
    if(panel==='chart'&&typeof renderResults==='function')renderResults();
  }
  function applyViewportLayout(){
    const root=q('controlsBody');
    if(!root)return;
    const fields=[...root.children];
    if(layoutTab!==active){layoutTab=active;currentFieldPage=0;}
    root.dataset.count=String(fields.length);
    const mobile=window.matchMedia('(max-width:1050px)').matches;
    const available=window.innerHeight;
    // Page through inputs on narrow displays. All inputs remain mounted.
    const perPage=!mobile?fields.length:
      available<=640?2:available<=820?3:4;
    const pages=Math.max(1,Math.ceil(fields.length/Math.max(1,perPage)));
    currentFieldPage=Math.min(Math.max(0,currentFieldPage),pages-1);
    fields.forEach((element,index)=>{
      element.hidden=mobile&&(index<currentFieldPage*perPage||index>=(currentFieldPage+1)*perPage);
    });
    root.style.setProperty('--visible-count',String(mobile?Math.min(perPage,fields.length-currentFieldPage*perPage):fields.length));
    q('fieldPager').hidden=!mobile||pages===1;
    q('fieldPageLabel').textContent=(currentFieldPage+1)+' / '+pages;
    q('fieldPagePrev').disabled=currentFieldPage===0;
    q('fieldPageNext').disabled=currentFieldPage===pages-1;
    if(!mobile){
      document.body.dataset.screenPanel='desktop';
    }else{
      document.body.dataset.screenPanel=screenPanel;
    }
  }
  q('screenViews').addEventListener('click',event=>{
    const button=event.target.closest('[data-screen-panel]');
    if(button)setScreenPanel(button.dataset.screenPanel);
  });
  q('fieldPagePrev').addEventListener('click',()=>{
    currentFieldPage=Math.max(0,currentFieldPage-1);applyViewportLayout();
  });
  q('fieldPageNext').addEventListener('click',()=>{
    currentFieldPage++;applyViewportLayout();
  });
  let layoutFrame=null;
  window.addEventListener('resize',()=>{
    if(layoutFrame)cancelAnimationFrame(layoutFrame);
    layoutFrame=requestAnimationFrame(()=>{
      layoutFrame=null;applyViewportLayout();
      if(!window.matchMedia('(max-width:1050px)').matches||screenPanel==='chart')renderResults();
    });
  });
