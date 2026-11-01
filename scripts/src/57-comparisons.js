  // The baseline mirrors the actual Reset button: user-configured slider reset
  // points, no scheduled savings deposits, and preserved advanced settings.
  function resetBaseline(tab){
    const values=Object.fromEntries(configs[tab].fields.map(f=>[f[0],getResetPoint(tab,f[0])]));
    if(tab==='mortgage'){
      values.equity=Math.min(values.equity,values.price);
      values.kind='first';
    }
    return values;
  }
  function headlineValue(tab,s,events=[]){
    if(tab==='mortgage')return schedule(Math.max(0,s.price-s.equity),s.rate,s.years,s.extra).payment+advanced.mortgage.insurance;
    if(tab==='loan')return schedule(s.principal,s.rate,loanTermYears(s),s.extra).payment;
    if(tab==='savings'||tab==='index')return futureValue(s,s.rate,tab==='index'?s.fees:0,events).value;
    const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+(Number(item.amount)||0),0)/12;
    return s.income-s.housing-s.bills-s.living-s.spending-s.savings-annual;
  }
  function secondaryMetric(){
    const s=states[active];
    if(active==='mortgage'){
      if(advanced.mortgage.income>0){
        const share=100*headlineValue(active,s)/advanced.mortgage.income;
        return {label:'יחס החזר להכנסה',value:pct(share),detail:'כולל ביטוח, לפי ההכנסה שהוגדרה'};
      }
      const required=s.price*(1-limits[s.kind]);
      return {label:'הון עצמי מינימלי',value:money(required),detail:'לפי תקרת המימון לסוג הנכס'};
    }
    if(active==='savings'){
      const r=futureValue(s,s.rate,0,contributions.savings||[],s.goal);
      if(goalIsActive('savings')&&goalPlans.savings.solve==='years')return {label:'משך החיסכון הנדרש',value:yearLabel(s.years),detail:'תקופת מינימום בחודשים לפי חישוב היעד הנעול'};
      if(r.reachedMonth===null)return {label:'זמן להשגת היעד',value:'לא הושג',detail:'בתקופת החיסכון שנבחרה'};
      if(r.reachedMonth===0)return {label:'זמן להשגת היעד',value:'כבר הושג',detail:'הסכום ההתחלתי מכסה את היעד'};
      return {label:'זמן להשגת היעד',value:Number((r.reachedMonth/12).toFixed(1)).toLocaleString('he-IL')+' שנים',detail:'בהנחת התשואה בסימולציה'};
    }
    if(active==='index'){
      const r=futureValue(s,s.rate,s.fees,contributions.index||[]),gain=r.value-r.contributed;
      if(goalIsActive('index'))return {label:'התקדמות ליעד',value:pct(s.goal>0?r.value/s.goal*100:0),detail:'שווי נומינלי לפני מס ביחס ליעד הנעול'};
      if(r.contributed<=0)return {label:'רווח לכל ₪1,000',value:'—',detail:'נדרשות הפקדות לחישוב היחס'};
      return {label:'רווח לכל ₪1,000',value:money(gain/r.contributed*1000),detail:'שקלים לכל ₪1,000 שהופקדו · לפני מס'};
    }
    if(active==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      return {label:'החזר לכל ₪1,000',value:money(1000*(s.principal+r.interest)/s.principal),detail:'סך החזר קרן וריבית לאורך התקופה'};
    }
    const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+(Number(item.amount)||0),0)/12;
    const monthly=s.income-s.housing-s.bills-s.living-s.spending-s.savings-annual;
    return {label:monthly<0?'גירעון שנתי צפוי':'עודף שנתי צפוי',value:money(monthly*12),detail:'אם התקציב החודשי יישאר קבוע'};
  }
  function updateHeroSecondary(){
    const metric=secondaryMetric();
    q('heroSecondaryLabel').textContent=metric.label;
    q('heroSecondaryNumber').textContent=metric.value;
    q('heroSecondaryDesc').textContent=metric.detail;
    q('heroSecondary').title=metric.label+': '+metric.value+'. '+metric.detail;
    const current=headlineValue(active,states[active],contributions[active]||[]);
    const original=headlineValue(active,resetBaseline(active));
    const difference=current-original;
    const nearlyEqual=Math.abs(difference)<.5;
    const delta=nearlyEqual?'ללא שינוי':(difference>0?'+':'−')+(Math.abs(difference)>=1000000?'₪'+compactMoney(Math.abs(difference)):money(Math.abs(difference)));
    const baseline=q('heroBaselineDelta');
    baseline.textContent=delta;
    baseline.classList.toggle('is-equal',nearlyEqual);
    q('heroBaseline').title='תרחיש הבסיס מבוסס על ערכי האיפוס שהגדרת לסליידרים · תוצאה בסיסית: '+money(original)+' · תוצאה נוכחית: '+money(current)+' · הפרש: '+money(difference);
    q('heroBaseline').setAttribute('aria-label','הפרש מתרחיש בסיס נבחר: '+(nearlyEqual?'ללא שינוי':money(difference)));
  }

