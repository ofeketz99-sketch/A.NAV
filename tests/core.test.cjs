'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=require('../tools/manifest.json');
const css=fs.readFileSync(path.join(root,'styles/app.css'),'utf8'),js=fs.readFileSync(path.join(root,'scripts/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('build outputs exactly match the ordered source modules',()=>{
 const combine=(kind,folder,extension)=>manifest[kind].map(name=>fs.readFileSync(path.join(root,folder,'src',name+extension),'utf8')).join('');
 assert.equal(css,combine('css','styles','.css'));
 assert.equal(js,combine('javascript','scripts','.js'));
});
test('the live HTML entrypoint preserves linked assets and A.NAV branding',()=>{
 assert.match(html,/^<!doctype html>/i);
 assert.match(html,/<html lang="he" dir="rtl">/);
 assert.match(html,/<link rel="stylesheet" href="styles\/app\.css">/);
 assert.match(html,/<script src="scripts\/app\.js" defer><\/script>/);
 assert.doesNotMatch(html,/<style>/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/<strong>A\.NAV<\/strong>/);
 assert.match(html,/<title>A\.NAV[^<]*<\/title>/);
 assert.match(html,/<meta name="application-name" content="A\.NAV">/);
 assert.doesNotMatch(html,/<strong>מרווח<\/strong>/);
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
