
  // Excel import: reads the user's workbook (no libraries), recognises sheets by their headers and turns rows into
  // transactions, broker snapshots and prices. Nothing is written until the user confirms the preview.
  // Re-importing the same file finds every row again by its import key and skips it, so nothing is doubled silently.
  const ExcelImport=(()=>{
    const E=PortfolioEngine;
    // ---------- unzip (.xlsx is a zip; entries are stored or deflated) ----------
    async function unzip(buffer){
      const u=new Uint8Array(buffer),dv=new DataView(u.buffer,u.byteOffset,u.byteLength),dec=new TextDecoder();
      let eocd=-1;for(let i=u.length-22;i>=Math.max(0,u.length-66000);i--)if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
      if(eocd<0)throw Error('הקובץ אינו קובץ Excel תקין (xlsx)');
      const count=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);const out={};
      for(let k=0;k<count;k++){
        if(dv.getUint32(p,true)!==0x02014b50)throw Error('מבנה קובץ פגום');
        const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),xlen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),loc=dv.getUint32(p+42,true);
        const name=dec.decode(u.subarray(p+46,p+46+nlen));p+=46+nlen+xlen+clen;
        if(!/\.(xml|rels)$/i.test(name))continue;
        const start=loc+30+dv.getUint16(loc+26,true)+dv.getUint16(loc+28,true),raw=u.subarray(start,start+csize);
        let bytes;
        if(method===0)bytes=raw;
        else if(method===8){
          if(typeof DecompressionStream!=='function')throw Error('הדפדפן לא תומך בפתיחת הקובץ. נסה דפדפן עדכני');
          bytes=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        }else continue;
        out[name]=dec.decode(bytes);
      }
      return out;
    }
    // ---------- workbook XML → sheets of cells ----------
    const xmlText=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,n)=>String.fromCharCode(+n)).replace(/&amp;/g,'&');
    const texts=x=>[...x.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlText(m[1])).join('');
    function colIndex(ref){let n=0;for(const ch of ref.replace(/\d+/g,''))n=n*26+ch.charCodeAt(0)-64;return n-1;}
    function readWorkbook(files){
      const wb=files['xl/workbook.xml'];if(!wb)throw Error('לא נמצא workbook בקובץ');
      const shared=files['xl/sharedStrings.xml']?[...files['xl/sharedStrings.xml'].matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1])):[];
      const rels={};for(const m of (files['xl/_rels/workbook.xml.rels']||'').matchAll(/<Relationship\b[^>]*>/g)){const id=(m[0].match(/Id="([^"]+)"/)||[])[1],t=(m[0].match(/Target="([^"]+)"/)||[])[1];if(id&&t)rels[id]=t.replace(/^\/?(xl\/)?/,'xl/');}
      const sheets=[];
      for(const m of wb.matchAll(/<sheet\b[^>]*>/g)){
        const name=xmlText((m[0].match(/name="([^"]*)"/)||[])[1]||''),rid=(m[0].match(/r:id="([^"]+)"/)||[])[1];
        const x=files[rels[rid]];if(!x)continue;
        const rows=[];
        for(const r of x.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)){
          const rn=+((r[0].match(/\br="(\d+)"/)||[])[1]||rows.length+1),cells=[];
          for(const c of (r[1]||'').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
            const ref=(c[1].match(/\br="([A-Z]+\d+)"/)||[])[1];if(!ref)continue;
            const t=(c[1].match(/\bt="(\w+)"/)||[])[1]||'n',inner=c[2]||'',v=(inner.match(/<v>([\s\S]*?)<\/v>/)||[])[1];
            let val=null;
            if(t==='s')val=v===undefined?null:shared[+v]??'';
            else if(t==='inlineStr')val=texts(inner);
            else if(t==='str'||t==='e')val=v===undefined?null:xmlText(v);
            else if(t==='b')val=v==='1';
            else val=v===undefined?null:Number(v);
            cells[colIndex(ref)]={v:val,f:/<f[\s>/]/.test(inner)};
          }
          rows.push({n:rn,cells});
        }
        sheets.push({name,rows});
      }
      return {sheets};
    }
    // ---------- recognising sheets by header ----------
    const norm=s=>String(s??'').replace(/["'״׳`]/g,'').replace(/\\/g,'/').replace(/\s+/g,' ').trim();
    const KINDS={
      trades:{label:'לוג עסקאות',need:['תאריך','סוג פעולה','שם נייר','כמות','שער ביצוע'],opt:{fee:'עמלת פעולה',total:['תמורה במטח','תמורה במט ח'],currency:'מטבע'}},
      cashflows:{label:'הפקדות ומשיכות',need:['תאריך','סוג פעולה','סכום פעולה']},
      equity:{label:'שווי חשבון יומי',need:['תאריך','ערך חשבון'],opt:{flow:'הפקדה/משיכה'}},
      holdings:{label:'מחירים מתמונת התיק',need:['סימבול','שער']}
    };
    function detect(sheet){
      for(const row of sheet.rows.slice(0,6)){
        const heads=row.cells.map(c=>norm(c?.v));
        for(const [kind,def] of Object.entries(KINDS)){
          if(!def.need.every(h=>heads.includes(norm(h))))continue;
          const col={};def.need.forEach(h=>col[h]=heads.indexOf(norm(h)));
          for(const [k,h] of Object.entries(def.opt||{})){const list=Array.isArray(h)?h:[h];const i=heads.findIndex(x=>list.map(norm).includes(x));if(i>=0)col[k]=i;}
          return {kind,headerRow:row.n,col};
        }
      }
      return null;
    }
    // ---------- cell helpers ----------
    function parseDate(v){
      if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5);return d.toISOString().slice(0,10);}
      if(typeof v!=='string')return null;
      const s=v.trim();let m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
      if(m){const y=m[3].length===2?2000+ +m[3]:+m[3],mo=+m[2],d=+m[1];const iso=y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');return mo>=1&&mo<=12&&d>=1&&d<=31&&E.isDate(iso)&&new Date(iso+'T00:00:00Z').getUTCDate()===d?iso:null;}
      m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m&&E.isDate(m[0])?m[0]:null;
    }
    const numOf=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v.replace(/[,₪$\s]/g,'')))?Number(v.replace(/[,₪$\s]/g,'')):null;
    // A text cell in the date column that does not even look like a date is a label row (SUMMARY, totals).
    const isLabel=v=>typeof v==='string'&&v.trim()!==''&&!/\d{1,4}[/.-]\d{1,2}/.test(v);
    const textOf=v=>v===null||v===undefined?'':String(v).trim();
    // "ACME CORP (ACME)" → ACME, "BETA LTD (BTA US)" → BTA, "GAMA US" → GAMA, "DELTA SYSTEM(DLT" → DLT
    function symbolOf(text){
      const s=textOf(text);if(!s)return '';
      const par=s.match(/\(([^)]*)\)?\s*$/);
      const core=par?par[1]:s;
      const tok=core.trim().split(/\s+/);
      const pick=tok.length>1&&/^(US|TA|IL|UN|UQ)$/i.test(tok[tok.length-1])?tok.slice(0,-1).join(''):par?tok.join(''):tok[0];
      return E.cleanSymbol(pick);
    }
    const r2=v=>Math.round(v*100)/100;
    // ---------- planning: every row gets a status before anything is saved ----------
    function plan(state,workbook,market){
      const haveQuote=s=>!!market?.quotes?.[s],haveFx=!!market?.fx?.USDILS;
      const existingKeys=new Set(state.transactions.map(t=>t.importKey).filter(Boolean));
      const sig=t=>[t.type,t.date,t.symbol||'',t.qty??'',t.price??'',t.amount??'',t.currency||''].join('|');
      const existingSig=new Set(state.transactions.filter(t=>!t.importKey).map(sig));
      const snapByDate=Object.fromEntries(state.snapshots.map(s=>[s.date,s]));
      const result={sheets:[],instruments:{}};
      for(const sheet of workbook.sheets){
        const d=detect(sheet);
        if(!d){result.sheets.push({name:sheet.name,kind:null,rows:[],notes:['לא זוהה כגיליון נתונים. לא ייובא.']});continue;}
        const out={name:sheet.name,kind:d.kind,label:KINDS[d.kind].label,rows:[],notes:[]};
        const seen={};
        const keyOf=(parts)=>{const base=sheet.name+'|'+d.kind+'|'+parts.join('|');seen[base]=(seen[base]||0)+1;return base+'#'+seen[base];};
        const body=sheet.rows.filter(r=>r.n>d.headerRow);
        const cell=(r,i)=>i===undefined||i<0?null:r.cells[i]?.v??null;
        if(d.kind==='trades'){
          let lastType='',block='';const stats={noFee:0,sign:0};
          for(const r of body){
            const c=d.col,typeText=textOf(cell(r,c['סוג פעולה'])),symText=textOf(cell(r,c['שם נייר']));
            const dateRaw=cell(r,c['תאריך']),date=parseDate(dateRaw),qty=numOf(cell(r,c['כמות'])),price=numOf(cell(r,c['שער ביצוע']));
            if(typeText)lastType=typeText;
            if(symText)block=symText;
            if(!date&&qty===null&&price===null)continue;               // empty or summary line
            if(isLabel(dateRaw))continue;                                // label row such as SUMMARY
            const row={row:r.n,status:'new',message:'',excel:{date:dateRaw,type:typeText||lastType,symbol:block,qty,price}};
            out.rows.push(row);
            const type=/קני/.test(lastType)?'buy':/מכיר/.test(lastType)?'sell':null;
            if(!date){row.status='error';row.message='תאריך לא מזוהה';continue;}
            if(!type){row.status='error';row.message='סוג פעולה לא מזוהה: '+(lastType||'ריק');continue;}
            const symbol=symbolOf(block);
            if(!symbol){row.status='error';row.message='חסר שם נייר';continue;}
            if(!(qty>0)||!(price>0)){row.status='error';row.message='כמות או מחיר חסרים';continue;}
            const curText=textOf(cell(r,c.currency));
            const market=/שקל/.test(lastType)||/₪|ש"?ח|ILS/i.test(curText)?'TASE':/^(BTC|ETH|SOL|XRP|ADA|DOGE)(USD|USDT)?$/.test(symbol)?'CRYPTO':'US';
            const feeCell=numOf(cell(r,c.fee)),fee=feeCell!==null&&feeCell>=0?feeCell:state.settings.fees[market];
            const tx={id:E.uid(),type,date,symbol,qty:Math.round(qty*1e8)/1e8,price,fee,note:'',source:'excel'};
            tx.importKey=keyOf([date,type,symbol,qty,price,fee]);
            row.record=tx;row.market=market;
            if(!state.instruments[symbol]&&!result.instruments[symbol])result.instruments[symbol]={symbol,market,currency:E.MARKETS[market].currency,name:block!==symbol?block:'',sector:'',kind:''};
            if(feeCell===null)row.message='עמלה לא רשומה, נלקחה ברירת המחדל';
            // Compare with the sheet's own total, and explain a difference instead of copying it.
            const total=numOf(cell(r,c.total));
            if(total!==null){
              const site=type==='buy'?-(qty*price+fee):qty*price-fee;
              if(Math.abs(total-site)>0.05){
                if(Math.sign(total)!==Math.sign(site)&&Math.abs(Math.abs(total)-Math.abs(site))<0.05+2*fee){stats.sign++;row.note='באקסל הסימן של התמורה הפוך';}
                else if(Math.abs(Math.abs(total)-qty*price)<0.05&&fee>0){stats.noFee++;row.note='באקסל העמלה לא נכללה בתמורה';}
                else row.note='באקסל: '+r2(total)+' · באתר: '+r2(site);
              }
            }
            if(existingKeys.has(tx.importKey)){row.status='dup';row.message='יובא כבר בעבר';}
            else if(existingSig.has(sig(tx))){row.status='dup';row.message='קיימת כבר פעולה זהה';}
          }
          if(stats.noFee)out.notes.push('ב־'+stats.noFee+' שורות התמורה באקסל לא כוללת עמלה. באתר העמלה נכללת תמיד, ולכן הנטו קטן יותר.');
          if(stats.sign)out.notes.push('ב־'+stats.sign+' שורות הסימן של התמורה באקסל הפוך. באתר הסימן נקבע לפי סוג הפעולה.');
        }else if(d.kind==='cashflows'){
          for(const r of body){
            const c=d.col,dateRaw=cell(r,c['תאריך']),date=parseDate(dateRaw),typeText=textOf(cell(r,c['סוג פעולה'])),amount=numOf(cell(r,c['סכום פעולה']));
            if(isLabel(dateRaw)||(!date&&amount===null))continue;          // total line
            const row={row:r.n,status:'new',message:'',excel:{date:dateRaw,type:typeText,amount}};out.rows.push(row);
            if(!date){row.status='error';row.message='תאריך לא מזוהה';continue;}
            if(amount===null||amount===0){row.status='error';row.message='סכום חסר';continue;}
            const type=/משיכ/.test(typeText)||(!/הפקד/.test(typeText)&&amount<0)?'withdrawal':'deposit';
            const tx={id:E.uid(),type,date,currency:'ILS',amount:Math.abs(amount),note:'',source:'excel'};
            tx.importKey=keyOf([date,type,Math.abs(amount)]);row.record=tx;
            if(existingKeys.has(tx.importKey)){row.status='dup';row.message='יובא כבר בעבר';}
            else if(existingSig.has(sig(tx))){row.status='dup';row.message='קיימת כבר פעולה זהה';}
          }
        }else if(d.kind==='equity'){
          let flowSum=0;
          for(const r of body){
            const c=d.col,dateRaw=cell(r,c['תאריך']),date=parseDate(dateRaw),value=numOf(cell(r,c['ערך חשבון']));
            if(isLabel(dateRaw)||(!date&&value===null))continue;
            flowSum+=numOf(cell(r,c.flow))||0;
            const row={row:r.n,status:'new',message:'',excel:{date:dateRaw,value}};out.rows.push(row);
            if(!date){row.status='error';row.message='תאריך לא מזוהה';continue;}
            if(value===null){row.status='error';row.message='שווי חסר';continue;}
            row.record={id:E.uid('s'),date,value,currency:'ILS',note:''};
            const old=snapByDate[date];
            if(old&&Math.abs(old.value-value)<0.005){row.status='dup';row.message='כבר רשום';}
            else if(old){row.status='conflict';row.message='כבר רשום שווי אחר לתאריך הזה: '+old.value;}
          }
          // A date repeated in the sheet: the same value is imported once; different values are a conflict for the user.
          const byDate={};for(const r of out.rows)if(r.record)(byDate[r.record.date]||(byDate[r.record.date]=[])).push(r);
          for(const list of Object.values(byDate)){
            if(list.length<2)continue;
            const same=list.every(r=>Math.abs(r.record.value-list[0].record.value)<0.005);
            list.forEach((r,i)=>{if(r.status!=='new')return;
              if(same&&i>0){r.status='dup';r.message='שורה כפולה בגיליון (שורה '+list[0].row+')';}
              else if(!same){r.status='conflict';r.message='לתאריך הזה יש בגיליון כמה ערכים שונים';}});
          }
          if(d.col.flow!==undefined)out.notes.push('עמודת ההפקדות בגיליון הזה לא מיובאת. ההפקדות נלקחות מגיליון ההפקדות, כדי שלא ייספרו פעמיים'+(flowSum?' (סכום העמודה כאן: ₪'+r2(flowSum).toLocaleString('en-US')+')':'')+'.');
        }else if(d.kind==='holdings'){
          for(const r of body){
            const c=d.col,s=textOf(cell(r,c['סימבול'])),price=numOf(cell(r,c['שער']));
            if(!s||price===null)continue;
            const row={row:r.n,status:'new',message:'',excel:{symbol:s,price}};out.rows.push(row);
            if(s.toUpperCase()==='USD'){row.record={fx:'USDILS',rate:price};row.message='שער דולר';if(haveFx){row.status='dup';row.message='שער דולר כבר קיים באתר';}}
            else{const sym=symbolOf(s);if(!sym||!/^[A-Z0-9.]+$/.test(sym)){row.status='skip';row.message='לא סימול';continue;}row.record={symbol:sym,price};if(haveQuote(sym)){row.status='dup';row.message='מחיר כבר קיים באתר';}}
          }
          out.notes.push('תאריך המחירים לא מופיע באקסל, ולכן הם יסומנו "מהאקסל" עד שיעודכנו. מחיר שכבר הוזן באתר לא יוחלף.');
        }
        result.sheets.push(out);
      }
      validate(state,result);
      return result;
    }
    // Run the whole ledger with the new rows; a sale that finds nothing to sell becomes a row error instead of a silent skip.
    function validate(state,result){
      for(let pass=0;pass<5;pass++){
        const merged=merge(state,result);
        const r=E.compute(merged.state,{},{});
        if(!r.issues.length)return;
        let changed=false;
        for(const issue of r.issues)for(const sh of result.sheets)for(const row of sh.rows)
          if(row.record&&row.record.id===issue.txId&&row.status==='new'){row.status='error';row.oversell=true;row.message='מכירה ללא אחזקה מספקת ('+issue.held+' מוחזקות)';changed=true;}
        if(!changed)return;
      }
    }
    // After the user includes or excludes a sheet, sale checks are redone from scratch.
    function revalidate(state,result){
      for(const sh of result.sheets)for(const row of sh.rows)if(row.oversell){row.status='new';row.message='';row.oversell=false;}
      validate(state,result);
    }
    // Same day: deposits, then buys, then sales (the 2025 sheet lists a trade's sale row first).
    const RANK={deposit:0,withdrawal:0,fx:1,buy:2,sell:3};
    function merge(state,result){
      const take=sh=>sh.include!==false;
      const tx=[],snaps=[],quotes={};let fx=null;
      for(const sh of result.sheets){
        if(!sh.kind||!take(sh))continue;
        for(const row of sh.rows){
          if(row.status!=='new'||!row.record)continue;
          if(sh.kind==='trades'||sh.kind==='cashflows')tx.push(row.record);
          else if(sh.kind==='equity')snaps.push(row.record);
          else if(row.record.fx)fx=row.record.rate;else quotes[row.record.symbol]=row.record.price;
        }
      }
      tx.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(RANK[a.type]??5)-(RANK[b.type]??5));
      const instruments={...state.instruments};
      for(const t of tx)if(t.symbol&&!instruments[t.symbol]&&result.instruments[t.symbol])instruments[t.symbol]=result.instruments[t.symbol];
      return {state:{...state,instruments,transactions:[...state.transactions,...tx],snapshots:[...state.snapshots,...snaps]},quotes,fx,counts:{transactions:tx.length,snapshots:snaps.length,prices:Object.keys(quotes).length+(fx?1:0)}};
    }
    function counts(sheet){const c={new:0,dup:0,error:0,conflict:0,skip:0};for(const r of sheet.rows)c[r.status]=(c[r.status]||0)+1;return c;}
    return {unzip,readWorkbook,detect,parseDate,symbolOf,plan,revalidate,merge,counts,KINDS};
  })();
