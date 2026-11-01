  function show(mainLabel,mainValue,tag,description,stats,chartTitle,chartCaption,chartContent,chartBottom,insight,tone='info',status='מידע'){
    q('heroLabel').textContent=mainLabel;q('heroNumber').textContent=mainValue;q('mobileLabel').textContent=mainLabel;q('mobileNumber').textContent=mainValue;q('heroTag').textContent=tag;q('heroDesc').textContent=description;
    q('stats').innerHTML=stats.map(([label,value,mini])=>`<div class="stat"><div class="stat-label">${label}</div><div class="stat-number">${value}</div>${mini?`<div class="stat-mini">${mini}</div>`:''}</div>`).join('');
    q('chartTitle').textContent=chartTitle;q('chartCaption').textContent=chartCaption;q('chart').innerHTML=chartContent; if(typeof toolTip!=='undefined')toolTip.hidden=true;
    q('chartBottom').textContent=chartBottom+(goalIsActive()&&goalFeedback[active]&&!goalFeedback[active].reached?' · '+goalFeedback[active].message:'')+comparisonText();renderComposition();updateMeter();
    const heroStatus=q('heroStatus');
    heroStatus.hidden=!status;
    heroStatus.textContent=status||'';
    heroStatus.dataset.tone=tone||'info';
    heroStatus.title=insight||status||'';
    heroStatus.setAttribute('aria-label',(status||'')+(insight?': '+insight:''));
    updateHeroSecondary();
    const chartToggle=q('chartModeToggle'),isInvest=active==='savings'||active==='index';
    chartToggle.hidden=!isInvest;if(isInvest){chartToggle.setAttribute('aria-pressed',String(chartModes[active]));chartToggle.textContent=chartModes[active]?'הסתר הפקדות':'הצג הפקדות';}
  }

  function scenarioFor(tab){return scenarios[tab].find(x=>x.id===compareIds[tab])||null;}
  function scenarioOutput(tab,rec){
    if(!rec)return null;
    const s=rec.values||{};
    if(tab==='mortgage'){const p=Math.max(0,s.price-s.equity),r=schedule(p,s.rate,s.years,s.extra);return {value:r.payment+(rec.advanced?.insurance||0),series:r.monthlySeries,years:r.months/12};}
    if(tab==='loan'){const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);return {value:r.payment,series:r.monthlySeries,years:r.months/12};}
    if(tab==='savings'||tab==='index'){
      const r=futureValue(s,s.rate,tab==='index'?s.fees:0,rec.events||[]);
      const tax=tab==='index'&&rec.advanced?.taxEnabled?Math.max(0,r.value-Math.max(r.contributed,r.inflationBasis||r.contributed))*(Number(rec.advanced.taxRate)||0)/100:0;
      return {value:r.value-tax,series:r.monthlySeries,years:s.years};
    }
    if(tab==='budget'){const a=(rec.advanced?.annualItems||[]).reduce((total,x)=>total+(Number(x.amount)||0),0)/12;return {value:s.income-s.housing-s.bills-s.living-(s.spending||0)-s.savings-a,series:null,years:1};}
    return null;
  }
  function currentScenarioValue(){return scenarioOutput(active,{values:states[active],events:contributions[active]||[],advanced:advanced[active]||{}});}
  function comparisonText(){const rec=scenarioFor(active),base=rec&&scenarioOutput(active,rec),current=currentScenarioValue();if(!base||!current)return '';
    const delta=current.value-base.value;return ` · השוואה ל״${rec.name}״: ${money(base.value)} (פער ${delta>=0?'+':''}${money(delta)})`;
  }
