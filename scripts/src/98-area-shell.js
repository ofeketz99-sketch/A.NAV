
  // Top-level areas: the existing calculators and the investments workspace share one frame (logo, header, footer).
  // The calculator DOM stays mounted while hidden, so its ids, state and storage are untouched by switching.
  // The investments accent comes from CSS (!important beats the inline per-tab accent), so applyTabAccent can keep running.
  (function(){
    const switcher=q('areaSwitch'),investApp=q('investApp'),investTabs=q('investTabs');
    if(!switcher||!investApp||!investTabs)return;
    const AREA_KEY='anav.shell.v1';
    const INVEST_COLOR='#2f6461';
    const areas=['calc','invest'];
    const views=['log','holdings','performance','cash'];
    let area='calc',view='log';
    try{
      const saved=JSON.parse(localStorage.getItem(AREA_KEY)||'null');
      if(saved&&typeof saved==='object'){
        if(areas.includes(saved.area))area=saved.area;
        if(views.includes(saved.view))view=saved.view;
      }
    }catch(_){}
    const persist=()=>{try{localStorage.setItem(AREA_KEY,JSON.stringify({area,view}));}catch(_){}};
    const areaButtons=[...switcher.querySelectorAll('[data-area-target]')];
    const viewButtons=[...investTabs.querySelectorAll('[data-invest-view]')];
    function selectTabs(buttons,attr,value){
      buttons.forEach(b=>{const on=b.dataset[attr]===value;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    }
    function render(){
      app.dataset.area=area;
      const invest=area==='invest';
      investApp.hidden=!invest;
      // Hidden calculator controls leave the keyboard order too.
      for(const id of ['contentLayout','screenViews'])q(id).inert=invest;
      selectTabs(areaButtons,'areaTarget',area);
      selectTabs(viewButtons,'investView',view);
      investApp.querySelectorAll('.invest-view').forEach(panel=>{panel.hidden=panel.dataset.view!==view;});
      // Views that draw charts measure themselves once visible.
      if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('anav:invest-view',{detail:{area,view}}));
    }
    function enter(el){
      if(!motionAllowed())return;
      el.animate([{opacity:.55,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});
    }
    function setArea(next){
      if(next===area||!areas.includes(next))return;
      const from=switcher.querySelector('[data-area-target="'+area+'"]'),to=switcher.querySelector('[data-area-target="'+next+'"]');
      const dir=Math.sign(to.getBoundingClientRect().left-from.getBoundingClientRect().left);
      const prevColor=area==='invest'?INVEST_COLOR:app.style.getPropertyValue('--ambient');
      area=next;render();persist();
      playNavMotion(dir,prevColor);
      if(area==='calc'){
        // Charts rendered while hidden have no geometry; redo layout now that the calculators are visible again.
        applyViewportLayout();renderResults();enter(q('contentLayout'));
      }else enter(investApp.querySelector('.invest-stage'));
    }
    function setView(next){
      if(next===view||!views.includes(next))return;
      view=next;render();persist();
      enter(investApp.querySelector('.invest-view:not([hidden])'));
    }
    // Arrow keys move between tabs (RTL: left is "next"), Home/End jump to the ends.
    function tabKeys(buttons,choose){
      return e=>{
        const i=buttons.indexOf(e.target.closest('[role="tab"]'));
        if(i<0)return;
        const step={ArrowLeft:1,ArrowRight:-1}[e.key];
        let n=null;
        if(step)n=(i+step+buttons.length)%buttons.length;
        else if(e.key==='Home')n=0;
        else if(e.key==='End')n=buttons.length-1;
        if(n===null)return;
        e.preventDefault();choose(buttons[n]);buttons[n].focus();
      };
    }
    switcher.addEventListener('click',e=>{const b=e.target.closest('[data-area-target]');if(b)setArea(b.dataset.areaTarget);});
    investTabs.addEventListener('click',e=>{const b=e.target.closest('[data-invest-view]');if(b)setView(b.dataset.investView);});
    switcher.addEventListener('keydown',tabKeys(areaButtons,b=>setArea(b.dataset.areaTarget)));
    investTabs.addEventListener('keydown',tabKeys(viewButtons,b=>setView(b.dataset.investView)));
    // Ctrl+Z belongs to the calculators; it must not undo hidden calculator edits while the investments area is open.
    window.addEventListener('keydown',e=>{
      if(area==='invest'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')e.stopImmediatePropagation();
    },true);
    render();
  })();
