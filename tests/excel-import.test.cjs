'use strict';
// Excel import. The fixtures copy the layout of a personal investments workbook (trade-log blocks, deposits table,
// daily equity sheet, holdings snapshot) but every symbol, name, date and amount here is made up.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const read=f=>fs.readFileSync(path.join(__dirname,'..','scripts/src',f),'utf8');
const ctx=vm.createContext({Date,Math,Number,String,Object,Array,Set,JSON,TextDecoder,Uint8Array,DataView,Blob,Response,DecompressionStream,Error,RegExp});
vm.runInContext(read('97-portfolio-engine.js')+read('97-excel-import.js')+'\nthis.E=PortfolioEngine;this.X=ExcelImport;',ctx);
const {E,X}=ctx;

// Build sheet XML from rows of values (numbers stay numbers, strings are inline).
const col=i=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const sheetXml=rows=>'<worksheet><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>v===null||v===undefined?'':typeof v==='number'?'<c r="'+col(j)+(i+1)+'"><v>'+v+'</v></c>':'<c r="'+col(j)+(i+1)+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
function files(sheets){
 const f={'xl/workbook.xml':'<workbook xmlns:r="x"><sheets>'+sheets.map((s,i)=>'<sheet name="'+esc(s[0])+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships>'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>'};
 sheets.forEach((s,i)=>f['xl/worksheets/sheet'+(i+1)+'.xml']=sheetXml(s[1]));
 return f;
}
const serial=iso=>(Date.parse(iso+'T00:00:00Z')-Date.UTC(1899,11,30))/864e5;
// Trade log: the symbol and action appear on the first row of a block; totals sometimes leave the fee out,
// and the shekel sale has its sign reversed, like the issues found in the real sheet.
const TRADES=[['תאריך','סוג פעולה','שם נייר','כמות','שער ביצוע','עמלת פעולה','תמורה במט"ח','שינוי נטו במטח'],
 [serial('2026-02-02'),'קניה חול מטח','ALFA',100,10,7.5,-1007.5,-115],
 [serial('2026-02-04'),'מכירה חול מטח',null,100,9,7.5,892.5],
 [serial('2026-02-18'),'קניה חול מטח','BETA',2,100,7.5,-200,80],
 [serial('2026-04-18'),null,null,1,110,7.5,-110],
 [serial('2026-08-02'),'מכירה חול מטח',null,3,130,7.5,390],
 [null,null,null,null,null,null,0],
 [serial('2026-08-31'),'קניה שקלית','TLV1',50,20,1.5,-1000,0],
 [serial('2026-11-03'),'מכירה שקלית',null,50,20,1.5,-1000],
 [],
 ['SUMMERY',3,3,0.5,null,30,1282.5,-35],
 [null,'קניית מניה','טיקרים שונים','WR']];
const CASH=[['תאריך','סוג פעולה','סכום פעולה'],[serial('2026-01-01'),'הפקדה',10000],['16/4/2026',' הפקדה ',1000],[serial('2026-03-01'),'משיכה',-4000],['סה"כ בחשבון',null,7000]];
const EQUITY=[['תאריך','ערך חשבון','תנועה אחוזית','הפקדה\\משיכה','סך הפקדות לחשבון','GAP'],[serial('2026-01-01'),10000,0,10000,10000,0],['02/01/2026',9900,-1,0,10000,100],['03/01/2026',9950,0.5,0,10000,50]];
const HOLD=[['סימבול','מחיר ממוצע במטבע מקור','שער','כמות נוכחית'],['USD',3.5,3.6,1000],['ALFA',10,12.5,40],['מוסתר']];
const book=()=>X.readWorkbook(files([['Trades2026',TRADES],['הפקדות ומשיכות',CASH],['סהכ',EQUITY],['תיק השקעות',HOLD],['הערות',[['סתם טקסט']]]]));
const empty=()=>E.normalize(null);

test('dates: Excel serials and dd/mm/yyyy text, invalid rejected',()=>{
 assert.equal(X.parseDate(46023),'2026-01-01');
 assert.equal(X.parseDate('07/03/2025'),'2025-03-07');
 assert.equal(X.parseDate('16/4/2026'),'2026-04-16');
 assert.equal(X.parseDate('31/02/2026'),null);
 assert.equal(X.parseDate('SUMMERY'),null);
});

test('ticker extraction from long security names',()=>{
 assert.equal(X.symbolOf('ACME CORP (ACME)'),'ACME');
 assert.equal(X.symbolOf('BETA LTD (BTA US)'),'BTA');
 assert.equal(X.symbolOf('GAMA US'),'GAMA');
 assert.equal(X.symbolOf('DELTA SYSTEM(DLT'),'DLT');
 assert.equal(X.symbolOf('EPSILON BIO(EPS)'),'EPS');
 assert.equal(X.symbolOf('TLV1'),'TLV1');
});

test('sheets are recognised by their headers; unknown sheets are left alone',()=>{
 const p=X.plan(empty(),book());
 assert.equal(p.sheets.map(s=>s.kind).join(),'trades,cashflows,equity,holdings,');
});

test('trade blocks: symbol and type carry down, summary lines skipped',()=>{
 const p=X.plan(empty(),book()),t=p.sheets[0];
 const recs=t.rows.filter(r=>r.record).map(r=>r.record);
 assert.equal(recs.length,7);
 assert.equal(recs.map(r=>r.symbol+':'+r.type).join(),'ALFA:buy,ALFA:sell,BETA:buy,BETA:buy,BETA:sell,TLV1:buy,TLV1:sell');
 assert.equal(p.instruments.TLV1.market,'TASE');
 assert.equal(t.rows.every(r=>r.status==='new'),true);
 // explained differences from the sheet's own totals
 assert.match(t.notes.join(' '),/ב־4 שורות התמורה באקסל לא כוללת עמלה/);
 assert.match(t.notes.join(' '),/ב־1 שורות הסימן של התמורה באקסל הפוך/);
});

test('imported trades compute like the site: fees included, TASE sale positive',()=>{
 const p=X.plan(empty(),book()),m=X.merge(empty(),p);
 const r=E.compute(m.state,{},{today:'2026-11-25'});
 const by=s=>r.trades.find(t=>t.symbol===s);
 assert.equal(by('ALFA').net,-11500);
 assert.equal(by('BETA').net,Math.round((390-7.5-(200+7.5)-(110+7.5))*100));
 assert.equal(by('TLV1').net,-300);
 assert.equal(by('TLV1').currency,'ILS');
});

test('deposits sheet: text dates, trimmed labels, withdrawal sign, total row skipped',()=>{
 const c=X.plan(empty(),book()).sheets[1];
 const recs=c.rows.map(r=>r.record);
 assert.equal(recs.length,3);
 assert.equal(recs.map(r=>r.type+':'+r.amount+':'+r.date).join(),'deposit:10000:2026-01-01,deposit:1000:2026-04-16,withdrawal:4000:2026-03-01');
});

test('equity sheet: values become broker snapshots; its deposit column is not imported twice',()=>{
 const p=X.plan(empty(),book()),eq=p.sheets[2];
 assert.equal(eq.rows.filter(r=>r.status==='new').length,3);
 assert.match(eq.notes[0],/לא מיובאת/);
 const m=X.merge(empty(),p);
 const r=E.compute(m.state,{},{today:'2026-11-25'});
 assert.equal(r.netDeposits.ILS,700000);   // 10,000 + 1,000 − 4,000 from the deposits sheet only
 assert.equal(r.performance.rows.length,3);
});

test('a date repeated in the equity sheet: same value once, different values flagged',()=>{
 const rows=[EQUITY[0],[serial('2025-12-31'),5000],[serial('2025-12-31'),5000],[serial('2026-01-01'),100],[serial('2026-01-01'),200]];
 const eq=X.plan(empty(),X.readWorkbook(files([['סהכ',rows]]))).sheets[0];
 assert.equal(eq.rows.map(r=>r.status).join(),'new,dup,conflict,conflict');
});

test('holdings snapshot gives prices and the dollar rate',()=>{
 const m=X.merge(empty(),X.plan(empty(),book()));
 assert.equal(m.fx,3.6);
 assert.equal(m.quotes.ALFA,12.5);
 assert.equal(m.quotes['מוסתר'],undefined);
});

test('prices already on the site are shown as existing and not replaced',()=>{
 const h=X.plan(empty(),book(),{quotes:{ALFA:{price:5}},fx:{USDILS:{rate:3.7}}}).sheets[3];
 assert.equal(h.rows.map(r=>r.status).join(),'dup,dup');
});

test('importing the same file again adds nothing',()=>{
 const first=X.merge(empty(),X.plan(empty(),book())).state;
 const again=X.plan(first,book());
 for(const sh of again.sheets.filter(s=>s.kind&&s.kind!=='holdings'))assert.equal(sh.rows.filter(r=>r.status==='new').length,0,sh.name);
 assert.equal(X.merge(first,again).counts.transactions,0);
 assert.equal(X.merge(first,again).counts.snapshots,0);
});

test('a manually typed identical action is flagged, not doubled',()=>{
 const s=E.normalize({transactions:[{id:'m1',type:'deposit',date:'2026-01-01',currency:'ILS',amount:10000}]});
 const row=X.plan(s,book()).sheets[1].rows[0];
 assert.equal(row.status,'dup');assert.match(row.message,/פעולה זהה/);
});

test('a different value for an already recorded date is a conflict and is not overwritten',()=>{
 const s=E.normalize({snapshots:[{date:'2026-01-02',value:9800}]});
 const eq=X.plan(s,book()).sheets[2];
 assert.equal(eq.rows[1].status,'conflict');
 assert.equal(X.merge(s,X.plan(s,book())).state.snapshots.filter(x=>x.date==='2026-01-02')[0].value,9800);
});

test('sale without the buy: row error; excluding a sheet re-checks sales',()=>{
 const wb=X.readWorkbook(files([['Trades2025',[TRADES[0],[serial('2025-12-01'),'קניית מניה','ZZZ',5,10,7.5]]],['Trades2026',[TRADES[0],[serial('2026-01-05'),'מכירת מניה','ZZZ',5,12,7.5]]]]));
 const p=X.plan(empty(),wb);
 assert.equal(p.sheets[1].rows[0].status,'new');
 p.sheets[0].include=false;X.revalidate(empty(),p);
 assert.equal(p.sheets[1].rows[0].status,'error');assert.match(p.sheets[1].rows[0].message,/ללא אחזקה/);
 p.sheets[0].include=true;X.revalidate(empty(),p);
 assert.equal(p.sheets[1].rows[0].status,'new');
});

test('same-day sale listed before its buy (older sheet layout) imports in buy-then-sell order',()=>{
 const wb=X.readWorkbook(files([['Trades2025',[TRADES[0],[serial('2025-06-01'),'מכירת מניה','ACME CORP(ACME)',10,12,7.5],[serial('2025-06-01'),'קניית מניה',null,10,10,7.5]]]]));
 const p=X.plan(empty(),wb);
 assert.equal(p.sheets[0].rows.every(r=>r.status==='new'),true);
 assert.equal(E.compute(X.merge(empty(),p).state,{},{}).trades[0].status,'closed');
});

test('real .xlsx bytes: deflated zip entries are read',async()=>{
 const f=files([['הפקדות ומשיכות',CASH]]);
 const parts=[],central=[];let off=0;const u16=v=>Buffer.from([v&255,v>>8&255]),u32=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);return b;};
 for(const [name,text] of Object.entries(f)){
  const nb=Buffer.from(name),raw=Buffer.from(text),data=zlib.deflateRawSync(raw),crc=zlib.crc32?zlib.crc32(raw):0;
  const head=Buffer.concat([u32(0x04034b50),u16(20),u16(0x0800),u16(8),u16(0),u16(0),u32(crc),u32(data.length),u32(raw.length),u16(nb.length),u16(0)]);
  parts.push(head,nb,data);
  central.push(Buffer.concat([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(8),u16(0),u16(0),u32(crc),u32(data.length),u32(raw.length),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),nb]));
  off+=head.length+nb.length+data.length;
 }
 const cd=Buffer.concat(central),n=Object.keys(f).length;
 const zip=Buffer.concat([...parts,cd,u32(0x06054b50),u16(0),u16(0),u16(n),u16(n),u32(cd.length),u32(off),u16(0)]);
 const out=await X.unzip(zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.length));
 const p=X.plan(empty(),X.readWorkbook(out));
 assert.equal(p.sheets[0].kind,'cashflows');
 assert.equal(p.sheets[0].rows.length,3);
});
