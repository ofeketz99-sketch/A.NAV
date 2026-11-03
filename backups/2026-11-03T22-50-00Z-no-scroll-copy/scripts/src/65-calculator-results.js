  function renderResults(){
    const s=states[active];
    if(active==='mortgage'){
      const p=Math.max(0,s.price-s.equity),res=schedule(p,s.rate,s.years,s.extra),base=schedule(p,s.rate,s.years,0);
      const ltv=100*p/s.price,cap=limits[s.kind],shortage=Math.max(0,s.price*(1-cap)-s.equity);
      const insurance=advanced.mortgage.insurance,oneTime=advanced.mortgage.purchaseCosts;
      const yearsActual=res.months/12,yearsSaved=Math.max(0,(base.months-res.months)/12);
      const message=shortage>0?`שימו לב: שיעור המימון הוא ${pct(ltv)}. בהנחת תקרת מימון של ${pct(cap*100)}, חסרים עוד ${money(shortage)} בהון העצמי (לפני הוצאות רכישה).`:`שיעור המימון הוא ${pct(ltv)} — בתוך תקרת המימון של ${pct(cap*100)} שנבחרה. עדיין נדרש אישור בנק ובדיקת כושר החזר.`;
      show('החזר חודשי צפוי',money(res.payment+insurance),'משכנתא',`תשלום בסיסי ${money(res.base)} ${s.extra>0?`+ תוספת ${money(s.extra)}`:''}${insurance?` + ביטוח ${money(insurance)}`:''} בכל חודש.`,[
        ['סכום המשכנתא',money(p),'מחיר הנכס פחות ההון העצמי'],['סך הריבית',money(res.interest),'בהנחת ריבית קבועה'],['שיעור מימון',pct(ltv),'מסך מחיר הדירה'],['משך החזר בפועל',`${Number(yearsActual.toFixed(1))} שנים`,yearsSaved?`קיצור של ${Number(yearsSaved.toFixed(1))} שנים`:'ללא פירעון מוקדם']
      ],'יתרת המשכנתא לאורך זמן','סימולציית יתרת קרן',lineChart(res.monthlySeries,yearsActual),`סך ההחזרים הכולל: ${money(p+res.interest+insurance*res.months)}. ${oneTime?`הוצאות רכישה נוספות: ${money(oneTime)}. `:''}${insurance?`ביטוח חודשי: ${money(insurance)}. `:''}${advanced.mortgage.stressRise?`אם הריבית הייתה עולה ב־${pct(advanced.mortgage.stressRise)} נקודות אחוז, ההחזר הבסיסי היה ${money(annuity(p,s.rate+advanced.mortgage.stressRise,s.years*12))}. `:''}${s.extra>0?`חיסכון ריבית לעומת ללא תוספת: ${money(base.interest-res.interest)}.`:''}`,message,shortage>0||advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.4?'warn':advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.3?'info':'good',shortage>0?'חסר הון עצמי':advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.4?'יחס החזר גבוה':advanced.mortgage.income>0&&(res.payment+insurance)/advanced.mortgage.income>.3?'בדקו כושר החזר':'בטווח המימון');
    }else if(active==='savings'){
      const events=contributions.savings;
      const r=futureValue(s,s.rate,0,events,s.goal),gain=r.value-r.contributed;
      const reached=r.reachedMonth;
      const activeCount=events.filter(e=>e.month<=s.years*12).length;
      show('סכום החיסכון בסוף התקופה',money(r.value),'חיסכון',`תחזית אחרי ${s.years} שנות חיסכון בריבית שנתית של ${pct(s.rate)}.`,[
        ['כסף שהפקדתם',money(r.contributed),'כולל סכום התחלתי'],['רווחים מריבית',money(gain),'ריבית דריבית'],['שיעור הרווח מסך הצבירה',pct(r.value?gain/r.value*100:0),'ללא מס ועמלות'],['פער מיעד החיסכון',money(Math.abs(s.goal-r.value)),s.goal<=r.value?'מעל היעד':'חסרים ליעד']
      ],'איך החיסכון גדל','צבירה שנתית',lineChart(r.monthlySeries,s.years,events,r.contributionSeries),`הפקדה חודשית התחלתית: ${money(s.monthly)}${activeCount?` · ${activeCount} שינויים עתידיים`:''}. סך הרווח המחושב: ${money(gain)}.`,reached===null?`בסימולציה הנוכחית לא מגיעים ליעד של ${money(s.goal)} בתוך ${s.years} שנים. הגדלת ההפקדה או משך החיסכון יכולה לשנות זאת.`:reached===0?'הסכום ההתחלתי כבר מכסה את יעד החיסכון שהגדרתם.':`את יעד החיסכון של ${money(s.goal)} צפויים להגיע אחרי כ־${(reached/12).toFixed(1)} שנים, בהנחה שהתשואה נשמרת.`,goalIsActive()&&!goalFeedback.savings?.reached?'warn':reached===null?'warn':'good',goalIsActive()?goalFeedback.savings?.reached?'יעד נעול והושג':'יעד מחוץ לטווח':reached===null?'מתחת ליעד':'יעד מושג');
    }else if(active==='index'){
      const events=contributions.index;
      const r=futureValue(s,s.rate,s.fees,events),real=r.value/Math.pow(1+s.inflation/100,s.years),gain=r.value-r.contributed;
      const taxBasis=Math.max(r.contributed,r.inflationBasis||r.contributed),estimatedTax=advanced.index.taxEnabled?Math.max(0,r.value-taxBasis)*advanced.index.taxRate/100:0;
      const low=futureValue(s,s.rate-3,s.fees,events).value,high=futureValue(s,s.rate+3,s.fees,events).value;
      const activeCount=events.filter(e=>e.month<=s.years*12).length;
      show('שווי תיק השקעות משוער',money(r.value),'S&P 500',`סימולציה לפי תשואה שנתית של ${pct(s.rate)} לפני דמי ניהול${goalIsActive()?' · יעד נעול '+money(s.goal):''}.`,[
        ['סך ההפקדות',money(r.contributed),'קרן מצטברת'],['רווח / הפסד נומינלי',money(gain),'לפני מס'],['שווי בכסף של היום',money(real),`בהנחת אינפלציה של ${pct(s.inflation)}`],[advanced.index.taxEnabled?'נטו לאחר מס משוער':'עלות השפעת דמי ניהול',money(advanced.index.taxEnabled?r.value-estimatedTax:futureValue(s,s.rate,0,events).value-r.value),advanced.index.taxEnabled?'אומדן מס ריאלי: '+money(estimatedTax):'אובדן תשואה מצטבר משוער']
      ],'צמיחת ההשקעה לאורך זמן','תרחיש תשואה קבועה',lineChart(r.monthlySeries,s.years,events,r.contributionSeries),`${advanced.index.taxEnabled?`אומדן מס רווחי הון: ${money(estimatedTax)} · `:''}${activeCount?`${activeCount} שינויים בהפקדות · `:''}תרחיש של תשואה נמוכה ב־3 נקודות אחוז: ${money(low)} · גבוהה ב־3 נקודות: ${money(high)}.`,`התשואה אינה קבועה. קיימים סיכוני ירידות ומטבע; זו סימולציה, לא תחזית.`,goalIsActive()&&!goalFeedback.index?.reached?'warn':gain<0?'warn':'info',goalIsActive()?goalFeedback.index?.reached?'יעד נעול והושג':'יעד מחוץ לטווח':gain<0?'תרחיש הפסד':'תרחיש השקעה');
    }else if(active==='loan'){
      const r=schedule(s.principal,s.rate,loanTermYears(s),s.extra),base=schedule(s.principal,s.rate,loanTermYears(s),0),saved=base.interest-r.interest;
      show('החזר חודשי כולל',money(r.payment),'הלוואה',`החזר בסיסי ${money(r.base)} ${s.extra>0?`+ ${money(s.extra)} להקדמת פירעון`:''}.`,[
        ['סך הריבית',money(r.interest),'עלות המימון'],['סך כל ההחזרים',money(s.principal+r.interest),'קרן וריבית'],['זמן לסיום ההלוואה',`${count(r.months)} חודשים`,'בכפוף לתשלומים שהוגדרו'],['חיסכון מפירעון מוקדם',money(saved),'ללא עמלות פירעון מוקדם']
      ],'יתרת ההלוואה','לוח סילוקין חודשי משוער',lineChart(r.monthlySeries,r.months/12),`עלות ההלוואה ביחס לקרן: ${pct(s.principal?r.interest/s.principal*100:0)}.`,`תשלום נוסף עשוי להפחית ריבית וזמן החזר. ייתכנו עמלות פירעון.`,saved>1?'good':'info',saved>1?'קיצור תקופת ההחזר':'החזר מתוכנן');
    }else{
      const annualMonthly=advanced.budget.annualItems.reduce((sum,item)=>sum+item.amount,0)/12;
      const expenses=s.housing+s.bills+s.living+s.spending+annualMonthly,left=s.income-expenses-s.savings;
      const housingShare=s.income?s.housing/s.income*100:0,saveShare=s.income?s.savings/s.income*100:0;
      show(left>=0?'יתרה פנויה בסוף החודש':'גירעון חודשי',money(left),'תקציב',left>=0?'הכסף שנותר אחרי הוצאות והפקדה לחיסכון.':'ההוצאות והחיסכון המתוכנן גבוהים מההכנסה.',[
        ['הוצאות חודשיות',money(expenses),'ללא החיסכון'],['חיסכון שנתי מתוכנן',money(s.savings*12),'אם ההפקדה קבועה'],['דיור מסך ההכנסה',pct(housingShare),'שכירות או החזר משכנתא'],['שיעור החיסכון',pct(saveShare),'מההכנסה נטו']
      ],'לאן הולך הכסף?','חלוקת הוצאות חודשית',(budgetFlowMode?budgetFlowChart([['housing','דיור'],['living','מחיה ותחבורה'],['bills','חשבונות'],['spending','בזבוזים'],['savings','חיסכון']].map(([id,label])=>[fieldLabels.budget[id]||label,s[id],id]).concat(annualMonthly?[['הוצאות שנתיות ÷ 12',annualMonthly]]:[]),s.income):budgetBars([['housing','דיור'],['living','מחיה ותחבורה'],['bills','חשבונות'],['spending','בזבוזים'],['savings','חיסכון']].map(([id,label])=>[fieldLabels.budget[id]||label,s[id],id]).concat(annualMonthly?[['הוצאות שנתיות ÷ 12',annualMonthly]]:[]))),`סה״כ הוצאות והפקדות מתוכננות: ${money(expenses+s.savings)} מתוך הכנסה של ${money(s.income)}.`,left<0?`גירעון של ${money(-left)} בחודש. כדאי לצמצם הוצאות או להתאים את החיסכון.`:`אם התקציב יישמר, העודף השנתי יהיה ${money(left*12)}.`,left<0?'warn':left/s.income<.05?'info':'good',left<0?'גירעון חודשי':left/s.income<.05?'מרווח תקציבי נמוך':'עודף תקציבי');
    }
    const budgetToggle=q('budgetChartToggle');budgetToggle.hidden=active!=='budget';
    budgetToggle.setAttribute('aria-pressed',String(budgetFlowMode));
    budgetToggle.textContent=budgetFlowMode?'הצג סרגלים':'הצג זרימת כסף';
  }
  q('chartModeToggle').addEventListener('click',()=>{
    if(active!=='savings'&&active!=='index')return;
    chartModes[active]=!chartModes[active];renderResults();saveState();
  });

  q('budgetChartToggle').addEventListener('click',()=>{
    if(active!=='budget')return;
    budgetFlowMode=!budgetFlowMode;renderResults();saveState();
  });
