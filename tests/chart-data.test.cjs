'use strict';
// Chart data layer: datasets, rules that prevent meaningless charts, aggregation and drill-down. Made-up data.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','scripts/src',f),'utf8');
const ctx=vm.createContext({Date,Math,Number,String,Object,Array,Set,JSON});
vm.runInContext(read('97-portfolio-engine.js')+read('97-chart-data.js')+'\nthis.E=PortfolioEngine;this.C=ChartData;',ctx);
const {E,C}=ctx;
let n=0;const b=(d,s,q,p,f=7.5)=>({id:'b'+(++n),type:'buy',date:d,symbol:s,qty:q,price:p,fee:f}),sl=(d,s,q,p,f=7.5)=>({id:'s'+(++n),type:'sell',date:d,symbol:s,qty:q,price:p,fee:f});
const pf=E.normalize({transactions:[
  {id:'d1',type:'deposit',date:'2026-01-02',currency:'ILS',amount:10000},{id:'d2',type:'deposit',date:'2026-02-02',currency:'ILS',amount:5000},
  b('2026-01-05','ALFA',10,100),sl('2026-01-20','ALFA',10,120),b('2026-02-03','BETA',5,50),sl('2026-02-25','BETA',5,40),b('2026-02-10','GAMA',1,10)],
  instruments:{ALFA:{sector:'טכנולוגיה'},BETA:{sector:'אנרגיה'}}});
const calc=E.compute(pf,{quotes:{GAMA:{price:12}},fx:{USDILS:{rate:4}}},{today:'2026-03-01'});
const ds=C.build({pf,calc,daily:{rows:[{date:'2026-02-01',value:100000,daily:null},{date:'2026-02-02',value:101000,daily:1}]},E});

test('datasets carry typed fields; money never mixes currencies in one field',()=>{
  assert.equal(ds.trades.fields.netUSD.unit,'USD');
  assert.equal(ds.trades.rows.length,3);
  assert.equal(ds.actions.rows.find(r=>r.id==='d1').depositsILS,1000000);
  assert.equal(ds.holdings.rows[0].symbol,'GAMA');
});

test('percentages and levels are never summed',()=>{
  assert.equal(C.aggsFor(ds.trades.fields.returnPct).includes('sum'),false);
  assert.equal(C.aggsFor(ds.daily.fields.value).includes('sum'),false);
  assert.equal(C.aggsFor(ds.trades.fields.netUSD).includes('sum'),true);
  const bad=C.check({dataset:'trades',x:'endDate',metrics:[{field:'returnPct',agg:'sum'}],type:'bar'},ds);
  assert.ok(bad.errors.length);
});

test('shekels and dollars cannot share a chart; at most two units',()=>{
  const c=C.check({dataset:'actions',x:'date',metrics:[{field:'cashUSD',agg:'sum'},{field:'cashILS',agg:'sum'}],type:'line'},ds);
  assert.match(c.errors.join(),/שקלים ודולרים/);
});

test('chart types offered fit the data',()=>{
  const donut=C.check({dataset:'trades',x:'sector',metrics:[{field:'netUSD',agg:'sum'}]},ds);
  assert.ok(donut.types.includes('donut'));assert.equal(donut.types.includes('line'),false);
  const time=C.check({dataset:'trades',x:'endDate',metrics:[{field:'netUSD',agg:'sum'}]},ds);
  assert.ok(time.types.includes('line'));assert.equal(time.types.includes('donut'),false);
  const scatter=C.check({dataset:'trades',metrics:[{field:'days',agg:'avg'},{field:'returnPct',agg:'avg'}]},ds);
  assert.ok(scatter.types.includes('scatter'));
  assert.equal(C.suggest({dataset:'trades',x:'endDate',metrics:[{field:'netUSD',agg:'cum'}]},ds),'line');
  assert.equal(C.suggest({dataset:'trades',x:'sector',metrics:[{field:'netUSD',agg:'sum'}]},ds),'donut');
});

test('net per month with drill-down to the trades behind each bar',()=>{
  const r=C.compute({dataset:'trades',x:'endDate',grain:'month',metrics:[{field:'netUSD',agg:'sum'}],type:'bar'},ds);
  assert.equal(r.xs.join(),'2026-01,2026-02');
  const jan=r.series[0].points[0];
  assert.equal(jan.y,Math.round((1200-7.5-(1000+7.5))*100));
  assert.equal(jan.ids.length,1);
});

test('cumulative sum runs over time; count needs no field',()=>{
  const r=C.compute({dataset:'actions',x:'date',grain:'month',metrics:[{field:'depositsILS',agg:'cum'}],type:'line'},ds);
  assert.equal(r.series[0].points.map(p=>p.y).join(),'1000000,1500000');
  const k=C.compute({dataset:'trades',metrics:[{agg:'count'}],type:'kpi'},ds);
  assert.equal(k.series[0].points[0].y,3);
});

test('grouping and filters, and the shared period filter',()=>{
  const r=C.compute({dataset:'trades',x:'sector',metrics:[{field:'feesUSD',agg:'sum'}],type:'donut'},ds);
  assert.ok(r.xs.includes('טכנולוגיה'));
  const f=C.compute({dataset:'trades',x:'sector',metrics:[{agg:'count'}],filters:[{field:'result',value:'הפסד'}],type:'bar'},ds);
  assert.equal(f.xs.join(),'אנרגיה');
  const p=C.compute({dataset:'actions',x:'date',grain:'month',metrics:[{field:'depositsILS',agg:'sum'}],type:'bar'},ds,{from:'2026-02-01'});
  assert.equal(p.xs.join(),'2026-02');
});

test('weeks start on Monday; quarters',()=>{
  assert.equal(C.bucket('2026-03-05','week'),'2026-03-02');
  assert.equal(C.bucket('2026-05-20','quarter'),'2026-Q2');
});
