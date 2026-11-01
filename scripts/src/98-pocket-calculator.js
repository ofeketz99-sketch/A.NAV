  // Lightweight arithmetic parser, no eval or arbitrary code execution.
  const calcDisplay=q('calcDisplay'),calcBox=q('quickCalc');
  const calcDock=q('calcDock'),calcToggle=q('quickCalcToggle');
  function openCalc(open){
    if(open && notesCollapsed)setNotesCollapsed(false);
    calcDock.classList.toggle('is-open',open);
    calcToggle.setAttribute('aria-expanded',String(open));
    calcToggle.setAttribute('aria-label',open?'סגירת מחשבון כיס':'פתיחת מחשבון כיס');
    calcBox.inert=!open;
    calcBox.setAttribute('aria-hidden',String(!open));
    // Preserve the scroll position on mobile; the accordion opens in place.
  }
  calcToggle.addEventListener('click',()=>openCalc(!calcDock.classList.contains('is-open')));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&calcDock.classList.contains('is-open')){openCalc(false);calcToggle.focus();}});
  function evalMath(expression){
    const input=expression.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!/^[0-9+*/().-]{1,120}$/.test(input))throw new Error('ביטוי לא תקין');
    let pos=0;
    function num(){let start=pos;while(/[0-9.]/.test(input[pos]||''))pos++;if(start===pos)throw Error();const n=Number(input.slice(start,pos));if(!Number.isFinite(n))throw Error();return n;}
    function primary(){if(input[pos]==='+'){pos++;return primary();}if(input[pos]==='-'){pos++;return -primary();}if(input[pos]==='('){pos++;const v=expr();if(input[pos++]!==')')throw Error();return v;}return num();}
    function term(){let v=primary();while(input[pos]==='*'||input[pos]==='/'){const op=input[pos++],r=primary();v=op==='*'?v*r:v/r;if(!Number.isFinite(v))throw Error();}return v;}
    function expr(){let v=term();while(input[pos]==='+'||input[pos]==='-'){const op=input[pos++],r=term();v=op==='+'?v+r:v-r;}return v;}
    const result=expr();if(pos!==input.length||!Number.isFinite(result))throw Error();return result;
  }
  function calcEquals(){try{const n=evalMath(calcDisplay.value);calcDisplay.value=String(Number(n.toPrecision(12)));q('calcError').textContent='';}catch(e){q('calcError').textContent='תרגיל לא תקין';}}
  q('calcKeys').addEventListener('click',e=>{const key=e.target.closest('[data-calc]')?.dataset.calc;if(!key)return;
    if(key==='C')calcDisplay.value='';else if(key==='back')calcDisplay.value=calcDisplay.value.slice(0,-1);else if(key==='=')calcEquals();else calcDisplay.value+=key;
    calcDisplay.focus();
  });
  calcDisplay.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calcEquals();}});
