  // Graph tooltip: explicit event descriptions and exact amounts.
  const toolTip=document.createElement('div');toolTip.className='chart-tooltip';toolTip.hidden=true;document.querySelector('.chart-panel').append(toolTip);
  const chart=q('chart');
  function showChartTip(target){const hit=target.closest?.('[data-tip]');if(!hit)return hideChartTip();
    toolTip.textContent=hit.dataset.tip;toolTip.hidden=false;
    const chartPanel=document.querySelector('.chart-panel'),p=chartPanel.getBoundingClientRect(),b=hit.getBoundingClientRect();
    const relY=b.top-p.top;
    const half=Math.min(p.width/2-9,toolTip.offsetWidth/2+8);
    const relX=clamp((b.left+b.width/2)-p.left,half,p.width-half);
    toolTip.dataset.placement=relY<88?'below':'above';
    toolTip.style.left=relX+'px';toolTip.style.top=(relY<88?relY+8:relY-5)+'px';
  }
  function hideChartTip(){toolTip.hidden=true;}
  chart.addEventListener('pointerover',e=>{if(e.target.closest('[data-tip]'))showChartTip(e.target);});
  chart.addEventListener('focusin',e=>showChartTip(e.target));
  chart.addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))hideChartTip();});
  chart.addEventListener('focusout',hideChartTip);
  chart.addEventListener('click',e=>{if(e.target.closest('[data-tip]')){showChartTip(e.target);setTimeout(hideChartTip,2800);}});
  // Continuous, accurate hover along the whole SVG line, including months between milestones.
  function hoverAt(clientX,clientY){
    const svg=chart.querySelector('svg.line-chart'),m=hoverChartModel;
    if(!svg||!m)return;
    const ctm=svg.getScreenCTM();if(!ctm)return;
    const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
    const pt=point.matrixTransform(ctm.inverse());
    if(pt.x<m.x0-5||pt.x>m.x0+(m.x1-m.x0)*(m.years/m.horizon)+5||pt.y<m.y1-12||pt.y>m.y0+25){hideChartTip();svg.querySelector('.chart-cursor').style.display='none';return;}
    const index=Math.max(0,Math.min(m.values.length-1,Math.round((pt.x-m.x0)/((m.x1-m.x0)*(m.years/m.horizon))*(m.values.length-1))));
    const month=Math.round(index/(m.values.length-1||1)*m.years*12);
    const x=m.x0+(m.x1-m.x0)*(m.years/m.horizon)*index/(m.values.length-1||1);
    const value=m.values[index];
    const y=m.y0-(Math.max(0,value)/m.max)*(m.y0-m.y1);
    const cursor=svg.querySelector('.chart-cursor');cursor.style.display='';
    const guide=cursor.querySelector('line'),dot=cursor.querySelector('circle');
    guide.setAttribute('x1',x);guide.setAttribute('x2',x);guide.setAttribute('y1',m.y0);guide.setAttribute('y2',y);
    dot.setAttribute('cx',x);dot.setAttribute('cy',y);
    let detail=`${active==='loan'?'חודש '+month:'שנה '+(month/12).toFixed(1).replace(/\.0$/,'')+' · חודש '+month} · ${active==='mortgage'||active==='loan'?'יתרה':'שווי'}: ${money(value)}`;
    if(m.principal){const invested=m.principal[index]??0;detail+=` · הפקדות: ${money(invested)} · ${value-invested>=0?'רווח':'הפסד'}: ${money(Math.abs(value-invested))}`;}
    if(m.compare){const j=Math.round(month/12/(m.compareYears||1)*(m.compare.length-1));if(j>=0&&j<m.compare.length)detail+=` · תרחיש להשוואה: ${money(m.compare[j])}`;}
    if(m.risk&&active==='index'){
      const i=m.risk.months.reduce((best,value,j)=>Math.abs(value-month)<Math.abs(m.risk.months[best]-month)?j:best,0);
      detail+=' · תרחישים מדומים 10–90%: '+money(m.risk.low[i])+'–'+money(m.risk.high[i]);
    }
    const nearby=m.events.filter(e=>Math.abs(e.month-month)<=.6);
    if(nearby.length)detail+=' · '+nearby.map(e=>e.type==='monthly'?`הפקדה חודשית עודכנה ל־${money(e.amount)}`:`הפקדה חד־פעמית ${money(e.amount)}`).join(' · ');
    const pp=svg.createSVGPoint();pp.x=x;pp.y=y;const screen=pp.matrixTransform(ctm);
    const panel=document.querySelector('.chart-panel').getBoundingClientRect();
    toolTip.textContent=detail;toolTip.hidden=false;
    const half=Math.min(panel.width/2-9,toolTip.offsetWidth/2+8),relY=screen.y-panel.top;
    toolTip.dataset.placement=relY<88?'below':'above';
    toolTip.style.left=clamp(screen.x-panel.left,half,panel.width-half)+'px';
    toolTip.style.top=(relY<88?relY+8:relY-5)+'px';
  }
  chart.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
    if(e.target.closest('[data-tip]'))return;
    hoverAt(e.clientX,e.clientY);
  });
  chart.addEventListener('pointerleave',()=>{hideChartTip();const cursor=chart.querySelector('.chart-cursor');if(cursor)cursor.style.display='none';});
  chart.addEventListener('click',e=>{
    if(e.target.closest('[data-tip]'))return;
    if(chart.querySelector('svg.line-chart')){hoverAt(e.clientX,e.clientY);if(e.pointerType!=='mouse')setTimeout(()=>{hideChartTip();const cursor=chart.querySelector('.chart-cursor');if(cursor)cursor.style.display='none';},2600);}
  });
