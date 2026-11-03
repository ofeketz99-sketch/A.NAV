  let hoverChartModel=null;
  function lineChart(data,years,events=[],principalSeries=null){
    const values=data.length?data:[0];
    const compare=scenarioFor(active),other=scenarioOutput(active,compare);
    const horizon=Math.max(.01,years,other?.years||0);
    const w=600,h=208,x0=28,x1=572,y0=170,y1=24;
    const allValues=[...values,...(other?.series||[]),...(chartModes[active]&&principalSeries?principalSeries:[])];
    const max=Math.max(1,...allValues)*1.23;
    const coords=(series,length)=>series.map((v,i)=>[x0+(x1-x0)*(length/horizon)*(i/Math.max(1,series.length-1)),y0-(Math.max(0,v)/max)*(y0-y1)]);
    const coord=coords(values,years);
    const linePath=points=>points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
    const path=linePath(coord),last=coord.at(-1);
    const area=path+` L ${last[0]} ${y0} L ${coord[0][0]} ${y0} Z`;
    const axisColor='#c4b6a6';
    const baseline=`<line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="${axisColor}" stroke-width="1.35"/>`;
    const milestoneCount=Math.min(6,Math.max(4,Math.round(years/5)+3));
    const milestoneIndexes=[...new Set(Array.from({length:milestoneCount},(_,step)=>Math.round((values.length-1)*step/Math.max(1,milestoneCount-1))))].filter(i=>i>=0&&i<coord.length);
    const fmtYear=y=>Number(y.toFixed(1)).toLocaleString('en-US',{maximumFractionDigits:1});
    const axisMarkers=milestoneIndexes.map((i,idx)=>{
      const p=coord[i],v=values[i],x=p[0],actualYear=years*i/Math.max(1,values.length-1);
      // A slight teardrop thickening where an axis marker joins the baseline.
      // Zero vertical slope at its tips makes the point taper naturally into the line.
      const half=8.1,r=2.45;
      const shape=`M ${x-half} ${y0} C ${x-half*.45} ${y0}, ${x-half*.52} ${y0-r}, ${x} ${y0-r} C ${x+half*.52} ${y0-r}, ${x+half*.45} ${y0}, ${x+half} ${y0} C ${x+half*.45} ${y0}, ${x+half*.52} ${y0+r}, ${x} ${y0+r} C ${x-half*.52} ${y0+r}, ${x-half*.45} ${y0}, ${x-half} ${y0} Z`;
      if(i===0)return `<path d="${shape}" fill="${axisColor}"/>`;
      const yearText=fmtYear(actualYear),shiftX=-13,labelX=x+shiftX;
      const labelY=Math.max(14,p[1]-(22+(idx%2)*4));
      const connector=`M ${labelX} ${labelY+4} Q ${x-10} ${Math.max(10,labelY+1)} ${x} ${Math.max(10,p[1]-4)}`;
      const tooltip=`${active==='loan'?'חודש '+Math.round(actualYear*12):'שנה '+yearText} · ${active==='loan'?'יתרה':'שווי'} ${money(v)}`+(principalSeries?.[i]!==undefined?` · הפקדות ${money(principalSeries[i])} · רווח ${money(v-principalSeries[i])}`:'');
      return `<path d="${shape}" fill="${axisColor}"/><line x1="${x}" y1="${y0-4}" x2="${x}" y2="${Math.min(y0-6,p[1]+6)}" stroke="#d8cec0" stroke-width="1" stroke-dasharray="2.4 4.2" opacity=".95"/><path d="${connector}" fill="none" stroke="#bda68b" stroke-width="1.15" stroke-linecap="round" opacity=".9"/><text x="${labelX}" y="${labelY}" direction="ltr" text-anchor="end" fill="#7e7264" font-size="10.5" font-family="Calibri, Carlito, Arial, sans-serif">${compactMoney(v)}</text><text x="${x}" y="${y0+19}" text-anchor="middle" fill="#968677" font-size="10.5" font-family="Calibri, Carlito, Arial, sans-serif">${active==='loan'?Math.round(actualYear*12):yearText}</text><circle cx="${x}" cy="${p[1]}" r="11" opacity="0" fill="#fff" tabindex="0" role="img" aria-label="${tooltip}" data-tip="${tooltip}"/>`;
    }).join('');
    const eventDots=events.filter(e=>e.month<=years*12).map(e=>{
      const p=coord[e.month];if(!p)return '';
      const when=`שנה ${Math.floor((e.month-1)/12)+1}, חודש ${((e.month-1)%12)+1}`;
      const label=e.type==='monthly'?`שינוי הפקדה חודשית ל־${money(e.amount)}`:`הפקדה חד־פעמית של ${money(e.amount)}`;
      const tooltip=`${when} · ${label} · שווי משוער: ${money(values[e.month])}`;
      return `<circle cx="${p[0]}" cy="${p[1]}" r="5.3" fill="#fffdf9" stroke="var(--accent)" stroke-width="2"/><circle cx="${p[0]}" cy="${p[1]}" r="14" fill="transparent" tabindex="0" role="img" aria-label="${tooltip}" data-tip="${tooltip}"/>`;
    }).join('');
    const principalPath=chartModes[active]&&principalSeries?.length===values.length
      ?`<path d="${linePath(coords(principalSeries,years))}" fill="none" stroke="#af8d68" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" opacity=".95"/>`:'';
    const otherPath=other?.series?`<path d="${linePath(coords(other.series,other.years))}" fill="none" stroke="#9a806c" stroke-width="2.2" stroke-dasharray="7 6" stroke-linecap="round" opacity=".78"/>`:'';
    hoverChartModel={values:[...values],years,horizon,x0,x1,y0,y1,max,
      principal:principalSeries?[...principalSeries]:null,
      events:events.map(e=>({...e})),compare:other?.series?[...other.series]:null,compareYears:other?.years||0};
    return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="גרף שינוי סכום לאורך זמן משמאל לימין"><defs><linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".15"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><rect x="${x0}" y="${y1-12}" width="${x1-x0}" height="${y0-y1+26}" fill="transparent" pointer-events="all"/><path d="${area}" fill="url(#lineFill)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>${principalPath}${otherPath}${baseline}${axisMarkers}${eventDots}<circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="var(--accent)" stroke="#fffdf9" stroke-width="1.5"/>${(active==='savings'||active==='index')&&!goalPinned[active].includes('monthly')&&!(goalIsActive()&&goalPlans[active].solve==='monthly')&&!events.some(e=>e.type==='monthly'&&e.month===1)?`<circle class="chart-edit-halo" cx="${last[0]}" cy="${last[1]}" r="15" fill="var(--accent-soft)" stroke="var(--accent)" stroke-opacity=".44" stroke-width="1.5" tabindex="0" role="slider" aria-label="גרור כדי לשנות את ההפקדה החודשית" aria-valuemin="${configs[active].fields.find(f=>f[0]==='monthly')[2]}" aria-valuemax="${configs[active].fields.find(f=>f[0]==='monthly')[3]}" aria-valuenow="${states[active].monthly}" data-chart-drag="monthly"><title>גרור מעלה או מטה לשינוי ההפקדה החודשית</title></circle>`:''}<g class="chart-cursor" style="display:none" pointer-events="none"><line class="chart-cursor-line" x1="0" y1="${y0}" x2="0" y2="${y0}" stroke="var(--accent)" stroke-opacity=".38" stroke-dasharray="3 4" stroke-width="1.25"/><circle class="chart-cursor-dot" cx="0" cy="${y0}" r="4.5" fill="var(--accent)" stroke="#fffdfa" stroke-width="2"/></g></svg><div class="chart-axis"><span>${active==='loan'?'חודשים':'שנים'}${chartModes[active]?' · קו מנוקד חום: סך הפקדות':''}${other?' · קו מקווקו: '+escapeHtml(compare.name):''}</span></div>`;
  }
