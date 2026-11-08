
  // Stage 4: edit budget categories and investment contributions directly in a chart.
  let chartDrag=null,chartSuppressClick=false;
  function chartFieldSpec(tab,id){return configs[tab].fields.find(f=>f[0]===id);}
  chart.addEventListener('pointerdown',event=>{
    if(event.button!==0||chartDrag)return;
    const handle=event.target.closest('[data-chart-drag]');
    const track=event.target.closest('.bar-track');
    const budgetRow=track?.closest('[data-budget-field]');
    if(!handle&&!budgetRow)return;
    if(handle){
      const tab=active,s=states[tab],f=chartFieldSpec(tab,'monthly');
      const ctm=handle.ownerSVGElement?.getScreenCTM(),model=hoverChartModel;
      if(!f||!ctm||!model)return;
      const events=contributions[tab]||[];
      const base=futureValue({...s,monthly:0},s.rate,tab==='index'?s.fees:0,events).value;
      const sensitivity=futureValue({...s,monthly:1},s.rate,tab==='index'?s.fees:0,events).value-base;
      if(!Number.isFinite(sensitivity)||sensitivity<=1e-8)return;
      chartDrag={type:'line',tab,id:'monthly',pointerId:event.pointerId,svg:handle.ownerSVGElement,ctm,model:{...model},base,sensitivity,field:f,x:event.clientX,y:event.clientY,moved:false};
    }else if(active==='budget'){
      const id=budgetRow.dataset.budgetField,f=chartFieldSpec(active,id);
      if(!f)return;
      chartDrag={type:'budget',tab:active,id,pointerId:event.pointerId,rect:track.getBoundingClientRect(),scale:Number(budgetRow.dataset.budgetScale),field:f,x:event.clientX,y:event.clientY,moved:false};
    }
    if(chartDrag){try{chart.setPointerCapture(event.pointerId);}catch(e){}event.preventDefault();}
  });
  chart.addEventListener('pointermove',event=>{
    const drag=chartDrag;
    if(!drag||drag.pointerId!==event.pointerId||active!==drag.tab)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4)return;
    drag.moved=true;
    let value;
    if(drag.type==='budget'){
      const ratio=clamp((drag.rect.right-event.clientX)/Math.max(1,drag.rect.width),0,1);
      value=ratio*drag.scale;
    }else{
      const point=drag.svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const p=point.matrixTransform(drag.ctm.inverse()),m=drag.model;
      const requested=clamp((m.y0-p.y)/(m.y0-m.y1)*m.max,0,m.max*1.12);
      value=(requested-drag.base)/drag.sensitivity;
    }
    const f=drag.field,step=f[4]||1;
    value=clamp(f[2]+Math.round((value-f[2])/step)*step,f[2],f[3]);
    if(Number.isFinite(value)&&Math.abs(states[drag.tab][drag.id]-value)>1e-7){
      changeValue(drag.id,Number(value.toFixed(10)),'chart-drag');
      hideChartTip();
    }
  });
  function finishChartDrag(event){
    if(!chartDrag||event.pointerId!==chartDrag.pointerId)return;
    chartSuppressClick=chartDrag.moved;
    chartDrag=null;
    try{chart.releasePointerCapture(event.pointerId);}catch(e){}
  }
  chart.addEventListener('pointerup',finishChartDrag);
  chart.addEventListener('pointercancel',finishChartDrag);
  chart.addEventListener('click',event=>{
    if(!chartSuppressClick)return;
    chartSuppressClick=false;event.preventDefault();event.stopImmediatePropagation();
  },true);
  chart.addEventListener('keydown',event=>{
    const handle=event.target.closest('[data-chart-drag]');
    const bar=event.target.closest('[data-budget-field]');
    if((!handle&&!bar)||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const id=handle?'monthly':bar.dataset.budgetField,f=chartFieldSpec(active,id);
    if(!f||goalPinned[active]?.includes(id))return;
    const sign=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1;
    event.preventDefault();event.stopImmediatePropagation();
    changeValue(id,states[active][id]+sign*f[4],'chart-keyboard');
    const target=chart.querySelector(handle?'[data-chart-drag]':'[data-budget-field="'+id+'"]');
    target?.focus();
  });
