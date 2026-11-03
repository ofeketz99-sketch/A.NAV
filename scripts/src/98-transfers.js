
  // Stage 7: explicit, one-time transfers. Never couple calculator values implicitly.
  function availableTransfers(tab){
    if(tab==='mortgage')return [{id:'mortgage-budget',to:'budget',field:'housing',label:'החזר ← תקציב',hint:'שכירות / משכנתא'}];
    if(tab==='budget')return [
      {id:'budget-savings',to:'savings',field:'monthly',label:'חיסכון ← תוכנית',hint:'הפקדה חודשית'},
      {id:'budget-index',to:'index',field:'monthly',label:'חיסכון ← השקעות',hint:'השקעה חודשית'}
    ];
    if(tab==='savings')return [{id:'savings-index',to:'index',field:'monthly',label:'הפקדה ← השקעות',hint:'השקעה חודשית'}];
    return [];
  }
  function transferValue(tab,route){
    if(tab==='mortgage'){
      const s=states.mortgage,r=schedule(Math.max(0,s.price-s.equity),s.rate,s.years,s.extra);
      return Math.round(r.payment+advanced.mortgage.insurance);
    }
    if(tab==='budget')return states.budget.savings;
    if(tab==='savings')return states.savings.monthly;
    return 0;
  }
  function updateTransferActions(){
    const holder=q('transferActions'),routes=availableTransfers(active);
    holder.hidden=!routes.length;
    if(!routes.length){holder.innerHTML='';return;}
    holder.innerHTML='<span class="transfer-prefix">העברת נתונים:</span>'+
      routes.map(route=>'<button type="button" class="transfer-button" data-transfer="'+route.id+'" title="העברה חד־פעמית">'+escapeHtml(route.label)+'</button>').join('');
  }
  q('transferActions').addEventListener('click',event=>{
    const button=event.target.closest('[data-transfer]');if(!button)return;
    const source=active,route=availableTransfers(source).find(x=>x.id===button.dataset.transfer);
    if(!route)return;
    const f=configs[route.to].fields.find(x=>x[0]===route.field);if(!f)return;
    const value=transferValue(source,route);
    if(!Number.isFinite(value)||value<f[2]||value>f[3]){
      alert('לא ניתן להעביר '+money(value)+' · הערך מחוץ לטווח הקלט של המחשבון המקבל. ניתן להזין ערך מתאים ידנית.');
      return;
    }
    if(goalPinned[route.to]?.includes(route.field)||
      (goalPlans[route.to]?.locked&&goalPlans[route.to].solve===route.field)){
      alert('המשתנה במחשבון המקבל נעול או מחושב אוטומטית. שחרר נעילה תחילה.');
      return;
    }
    const old=states[route.to][route.field],label=fieldLabels[route.to][route.field]||f[1];
    if(!confirm('להעביר '+money(value)+' מ־'+tabLabels[source]+' אל '+tabLabels[route.to]+'?'+
      '\nהשדה: '+label+'\nערך קודם: '+money(old)+
      '\nהעברה חד־פעמית.'))return;
    states[route.to][route.field]=value;
    if(goalPlans[route.to]?.locked){
      if(!goalManuals[route.to])goalManuals[route.to]=Object.fromEntries(goalSolveChoices.map(([id])=>[id,states[route.to][id]]));
      goalManuals[route.to][route.field]=value;
      goalSolver(route.to);
    }
    activate(route.to);
    q('saveStatus').textContent='הועבר '+money(value)+' אל '+tabLabels[route.to]+' · ניתן לבטל באמצעות ביטול פעולה';
  });
