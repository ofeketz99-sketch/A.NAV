
(function(){
  'use strict';
  const app=document.getElementById('financeApp');
  const q=id=>document.getElementById(id);
  const num=new Intl.NumberFormat('he-IL',{maximumFractionDigits:0});
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
  const fields=(...xs)=>xs;

