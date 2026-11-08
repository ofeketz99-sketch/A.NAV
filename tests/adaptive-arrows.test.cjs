'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const helpers=read('scripts/src/00-helpers.js');
const begin=helpers.indexOf('  function adaptiveArrowStep('),end=helpers.indexOf('  const fields=(...xs)=>xs;');
assert.ok(begin>=0&&end>begin,'adaptive helper must exist');
const {adaptiveArrowStep,adaptiveArrowValue}=vm.runInNewContext('const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));'+helpers.slice(begin,end)+';({adaptiveArrowStep,adaptiveArrowValue})');
test('requested adaptive increments are honored',()=>{
 assert.equal(adaptiveArrowStep(700,'₪'),50);
 assert.equal(adaptiveArrowStep(7.5,'%'),0.5);
 assert.equal(adaptiveArrowStep(500000,'₪'),50000);
 assert.equal(adaptiveArrowValue(700,1,'₪',0,15000),750);
 assert.equal(adaptiveArrowValue(7.5,1,'%',0,10),8);
 assert.equal(adaptiveArrowValue(500000,1,'₪',0,5000000),550000);
});
test('down arrows, decimals and limits work without snapping the value',()=>{
 assert.equal(adaptiveArrowValue(700,-1,'₪',0,15000),650);
 assert.equal(adaptiveArrowValue(7.25,1,'%',0,10),7.75);
 assert.equal(adaptiveArrowValue(7.25,-1,'%',0,10),6.75);
 assert.equal(adaptiveArrowValue(7.5,1,'%',0,7.7),7.7);
 assert.equal(adaptiveArrowValue(0,-1,'₪',0,15000,50),0);
 assert.equal(adaptiveArrowValue(0,1,'₪',0,15000,50),50);
});
test('duration arrows never produce fractional years or months',()=>{
 assert.equal(adaptiveArrowStep(3,'שנים'),1);
 assert.equal(adaptiveArrowStep(24,'חודשים'),2);
 assert.equal(adaptiveArrowValue(3,1,'שנים',1,80),4);
 assert.equal(adaptiveArrowValue(24,-1,'חודשים',1,180),22);
});
test('all numeric arrow surfaces are wired to the adaptive helper',()=>{
 const controls=read('scripts/src/40-input-controls.js');
 const touch=read('scripts/src/45-touch-sliders.js');
 const allocation=read('scripts/src/98-allocation-planner.js');
 const chart=read('scripts/src/98-direct-charts.js');
 assert.match(controls,/number\.addEventListener\('keydown'/);
 assert.match(controls,/slider\.addEventListener\('keydown'/);
 assert.match(controls,/number\.step=String\(adaptiveArrowStep/);
 assert.match(touch,/number\.step=String\(adaptiveArrowStep/);
 assert.match(allocation,/slider\.addEventListener\('keydown'/);
 assert.match(allocation,/amount\.addEventListener\('keydown'/);
 assert.match(chart,/adaptiveArrowValue\(states\[active\]\[id\]/);
});
