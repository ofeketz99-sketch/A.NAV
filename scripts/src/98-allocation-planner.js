
  // Independent savings allocation window; intentionally separate from financial calculators.
  (() => {
    const STORAGE='anav.allocation.planner.v1', MAX=24, PAGE_SIZE=4;
    const colors=['#387d82','#a78e6e','#7289a5','#b57868','#7b8671','#9b7aa0','#c29c57'];
    const defaults=()=>({amount:300,period:'monthly',items:[{id:1,name:'אפיק 1',pct:50},{id:2,name:'אפיק 2',pct:50}]});
    function normalize(raw){
      const def=defaults();
      if(!raw||typeof raw!=='object')return def;
      const amount=Number(raw.amount);
      const items=Array.isArray(raw.items)?raw.items.slice(0,MAX).map((x,i)=>({id:i+1,name:typeof x.name==='string'?x.name.slice(0,60):'אפיק '+(i+1),pct:Math.max(0,Math.min(100,Number(x.pct)||0))})):[];
      if(!items.length)return {...def,amount:Number.isFinite(amount)?Math.max(0,Math.min(100000000,amount)):300};
      let remaining=100;
      const sum=items.reduce((a,x)=>a+x.pct,0);
      items.forEach((item,i)=>{item.pct=i===items.length-1?remaining:Math.min(remaining,Math.round((sum?item.pct/sum:1/items.length)*1000)/10);remaining=Math.round((remaining-item.pct)*10)/10;});
      return {amount:Number.isFinite(amount)?Math.max(0,Math.min(100000000,amount)):300,period:raw.period==='once'?'once':'monthly',items};
    }
    let allocation;
    try{allocation=normalize(JSON.parse(localStorage.getItem(STORAGE)||'null'));}catch(_){allocation=defaults();}
    let page=0,opener=null;
    const money=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:2});
    const button=document.createElement('button');
    button.type='button';button.className='mini-tool allocation-trigger';button.id='allocationToggle';
    button.textContent='חלוקת חיסכון';button.title='חלון עצמאי לחלוקת סכום בין אפיקים אישיים';
    const tools=document.querySelector('.workspace-tools');
    tools.insertBefore(button,document.getElementById('excelBtn'));
    const overlay=document.createElement('div');overlay.id='allocationOverlay';overlay.className='tool-overlay allocation-overlay';overlay.hidden=true;
    overlay.innerHTML=`<section class="tool-dialog allocation-dialog" role="dialog" aria-modal="true" aria-labelledby="allocationTitle">
      <header class="tool-head"><div><h2 id="allocationTitle">חלוקת חיסכון</h2><p>תכנון סכום וחלוקה חופשית בין אפיקים — בנפרד מהמחשבונים האחרים</p></div><button type="button" class="tool-close" id="allocationClose" aria-label="סגירה">×</button></header>
      <div class="allocation-content">
        <div class="allocation-top"><label class="allocation-amount">סכום לחלוקה (₪)<input id="allocationAmount" type="number" inputmode="decimal" min="0" max="100000000" step="50"></label>
        <label class="allocation-period">סוג סכום<select id="allocationPeriod"><option value="monthly">חודשי</option><option value="once">חד־פעמי</option></select></label></div>
        <div class="allocation-summary"><span>סה״כ מוקצה</span><strong id="allocationAssigned"></strong><span class="allocation-total" id="allocationTotal"></span></div>
        <div class="allocation-bar" id="allocationBar" role="img" aria-label="התפלגות החיסכון"></div>
        <div class="allocation-list-head"><strong>אפיקי החיסכון</strong><small id="allocationCount"></small></div>
        <div id="allocationList" class="allocation-list"></div>
        <nav class="allocation-pager" id="allocationPager" aria-label="עמודי אפיקים"><button type="button" id="allocationPrev">הקודם</button><span id="allocationPage"></span><button type="button" id="allocationNext">הבא</button></nav>
        <div class="allocation-actions"><button type="button" class="tool-primary" id="allocationAdd">+ הוסף אפיק</button><button type="button" class="allocation-reset" id="allocationReset">איפוס חלוקה</button></div>
        <p class="tool-hint">כל שינוי באחוז של אפיק מחלק מחדש את היתרה בין שאר האפיקים. הנתונים נשמרים בדפדפן הזה.</p>
      </div>
    </section>`;
    document.body.appendChild(overlay);
    const get=id=>document.getElementById(id);
    function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(allocation));}catch(_){}}
    function setShare(index,value){
      const items=allocation.items;
      if(items.length===1){items[0].pct=100;return;}
      const target=Math.round(Math.max(0,Math.min(100,Number(value)||0))*10)/10;
      const other=items.reduce((sum,x,i)=>sum+(i===index?0:x.pct),0);
      const others=items.map((x,i)=>i).filter(i=>i!==index);
      let remaining=Math.round((100-target)*10)/10;
      items[index].pct=target;
      others.forEach((i,k)=>{const pct=k===others.length-1?remaining:Math.min(remaining,Math.round((other?items[i].pct/other:1/others.length)*(100-target)*10)/10);items[i].pct=pct;remaining=Math.round((remaining-pct)*10)/10;});
    }
    function amounts(){
      const cents=Math.round(allocation.amount*100);
      let left=cents;
      return allocation.items.map((item,i)=>{
        const part=i===allocation.items.length-1?left:Math.min(left,Math.round(cents*item.pct/100));
        left-=part;return part/100;
      });
    }
    function render(){
      page=Math.max(0,Math.min(page,Math.ceil(allocation.items.length/PAGE_SIZE)-1));
      get('allocationAmount').value=allocation.amount;
      get('allocationPeriod').value=allocation.period;
      const values=amounts();
      get('allocationAssigned').textContent=money.format(values.reduce((a,v)=>a+v,0));
      get('allocationTotal').textContent=allocation.period==='monthly'?'בכל חודש':'בהפקדה חד־פעמית';
      get('allocationCount').textContent=allocation.items.length+' אפיקים · 100%';
      const bar=get('allocationBar');bar.replaceChildren();
      allocation.items.forEach((item,i)=>{
        const piece=document.createElement('span');piece.style.width=item.pct+'%';piece.style.background=colors[i%colors.length];piece.title=(item.name||'אפיק '+(i+1))+': '+item.pct+'%';bar.append(piece);
      });
      const list=get('allocationList');list.replaceChildren();
      allocation.items.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).forEach((item,offset)=>{
        const i=page*PAGE_SIZE+offset;
        const row=document.createElement('div');row.className='allocation-row';
        const head=document.createElement('div');head.className='allocation-row-head';
        const dot=document.createElement('i');dot.className='allocation-dot';dot.style.background=colors[i%colors.length];
        const name=document.createElement('input');name.className='allocation-name';name.type='text';name.maxLength=60;name.value=item.name;name.setAttribute('aria-label','שם אפיק '+(i+1));
        name.addEventListener('input',()=>{item.name=name.value;persist();bar.children[i].title=item.name+': '+item.pct+'%';});
        const amount=document.createElement('strong');amount.className='allocation-value';amount.textContent=money.format(values[i]);
        const del=document.createElement('button');del.type='button';del.className='allocation-delete';del.textContent='×';del.title='מחק אפיק';del.setAttribute('aria-label','מחק אפיק '+(i+1));
        del.disabled=allocation.items.length===1;
        del.addEventListener('click',()=>{
          if(allocation.items.length<2)return;
          allocation.items.splice(i,1);allocation=normalize(allocation);persist();render();
        });
        head.append(dot,name,amount,del);
        const bottom=document.createElement('div');bottom.className='allocation-row-bottom';
        const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=item.pct;slider.disabled=allocation.items.length===1;slider.setAttribute('aria-label','אחוז '+(item.name||'אפיק '+(i+1)));
        const percentage=document.createElement('input');percentage.type='number';percentage.inputMode='decimal';percentage.min='0';percentage.max='100';percentage.step='0.1';percentage.value=item.pct;percentage.className='allocation-percent';percentage.setAttribute('aria-label','אחוז מוקצה לאפיק '+(i+1));percentage.disabled=allocation.items.length===1;
        const onChange=value=>{setShare(i,value);persist();render();};
        slider.addEventListener('change',()=>onChange(slider.value));percentage.addEventListener('change',()=>onChange(percentage.value));
        bottom.append(slider,percentage,document.createTextNode('%'));
        row.append(head,bottom);list.append(row);
      });
      const count=Math.ceil(allocation.items.length/PAGE_SIZE);
      get('allocationPager').hidden=count<=1;get('allocationPage').textContent=(page+1)+' / '+count;
      get('allocationPrev').disabled=page===0;get('allocationNext').disabled=page===count-1;
      get('allocationAdd').disabled=allocation.items.length>=MAX;
    }
    function close(){overlay.hidden=true;document.body.classList.remove('schedule-open');opener?.focus?.();}
    button.addEventListener('click',()=>{
      document.querySelectorAll('.tool-overlay:not([hidden])').forEach(el=>{el.hidden=true;});
      opener=document.activeElement;overlay.hidden=false;document.body.classList.add('schedule-open');render();get('allocationClose').focus();
    });
    get('allocationClose').addEventListener('click',close);
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){e.preventDefault();e.stopImmediatePropagation();close();}},{capture:true});
    get('allocationAmount').addEventListener('change',e=>{
      const n=Number(e.target.value);
      allocation.amount=Number.isFinite(n)?Math.max(0,Math.min(100000000,n)):0;
      persist();render();
    });
    get('allocationPeriod').addEventListener('change',e=>{allocation.period=e.target.value==='once'?'once':'monthly';persist();render();});
    get('allocationAdd').addEventListener('click',()=>{
      if(allocation.items.length>=MAX)return;
      const n=allocation.items.length;
      allocation.items.push({id:n+1,name:'אפיק '+(n+1),pct:0});
      page=Math.floor(n/PAGE_SIZE);persist();render();
      get('allocationList').querySelector('.allocation-row:last-child .allocation-name')?.focus();
    });
    get('allocationReset').addEventListener('click',()=>{if(!window.confirm('לאפס את כל האפיקים והחלוקה?'))return;allocation=defaults();page=0;persist();render();});
    get('allocationPrev').addEventListener('click',()=>{page--;render();});
    get('allocationNext').addEventListener('click',()=>{page++;render();});
  })();
