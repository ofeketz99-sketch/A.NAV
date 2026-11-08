'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'scripts/src/98-allocation-planner.js'),'utf8');
const controls=fs.readFileSync(path.join(root,'scripts/src/40-input-controls.js'),'utf8');
const a=source.indexOf("    const clean=n=>");
const b=source.indexOf("    let allocation;");
assert.ok(a>=0&&b>a,'Allocation helpers missing');
function setup(budgetSavings=1000){
 const src="const MAX=24,LIMIT=15000,states={budget:{savings:"+budgetSavings+"}};"+source.slice(a,b)+";({defaults,normalize,clean})";
 return vm.runInNewContext(src);
}
const total=state=>state.items.reduce((sum,item)=>sum+item.amount,0);
test('a fresh allocation has no destinations',()=>assert.equal(setup().defaults().items.length,0));
test('named shekel amounts are preserved as monthly independent entries',()=>{
 const a=setup().normalize({version:2,items:[{name:'SPY',amount:300},{name:'כללי',amount:300},{name:'בגדים',amount:400}]});
 assert.equal(total(a),1000);assert.equal(a.items[2].name,'בגדים');assert.equal(a.items[1].amount,300);
});
test('old percentage amounts migrate without losing names',()=>{
 const a=setup().normalize({amount:600,items:[{name:'SPY',pct:25},{name:'קרן',pct:75}]});
 assert.equal(total(a),600);assert.equal(a.items[0].amount,150);assert.equal(a.items[1].amount,450);
 const linked=setup(1200).normalize({linkedToBudget:true,items:[{name:'SPY',pct:25},{name:'כללי',pct:75}]});
 assert.equal(total(linked),1200);assert.equal(linked.items[0].amount,300);
});
test('saving goals independently never derives them from changed main budget values',()=>{
 const raw={version:2,items:[{name:'מדד',amount:300},{name:'בגדים',amount:400}]};
 const a=setup(1000).normalize(raw),b=setup(3000).normalize(raw);
 assert.equal(total(a),700);assert.equal(total(b),700);
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
});
test('allocation respects budget monthly savings cap',()=>{
 const a=setup().normalize({version:2,items:[{name:'א',amount:12000},{name:'ב',amount:9000},{name:'ג',amount:100}]});
 assert.equal(total(a),15000);assert.equal(a.items[1].amount,3000);assert.equal(a.items[2].amount,0);
 assert.equal(setup().clean(-10),0);
});
test('breakdown changes update the main budget, while there is no reverse subscription',()=>{
 assert.match(source,/if\(active==='budget'\)changeValue\('savings',total\(\),'allocation'\)/);
 assert.doesNotMatch(source,/anav:finance-state-changed/);
 assert.match(source,/addEventListener\('change',\(\)=>\{setAmount\(i,amount.value\);render\(\);\}\)/);
 assert.match(source,/allocation.items.splice\(i,1\);persist\(\);syncBudget\(\);render\(\)/);
});
test('breakdown opens from the budget monthly savings input instead of the toolbar',()=>{
 assert.match(controls,/active==='budget'&&id==='savings'/);
 assert.match(controls,/data-open-allocation/);
 assert.match(source,/get\('controlsBody'\)\.addEventListener\('click'/);
 assert.doesNotMatch(source,/workspace-tools/);
 assert.match(source,/localStorage\.setItem\(STORAGE/);
});
