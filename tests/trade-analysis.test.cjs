'use strict';
// Trade analysis on daily bars. All symbols, prices and dates are made up.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','scripts/src',f),'utf8');
const ctx=vm.createContext({Date,Math,Number,String,Object,Array,Set,JSON});
vm.runInContext(read('97-portfolio-engine.js')+read('97-trade-analysis.js')+'\nthis.E=PortfolioEngine;this.T=TradeAnalysis;',ctx);
const {E,T}=ctx;
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,a+' ≠ '+b);

// Business-day bars from a start date with given closes; high = close×1.02, low = close×0.98 unless overridden.
function bars(start,closes,over={}){
  const out=[];let d=new Date(start+'T00:00:00Z');
  for(const c of closes){while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);const iso=d.toISOString().slice(0,10);
    const o=over[iso]||{};out.push([iso,c,o.h??c*1.02,o.l??c*0.98,c]);d.setUTCDate(d.getUTCDate()+1);}
  return out;
}
function trade(txs,plan){
  const s=E.normalize({transactions:txs.map((t,i)=>({...t,id:t.id||'t'+i,fee:t.fee??0}))});
  if(plan)s.transactions[0].tradePlan=E.normalizePlan(plan);
  const r=E.compute(s,{},{today:'2026-12-31'});
  return {t:r.trades[0],txs:s.transactions};
}

test('highest high and lowest low while held, against the average entry',()=>{
  const B=bars('2026-03-02',[10,10.5,12,11,9,10.2,10.4],{'2026-03-04':{h:12.5},'2026-03-06':{l:8.6}});
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:10},{type:'sell',date:'2026-03-10',symbol:'ALFA',qty:10,price:10.4}]);
  const a=T.analyze(t,txs,B,{today:'2026-12-31'});
  near(a.mfe.pct,25);assert.equal(a.mfe.date,'2026-03-04');
  near(a.mae.pct,-14);assert.equal(a.mae.date,'2026-03-06');
  assert.equal(a.coverage,'ok');
});

test('after the sale: next trading day, a week and a month, from the sale price',()=>{
  const closes=[10,10,10,10,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33];
  const B=bars('2026-03-02',closes);
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:10},{type:'sell',date:'2026-03-06',symbol:'ALFA',qty:10,price:10}]);
  const a=T.analyze(t,txs,B,{today:'2026-12-31',customDays:7});
  near(a.after.d1.pct,10);          // next bar close 11
  near(a.after.w1.pct,50);          // 5th bar after: 15
  near(a.after.m1.pct,210);         // 21st bar after: 31
  assert.equal(a.exits[0].after.custom.date,'2026-03-13');
  near(a.hypothetical.d1.diff,1000); // 10 × (11 − 10) = $10.00 → 1000 cents
  assert.equal(a.patterns.includes('ranAfter'),true);
});

test('partial exits are weighted by the quantity sold; missing data says how many exits have it',()=>{
  const B=bars('2026-03-02',[10,10,10,12,12,12,12,12,12]);
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:30,price:10},{type:'sell',date:'2026-03-03',symbol:'ALFA',qty:10,price:10},{type:'sell',date:'2026-03-12',symbol:'ALFA',qty:20,price:12}]);
  const a=T.analyze(t,txs,B,{today:'2026-12-31'});
  // first exit: next close 10 → 0%; second exit has no bar after it
  assert.equal(a.after.d1.exits,1);assert.equal(a.after.d1.of,2);
  near(a.after.d1.pct,0);
  assert.equal(a.after.m1,null);
});

test('no history: nothing is invented',()=>{
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:10},{type:'sell',date:'2026-03-10',symbol:'ALFA',qty:1,price:9}]);
  const a=T.analyze(t,txs,[],{today:'2026-12-31'});
  assert.equal(a.coverage,'none');assert.equal(a.mfe,null);assert.equal(a.after.d1,null);assert.equal(a.hypothetical.m1,null);
  assert.equal(a.patterns.includes('upThenLoss'),false);
});

test('went up, then closed at a loss',()=>{
  const B=bars('2026-03-02',[10,10.6,10.4,9.6,9.4],{'2026-03-03':{h:10.7}});
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:10},{type:'sell',date:'2026-03-06',symbol:'ALFA',qty:10,price:9.4}]);
  const a=T.analyze(t,txs,B,{today:'2026-12-31'});
  assert.equal(a.patterns.includes('upThenLoss'),true);
});

test('plan: exit before the target, target never touched; holding shorter than planned',()=>{
  const B=bars('2026-03-02',[10,10.5,11,11.2,11]);
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:10},{type:'sell',date:'2026-03-06',symbol:'ALFA',qty:10,price:11}],{target:13,stop:9,horizonDays:30,reason:'פריצה',tags:'מומנטום, טכני'});
  const a=T.analyze(t,txs,B,{today:'2026-12-31'});
  assert.equal(a.adherence.exit,'before-target');
  assert.equal(a.adherence.targetReached,false);
  assert.equal(a.adherence.stopTouched,false);
  assert.equal(a.adherence.holding,'shorter');
  assert.equal(a.plan.tags.join('|'),'מומנטום|טכני');
  assert.equal(a.patterns.includes('beforeTarget'),true);
  assert.equal(a.patterns.includes('noPlan'),false);
});

test('plan: exit at the target, and exit below the stop',()=>{
  const B=bars('2026-03-02',[10,11,12,12.5,12.4]);
  const up=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:10},{type:'sell',date:'2026-03-05',symbol:'ALFA',qty:1,price:12.48}],{target:12.5,stop:9});
  const a=T.analyze(up.t,up.txs,B,{today:'2026-12-31'});
  assert.equal(a.adherence.exit,'target');assert.equal(a.adherence.targetReached.date,'2026-03-05');
  const down=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:10},{type:'sell',date:'2026-03-05',symbol:'ALFA',qty:1,price:8.5}],{stop:9});
  const b=T.analyze(down.t,down.txs,B,{today:'2026-12-31'});
  assert.equal(b.adherence.exit,'below-stop');assert.equal(b.patterns.includes('belowStop'),true);
});

test('plan values are cleaned; an empty plan is dropped',()=>{
  assert.equal(E.normalizePlan({target:'abc',stop:-3,reason:'  '}),null);
  const p=E.normalizePlan({target:'12.5',tags:['א','',' ב '],horizonDays:'10.4'});
  assert.equal(p.target,12.5);assert.equal(p.tags.join(),'א,ב');assert.equal(p.horizonDays,10);
});

test('history window covers entry and a month after exit, never beyond today',()=>{
  const w=T.windowFor({startDate:'2026-03-02',endDate:'2026-11-20'},'2026-11-25',63);
  assert.equal(w.from,'2026-02-10');assert.equal(w.to,'2026-11-25');
  const w2=T.windowFor({startDate:'2026-01-05',endDate:'2026-02-01'},'2026-11-25',30);
  assert.equal(w2.to,'2026-03-18');
});

test('summary counts patterns and averages after-exit changes over closed trades',()=>{
  const B=bars('2026-03-02',Array.from({length:30},(_,i)=>10+i*0.5));
  const one=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:10},{type:'sell',date:'2026-03-04',symbol:'ALFA',qty:1,price:11}]);
  const two=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:10}]);
  const s=T.summarize([T.analyze(one.t,one.txs,B,{today:'2026-12-31'}),T.analyze(two.t,two.txs,B,{today:'2026-12-31'})]);
  assert.equal(s.closed,1);assert.equal(s.counts.noPlan,2);assert.ok(s.after.d1.n===1);
});

test('split adjustment: a 4:1 split after the trade, and an irregular ratio, are detected from the trade prices',()=>{
  const four=T.scaleFor([{type:'buy',date:'2026-03-02',price:400},{type:'sell',date:'2026-03-04',price:440}],bars('2026-03-02',[101,105,110]));
  assert.equal(four.factor,4);assert.equal(four.exact,true);
  const odd=T.scaleFor([{type:'buy',date:'2026-03-02',price:1}],bars('2026-03-02',[2700]));
  assert.equal(odd.adjusted,true);assert.equal(odd.exact,false);
  const none=T.scaleFor([{type:'buy',date:'2026-03-02',price:10.4}],bars('2026-03-02',[10]));
  assert.equal(none.factor,1);
  const {t,txs}=trade([{type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:400},{type:'sell',date:'2026-03-04',symbol:'ALFA',qty:10,price:440}]);
  const a=T.analyze(t,txs,bars('2026-03-02',[100,105,110]),{today:'2026-12-31'});
  assert.equal(a.scale.factor,4);
  assert.ok(a.mfe.pct<20,'max rise measured on scaled prices, not 300%+');
});
