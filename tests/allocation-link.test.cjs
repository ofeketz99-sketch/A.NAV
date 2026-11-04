'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'scripts/src/98-allocation-planner.js'),'utf8');
const finance=fs.readFileSync(path.join(root,'scripts/src/18-persistence-and-undo.js'),'utf8');
function excerpt(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Expected allocation helper source must be available');
  return source.slice(a,b);
}
const {defaults,normalize}=vm.runInNewContext('const MAX=24;'+excerpt('    const defaults=()=>','    let allocation;')+';({defaults,normalize})');
const helpers=excerpt('    function effectiveAmount(){','    function setShare(')+excerpt('    function amounts(){','    function render(){');
function calculate(allocation,savings){
  const states={budget:{savings}};
  return vm.runInNewContext(helpers+';({amount:effectiveAmount(),amounts:amounts()})',{allocation,states});
}
test('old standalone allocations remain unlinked on load',()=>{
  const a=normalize({amount:350,period:'once',items:[{name:'מדד',pct:100}]});
  assert.equal(a.linkedToBudget,false);
  assert.equal(a.amount,350);
  assert.equal(a.period,'once');
  assert.equal(a.items[0].name,'מדד');
});
test('linked allocations use live budget savings without losing the manual value',()=>{
  const a=normalize({amount:650,period:'once',linkedToBudget:true,items:[{name:'מניות',pct:40},{name:'קרן',pct:60}]});
  let r=calculate(a,3000);
  assert.equal(r.amount,3000);
  assert.equal(r.amounts[0],1200);
  assert.equal(r.amounts[1],1800);
  r=calculate(a,2500);
  assert.equal(r.amount,2500);
  assert.equal(r.amounts[0],1000);
  assert.equal(r.amounts[1],1500);
  assert.equal(a.amount,650);
  assert.equal(a.period,'once');
  a.linkedToBudget=false;
  r=calculate(a,9000);
  assert.equal(r.amount,650);
  assert.equal(r.amounts[0],260);
  assert.equal(r.amounts[1],390);
});
test('zero savings and malformed legacy state are handled',()=>{
  const a=normalize({amount:1000,linkedToBudget:true,items:[{name:'יחיד',pct:100}]});
  assert.equal(calculate(a,0).amount,0);
  assert.equal(calculate(a,0).amounts[0],0);
  assert.equal(normalize(null).linkedToBudget,false);
  const b=normalize({amount:100,linkedToBudget:true,items:[]});
  assert.equal(b.linkedToBudget,true);
});
test('link is one-way and budget state changes notify linked tools',()=>{
  assert.match(source,/states\.budget\?\.savings/);
  assert.match(source,/get\('allocationAmount'\)\.disabled=linked/);
  assert.match(source,/get\('allocationPeriod'\)\.disabled=linked/);
  assert.match(source,/addEventListener\('anav:finance-state-changed'/);
  assert.doesNotMatch(source,/states\.budget\.savings\s*=/);
  assert.match(finance,/dispatchEvent\(new Event\('anav:finance-state-changed'\)\)/);
});
