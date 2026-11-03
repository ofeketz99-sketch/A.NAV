  let currentStats=[];
  function show(mainLabel,mainValue,tag,description,stats,chartTitle,chartCaption,chartContent,chartBottom,insight,tone='info',status='מידע'){
    q('heroLabel').textContent=mainLabel;q('heroNumber').textContent=mainValue;q('mobileLabel').textContent=mainLabel;q('mobileNumber').textContent=mainValue;q('heroTag').textContent=tag;q('heroDesc').textContent=description;
    q('stats').innerHTML=stats.map(([label,value,mini],i)=>`<button type="button" class="stat" data-stat-index="${i}" aria-label="פרטים על ${escapeHtml(label)}"><div class="stat-label">${label}</div><div class="stat-number">${value}</div>${mini?`<div class="stat-mini">${mini}</div>`:''}</button>`).join('');currentStats=stats.map(x=>[...x]);
    q('chartTitle').textContent=chartTitle;q('chartCaption').textContent=chartCaption;q('chart').innerHTML=chartContent; if(typeof toolTip!=='undefined')toolTip.hidden=true;
    q('chartBottom').textContent=chartBottom+(goalIsActive()&&goalFeedback[active]&&!goalFeedback[active].reached?' · '+goalFeedback[active].message:'')+comparisonText();renderComposition();updateMeter();
    const heroStatus=q('heroStatus');
    heroStatus.hidden=!status;
    heroStatus.textContent=status||'';
    heroStatus.dataset.tone=tone||'info';
    heroStatus.title=insight||status||'';
    heroStatus.setAttribute('aria-label',(status||'')+(insight?': '+insight:''));
    updateHeroSecondary();updateTransferActions();
    const toggle=q('riskToggle'),volControl=q('riskVolWrap'),riskLine=q('riskSummary');
    toggle.hidden=active!=='index';toggle.setAttribute('aria-pressed',String(riskSettings.enabled));
    toggle.textContent=riskSettings.enabled?'הסתר טווח':'טווח תרחישים';
    volControl.hidden=active!=='index'||!riskSettings.enabled;
    q('riskVolatility').value=String(riskSettings.volatility);
    riskLine.hidden=!(active==='index'&&riskSettings.enabled&&riskLast);
    if(!riskLine.hidden)riskLine.textContent='הדמיה · 10–90%: '+money(riskLast.low.at(-1))+'–'+money(riskLast.high.at(-1))+
      ' · חציון '+money(riskLast.median.at(-1))+' · '+riskLast.goalShare+'% הגיעו ליעד · לא תחזית.';
    const chartToggle=q('chartModeToggle'),isInvest=active==='savings'||active==='index';
    chartToggle.hidden=!isInvest;if(isInvest){chartToggle.setAttribute('aria-pressed',String(chartModes[active]));chartToggle.textContent=chartModes[active]?'הסתר הפקדות':'הפקדות';}
  }

  function scenarioFor(tab){const rec=scenarios[tab].find(x=>x.id===compareIds[tab])||null;return rec&&compareDrafts[tab]?.id===rec.id?compareDrafts[tab]:rec;}
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
    const delta=current.value-base.value;return ` · מול ״${rec.name}״: ${money(base.value)} (פער ${delta>=0?'+':''}${money(delta)})`;
  }
