
  // Interactive result cards and budget chart direct editing.
  const statExplanations={
    mortgage:['מחיר הדירה פחות ההון העצמי.','סך הריבית לאורך תקופת המשכנתא.','יחס סכום המשכנתא למחיר הדירה.','משך ההחזר בפועל.'],
    savings:['הסכום ההתחלתי וכל ההפקדות.','ההפרש בין שווי החיסכון לסך ההפקדות.','הרווח מתוך השווי הסופי של החיסכון.','הפער בין הצבירה העתידית ליעד.'],
    index:['סך ההפקדות לתיק.','הרווח המשוער מעבר להפקדות.','שווי עתידי במונחי כוח קנייה של היום.','עלות דמי הניהול או השפעת המס בהגדרות.'],
    loan:['סך הריבית שתשולם.','הקרן והריבית יחד.','מספר שנות ההחזר בפועל.','פער ריבית לעומת תרחיש ללא תשלום נוסף.'],
    budget:['הוצאות חודשיות, כולל חלק יחסי של הוצאות שנתיות, ללא חיסכון.','ההפרשה החודשית כפול 12.','עלויות הדיור כאחוז מההכנסה.','החיסכון החודשי כאחוז מההכנסה.']
  };

  // Live, model-derived drill-downs; do not reuse fixed illustrative figures.
  function metricBreakdown(tab,index){
    const s=states[tab],rows=[];
    const add=(title,value)=>rows.push([title,String(value)]);
    if(tab==='mortgage'){
      const principal=Math.max(0,s.price-s.equity);
      const result=schedule(principal,s.rate,s.years,s.extra);
      const standard=schedule(principal,s.rate,s.years,0);
      if(index===0){add('מחיר הנכס',money(s.price));add('הון עצמי',money(s.equity));add('יתרת מימון',money(principal));}
      else if(index===1){add('סך הריבית',money(result.interest));add('ללא תוספת החזר',money(standard.interest));add('חיסכון ריבית',money(Math.max(0,standard.interest-result.interest)));}
      else if(index===2){add('סכום המימון',money(principal));add('מחיר הנכס',money(s.price));add('תקרת המימון שנבחרה',pct(limits[s.kind]*100));}
      else{add('חודשי החזר',count(result.months));add('תקופה ללא תוספת',count(standard.months)+' חודשים');add('חודשים שנחסכו',count(Math.max(0,standard.months-result.months)));}
    }else if(tab==='savings'||tab==='index'){
      const events=contributions[tab]||[];
      const r=futureValue(s,s.rate,tab==='index'?s.fees:0,events);
      const gain=r.value-r.contributed;
      if(index===0){add('הפקדה התחלתית',money(s.initial));add('כל ההפקדות יחד',money(r.contributed));add('אירועי הפקדה מתוכננים',count(events.filter(x=>x.month<=s.years*12).length));}
      else if(index===1){add('שווי סופי',money(r.value));add('סך ההפקדות',money(r.contributed));add(gain<0?'הפסד נומינלי':'רווח נומינלי',money(Math.abs(gain)));}
      else if(index===2&&tab==='savings'){add('שווי סופי',money(r.value));add('רווח נומינלי',money(gain));add('חלק הרווחים בתיק',pct(r.value?100*gain/r.value:0));}
      else if(index===2){add('שווי נומינלי',money(r.value));add('אינפלציה שנתית',pct(s.inflation));add('שווי בכסף של היום',money(r.value/Math.pow(1+s.inflation/100,s.years)));}
      else if(tab==='savings'){add('יעד חיסכון',money(s.goal));add('תחזית צבירה',money(r.value));add(r.value>=s.goal?'עודף ביחס ליעד':'חסר ביחס ליעד',money(Math.abs(r.value-s.goal)));}
      else{
        const withoutFees=futureValue(s,s.rate,0,events).value;
        const basis=Math.max(r.contributed,r.inflationBasis||r.contributed);
        const tax=advanced.index.taxEnabled?Math.max(0,r.value-basis)*advanced.index.taxRate/100:0;
        if(advanced.index.taxEnabled){add('שווי לפני מס',money(r.value));add('מס משוער',money(tax));add('שווי לאחר מס משוער',money(r.value-tax));}
        else{add('שווי ללא דמי ניהול',money(withoutFees));add('עלות מצטברת של דמי הניהול',money(withoutFees-r.value));add('שווי לאחר דמי ניהול',money(r.value));}
      }
    }else if(tab==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      const base=schedule(s.principal,s.rate,loanTermYears(s),0);
      if(index===0){add('קרן ההלוואה',money(s.principal));add('ריבית שנתית',pct(s.rate));add('ריבית מצטברת',money(r.interest));}
      else if(index===1){add('סכום הקרן',money(s.principal));add('סך הריבית',money(r.interest));add('עלות כוללת',money(s.principal+r.interest));}
      else if(index===2){add('חודשי החזר',count(r.months));add('ללא תוספת החזר',count(base.months)+' חודשים');add('חודשים שנחסכו',count(Math.max(0,base.months-r.months)));}
      else{add('ללא תוספת החזר',money(base.interest));add('עם התשלום הנוסף',money(r.interest));add('חיסכון ריבית משוער',money(Math.max(0,base.interest-r.interest)));}
    }else if(tab==='budget'){
      const annual=(advanced.budget.annualItems||[]).reduce((sum,item)=>sum+Number(item.amount||0),0)/12;
      const total=s.housing+s.living+s.bills+s.spending+annual;
      if(index===0){add('דיור',money(s.housing));add('מחיה ותחבורה',money(s.living));add('חשבונות ופנאי',money(s.bills+s.spending));add('הוצאות שנתיות בחישוב חודשי',money(annual));add('סה״כ הוצאות',money(total));}
      else if(index===1){add('חיסכון חודשי',money(s.savings));add('חיסכון שנתי',money(s.savings*12));add('חלק מההכנסה',pct(s.income?100*s.savings/s.income:0));}
      else if(index===2){add('עלות דיור חודשית',money(s.housing));add('הכנסה נטו',money(s.income));add('שיעור הדיור',pct(s.income?100*s.housing/s.income:0));}
      else{add('הכנסה נטו',money(s.income));add('חיסכון חודשי',money(s.savings));add('יתרה פנויה לאחר הכול',money(s.income-total-s.savings));}
    }
    return rows;
  }
  let statOpener=null;
  function closeStatDetail(){q('statOverlay').hidden=true;document.body.classList.remove('schedule-open');statOpener?.focus?.();}
  q('stats').addEventListener('click',e=>{
    const btn=e.target.closest('[data-stat-index]');if(!btn)return;
    const idx=Number(btn.dataset.statIndex),stat=currentStats[idx];if(!stat)return;
    statOpener=btn;q('statDetailTitle').textContent=stat[0];q('statDetailValue').textContent=stat[1];
    q('statDetailInfo').textContent=statExplanations[active]?.[idx]||stat[2]||'מדד מחושב.';
    q('statDetailBreakdown').innerHTML=metricBreakdown(active,idx).map(([label,value])=>
      '<div class="stat-detail-row"><span>'+escapeHtml(label)+'</span><strong dir="auto">'+escapeHtml(value)+'</strong></div>'
    ).join('');
    q('statDetailFooter').textContent=(stat[2]||'')+' · כל הסכומים מתעדכנים לפי הנחות הסימולציה.';
    q('statOverlay').hidden=false;document.body.classList.add('schedule-open');q('statClose').focus();
  });
  q('statClose').addEventListener('click',closeStatDetail);
  q('statOverlay').addEventListener('pointerdown',e=>{if(e.target===q('statOverlay'))closeStatDetail();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('statOverlay').hidden){e.preventDefault();closeStatDetail();}});
  function focusBudgetField(id){
    if(active!=='budget'||!id)return;const input=q('number-'+id);if(!input)return;
    const field=input.closest('.field');field.classList.remove('field-attention');void field.offsetWidth;field.classList.add('field-attention');
    field.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'nearest'});
    if(!input.readOnly&&!input.disabled)input.focus({preventScroll:true});
    setTimeout(()=>field.classList.remove('field-attention'),1200);
  }
  q('chart').addEventListener('click',e=>{const bar=e.target.closest('[data-budget-field]');if(bar)focusBudgetField(bar.dataset.budgetField);});
  q('chart').addEventListener('keydown',e=>{
    const bar=e.target.closest('[data-budget-field]');if(bar&&(e.key==='Enter'||e.key===' ')){e.preventDefault();focusBudgetField(bar.dataset.budgetField);}
  });
