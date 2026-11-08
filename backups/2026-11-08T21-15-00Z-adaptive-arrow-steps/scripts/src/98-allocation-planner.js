
  // Each destination stores its own monthly amount. Changes flow only to the budget.
  (() => {
    const STORAGE='anav.allocation.planner.v1',MAX=24,PAGE=4,LIMIT=configs.budget.fields.find(f=>f[0]==='savings')[3];
    const colors=['#387d82','#a78e6e','#7289a5','#b57868','#7b8671','#9b7aa0','#c29c57'];
    const currency=new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:2});
    const clean=n=>Math.round(Math.max(0,Math.min(LIMIT,Number(n)||0))*100)/100;
    const defaults=()=>({version:2,items:[]});
    function normalize(raw){
      if(!raw||typeof raw!=='object')return defaults();
      const rows=Array.isArray(raw.items)?raw.items.slice(0,MAX):[];
      let amounts;
      if(raw.version===2)amounts=rows.map(x=>clean(x?.amount));
      else{
        const weights=rows.map(x=>Math.max(0,Number(x?.pct)||0));
        const sum=weights.reduce((a,b)=>a+b,0);
        const total=Math.round(clean(raw.linkedToBudget?states.budget.savings:raw.amount)*100);
        let left=total;
        amounts=rows.map((x,i)=>{const cents=i===rows.length-1?left:Math.min(left,Math.round(total*(sum?weights[i]/sum:1/rows.length)));left-=cents;return cents/100;});
      }
      let left=LIMIT;
      const items=rows.map((x,i)=>{
        const amount=Math.min(left,amounts[i]);left=Math.round((left-amount)*100)/100;
        return {id:i+1,name:typeof x?.name==='string'?x.name.slice(0,60):'יעד '+(i+1),amount};
      });
      return {version:2,items};
    }
    let allocation;
    try{allocation=normalize(JSON.parse(localStorage.getItem(STORAGE)||'null'));}catch(_){allocation=defaults();}
    let page=0,opener=null;
    const get=id=>document.getElementById(id);
    const total=()=>Math.round(allocation.items.reduce((sum,item)=>sum+Math.round(item.amount*100),0))/100;
    const persist=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(allocation));}catch(_){}};
    const remaining=i=>Math.max(0,Math.round((LIMIT-total()+allocation.items[i].amount)*100)/100);
    function syncBudget(){if(active==='budget')changeValue('savings',total(),'allocation');}
    const overlay=document.createElement('div');overlay.id='allocationOverlay';overlay.className='tool-overlay allocation-overlay';overlay.hidden=true;
    overlay.innerHTML=`<section class="tool-dialog allocation-dialog" role="dialog" aria-modal="true" aria-labelledby="allocationTitle">
      <header class="tool-head"><div><h2 id="allocationTitle">פילוח החיסכון החודשי</h2><p>יעדי חיסכון אישיים בסכומים חודשיים</p></div><button type="button" class="tool-close" id="allocationClose" aria-label="סגירה">×</button></header>
      <div class="allocation-content">
        <div class="allocation-summary"><span>סה״כ מוקצה</span><strong id="allocationAssigned"></strong><small id="allocationBudgetNote" aria-live="polite"></small></div>
        <div class="allocation-bar" id="allocationBar" role="img" aria-label="פילוח יעדי חיסכון"></div>
        <div class="allocation-list-head"><strong>יעדי החיסכון</strong><small id="allocationCount"></small></div>
        <div class="allocation-list" id="allocationList"></div>
        <nav class="allocation-pager" id="allocationPager" aria-label="עמודי יעדים"><button type="button" id="allocationPrev">הקודם</button><span id="allocationPage"></span><button type="button" id="allocationNext">הבא</button></nav>
        <div class="allocation-actions"><button type="button" class="tool-primary" id="allocationAdd">+ הוסף יעד</button><button type="button" class="allocation-reset" id="allocationReset">נקה פילוח</button></div>
        <p class="tool-hint">שינוי סכום באחד היעדים מעדכן את החיסכון הראשי בתקציב. שינוי ידני של החיסכון הראשי לא משנה את היעדים.</p>
      </div>
    </section>`;
    document.body.appendChild(overlay);
    function summary(){
      const sum=total();
      get('allocationAssigned').textContent=currency.format(sum);
      const budget=states.budget.savings;
      get('allocationBudgetNote').textContent=Math.abs(budget-sum)<.005?'תואם לתקציב':'חיסכון ראשי: '+currency.format(budget)+' · הוגדר עצמאית';
      get('allocationCount').textContent=allocation.items.length+' יעדים';
      const bar=get('allocationBar');bar.replaceChildren();
      allocation.items.forEach((item,i)=>{
        if(!sum||!item.amount)return;
        const piece=document.createElement('span');piece.style.width=(100*item.amount/sum)+'%';piece.style.background=colors[i%colors.length];
        piece.title=(item.name||'יעד '+(i+1))+': '+currency.format(item.amount);bar.append(piece);
      });
    }
    function setAmount(i,n){
      const amount=Math.min(clean(n),remaining(i));
      allocation.items[i].amount=amount;
      persist();syncBudget();summary();
      return amount;
    }
    function render(){
      const pages=Math.max(1,Math.ceil(allocation.items.length/PAGE));
      page=Math.min(page,pages-1);summary();
      const list=get('allocationList');list.replaceChildren();
      if(!allocation.items.length){const empty=document.createElement('p');empty.className='allocation-empty';empty.textContent='לא הוגדרו יעדים. הוסף יעד והזן את סכום החיסכון החודשי שלו.';list.append(empty);}
      allocation.items.slice(page*PAGE,(page+1)*PAGE).forEach((item,offset)=>{
        const i=page*PAGE+offset;
        const row=document.createElement('div');row.className='allocation-row';
        const head=document.createElement('div');head.className='allocation-row-head';
        const dot=document.createElement('i');dot.className='allocation-dot';dot.style.background=colors[i%colors.length];
        const name=document.createElement('input');name.className='allocation-name';name.type='text';name.maxLength=60;name.value=item.name;name.setAttribute('aria-label','שם יעד '+(i+1));
        name.addEventListener('input',()=>{item.name=name.value;persist();summary();});
        const value=document.createElement('strong');value.className='allocation-value';value.textContent=currency.format(item.amount);
        const del=document.createElement('button');del.type='button';del.className='allocation-delete';del.textContent='×';del.title='מחק יעד';del.setAttribute('aria-label','מחק יעד '+(i+1));
        del.addEventListener('click',()=>{allocation.items.splice(i,1);persist();syncBudget();render();});
        head.append(dot,name,value,del);
        const bottom=document.createElement('div');bottom.className='allocation-row-bottom';
        const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max=String(remaining(i));slider.step='any';slider.value=String(item.amount);slider.setAttribute('aria-label','סכום חודשי עבור '+item.name);
        const amount=document.createElement('input');amount.type='number';amount.inputMode='decimal';amount.min='0';amount.max=String(remaining(i));amount.step='any';amount.value=String(item.amount);amount.className='allocation-amount-input';amount.setAttribute('aria-label','סכום בשקלים ליעד '+(i+1));
        slider.addEventListener('input',()=>{const n=Math.round(Number(slider.value)/10)*10;const saved=setAmount(i,n);amount.value=String(saved);value.textContent=currency.format(saved);});
        slider.addEventListener('change',render);
        amount.addEventListener('change',()=>{setAmount(i,amount.value);render();});
        amount.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();amount.blur();}});
        const unit=document.createElement('span');unit.textContent='₪';
        bottom.append(slider,amount,unit);row.append(head,bottom);list.append(row);
      });
      get('allocationPager').hidden=pages<=1;get('allocationPage').textContent=(page+1)+' / '+pages;
      get('allocationPrev').disabled=page===0;get('allocationNext').disabled=page===pages-1;
      get('allocationAdd').disabled=allocation.items.length>=MAX;
    }
    function close(){overlay.hidden=true;document.body.classList.remove('schedule-open');opener?.focus?.();}
    get('controlsBody').addEventListener('click',e=>{
      if(!e.target.closest('[data-open-allocation]')||active!=='budget')return;
      document.querySelectorAll('.tool-overlay:not([hidden])').forEach(el=>el.hidden=true);
      opener=document.activeElement;overlay.hidden=false;document.body.classList.add('schedule-open');render();get('allocationClose').focus();
    });
    get('allocationClose').addEventListener('click',close);
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){e.preventDefault();e.stopImmediatePropagation();close();}},{capture:true});
    get('allocationAdd').addEventListener('click',()=>{
      if(allocation.items.length>=MAX)return;
      const i=allocation.items.length;allocation.items.push({id:i+1,name:'יעד '+(i+1),amount:0});
      page=Math.floor(i/PAGE);persist();render();get('allocationList').querySelector('.allocation-row:last-child .allocation-name')?.focus();
    });
    get('allocationReset').addEventListener('click',()=>{
      if(!window.confirm('למחוק את כל יעדי החיסכון ולאפס את החיסכון הראשי לאפס?'))return;
      allocation=defaults();page=0;persist();syncBudget();render();
    });
    get('allocationPrev').addEventListener('click',()=>{page--;render();});
    get('allocationNext').addEventListener('click',()=>{page++;render();});
  })();
