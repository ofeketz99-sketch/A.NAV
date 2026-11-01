  // Details close when another tool opens; focus retained for keyboard users.
  let lastToolOpener=null;
  const toolOverlays=['scenarioOverlay','advancedOverlay','paletteOverlay'];
  function openTool(name){toolOverlays.forEach(id=>{q(id).hidden=id!==name;});lastToolOpener=document.activeElement;
    if(name==='scenarioOverlay')renderScenarioList();if(name==='advancedOverlay')renderAdvanced();if(name==='paletteOverlay')renderPalette();
    document.body.classList.add('schedule-open');q(name).querySelector('.tool-close')?.focus();}
  function closeTool(){toolOverlays.forEach(id=>q(id).hidden=true);document.body.classList.remove('schedule-open');lastToolOpener?.focus?.();}
  q('paletteToggle').addEventListener('click',()=>openTool('paletteOverlay'));
  q('paletteGrid').addEventListener('click',e=>{
    const b=e.target.closest('button[data-color]');if(!b||b.disabled)return;
    const candidate=b.dataset.color,owned=defaultOrder.find(t=>tabColors[t]===candidate);
    if(owned&&owned!==active)return;
    tabColors[active]=candidate;applyTabAccent();renderPalette();renderResults();saveState();
    q('saveStatus').textContent='צבע הלשונית עודכן';
  });
  q('scenarioToggle').addEventListener('click',()=>openTool('scenarioOverlay'));
  q('advancedToggle').addEventListener('click',()=>openTool('advancedOverlay'));
  document.querySelectorAll('[data-close-tool]').forEach(b=>b.addEventListener('click',closeTool));
  toolOverlays.forEach(id=>q(id).addEventListener('pointerdown',e=>{if(e.target===q(id))closeTool();}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toolOverlays.some(id=>!q(id).hidden)){e.preventDefault();closeTool();}});
