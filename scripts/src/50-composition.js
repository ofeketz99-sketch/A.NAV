  function renderComposition(){
    const s=states[active];
    let a=0,b=0,al='',bl='',negative=false;
    if(active==='mortgage'){
      a=Math.max(0,s.equity);b=Math.max(0,s.price-s.equity);al='הון עצמי';bl='מימון בנקאי';
    }else if(active==='loan'){
      const result=schedule(s.principal,s.rate,loanTermYears(s),s.extra);
      a=s.principal;b=Math.max(0,result.interest);al='קרן';bl='ריבית';
    }else if(active==='savings'||active==='index'){
      const r=futureValue(s,s.rate,active==='index'?s.fees:0,contributions[active]||[]);
      const gain=r.value-r.contributed;
      negative=gain<0;
      if(negative){a=Math.max(0,r.value);b=-gain;al='שווי נוכחי';bl='הפסד משוער';}
      else{a=Math.max(0,r.contributed);b=gain;al='הפקדות';bl='רווח משוער';}
    }else if(active==='budget'){
      const annual=(advanced.budget.annualItems||[]).reduce((sum,e)=>sum+Number(e.amount||0),0)/12;
      const committed=s.housing+s.living+s.bills+s.spending+s.savings+annual;
      negative=committed>s.income;
      if(negative){a=s.income;b=committed-s.income;al='הכנסה';bl='חריגה';}
      else{a=committed;b=Math.max(0,s.income-committed);al='הוצאות וחיסכון';bl='יתרה פנויה';}
    }
    const total=Math.max(.001,a+b),aPct=100*a/total,bPct=100*b/total;
    q('composition').classList.toggle('is-negative',negative);
    q('composition').innerHTML=`<div class="composition-labels"><span><i class="comp-swatch comp-a"></i>${al} <b dir="ltr">${compactMoney(a)}</b></span><span><i class="comp-swatch comp-b"></i>${bl} <b dir="ltr">${compactMoney(b)}</b></span></div><div class="composition-track" role="img" aria-label="${al} ${money(a)}, ${bl} ${money(b)}"><div class="composition-part composition-a" style="width:${aPct}%"></div><div class="composition-part composition-b" style="width:${bPct}%"></div></div>`;
  }

