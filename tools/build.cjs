#!/usr/bin/env node
'use strict';
// Deterministic zero-dependency build. Concatenation preserves legacy closure and CSS cascade.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=require('./manifest.json');
let failed=false;
for(const [kind,folder,ext,dest] of [['javascript','scripts','js','scripts/app.js'],['css','styles','css','styles/app.css']]){
  const parts=manifest[kind];
  if(!Array.isArray(parts)||!parts.length||new Set(parts).size!==parts.length)throw Error('Invalid manifest: '+kind);
  const data=parts.map(name=>{
    if(!/^[a-z0-9-]+$/.test(name))throw Error('Unsafe module '+name);
    return fs.readFileSync(path.join(root,folder,'src',name+'.'+ext),'utf8');
  }).join('');
  if(kind==='javascript')new vm.Script(data,{filename:dest});
  const target=path.join(root,dest);
  if(process.argv.includes('--check')){
    if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==data){console.error('FAIL: stale '+dest+'; run npm run build');failed=true;}
    else console.log('PASS: '+dest+' ('+parts.length+' parts, sha256 '+crypto.createHash('sha256').update(data).digest('hex').slice(0,12)+')');
  }else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);console.log('Built '+dest);}
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const ref of ['href="styles/app.css"','src="scripts/app.js"'])if(!html.includes(ref)){console.error('Missing asset link: '+ref);failed=true;}
if(/<style[ >]/.test(html)||/<script>([\s\S]*?)<\/script>/.test(html)){console.error('Inline application code found in HTML');failed=true;}
if(failed)process.exit(1);
