
  // Interactive result cards and budget chart direct editing.
  const statExplanations={
    mortgage:['מחיר הדירה פחות ההון העצמי.','סך הריבית לאורך תקופת המשכנתא.','יחס סכום המשכנתא למחיר הדירה.','משך ההחזר בפועל.'],
    savings:['הסכום ההתחלתי וכל ההפקדות.','ההפרש בין שווי החיסכון לסך ההפקדות.','הרווח מתוך השווי הסופי של החיסכון.','הפער בין הצבירה העתידית ליעד.'],
    index:['סך ההפקדות לתיק.','הרווח המשוער מעבר להפקדות.','שווי עתידי במונחי כוח קנייה של היום.','עלות דמי הניהול או השפעת המס בהגדרות.'],
    loan:['סך הריבית שתשולם.','הקרן והריבית יחד.','מספר שנות ההחזר בפועל.','פער ריבית לעומת תרחיש ללא תשלום נוסף.'],
    budget:['הוצאות חודשיות, כולל חלק יחסי של הוצאות שנתיות, ללא חיסכון.','ההפרשה החודשית כפול 12.','עלויות הדיור כאחוז מההכנסה.','החיסכון החודשי כאחוז מההכנסה.']
  };
  let statOpener=null;
  function closeStatDetail(){q('statOverlay').hidden=true;document.body.classList.remove('schedule-open');statOpener?.focus?.();}
  q('stats').addEventListener('click',e=>{
    const btn=e.target.closest('[data-stat-index]');if(!btn)return;
    const idx=Number(btn.dataset.statIndex),stat=currentStats[idx];if(!stat)return;
    statOpener=btn;q('statDetailTitle').textContent=stat[0];q('statDetailValue').textContent=stat[1];
    q('statDetailInfo').textContent=statExplanations[active]?.[idx]||stat[2]||'מדד מחושב.';
    q('statDetailFooter').textContent=(stat[2]||'')+' · מחושב בזמן אמת מתוך נתוני המחשבון.';
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
