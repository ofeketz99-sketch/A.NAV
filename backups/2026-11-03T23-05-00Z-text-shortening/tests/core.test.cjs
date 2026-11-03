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

test('standard reset preserves locked fields, locked goal and deposit schedule',()=>{
 const source=fs.readFileSync(path.join(root,'scripts/src/90-notes-and-activation.js'),'utf8');
 const a=source.indexOf('  function resetCalculatorValues('),b=source.indexOf("  q('resetBtn').addEventListener",a);
 assert.ok(a>=0&&b>a,'Reset function must be independently testable');
 const ctx={
  states:{savings:{initial:700,monthly:1000,years:10,rate:5,goal:1000000}},
  configs:{savings:{fields:[['initial'],['monthly'],['years'],['rate'],['goal']]}},
  goalPinned:{savings:['initial','rate']},goalPlans:{savings:{locked:true,solve:'monthly'}},
  goalManuals:{savings:{initial:700,monthly:850,years:10,rate:5}},goalFeedback:{savings:null},
  goalSolveChoices:[['monthly'],['years'],['initial'],['rate']],
  contributions:{savings:[{month:6,amount:300}]},compareIds:{savings:'previous'},
  advanced:{mortgage:{},index:{},budget:{}},
  getResetPoint:(_,id)=>({initial:10,monthly:250,years:20,rate:3,goal:50000})[id],
  goalSolver(tab){ctx.states[tab].monthly=750;ctx.solved=true;}
 };
 const reset=vm.runInNewContext(source.slice(a,b)+'\nresetCalculatorValues',ctx);
 reset('savings',false);
 assert.equal(ctx.states.savings.initial,700);
 assert.equal(ctx.states.savings.rate,5);
 assert.equal(ctx.states.savings.goal,1000000);
 assert.equal(ctx.states.savings.years,20);
 assert.equal(ctx.states.savings.monthly,750);
 assert.equal(ctx.goalManuals.savings.monthly,850);
 assert.equal(ctx.goalPlans.savings.locked,true);
 assert.equal(ctx.contributions.savings.length,1);
 assert.equal(ctx.solved,true);
 reset('savings',true);
 assert.equal(ctx.states.savings.initial,10);
 assert.equal(ctx.states.savings.goal,50000);
 assert.equal(ctx.states.savings.monthly,250);
 assert.equal(ctx.goalPlans.savings.locked,false);
 assert.equal(ctx.goalPinned.savings.length,0);
 assert.equal(ctx.contributions.savings.length,0);
 assert.equal(ctx.compareIds.savings,null);
});
test('saved scenario locks round-trip and legacy scenarios clear unrelated locks',()=>{
 const normal=fs.readFileSync(path.join(root,'scripts/src/15-snapshots-and-storage.js'),'utf8');
 const scenario=fs.readFileSync(path.join(root,'scripts/src/94-scenarios-and-settings.js'),'utf8');
 const a=normal.indexOf('  function normalizeScenarioLockState('),b=normal.indexOf('  function restoreSnapshot(',a);
 const c=scenario.indexOf('  function snapshotFor('),d=scenario.indexOf('  function renderScenarioList(',c);
 assert.ok(a>=0&&b>a&&c>=0&&d>c,'Helpers must be individually testable');
 const ctx={
  configs:{savings:{fields:[['initial','',0,500000],['monthly','',0,15000],['years','',1,80],['rate','',0,12],['goal','',1000,50000000]]}},
  states:{savings:{initial:100,monthly:500,years:20,rate:4,goal:100000}},
  contributions:{savings:[{month:10,amount:400}]},
  advanced:{savings:{}},goalPlans:{savings:{locked:true,solve:'monthly'}},
  goalPinned:{savings:['initial']},goalManuals:{savings:{initial:100,monthly:450,years:20,rate:4}},
  goalFeedback:{savings:null},
  goalSolveChoices:[['monthly'],['years'],['initial'],['rate']],
  structuredClone,clamp:(x,low,high)=>Math.max(low,Math.min(high,x)),
  allowedKinds:[],goalSolver(){ctx.solveCalls=(ctx.solveCalls||0)+1;}
 };
 const api=vm.runInNewContext(normal.slice(a,b)+scenario.slice(c,d)+'\n({snapshotFor,loadScenarioRecord})',ctx);
 const saved=api.snapshotFor('savings');
 assert.equal(saved.lockState.locked,true);
 assert.equal(saved.lockState.solve,'monthly');
 assert.equal(saved.lockState.pinned.join(','),'initial');
 ctx.goalPinned.savings=[];ctx.goalPlans.savings.locked=false;
 api.loadScenarioRecord('savings',saved);
 assert.equal(ctx.goalPlans.savings.locked,true);
 assert.equal(ctx.goalPinned.savings[0],'initial');
 assert.equal(ctx.solveCalls,1);
 api.loadScenarioRecord('savings',{values:{...saved.values},events:[],advanced:{}});
 assert.equal(ctx.goalPlans.savings.locked,false);
 assert.equal(ctx.goalPinned.savings.length,0);
 assert.equal(ctx.contributions.savings.length,0);
});
test('a locked target rejects manual mutations in both input and slider paths',()=>{
 const source=fs.readFileSync(path.join(root,'scripts/src/32-goal-solving.js'),'utf8');
 const edits=fs.readFileSync(path.join(root,'scripts/src/45-touch-sliders.js'),'utf8');
 assert.match(source,/lockedTarget=locked&&id==='goal'/);
 assert.match(source,/r\.disabled=n\.disabled=computed\|\|pinned\|\|lockedTarget/);
 assert.match(edits,/if\(goalIsActive\(\)&&id==='goal'\)return;/);
});

test('illustrative volatility fan is deterministic and percentile-ordered',()=>{
 const code=fs.readFileSync(path.join(root,'scripts/src/98-risk-model.js'),'utf8');
 const a=code.indexOf('  function riskEnvelope('),b=code.indexOf("  q('riskToggle')",a);
 assert.ok(a>=0&&b>a,'risk model must be independently testable');
 const simulate=vm.runInNewContext(code.slice(a,b)+'\nriskEnvelope');
 const input={initial:10000,monthly:400,years:8,rate:7,fees:.2,goal:100000};
 const p=simulate(input,[],18,100),again=simulate(input,[],18,100);
 assert.equal(p.low.length,p.high.length);
 assert.equal(p.goalShare,again.goalShare);
 assert.deepEqual(Array.from(p.low),Array.from(again.low));
 assert.ok(p.low.every((v,i)=>v<=p.median[i]&&p.median[i]<=p.high[i]));
 assert.ok(p.high.at(-1)>p.low.at(-1));
 const fixed=simulate(input,[],0,30);
 assert.ok(Math.abs(fixed.high.at(-1)-fixed.low.at(-1))<.01);
});

test('visual polish uses responsive plot bounds and a structured A.NAV masthead',()=>{
 const css=fs.readFileSync(path.join(root,'styles/src/99-visual-polish.css'),'utf8');
 const renderer=fs.readFileSync(path.join(root,'scripts/src/62-chart-rendering.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/<strong>A\.NAV<\/strong>/);
 assert.match(html,/frame-chrome-center/);
 assert.match(renderer,/getBoundingClientRect\(\)/);
 assert.match(renderer,/const x0=34,x1=w-36,y0=h-38,y1=26/);
 assert.match(css,/justify-content:space-evenly/);
 assert.match(css,/grid-template-rows:minmax\(144px/);
});

test('fixed viewport has selectable panes and paginated fields',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'styles/src/99-no-scroll.css'),'utf8');
 const mod=fs.readFileSync(path.join(root,'scripts/src/98-fixed-screen.js'),'utf8');
 assert.match(html,/id="screenViews"/);
 assert.match(html,/id="fieldPager"/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(css,/grid-template-rows:repeat\(var\(--visible-count/);
 assert.match(mod,/function applyViewportLayout\(\)/);
 assert.match(mod,/setScreenPanel\(button.dataset.screenPanel\)/);
});
