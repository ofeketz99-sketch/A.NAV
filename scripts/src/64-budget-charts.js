  function budgetBars(items){hoverChartModel=null;
    const max=Math.max(1,...items.map(i=>i[1]));
    const total=items.reduce((sum,item)=>sum+Math.max(0,item[1]),0);
    return `<div class="bar-chart">${items.map(([title,v],i)=>`<div class="bar-row" data-tip="${escapeHtml(title)}: ${money(v)} · ${pct(total?100*v/total:0)} מסך ההוצאות וההפקדות" tabindex="0"><div class="bar-name" title="${escapeHtml(title)}">${escapeHtml(title)}</div><div class="bar-track"><div class="bar-fill" style="width:${100*v/max}%;opacity:${1-i*.12}"></div></div><div class="bar-amount">${money(v)}</div></div>`).join('')}</div>`;
  }
