
  // Stage 8: deterministic Monte Carlo illustration, not an investment forecast.
  let riskLast=null;
  function riskEnvelope(s,events=[],volatility=18,samples=220){
    const totalMonths=Math.round(s.years*12),months=[0];
    for(let i=12;i<=totalMonths;i+=12)months.push(i);
    if(months[months.length-1]!==totalMonths)months.push(totalMonths);
    const buckets=months.map(()=>[]);
    const monthIndex=new Map(months.map((month,i)=>[month,i]));
    const byMonth=new Map();
    for(const e of events){
      if(!Number.isInteger(e.month)||e.month<1||e.month>totalMonths)continue;
      if(!byMonth.has(e.month))byMonth.set(e.month,[]);
      byMonth.get(e.month).push(e);
    }
    let hits=0;
    for(let run=0;run<samples;run++){
      let seed=(0x9E3779B9 ^ Math.imul(run+1,0x85EBCA6B))>>>0;
      const random=()=>{
        seed=(seed+0x6D2B79F5)>>>0;
        let t=seed;
        t=Math.imul(t^(t>>>15),t|1);
        t^=t+Math.imul(t^(t>>>7),t|61);
        return ((t^(t>>>14))>>>0)/4294967296;
      };
      let balance=s.initial,monthly=s.monthly,growth=1;
      buckets[0].push(balance);
      for(let month=1;month<=totalMonths;month++){
        if((month-1)%12===0){
          const u=Math.max(1e-9,random()),v=random();
          const normal=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
          const annualGross=Math.max(.03,1+(s.rate+volatility*normal)/100)*(1-s.fees/100);
          growth=Math.pow(annualGross,1/12);
        }
        let extra=0;
        for(const event of byMonth.get(month)||[]){
          if(event.type==='monthly')monthly=event.amount;
          else if(event.type==='once')extra+=event.amount;
        }
        balance=Math.max(0,balance*growth+monthly+extra);
        const at=monthIndex.get(month);
        if(at!==undefined)buckets[at].push(balance);
      }
      if(balance>=s.goal)hits++;
    }
    const percentile=(arr,p)=>{
      const n=(arr.length-1)*p,i=Math.floor(n);
      return arr[i]+(arr[Math.min(i+1,arr.length-1)]-arr[i])*(n-i);
    };
    const low=[],median=[],high=[];
    for(const bucket of buckets){
      bucket.sort((a,b)=>a-b);
      low.push(percentile(bucket,.10));
      median.push(percentile(bucket,.50));
      high.push(percentile(bucket,.90));
    }
    return {months,low,median,high,goalShare:Math.round(100*hits/samples),runs:samples,volatility};
  }
  q('riskToggle').addEventListener('click',()=>{
    if(active!=='index')return;
    riskSettings.enabled=!riskSettings.enabled;
    renderResults();saveState();
  });
  q('riskVolatility').addEventListener('change',event=>{
    const v=Number(event.target.value);
    if(!Number.isFinite(v)||v<5||v>40)return;
    riskSettings.volatility=v;renderResults();saveState();
  });
