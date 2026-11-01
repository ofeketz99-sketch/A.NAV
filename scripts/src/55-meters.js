  // Animated, semantic ring indicator: financing / goal / gains / interest / budget utilization.
  const meterCircumference=2*Math.PI*31;
  const meterCircumferenceSecondary=2*Math.PI*39;
  const meterCircumferenceTertiary=2*Math.PI*47;
  const meterProgress=q('meterProgress'),meterProgressSecondary=q('meterProgressSecondary'),meterProgressTertiary=q('meterProgressTertiary'),meterTrackSecondary=q('meterTrackSecondary'),meterTrackTertiary=q('meterTrackTertiary'),meterNumber=q('meterNumber'),meterLabel=q('meterLabel'),meter=q('heroMeter');
  let meterValue=0,meterTarget=0,meterFrame=0,meterFrameStart=0;
  function meterMetric(){
    const s=states[active];
    if(active==='mortgage'){
      const rate=s.price>0?100*Math.max(0,s.price-s.equity)/s.price:0;
      return {value:rate,label:'שיעור מימון',detail:'אחוז ממחיר הנכס שממומן באמצעות משכנתא'};
    }
    if(active==='savings'){
      const r=futureValue(s,s.rate,0,contributions.savings||[],s.goal);
      const rate=s.goal>0?r.value/s.goal*100:0;
      return {value:rate,label:'מהיעד',detail:'אחוז מהיעד שהגדרת שהסימולציה צפויה להשיג'};
    }
    if(active==='index'){
      const r=futureValue(s,s.rate,s.fees,contributions.index||[]);
      const basis=Math.max(r.contributed,r.inflationBasis||r.contributed);
      const tax=advanced.index.taxEnabled?Math.max(0,r.value-basis)*advanced.index.taxRate/100:0;
      const netGain=r.value-r.contributed-tax;
      const cumulativeReturn=r.contributed>0?100*netGain/r.contributed:0;
      return {value:cumulativeReturn,label:'תשואה נטו',detail:advanced.index.taxEnabled?'תשואה מצטברת ביחס לכלל ההפקדות, אחרי דמי ניהול ואומדן מס. לא תשואה שנתית.':'תשואה מצטברת ביחס לכלל ההפקדות, אחרי דמי ניהול ולפני מס. לא תשואה שנתית.'};
    }
    if(active==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      const total=s.principal+r.interest;
      return {value:total>0?100*r.interest/total:0,label:'חלק הריבית',detail:'אחוז הריבית מסך התשלומים לאורך חיי ההלוואה'};
    }
    const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+(Number(item.amount)||0),0)/12;
    const out=s.housing+s.bills+s.living+s.spending+s.savings+annual;
    return {value:s.income>0?100*out/s.income:(out>0?100:0),label:'ניצול הכנסה',detail:'אחוז ההכנסה המיועד להוצאות ולחיסכון; מעל 100% משמעו גירעון'};
  }
  function setMeterRings(totalValue){
    const showMulti=active==='index';
    const first=clamp(totalValue,0,100);
    const second=clamp(totalValue-100,0,100);
    const third=clamp(totalValue-200,0,100);
    const ringCount=showMulti?(totalValue>200?3:(totalValue>100?2:1)):1;
    meter.dataset.rings=String(ringCount);
    meterProgress.style.strokeDashoffset=String(meterCircumference*(1-first/100));
    meterProgress.style.opacity=first>0?'1':'0';
    meterProgressSecondary.style.strokeDashoffset=String(meterCircumferenceSecondary*(1-second/100));
    meterProgressSecondary.style.opacity=showMulti&&totalValue>100&&second>0?'1':'0';
    meterTrackSecondary.style.opacity=showMulti&&totalValue>100?'.82':'0';
    meterProgressTertiary.style.strokeDashoffset=String(meterCircumferenceTertiary*(1-third/100));
    meterProgressTertiary.style.opacity=showMulti&&totalValue>200&&third>0?'1':'0';
    meterTrackTertiary.style.opacity=showMulti&&totalValue>200?'.78':'0';
  }
  // Size the percentage to the usable width inside the INNER ring (r=31/120).
  // This prevents 101%, 153%, 220% and longer values from striking the ring.
  function fitMeterNumber(fromValue,toValue){
    const currentText=meterNumber.textContent;
    meterNumber.style.fontSize='';
    const baseSize=parseFloat(getComputedStyle(meterNumber).fontSize)||23;
    const aperture=meter.getBoundingClientRect().width*0.39;
    let widest=0;
    for(const value of [fromValue,toValue]){
      meterNumber.textContent=Math.round(value)+'%';
      widest=Math.max(widest,meterNumber.getBoundingClientRect().width);
    }
    meterNumber.textContent=currentText;
    const fitted=widest>0?Math.min(baseSize,baseSize*aperture/widest):baseSize;
    meterNumber.style.fontSize=Math.max(10,Math.floor(fitted*10)/10)+'px';
  }
  window.addEventListener('resize',()=>fitMeterNumber(meterValue,meterTarget));
  if(document.fonts?.ready)document.fonts.ready.then(()=>fitMeterNumber(meterValue,meterTarget));

  function updateMeter(){
    const m=meterMetric();
    const raw=Number.isFinite(m.value)?m.value:0;
    const target=Math.max(-999,Math.min(9999,raw));
    meterLabel.textContent=m.label;
    const multiHint=active==='index'&&raw>100?' כל טבעת מלאה מייצגת 100%.':'';
    meter.setAttribute('aria-label',m.label+': '+pct(raw)+'. '+m.detail+multiHint);
    meter.title=m.detail+' · '+pct(raw)+(active==='index'&&raw>100?' · כל טבעת מלאה מייצגת 100%':'');
    setMeterRings(target);
    meter.dataset.state=active==='budget'&&raw>100?'alert':active==='savings'&&raw>=100?'complete':'normal';
    if(meterFrame)cancelAnimationFrame(meterFrame);
    const from=meterValue;
    meterTarget=target;
    fitMeterNumber(from,target);
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      meterValue=target;meterNumber.textContent=Math.round(target)+'%';return;
    }
    const duration=340;
    meterFrameStart=performance.now();
    const animate=(timestamp)=>{
      const t=Math.max(0,Math.min(1,(timestamp-meterFrameStart)/duration));
      const smooth=1-Math.pow(1-t,3);
      const current=from+(meterTarget-from)*smooth;
      meterValue=current;
      meterNumber.textContent=Math.round(current)+'%';
      if(t<1)meterFrame=requestAnimationFrame(animate);else meterFrame=0;
    };
    meterFrame=requestAnimationFrame(animate);
  }

