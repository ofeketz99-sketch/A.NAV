  const limits={first:.75,upgrade:.70,invest:.50};
  function annuity(principal,annualRate,n){ if(principal<=0)return 0; const r=annualRate/1200; return r===0?principal/n:principal*r/(1-Math.pow(1+r,-n)); }
  function schedule(principal,annualRate,years,extra){
    const maxMonths=Math.round(years*12),base=annuity(principal,annualRate,maxMonths),payment=base+extra,r=annualRate/1200;
    let balance=principal,totalInterest=0,months=0;
    const series=[principal],monthlySeries=[principal];
    while(balance>.00001 && months<maxMonths+1){
      const interest=balance*r;
      totalInterest+=interest;
      balance=Math.max(0,balance+interest-payment);
      months++;
      monthlySeries.push(balance);
      if(months%12===0 || balance===0)series.push(balance);
      if(payment<=interest)break;
    }
    if(series[series.length-1]!==0 && balance<1)series.push(0);
    return {base,payment,interest:totalInterest,months,series,monthlySeries};
  }
  function futureValue(s,annual,fee=0,events=[],goal=null){
    const mrate=Math.pow((1+annual/100)*(1-fee/100),1/12)-1;
    const byMonth=new Map();
    for(const event of events){
      if(event.month>Math.round(s.years*12))continue;
      if(!byMonth.has(event.month))byMonth.set(event.month,[]);
      byMonth.get(event.month).push(event);
    }
    let balance=s.initial,contributed=s.initial,monthly=s.monthly;
    const totalMonths=Math.round(s.years*12);
    let inflationBasis=s.initial*Math.pow(1+(Number(s.inflation)||0)/100,totalMonths/12);
    let reachedMonth=goal!==null && balance>=goal?0:null;
    const series=[balance],monthlySeries=[balance],contributionSeries=[contributed];
    for(let i=1;i<=totalMonths;i++) {
      const changes=byMonth.get(i)||[];
      for(const e of changes)if(e.type==='monthly')monthly=e.amount;
      const extra=changes.filter(e=>e.type==='once').reduce((sum,e)=>sum+e.amount,0);
      balance=balance*(1+mrate)+monthly+extra;
      contributed+=monthly+extra;
      if(Number.isFinite(s.inflation))inflationBasis+=(monthly+extra)*Math.pow(1+s.inflation/100,(totalMonths-i)/12);
      monthlySeries.push(balance);contributionSeries.push(contributed);
      if(reachedMonth===null && goal!==null && balance>=goal)reachedMonth=i;
      if(i%12===0)series.push(balance);
    }
    return {value:balance,series,monthlySeries,contributionSeries,contributed,reachedMonth,inflationBasis};
  }
