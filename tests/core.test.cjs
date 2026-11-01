'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const original=fs.readFileSync(path.join(root,'backups/2026-11-01-main/Index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles/app.css'),'utf8'),js=fs.readFileSync(path.join(root,'scripts/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('lossless refactor of deployed main CSS and JS',()=>{
 assert.equal(css,original.match(/<style>([\s\S]*?)<\/style>/)[1]);
 assert.equal(js,original.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('original app DOM is retained verbatim after externalizing assets',()=>{
 const expected=original.replace(/<style>[\s\S]*?<\/style>/,'<link rel="stylesheet" href="styles/app.css">').replace(/<script>[\s\S]*?<\/script>/,'<script src="scripts/app.js" defer></script>');
 assert.equal(html,expected);
});
test('browser script parses and five tabs remain',()=>{
 new vm.Script(js);
 for(const key of ['mortgage','savings','index','loan','budget'])assert.match(html,new RegExp('data-tab="'+key+'"'));
});
test('storage and backup schema stay compatible',()=>{
 assert.match(js,/mirvach\.finance\.calculators\.v1/);
 assert.match(js,/finance-calculators-backup/);
 assert.match(js,/version:1,active,values:states/);
});
const a=js.indexOf('  const limits={first:');
const b=js.indexOf('  function renderControls(){',a);
if(a<0||b<a)throw Error('Expected finance model functions missing');
const model=vm.runInNewContext(js.slice(a,b)+'\n({annuity,schedule,futureValue,limits})');
test('zero-interest repayment returns exact payment',()=>{
 const result=model.schedule(120000,0,10,0);
 assert.equal(result.base,1000);
 assert.equal(result.months,120);
 assert.equal(result.interest,0);
});
test('extra repayment reduces overall interest',()=>{
 const original=model.schedule(400000,6,20,0),extra=model.schedule(400000,6,20,500);
 assert.ok(extra.months<original.months);
 assert.ok(extra.interest<original.interest);
});
test('zero-growth savings total contributions',()=>{
 const r=model.futureValue({initial:1000,monthly:250,years:2},0);
 assert.equal(r.value,7000);
 assert.equal(r.contributed,7000);
});
test('dated deposits are counted exactly once',()=>{
 const events=[{type:'monthly',month:4,amount:200},{type:'once',month:6,amount:500}];
 const r=model.futureValue({initial:1000,monthly:100,years:1},0,0,events);
 assert.equal(r.value,1000+3*100+9*200+500);
});
test('mortgage funding limits preserved',()=>{
 assert.deepEqual([model.limits.first,model.limits.upgrade,model.limits.invest],[.75,.7,.5]);
});
