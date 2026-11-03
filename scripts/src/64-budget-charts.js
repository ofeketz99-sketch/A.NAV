  function budgetBars(items){hoverChartModel=null;
    const max=Math.max(1,...items.map(i=>i[1]))*1.15;
    const total=items.reduce((sum,item)=>sum+Math.max(0,item[1]),0);
    return `<div class="bar-chart">${items.map(([title,v,id],i)=>`<div class="bar-row" ${id?`data-budget-scale="${max}" data-budget-field="${id}" role="button" aria-label="עריכת ${escapeHtml(title)}"`:""} data-tip="${escapeHtml(title)}: ${money(v)} · ${pct(total?100*v/total:0)} מסך ההוצאות וההפקדות" tabindex="0"><div class="bar-name" title="${escapeHtml(title)}">${escapeHtml(title)}</div><div class="bar-track"><div class="bar-fill" style="width:${100*v/max}%;opacity:${1-i*.12}"></div></div><div class="bar-amount">${money(v)}</div></div>`).join('')}<div class="bar-chart-guide">גרירה לשינוי · לחיצה לעריכה</div></div>`;
  }

  // Stage 6: RTL cash-flow ribbon diagram; every band is derived from monthly budget fields.
  function budgetFlowChart(items,income){
    hoverChartModel=null;
    const chosen=items.map(([title,value,id],i)=>({title:String(title),value:Math.max(0,Number(value)||0),id:id||null,i})).filter(e=>e.value>0);
    const committed=chosen.reduce((sum,e)=>sum+e.value,0);
    const surplus=Math.max(0,income-committed),shortfall=Math.max(0,committed-income);
    if(surplus>0)chosen.push({title:'יתרה פנויה',value:surplus,id:null,i:chosen.length});
    const overall=Math.max(1,committed,income);
    const palette=['#97836c','#b29978','#81927b','#c0ab90','#ab8176','#72867f','#c5ba9f','#91a486'];
    let sourceY=21,destinationY=21;
    const spacing=5.5,totalHeight=154,available=Math.max(60,totalHeight-spacing*Math.max(0,chosen.length-1));
    const parts=chosen.map((item,i)=>{
      const thick=Math.max(1.1,item.value/overall*available);
      const sy=sourceY,dy=destinationY;
      sourceY+=thick;destinationY+=thick+spacing;
      const fill=palette[i%palette.length],title=escapeHtml(item.title),value=money(item.value);
      const path='M 507 '+sy+' C 380 '+sy+' 278 '+dy+' 157 '+dy+
        ' L 157 '+(dy+thick)+' C 278 '+(dy+thick)+' 380 '+(sy+thick)+' 507 '+(sy+thick)+' Z';
      const attr=item.id?' data-budget-field="'+item.id+'" tabindex="0" role="button" aria-label="ערוך '+title+'"':'';
      return '<g class="budget-flow-band"'+attr+' data-tip="'+title+' · '+escapeHtml(value)+'">'+
        '<path d="'+path+'" fill="'+fill+'" opacity=".8"/>'+
        '<rect x="147" y="'+dy+'" width="10" height="'+thick+'" rx="1.5" fill="'+fill+'"/>'+
        '<title>'+title+': '+escapeHtml(value)+'</title></g>';
    }).join('');
    const legend=chosen.map((item,i)=>
      '<div class="flow-legend-item"'+(item.id?' data-budget-field="'+item.id+'" tabindex="0" role="button"':'')+'>'+
      '<i style="background:'+palette[i%palette.length]+'"></i><span>'+escapeHtml(item.title)+'</span><strong>'+money(item.value)+'</strong></div>'
    ).join('');
    return '<div class="budget-flow">'+
      '<div class="budget-flow-head"><strong>הכנסה: '+money(income)+'</strong><span>'+(shortfall?'חריגה מההכנסה: '+money(shortfall):'יתרה פנויה: '+money(surplus))+'</span></div>'+
      '<svg viewBox="0 0 620 195" class="budget-flow-svg" role="group" aria-label="זרימת הכנסה להוצאות, חיסכון ויתרה פנויה" preserveAspectRatio="xMidYMid meet">'+
      '<text x="550" y="17" text-anchor="middle" direction="rtl" font-size="12" fill="#6b5e50">הכנסה</text>'+
      '<text x="120" y="17" text-anchor="middle" direction="rtl" font-size="12" fill="#6b5e50">חלוקה</text>'+
      parts+'<rect x="507" y="21" width="16" height="'+Math.max(1,sourceY-21)+'" rx="3" fill="var(--accent)"/>'+
      '</svg><div class="flow-legend">'+legend+'</div>'+
      '<div class="bar-chart-guide">לחיצה לעריכה</div></div>';
  }
