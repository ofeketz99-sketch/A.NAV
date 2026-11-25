'use strict';
// Portfolio engine. Cases mirror the patterns of a spreadsheet trade log (blocks of buys and sells, partial exits,
// fees, shekel trades, deposits, a daily equity sheet). All symbols and figures here are made up.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','scripts/src/97-portfolio-engine.js'),'utf8');
const E=vm.runInNewContext(src+'\nPortfolioEngine',{Date,Math,Number,String,Object,Array,Set,JSON});
const TODAY='2026-11-25';
let n=0;
const buy=(date,symbol,qty,price,fee=7.5,extra={})=>({id:'b'+(++n),type:'buy',date,symbol,qty,price,fee,...extra});
const sell=(date,symbol,qty,price,fee=7.5,extra={})=>({id:'s'+(++n),type:'sell',date,symbol,qty,price,fee,...extra});
const state=(transactions,more={})=>E.normalize({transactions,...more});
const run=(s,market)=>E.compute(s,market||{},{today:TODAY});

test('round trip: net includes both fees',()=>{
 const r=run(state([buy('2026-02-02','ALFA',100,10),sell('2026-02-04','ALFA',100,9)]));
 const t=r.trades[0];
 assert.equal(t.status,'closed');
 // 100×9 − 7.5 − (100×10 + 7.5)
 assert.equal(t.net,-11500);
 assert.equal(t.fees,1500);
 assert.equal(t.days,2);
 assert.equal(r.holdings.length,0);
 assert.equal(r.cash.USD,-11500);
});

test('repeat buys then one sale: one trade, a fee on every row',()=>{
 const r=run(state([buy('2026-02-18','BETA',2,100),buy('2026-04-18','BETA',1,110),buy('2026-06-14','BETA',1,90),sell('2026-08-02','BETA',4,130)]));
 assert.equal(r.trades.length,1);
 // A sheet whose totals leave the fees out would show 120; with four $7.5 fees the net is 90.
 assert.equal(r.trades[0].net,12000-3000);
 assert.equal(r.trades[0].days,165);
});

test('partial sales and a re-buy before going flat: still one trade',()=>{
 const r=run(state([buy('2026-03-01','GAMA',10,50),sell('2026-06-01','GAMA',2,60),sell('2026-06-03','GAMA',2,62),
  buy('2026-07-20','GAMA',4,55),sell('2026-08-20','GAMA',4,65),sell('2026-10-15','GAMA',6,58)]));
 assert.equal(r.trades.length,1);
 const t=r.trades[0];
 assert.equal(t.status,'closed');
 assert.equal(t.buys,2);assert.equal(t.sells,4);assert.equal(t.maxQty,10);
 // Net equals the sum of all cash flows, and also equals realized P&L by average cost once the trade is flat.
 const flows=t.txIds.reduce((s,id)=>s+r.txInfo[id].cash[0][1],0);
 assert.equal(t.net,flows);
 assert.equal(t.realized,t.net);
});

test('a new buy after going flat opens a separate trade',()=>{
 const r=run(state([buy('2026-01-01','GAMA',5,20),sell('2026-01-12','GAMA',5,19),buy('2026-03-01','GAMA',3,15)]));
 assert.equal(r.trades.length,2);
 assert.equal(r.trades.map(t=>t.status).join(),'closed,open');
 assert.equal(r.trades[1].net,null);
});

test('partial sale realizes P&L by average cost and keeps the rest at cost',()=>{
 const r=run(state([buy('2026-01-01','X',10,100,0),buy('2026-01-02','X',10,200,0),sell('2026-01-03','X',5,180,0)]));
 // average cost 150 → realized (180−150)×5 = 150
 assert.equal(r.txInfo[r.state.transactions[2].id].realized,15000);
 const h=r.holdings[0];
 assert.equal(h.qty,15);assert.equal(h.cost,225000);assert.equal(h.avgCost,150);
});

test('buy fee enters cost, sale fee reduces proceeds, each counted once',()=>{
 const r=run(state([buy('2026-01-01','X',10,10,7.5),sell('2026-01-05','X',10,10,7.5)]));
 assert.equal(r.trades[0].net,-1500);
 assert.equal(r.summary.byCurrency.USD.fees,1500);
 assert.equal(r.cash.USD,-1500);
});

test('Tel Aviv sale is positive and stays in shekels',()=>{
 const s=state([buy('2026-08-31','TLV1',50,20,7),sell('2026-11-03','TLV1',50,20,7)],{instruments:{TLV1:{market:'TASE'}}});
 const r=run(s);
 assert.equal(r.txInfo[s.transactions[1].id].cash[0][0],'ILS');
 assert.equal(r.txInfo[s.transactions[1].id].cash[0][1],100000-700);
 assert.equal(r.trades[0].net,-1400);
 assert.equal(r.summary.byCurrency.ILS.net,-1400);
 assert.equal(r.summary.byCurrency.USD.net,0);
 assert.equal(r.cash.USD,0);
});

test('deposits and withdrawals change cash, never profit',()=>{
 const s=state([{id:'d1',type:'deposit',date:'2026-01-01',currency:'ILS',amount:10000},{id:'w1',type:'withdrawal',date:'2026-02-01',currency:'ILS',amount:4000}]);
 const r=run(s);
 assert.equal(r.cash.ILS,600000);assert.equal(r.netDeposits.ILS,600000);
 assert.equal(r.trades.length,0);assert.equal(r.summary.winRate,null);
});

test('currency conversion moves cash between ₪ and $ at the given rate',()=>{
 const r=run(state([{id:'d',type:'deposit',date:'2026-01-01',currency:'ILS',amount:10000},{id:'f',type:'fx',date:'2026-01-02',from:'ILS',amount:10000,rate:3.2}]));
 assert.equal(r.cash.ILS,0);assert.equal(r.cash.USD,312500);
});

test('selling more than held is rejected and reported',()=>{
 const s=state([buy('2026-01-01','X',5,10,0)]);
 const errs=E.validate(s,{id:'new',type:'sell',date:'2026-01-02',symbol:'X',qty:6,price:10,fee:0},{});
 assert.match(errs.qty,/מוחזקות רק 5/);
 const before=E.validate(s,{id:'new',type:'sell',date:'2025-12-31',symbol:'X',qty:1,price:10,fee:0},{});
 assert.match(before.qty,/מוחזקות רק 0/);
 const r=run(state([buy('2026-01-01','X',5,10,0),sell('2026-01-02','X',6,10,0)]));
 assert.equal(r.issues.length,1);assert.equal(r.holdings[0].qty,5);assert.equal(r.cash.USD,-5000);
});

test('editing an earlier buy cannot strand a later sale',()=>{
 const s=state([buy('2026-01-01','X',5,10,0),sell('2026-02-01','X',5,12,0)]);
 const edited={...s.transactions[0],qty:3};
 // validate() checks sells; an edited buy is checked through compute issues
 assert.equal(run({...s,transactions:[edited,s.transactions[1]]}).issues.length,1);
});

test('missing price: value, profit and weight are unknown, not zero',()=>{
 const r=run(state([buy('2026-01-01','X',5,10,0)]),{fx:{USDILS:{rate:3.6}}});
 const h=r.holdings[0];
 assert.equal(h.value,null);assert.equal(h.unrealized,null);assert.equal(h.weight,null);
 assert.equal(r.totalIls,null);assert.equal(r.missingPrices.join(),'X');
});

test('valuation and weights include cash, in shekels',()=>{
 const s=state([{id:'d',type:'deposit',date:'2026-01-01',currency:'ILS',amount:3600},{id:'f',type:'fx',date:'2026-01-01',from:'ILS',amount:3600,rate:3.6},buy('2026-01-02','X',5,100,0)]);
 const r=run(s,{quotes:{X:{price:120,asOf:'2026-11-25',source:'manual'}},fx:{USDILS:{rate:4}}});
 // cash $500, position 5×120=$600 → ₪4,400 total; X weight 2400/4400
 assert.equal(r.holdings[0].value,60000);assert.equal(r.holdings[0].unrealized,10000);
 assert.equal(r.totalIls,440000);
 assert.ok(Math.abs(r.holdings[0].weight-240000/440000*100)<1e-9);
});

test('₪ profit uses the buy-date rate and splits out the dollar effect',()=>{
 const s=state([buy('2026-01-01','X',10,100,0,{fxRate:3.5}),sell('2026-03-01','X',10,110,0,{fxRate:3})]);
 const r=run(s);const info=r.txInfo[s.transactions[1].id];
 assert.equal(info.realized,10000);              // +$100
 assert.equal(info.realizedIls,330000-350000);   // ₪3,300 − ₪3,500 = −₪200
 assert.equal(info.fxEffect,-20000-30000);       // −₪200 − ($100×3) = −₪500 from the dollar
 const noRate=run(state([buy('2026-01-01','X',10,100,0),sell('2026-03-01','X',10,110,0,{fxRate:3})])).txInfo;
 assert.equal(Object.values(noRate).find(i=>'realized' in i).realizedIls,undefined);
});

test('summary: win rate and holding days use closed trades only',()=>{
 const r=run(state([buy('2026-01-01','A',1,10,0),sell('2026-01-11','A',1,12,0),buy('2026-02-01','B',1,10,0),sell('2026-02-05','B',1,8,0),buy('2026-11-01','C',1,10,0)]));
 assert.equal(r.summary.closed,2);assert.equal(r.summary.open,1);
 assert.equal(r.summary.winRate,50);
 assert.equal(r.summary.avgDaysClosed,7);
 assert.equal(r.summary.byCurrency.USD.buyVolume,3000);
 assert.equal(r.summary.byCurrency.USD.sellVolume,2000);
});

test('equity curve: the change excludes deposits made since the previous entry',()=>{
 const s=state([{id:'d1',type:'deposit',date:'2026-01-01',currency:'ILS',amount:10000},{id:'d2',type:'deposit',date:'2026-01-03',currency:'ILS',amount:5000}],
  {snapshots:[{date:'2026-01-01',value:10000},{date:'2026-01-02',value:9900},{date:'2026-01-03',value:14801}]});
 const p=run(s).performance;
 assert.equal(p.rows[0].daily,null);
 assert.ok(Math.abs(p.rows[1].daily-(-1))<1e-9);
 assert.ok(Math.abs(p.rows[2].daily-((14801-5000)/9900-1)*100)<1e-9);
 assert.equal(p.rows[2].netDeposits,1500000);
 assert.equal(p.rows[2].profit,1480100-1500000);
 const twr=((1-0.01)*(14801-5000)/9900-1)*100;
 assert.ok(Math.abs(p.twr-twr)<1e-9);
});

test('normalize drops broken records instead of guessing',()=>{
 const s=E.normalize({transactions:[{type:'buy',date:'bad',symbol:'X'},{type:'zzz',date:'2026-01-01'},{type:'buy',date:'2026-01-01',symbol:' abcd ',qty:1,price:1}],
  settings:{fees:{US:-3,TASE:9}}});
 assert.equal(s.transactions.length,1);assert.equal(s.transactions[0].symbol,'ABCD');
 assert.equal(s.settings.fees.US,7.5);assert.equal(s.settings.fees.TASE,9);
});

test('opening holding: builds the position without touching tracked cash, and counts as capital brought in',()=>{
 const s=state([buy('2025-12-01','OPEN1',10,50,0,{opening:true}),sell('2026-02-01','OPEN1',10,60,0)],{instruments:{OPEN1:{market:'TASE'}}});
 const r=run(s);
 assert.equal(r.txInfo[s.transactions[0].id].cash.length,0);
 assert.equal(r.cash.ILS,60000);                 // only the sale reached the tracked cash
 assert.equal(r.trades[0].net,10000);            // the trade itself still made ₪100
 assert.equal(r.openingCapital.ILS,50000);
 assert.equal(r.netDeposits.ILS,0);              // not a deposit…
 const p=run({...s,snapshots:[{id:'a',date:'2025-12-01',value:500},{id:'b',date:'2026-02-02',value:600}]}).performance;
 assert.equal(p.rows[1].profit,10000);           // …but profit is measured against it
});

test('opening holding in dollars needs the dollar rate to enter the shekel capital',()=>{
 const without=run(state([buy('2025-12-01','OPEN2',1,100,0,{opening:true})]));
 assert.equal(without.openingIlsMissing,true);
 const withRate=run(state([buy('2025-12-01','OPEN2',1,100,0,{opening:true,fxRate:3.5})]));
 assert.equal(withRate.openingIlsMissing,false);
 assert.equal(withRate.openingCapital.USD,10000);
});
