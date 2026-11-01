  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed=()=>!reduceMotion.matches;
  function rectMap(elements){
    return new Map([...elements].map(el=>[el,el.getBoundingClientRect()]));
  }
  function flipElements(before,elements,direction='y'){
    if(!motionAllowed())return;
    for(const el of elements){
      const from=before.get(el),to=el.getBoundingClientRect();
      if(!from)continue;
      const dx=from.left-to.left,dy=from.top-to.top;
      if(Math.abs(dx)<.5 && Math.abs(dy)<.5)continue;
      el.getAnimations().forEach(animation=>{if(animation.effect?.getKeyframes()?.some(f=>f.transform))animation.cancel();});
      el.animate([
        {transform:`translate3d(${dx}px, ${dy}px, 0)`},
        {transform:'translate3d(0,0,0)'}
      ],{duration:direction==='x'?240:210,easing:'cubic-bezier(.22,1,.36,1)'});
    }
  }
