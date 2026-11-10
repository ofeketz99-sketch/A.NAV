  // Original five accents are preserved exactly; ten extra tones share the same quiet palette.
  const accentBank=[
    // Ordered around the color wheel, from warm earth to green, blue, violet;
    // the achromatic charcoal is deliberately last. IDs remain stable for saved palettes.
    {id:'clay',name:'חמרה כהה',dark:'#744f4d',soft:'#ecddda'},
    {id:'terracotta',name:'טרקוטה',dark:'#935d47',soft:'#f2e3d9'},
    {id:'cognac',name:'קוניאק',dark:'#7a5136',soft:'#eee0d3'},
    {id:'sand',name:'חול עמוק',dark:'#806b58',soft:'#ece3d9'},
    {id:'bronze',name:'ענבר',dark:'#9b6623',soft:'#f1e3cc'},
    {id:'moss',name:'טחב',dark:'#626a42',soft:'#e9eadc'},
    {id:'olive',name:'ירוק עלה',dark:'#4f7a45',soft:'#dfead9'},
    {id:'forest',name:'יער',dark:'#3c6152',soft:'#e1ece5'},
    {id:'teal',name:'טורקיז מעושן',dark:'#396c68',soft:'#dfedeb'},
    {id:'ocean',name:'אוקיינוס',dark:'#2f6f7a',soft:'#d6eaed'},
    {id:'slate',name:'צפחה',dark:'#505e6f',soft:'#e2e7ec'},
    {id:'indigo',name:'אינדיגו',dark:'#3f4f8f',soft:'#dde3f4'},
    {id:'plum',name:'שזיף',dark:'#7d4a6b',soft:'#efdde8'},
    {id:'wine',name:'בורדו',dark:'#76495b',soft:'#efdee5'},
    {id:'charcoal',name:'פחם',dark:'#1f2528',soft:'#e6e0d6'}
  ];
  const legacyTabColors={mortgage:'charcoal',savings:'cognac',index:'olive',loan:'clay',budget:'ocean'};
  const defaultTabColors={mortgage:'indigo',savings:'bronze',index:'olive',loan:'plum',budget:'ocean'};
  const tabColors={...defaultTabColors};
  function applyTabAccent(){
    const tone=accentBank.find(x=>x.id===tabColors[active])||accentBank[0];
    app.style.setProperty('--accent',tone.dark);
    app.style.setProperty('--accent-soft',tone.soft);
    app.style.setProperty('--ambient',tone.dark);
    document.querySelectorAll('.tab').forEach(b=>{
      const t=accentBank.find(x=>x.id===tabColors[b.dataset.tab]);
      if(t){b.style.setProperty('--tab-accent',t.dark);b.style.setProperty('--tab-accent-soft',t.soft);}
    });
    const chip=q('paletteChip');if(chip)chip.style.background=tone.dark;
    const button=q('paletteToggle');if(button)button.title='צבע הלשונית: '+tone.name+' · לחץ להחלפה';
  }
  function renderPalette(){
    const current=accentBank.find(x=>x.id===tabColors[active]);
    q('paletteCurrent').textContent='לשונית: '+tabLabels[active]+' · צבע נוכחי: '+current.name;
    q('paletteGrid').innerHTML=accentBank.map(tone=>{
      const owner=defaultOrder.find(t=>tabColors[t]===tone.id);
      const selected=owner===active,blocked=!!owner&&!selected;
      const subtitle=selected?'נבחר ללשונית זו':blocked?'תפוס: '+tabLabels[owner]:'פנוי';
      const accessible=tone.name+', '+subtitle;
      return `<button type="button" class="palette-choice ${selected?'is-selected':''} ${blocked?'is-occupied':''}" data-color="${tone.id}" aria-label="${escapeHtml(accessible)}" aria-pressed="${selected}" title="${escapeHtml(accessible)}" ${blocked?'disabled':''}><i class="palette-dot" style="background:${tone.dark}" aria-hidden="true"></i><span class="palette-copy"><strong>${tone.name}</strong><small>${escapeHtml(subtitle)}</small></span><span class="palette-mark" aria-hidden="true">${selected?'✓':blocked?'●':''}</span></button>`;
    }).join('');
  }


