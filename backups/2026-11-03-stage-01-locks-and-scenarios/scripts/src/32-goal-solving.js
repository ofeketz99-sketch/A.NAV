  // Inverse future-value solver. Uses exactly the same engine as the chart and
  // includes dated deposits and annual management fees; no independent formula drift.
  function goalIsActive(tab=active){return (tab==='savings'||tab==='index') && !!goalPlans[tab].locked;}
  function goalTargetValue(tab,params=states[tab]){
    return futureValue(params,params.rate,tab==='index'?params.fees:0,contributions[tab]||[]).value;
  }
  function yearLabel(years){
    const n=Math.round(years*12),y=Math.floor(n/12),m=n%12;
    return (y?(y===1?'שנה אחת':y+' שנים'):'')+(y&&m?' ו־':'')+(m?(m===1?'חודש אחד':m+' חודשים'):'')||'0 חודשים';
  }
  function goalSolver(tab){
    if(!goalIsActive(tab)) {goalFeedback[tab]=null;return;}
    const pinned=goalPinned[tab];
    const choices=goalSolveChoices.map(x=>x[0]).filter(id=>!pinned.includes(id));
    if(!choices.includes(goalPlans[tab].solve))goalPlans[tab].solve=choices[0]||'';
    const s=states[tab],field=goalPlans[tab].solve,goal=s.goal;
    if(!field){
      const actual=goalTargetValue(tab),gap=goal-actual,reached=actual>=goal-0.51;
      goalFeedback[tab]={reached,limitReached:!reached,actual,
        message:reached?'כל המשתנים קבועים והיעד מושג. שחרר מנעול כדי לחשב משתנה אחר.':
          `כל המשתנים קבועים · חסרים ${money(Math.max(0,gap))} להגעה ליעד. שחרר לפחות מנעול אחד.`};
      return;
    }
    const spec=configs[tab].fields.find(f=>f[0]===field);
    if(!spec)return;
    const min=spec[2],max=spec[3],events=contributions[tab];
    const valueAt=(v)=>goalTargetValue(tab,{...s,[field]:v});
    let value=s[field],note='',limitReached=false;
    if(field==='monthly'||field==='initial'){
      const base=valueAt(0),coefficient=valueAt(1)-base;
      if(coefficient<=1e-8){
        value=min;limitReached=true;
        note=field==='monthly'?'שינוי הפקדות עתידי מחליף את ההפקדה כבר מהחודש הראשון, לכן ההפקדה ההתחלתית לא משפיעה על היעד.':'לא ניתן לחשב את הפרמטר בתנאים האלה.';
      }else{
        const required=(goal-base)/coefficient;
        value=clamp(Math.ceil(Math.max(0,required)*100-1e-7)/100,min,max);
        if(required>max+.001){limitReached=true;note='כדי להגיע ליעד נדרש ערך מעל המקסימום המוגדר בסליידר.';}
        else if(required<min-0.001){note='היעד מושג כבר בערך המינימלי.';}
      }
    }else if(field==='years'){
      const horizon=futureValue({...s,years:max},s.rate,tab==='index'?s.fees:0,events);
      const first=horizon.monthlySeries.findIndex((val,i)=>i>=Math.round(min*12)&&val+0.5>=goal);
      if(first<0){value=max;limitReached=true;note='לא ניתן להגיע ליעד גם בתקופה המרבית של 80 שנה.';}
      else{
        value=Math.max(min,first/12);
        if(first===Math.round(min*12)&&horizon.monthlySeries[12]>goal+0.5)note='היעד הושג כבר במהלך השנה הראשונה.';
      }
    }else if(field==='rate'){
      const vMin=valueAt(min),vMax=valueAt(max);
      if(vMin>=goal-0.5){value=min;note='היעד מושג גם בתשואה המינימלית.';}
      else if(vMax<goal-0.5){value=max;limitReached=true;note='היעד מחייב תשואה גבוהה מהטווח המוגדר בסליידר.';}
      else{
        let lo=min,hi=max;
        for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(valueAt(mid)>=goal)hi=mid;else lo=mid;}
        value=clamp(Math.ceil(hi*100-1e-9)/100,min,max);
      }
    }
    s[field]=Number(value.toFixed(10));
    const actual=goalTargetValue(tab);
    const reached=actual>=goal-0.51;
    if(!reached&&!note){limitReached=true;note='היעד אינו אפשרי בטווח הפרמטר שנבחר.';}
    const gap=goal-actual;
    goalFeedback[tab]={reached,limitReached,actual,note,
      message:!reached?`לא מגיעים ליעד · חסרים ${money(gap)}. ${note}`:
        note||`היעד מושג עם ${field==='years'?yearLabel(s.years):field==='rate'?pct(s.rate):money(s[field])}${field==='monthly'?' בחודש':field==='initial'?' בהתחלה':''}.`};
  }
  function syncReleaseLocksButton(){
    const button=q('unlockAllGoals'),count=q('unlockCount');
    if(!button||!count)return;
    const supported=active==='savings'||active==='index';
    button.hidden=!supported;
    if(!supported)return;
    const total=goalPinned[active].length+(goalIsActive(active)?1:0);
    button.disabled=total===0;
    count.textContent=String(total);
    count.hidden=total===0;
    button.title=total?'שחרר '+total+' נעילות בגיליון '+tabLabels[active]+' · הערכים עצמם לא ישתנו':'אין נעילות לשחרור בגיליון זה';
    button.setAttribute('aria-label',total?'שחרר את כל '+total+' הנעילות בגיליון '+tabLabels[active]:'אין נעילות לשחרור בגיליון '+tabLabels[active]);
  }
  function syncGoalPlanningUI(){
    if(active!=='savings'&&active!=='index')return;
    const locked=goalIsActive(),plan=goalPlans[active],btn=q('goalLock'),selector=q('goalSolve');
    if(!btn||!selector)return;
    btn.setAttribute('aria-pressed',String(locked));
    btn.textContent=locked?'שחרר יעד':'נעל יעד';
    btn.title=locked?'בטל נעילת יעד וחזור לעריכה חופשית':'נעל את סכום היעד וחשב אוטומטית משתנה אחד';
    const opts=q('goalOptions');opts.hidden=!locked;
    const goalRow=q('range-goal')?.closest('.field');if(goalRow)goalRow.classList.toggle('goal-locked',locked);
    const allowed=goalSolveChoices.filter(([id])=>!goalPinned[active].includes(id));
    selector.innerHTML=allowed.length?allowed.map(([id,label])=>`<option value="${id}">${label}</option>`).join(''):'<option value="">אין משתנה פנוי</option>';
    selector.disabled=!allowed.length;
    selector.value=plan.solve||'';
    const info=q('goalFeedback');
    if(locked){
      const f=goalFeedback[active];
      info.textContent=f?.message||'שנה פרמטרים והמערכת תחשב את המשתנה שנבחר.';
      info.dataset.tone=f&&!f.reached?'warn':'good';
    }
    configs[active].fields.forEach(f=>{
      const id=f[0],r=q('range-'+id),n=q('number-'+id);
      if(!r||!n)return;
      const computed=locked&&!!plan.solve&&id===plan.solve;
      const pinned=goalPinned[active].includes(id);
      r.disabled=n.disabled=computed||pinned;
      const row=r.closest('.field');row.classList.toggle('goal-computed',computed);row.classList.toggle('goal-pinned',pinned);
      const pin=row.querySelector('[data-pin-field]');
      if(pin){pin.setAttribute('aria-pressed',String(pinned));pin.setAttribute('aria-label',(pinned?'בטל נעילה':'נעל')+': '+(fieldLabels[active][id]||f[1]));
        pin.title=pinned?'שחרר ערך נעול לעריכה':'נעל את הערך כך שלא ישתנה בחישוב היעד';
        const path=pin.querySelector('path');if(path)path.setAttribute('d',pinned?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 8 0');}
      r.value=n.value=String(states[active][id]);
      if(id==='years')r.dataset.slideStep=locked&&plan.solve==='years'?String(1/12):String(f[4]);
      paintSlider(r);
      if(computed){r.title='ערך מחושב לפי יעד נעול · בחר משתנה אחר כדי לשנות אותו';n.title=r.title;}
      else if(pinned){r.title='ערך נעול וקבוע · לחץ על המנעול כדי לאפשר עריכה';n.title=r.title;}
      else{r.removeAttribute('title');n.removeAttribute('title');}
    });
    syncReleaseLocksButton();
  }

