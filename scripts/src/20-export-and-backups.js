  // Fully offline Excel (.xlsx) export. No CDN or outside dependencies.
  function exportExcel(){
    const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const sheets=[];
    const addSheet=(name,rows)=>sheets.push({name,rows});
    const now=new Date().toLocaleString('he-IL');
    const overview=[['סקירת המחשבונים','ערך מרכזי','ערך','יחידה'],['עודכן בתאריך',now]];
    for(const tab of defaultOrder){
      const c=configs[tab],s=states[tab];
      const rows=[[tabLabels[tab]],[ 'מועד ייצוא',now],[],['פרמטר','ערך','יחידה','נקודת איפוס']];
      for(const f of c.fields)rows.push([fieldLabels[tab][f[0]]||f[1],s[f[0]],f[6],getResetPoint(tab,f[0])]);
      rows.push([],['מדד','ערך','יחידה']);
      if(tab==='mortgage'||tab==='loan'){
        const debt=tab==='mortgage'?Math.max(0,s.price-s.equity):s.principal;
        const r=schedule(debt,s.rate,tab==='loan'?loanTermYears(s):s.years,s.extra);
        rows.push(['קרן מקורית',debt,'₪'],['החזר חודשי ללא ביטוח',r.payment,'₪'],['סך הריבית',r.interest,'₪'],['מספר חודשי החזר',r.months]);
        if(tab==='mortgage'){
          rows.push(['הון עצמי',s.equity,'₪'],['ביטוח חודשי',advanced.mortgage.insurance,'₪'],['הוצאות רכישה',advanced.mortgage.purchaseCosts,'₪'],['תרחיש עליית ריבית',advanced.mortgage.stressRise,'%'],['הכנסה חודשית נטו (אופציונלי)',advanced.mortgage.income,'₪']);
        }
        rows.push([],['חודש','שנה','יתרת חוב (₪)']);
        r.monthlySeries.forEach((val,month)=>rows.push([month,Math.round(month/12*100)/100,val]));
        overview.push([tabLabels[tab],'החזר חודשי',r.payment,'₪']);
      }else if(tab==='savings'||tab==='index'){
        const r=futureValue(s,s.rate,tab==='index'?s.fees:0,contributions[tab]||[]);
        rows.push(['סך הפקדות',r.contributed,'₪'],['שווי סוף תקופה',r.value,'₪'],['רווח או הפסד',r.value-r.contributed,'₪']);
        if(tab==='index')rows.push(['מס בדוגמה',advanced.index.taxEnabled?Math.max(0,r.value-Math.max(r.contributed,r.inflationBasis||r.contributed))*advanced.index.taxRate/100:0,'₪'],['שיעור מס לדוגמה',advanced.index.taxRate,'%']);
        rows.push([],['חודש','שנה','שווי מצטבר (₪)','סך הפקדות (₪)','רווח / הפסד (₪)']);
        r.monthlySeries.forEach((value,month)=>rows.push([month,Math.round(month/12*100)/100,value,r.contributionSeries[month],value-r.contributionSeries[month]]));
        rows.push([],['שינויים בהפקדות'],['חודש','סוג שינוי','סכום (₪)']);
        for(const e of contributions[tab])rows.push([e.month,e.type==='monthly'?'הפקדה חודשית חדשה':'הפקדה חד פעמית',e.amount]);
        overview.push([tabLabels[tab],'שווי בסוף תקופה',r.value,'₪']);
      }else{
        const extra=advanced.budget.annualItems.reduce((sum,x)=>sum+Number(x.amount||0),0)/12;
        const expense=s.housing+s.bills+s.living+s.spending+extra;
        const free=s.income-expense-s.savings;
        rows.push(['הוצאות חודשיות',expense,'₪'],['חיסכון מתוכנן',s.savings,'₪'],['יתרה חופשית',free,'₪'],['הוצאות שנתיות (ממוצע חודשי)',extra,'₪']);
        rows.push([],['הוצאה שנתית','סכום שנתי (₪)','ממוצע חודשי (₪)']);
        advanced.budget.annualItems.forEach(item=>rows.push([item.title,item.amount,item.amount/12]));
        overview.push([tabLabels[tab],'יתרה חודשית',free,'₪']);
      }
      addSheet(({mortgage:'משכנתא',savings:'חיסכון',index:'השקעות',loan:'הלוואה',budget:'תקציב'}[tab]),rows);
    }
    const scenariosRows=[['לשונית','תרחיש','פרמטר','ערך']];
    for(const tab of defaultOrder)for(const rec of scenarios[tab]||[])for(const [key,value] of Object.entries(rec.values||{}))scenariosRows.push([tabLabels[tab],rec.name,key,value]);
    addSheet('תרחישים',scenariosRows);
    addSheet('סקירה',overview);
    const sheetXml=(rows)=>{
      const colName=i=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="33" customWidth="1"/><col min="2" max="2" width="23" customWidth="1"/><col min="3" max="5" width="22" customWidth="1"/></cols><sheetData>${rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{if(v===undefined||v===null||v==='')return '';const addr=colName(ci)+(ri+1),style=ri===0?1:((typeof v==='string'&&v==='פרמטר')?1:0);if(typeof v==='number'&&Number.isFinite(v))return `<c r="${addr}" s="${style}"><v>${v}</v></c>`;return `<c r="${addr}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
    };
    const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${sheets.map((sh,i)=>`<sheet name="${xml(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
    const links=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((sh,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`;
    const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((sh,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF43565B"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAE0D3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`;
    const files=[['[Content_Types].xml',types],['_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',links],['xl/styles.xml',styles],...sheets.map((sh,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(sh.rows)])];
    // Small standalone ZIP writer (STORE method) for well-formed XLSX archives.
    const encoder=new TextEncoder();const chunks=[];const central=[];let offset=0;
    const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
    const crc32=bytes=>{let crc=0xFFFFFFFF;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;};
    for(const [filename,content] of files){
      const name=encoder.encode(filename),bytes=encoder.encode(content),crc=crc32(bytes);
      const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(8,0,true);
      v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);
      chunks.push(h,bytes);
      const cd=new Uint8Array(46+name.length),d=new DataView(cd.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);
      d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);cd.set(name,46);
      central.push(cd);offset+=h.length+bytes.length;
    }
    const cdLength=central.reduce((sum,arr)=>sum+arr.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,cdLength,true);ev.setUint32(16,offset,true);
    const blob=new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='finance-export-'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    q('saveStatus').textContent='קובץ Excel נוצר';
  }
  q('excelBtn').addEventListener('click',()=>{try{exportExcel();}catch(error){alert('לא ניתן לייצא ל־Excel: '+error.message);}});

  q('backupBtn').addEventListener('click',()=>{
    const json=JSON.stringify({kind:'finance-calculators-backup',createdAt:new Date().toISOString(),data:snapshot()},null,2);
    const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='finance-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    q('saveStatus').textContent='קובץ גיבוי נוצר';
  });
  q('restoreBtn').addEventListener('click',()=>q('restoreFile').click());
  q('restoreFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>2500000)throw new Error('קובץ גדול מדי');
      const parsed=JSON.parse(await file.text());
      if(parsed.kind!=='finance-calculators-backup'||!parsed.data?.values||parsed.data.version!==1)throw new Error('זה אינו קובץ גיבוי נתמך');
      if(!confirm('לשחזר את הנתונים מהקובץ? הפעולה תחליף את הנתונים הנוכחיים. אפשר לבטל אותה באמצעות כפתור ביטול.'))return;
      undoGroup++;saveState();undoHistory.push(lastCommitted);if(undoHistory.length>maxUndo)undoHistory.shift();
      restoring=true;
      try{restoreSnapshot(parsed.data);lastCommitted=JSON.stringify(snapshot());refreshAllAfterRestore();}
      finally{restoring=false;}
      saveState();setUndoState();q('saveStatus').textContent='הגיבוי שוחזר';
    }catch(err){alert('לא ניתן לשחזר: '+err.message);}
    finally{e.target.value='';}
  });
