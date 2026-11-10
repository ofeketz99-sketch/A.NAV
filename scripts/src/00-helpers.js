
(function(){
  'use strict';
  const app=document.getElementById('financeApp');
  const q=id=>document.getElementById(id);
  const num=new Intl.NumberFormat('he-IL',{maximumFractionDigits:0});
  // Text shown inside number inputs: at most two decimals, so values like 30.4166666 stay readable.
  const inputText=v=>{const n=Number(v);return Number.isFinite(n)?String(Number(n.toFixed(2))):String(v);};
  const money=n=>(n<0?'−':'')+'₪'+num.format(Math.round(Math.abs(Number.isFinite(n)?n:0)));
  const compactMoney=n=>{
    const val=Math.abs(Number.isFinite(n)?n:0),sign=n<0?'−':'';
    if(val>=1e9)return sign+(val/1e9).toFixed(val>=10e9?0:1).replace(/\.0$/,'')+'B';
    if(val>=1e6)return sign+(val/1e6).toFixed(val>=10e6?0:1).replace(/\.0$/,'')+'M';
    if(val>=1e3)return sign+(val/1e3).toFixed(val>=10e3?0:1).replace(/\.0$/,'')+'K';
    return sign+String(Math.round(val));
  };
  const count=n=>num.format(Math.round(n));
  const pct=n=>(Number.isFinite(n)?n:0).toFixed(1)+'%';
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // A compact 1/2/5 scale, adapted to the number currently shown.
  // Examples: 700 -> 50; 7.5% -> 0.5; 500,000 -> 50,000.
  function adaptiveArrowStep(value,unit,zeroStep=1){
    const magnitude=Math.abs(Number(value));
    const whole=unit==='שנים'||unit==='חודשים';
    const floor=whole?1:0.01;
    if(!Number.isFinite(magnitude)||magnitude===0)return Math.max(floor,Number(zeroStep)||floor);
    const scale=Math.pow(10,Math.floor(Math.log10(magnitude)));
    const digit=magnitude/scale;
    let step=(digit>=5?0.5:digit>=2?0.2:0.1)*scale;
    step=whole?Math.max(1,Math.round(step)):Math.max(floor,step);
    return Number(step.toPrecision(12));
  }
  function adaptiveArrowValue(value,direction,unit,min,max,zeroStep=1){
    const current=Number.isFinite(Number(value))?Number(value):0;
    const increment=adaptiveArrowStep(current,unit,zeroStep);
    return clamp(Number((current+(direction>0?1:-1)*increment).toFixed(10)),min,max);
  }
  const fields=(...xs)=>xs;

