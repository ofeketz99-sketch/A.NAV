'use strict';
// Top-level areas (calculators / investments): wiring in the HTML and manifest, and switching behaviour.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=require('../tools/manifest.json');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'scripts/src/98-area-shell.js'),'utf8');
const views=['log','holdings','performance','cash','analysis','boards'];

test('area switch sits in the header identity and keeps the logo markup intact',()=>{
 const identity=html.match(/<div class="frame-identity">([\s\S]*?)<\/nav><\/div>/);
 assert.ok(identity,'switch must be inside .frame-identity');
 assert.match(identity[1],/<strong aria-label="A\.NAV">A<span class="brand-dot" aria-hidden="true"><\/span>NAV<\/strong>/);
 assert.match(identity[1],/data-area-target="calc" aria-controls="contentLayout" aria-selected="true">מחשבונים</);
 assert.match(identity[1],/data-area-target="invest" aria-controls="investApp"/);
});

test('each investments tab controls exactly one matching panel',()=>{
 for(const v of views){
  assert.match(html,new RegExp('id="investTab-'+v+'" data-invest-view="'+v+'" aria-controls="investView-'+v+'"'));
  assert.equal(html.split('id="investView-'+v+'"').length,2,'one panel for '+v);
  assert.match(html,new RegExp('id="investView-'+v+'" role="tabpanel" aria-labelledby="investTab-'+v+'"'));
 }
});

test('investments views are rendered from data: no figures are hard-coded in the HTML',()=>{
 const area=html.slice(html.indexOf('id="investApp"'),html.indexOf('class="mobile-summary"'));
 for(const v of views)assert.match(area,new RegExp('<div class="invest-body" id="investBody-'+v+'"></div>'));
 assert.doesNotMatch(area,/[₪$]\s?\d|\d\s?[₪$%]/);
});

test('calculator DOM and storage are untouched by the shell',()=>{
 for(const id of ['contentLayout','screenViews','tabList','controlsBody','chart','notesInput','marketStrip'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(source,/mirvach\.finance\.calculators\.v1/);
 assert.match(source,/'anav\.shell\.v1'/);
});

test('modules load inside the app closure in dependency order, before startup',()=>{
 const js=manifest.javascript,at=n=>js.indexOf(n);
 assert.ok(at('97-portfolio-engine')>-1&&at('97-portfolio-engine')<at('98-investments'));
 assert.ok(at('98-area-shell')>-1&&at('98-area-shell')<at('98-investments')&&at('98-investments')<at('99-startup'));
 const css=manifest.css,ci=n=>css.indexOf(n);
 assert.ok(ci('99-area-shell')>-1&&ci('99-area-shell')<ci('99-investments'),'investments styles load after the area shell');
 assert.ok(ci('99-investments')>=css.length-2,'investments styles come at the end of the cascade');
});

// Minimal fake DOM for running the module on its own.
function el(extra={}){
 return Object.assign({dataset:{},attrs:{},hidden:false,inert:false,tabIndex:0,listeners:{},animations:0,rect:{left:0},
  setAttribute(k,v){this.attrs[k]=String(v);},addEventListener(t,f){this.listeners[t]=f;},
  getBoundingClientRect(){return this.rect;},animate(){this.animations++;},
  closest(sel){return this._closest?.(sel)??null;},focus(){}},extra);
}
function setup(saved){
 const areaBtns=['calc','invest'].map((a,i)=>el({dataset:{areaTarget:a},rect:{left:100-i*50}}));
 const viewBtns=views.map(v=>el({dataset:{investView:v}}));
 const panels=views.map(v=>el({dataset:{view:v}}));
 const stage=el();
 for(const b of [...areaBtns,...viewBtns])b._closest=()=>b;
 const switcher=el({querySelectorAll:()=>areaBtns,querySelector:s=>areaBtns.find(b=>s.includes('"'+b.dataset.areaTarget+'"'))});
 const tabs=el({querySelectorAll:()=>viewBtns});
 const investApp=el({hidden:true,querySelectorAll:()=>panels,querySelector:s=>s==='.invest-stage'?stage:panels.find(p=>!p.hidden)});
 const nodes={areaSwitch:switcher,investApp,investTabs:tabs,contentLayout:el(),screenViews:el()};
 const app=el({style:{getPropertyValue:()=>'#3f4f8f'}});
 const store=new Map(saved?[['anav.shell.v1',JSON.stringify(saved)]]:[]);
 const calls={motion:[],layout:0,render:0};
 const winListeners={};
 const ctx={app,q:id=>nodes[id],JSON,Math,
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  window:{addEventListener:(t,f)=>{winListeners[t]=f;}},
  motionAllowed:()=>true,playNavMotion:(d,c)=>calls.motion.push([d,c]),
  applyViewportLayout:()=>calls.layout++,renderResults:()=>calls.render++};
 vm.runInNewContext(source,ctx);
 return {areaBtns,viewBtns,panels,nodes,app,store,calls,winListeners,
  clickArea:a=>switcher.listeners.click({target:areaBtns.find(b=>b.dataset.areaTarget===a)}),
  clickView:v=>tabs.listeners.click({target:viewBtns.find(b=>b.dataset.investView===v)})};
}

test('starts in the calculators area by default',()=>{
 const s=setup();
 assert.equal(s.app.dataset.area,'calc');
 assert.equal(s.nodes.investApp.hidden,true);
 assert.equal(s.nodes.contentLayout.inert,false);
 assert.equal(s.areaBtns[0].attrs['aria-selected'],'true');
});

test('switching areas hides the calculators, persists, and redraws them on return',()=>{
 const s=setup();
 s.clickArea('invest');
 assert.equal(s.app.dataset.area,'invest');
 assert.equal(s.nodes.investApp.hidden,false);
 assert.equal(s.nodes.contentLayout.inert,true);
 assert.deepEqual(JSON.parse(s.store.get('anav.shell.v1')),{area:'invest',view:'log'});
 assert.deepEqual(s.calls.motion[0],[-1,'#3f4f8f']);
 s.clickArea('calc');
 assert.equal(s.nodes.contentLayout.inert,false);
 assert.equal(s.calls.layout,1);
 assert.equal(s.calls.render,1);
 assert.equal(s.calls.motion[1][1],'#2f6461','leaving investments sweeps out the investments colour');
});

test('only the chosen investments view is visible, and it is restored after reload',()=>{
 const s=setup();
 s.clickArea('invest');s.clickView('performance');
 assert.deepEqual(s.panels.map(p=>p.hidden),[true,true,false,true,true,true]);
 const again=setup(JSON.parse(s.store.get('anav.shell.v1')));
 assert.equal(again.app.dataset.area,'invest');
 assert.deepEqual(again.panels.map(p=>p.hidden),[true,true,false,true,true,true]);
 assert.equal(again.viewBtns[2].attrs['aria-selected'],'true');
});

test('corrupt or unknown saved state falls back to defaults',()=>{
 const s=setup({area:'nope',view:'x'});
 assert.equal(s.app.dataset.area,'calc');
 assert.equal(s.panels[0].hidden,false);
});

test('Ctrl+Z is blocked from the hidden calculators only while investments is open',()=>{
 const s=setup();
 let stopped=0;
 const key={ctrlKey:true,key:'z',stopImmediatePropagation:()=>stopped++};
 s.winListeners.keydown(key);
 assert.equal(stopped,0);
 s.clickArea('invest');
 s.winListeners.keydown(key);
 assert.equal(stopped,1);
});
