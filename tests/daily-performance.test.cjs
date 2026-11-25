'use strict';
// Daily value rebuilt from trades and closes. Made-up symbols and prices.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','scripts/src',f),'utf8');
const ctx=vm.createContext({Date,Math,Number,String,Object,Array,Set,JSON});
vm.runInContext(read('97-portfolio-engine.js')+read('97-trade-analysis.js')+read('97-daily-performance.js')+'\nthis.E=PortfolioEngine;this.D=DailyPerformance;',ctx);
const {E,D}=ctx;
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,a+' ≠ '+b);
const bar=(d,c)=>[d,c,c,c,c];

test('value per day: shares × close × dollar rate, plus cash; a deposit is not a gain',()=>{
  const s=E.normalize({transactions:[
    {id:'d',type:'deposit',date:'2026-03-02',currency:'ILS',amount:4000},
    {id:'f',type:'fx',date:'2026-03-02',from:'ILS',amount:4000,rate:4},
    {id:'b',type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:100,fee:0},
    {id:'d2',type:'deposit',date:'2026-03-04',currency:'ILS',amount:1000}]});
  const hist={ALFA:{bars:[bar('2026-03-02',100),bar('2026-03-03',110),bar('2026-03-04',110)]},USDILS:{bars:[bar('2026-03-02',4),bar('2026-03-03',4),bar('2026-03-04',4)]}};
  const r=D.compute(s,hist,{today:'2026-03-04'});
  assert.equal(r.rows.length,3);
  assert.equal(r.rows[0].value,400000);            // 10×100×4 = ₪4,000
  assert.equal(r.rows[1].value,440000);            // price +10%
  near(r.rows[1].daily,10);
  assert.equal(r.rows[2].value,540000);            // + ₪1,000 deposit
  near(r.rows[2].daily,0);                         // the deposit is not a gain
  near(r.twr,10);
});

test('the dollar rate alone moves a dollar portfolio, and that counts',()=>{
  const s=E.normalize({transactions:[{id:'b',type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:100,fee:0,opening:true}]});
  const hist={ALFA:{bars:[bar('2026-03-02',100),bar('2026-03-03',100)]},USDILS:{bars:[bar('2026-03-02',3.5),bar('2026-03-03',3.85)]}};
  const r=D.compute(s,hist,{today:'2026-03-03'});
  near(r.rows[1].daily,10);
});

test('missing prices: the day is left out, not counted as zero; short gaps carry the last close',()=>{
  const s=E.normalize({transactions:[{id:'b',type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:100,fee:0,opening:true},{id:'c',type:'buy',date:'2026-03-02',symbol:'BETA',qty:1,price:50,fee:0,opening:true}],
    instruments:{ALFA:{market:'TASE'},BETA:{market:'TASE'}}});
  const hist={ALFA:{bars:[bar('2026-03-02',100),bar('2026-03-03',101),bar('2026-03-20',102)]},BETA:{bars:[bar('2026-03-02',50)]}};
  const r=D.compute(s,hist,{today:'2026-03-20'});
  assert.equal(r.rows[1].value,15100);              // BETA carried from the day before
  assert.equal(r.rows[2].value,null);               // BETA's last close is too old
  assert.equal(r.rows[2].missing.join(),'BETA');
  assert.equal(r.complete,2);
  assert.equal(r.rows[2].daily,null);
});

test('no dollar rate with dollar exposure: the day is incomplete',()=>{
  const s=E.normalize({transactions:[{id:'b',type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:100,fee:0,opening:true}]});
  const r=D.compute(s,{ALFA:{bars:[bar('2026-03-02',100)]}},{today:'2026-03-02'});
  assert.equal(r.rows[0].value,null);
  assert.equal(r.rows[0].missing.join(),'USDILS');
});

test('selling turns shares into cash without changing value except the fee',()=>{
  const s=E.normalize({transactions:[{id:'b',type:'buy',date:'2026-03-02',symbol:'ALFA',qty:10,price:20,fee:0,opening:true},{id:'s',type:'sell',date:'2026-03-03',symbol:'ALFA',qty:10,price:20,fee:7}],instruments:{ALFA:{market:'TASE'}}});
  const r=D.compute(s,{ALFA:{bars:[bar('2026-03-02',20),bar('2026-03-03',20)]}},{today:'2026-03-03'});
  assert.equal(r.rows[1].value,20000-700);
});

test('history adjusted for a later split is scaled to the trade prices (no jump in value)',()=>{
  // Real trades at ~1.00; the provider's history shows ~20 because of a later 1:20 reverse split.
  const s=E.normalize({transactions:[{id:'b',type:'buy',date:'2026-03-02',symbol:'RSPL',qty:100,price:1,fee:0,opening:true},{id:'s',type:'sell',date:'2026-03-04',symbol:'RSPL',qty:100,price:1.1,fee:0}],instruments:{RSPL:{market:'TASE'}}});
  const r=D.compute(s,{RSPL:{bars:[bar('2026-03-02',20),bar('2026-03-03',21),bar('2026-03-04',22)]}},{today:'2026-03-04'});
  assert.equal(r.rows[0].value,10000);   // 100 × 20 × (1/20) = ₪100
  near(r.rows[1].daily,5);
});

test('a gap is bridged: the change from the last complete day is counted, deposits in the gap removed',()=>{
  const s=E.normalize({transactions:[{id:'b',type:'buy',date:'2026-03-02',symbol:'ALFA',qty:1,price:100,fee:0,opening:true},
    {id:'d',type:'deposit',date:'2026-03-04',currency:'ILS',amount:50}],instruments:{ALFA:{market:'TASE'}}});
  // no ALFA close on 03-03 and 03-04 within reach? carry covers them; force a gap with a missing early bar for a second asset instead
  const hist={ALFA:{bars:[bar('2026-03-02',100),bar('2026-03-12',120)]}};
  const r=D.compute(s,hist,{today:'2026-03-12'});
  const last=r.rows[r.rows.length-1];
  assert.equal(last.since,'2026-03-02');
  near(last.daily,((120*100+5000-5000)/(100*100)-1)*100);   // +20%, the ₪50 deposit removed
  near(r.twr,20);
});
