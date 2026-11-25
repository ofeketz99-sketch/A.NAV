
  // Dashboards and the chart builder. Every chart is a saved configuration over ChartData datasets, so it
  // updates when the data changes. Storage: anav.dashboards.v1. Colours are inline so exported SVG/PNG keep them.
  (function(){
    const box=q('investBody-boards');
    if(!box||!InvestAPI||typeof ChartData==='undefined')return;
    const A=InvestAPI,F=A.fmt,C=ChartData,KEY='anav.dashboards.v1';
    const COLORS=['#2f6461','#c08a3e','#5b6fa8','#9a5b7a','#6b8f4e','#b4654a','#4f8a9a','#7d6b9e','#a08f4a','#5f7f6a'];
    const POS='#2e7a4f',NEG='#b24a3c',INK='#4f463c',GRID='#ece4d8',AXIS='#cfc3b3';
    const uid=()=>'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    // ---------- default board ----------
    const W=(title,cfg,size)=>({id:uid(),size:size||'m',cfg:{title,...cfg}});
    function defaultBoard(){
      return {id:'b-default',name:'סקירה',range:'all',widgets:[
        W('שווי אחזקות',{dataset:'holdings',metrics:[{field:'valueIls',agg:'sum'}],type:'kpi'},'s'),
        W('נטו בעסקאות סגורות ($)',{dataset:'trades',metrics:[{field:'netUSD',agg:'sum'}],type:'kpi'},'s'),
        W('תשואה ממוצעת לעסקה',{dataset:'trades',metrics:[{field:'returnPct',agg:'avg'}],filters:[{field:'status',value:'סגורה'}],type:'kpi'},'s'),
        W('שווי התיק לאורך זמן',{dataset:'daily',x:'date',grain:'week',metrics:[{field:'value',agg:'last'}],type:'area'},'l'),
        W('רווח נטו לפי חודש ($)',{dataset:'trades',x:'endDate',grain:'month',metrics:[{field:'netUSD',agg:'sum'}],type:'bar'},'m'),
        W('חלוקת התיק לפי סקטור',{dataset:'holdings',x:'sector',metrics:[{field:'valueIls',agg:'sum'}],type:'donut'},'m'),
        W('הפקדות ומשיכות לפי חודש',{dataset:'actions',x:'date',grain:'month',metrics:[{field:'depositsILS',agg:'sum'}],type:'bar'},'m'),
        W('עמלות מצטברות ($)',{dataset:'actions',x:'date',grain:'month',metrics:[{field:'feeUSD',agg:'cum'}],type:'line'},'m'),
        W('ימי החזקה מול תשואה',{dataset:'trades',metrics:[{field:'days',agg:'avg'},{field:'returnPct',agg:'avg'}],filters:[{field:'status',value:'סגורה'}],type:'scatter'},'m'),
        W('תוצאות לפי נייר ($)',{dataset:'trades',x:'symbol',metrics:[{field:'netUSD',agg:'sum'}],type:'bar'},'m')]};
    }
    let store=(()=>{try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.boards)&&s.boards.length)return s;}catch(_){}return {version:1,active:'b-default',boards:[defaultBoard()]};})();
    const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(store));}catch(_){A.toast('שמירת הלוחות נכשלה');}};
    const board=()=>store.boards.find(b=>b.id===store.active)||store.boards[0];
    let ds=null,dailyCache=null;
    function datasets(){if(!ds){dailyCache=A.daily();ds=C.build({pf:A.pf,calc:A.calc,daily:dailyCache,E:A.E});}return ds;}
    A.onRefresh(()=>{ds=null;if(!box.closest('[hidden]'))render();});
    window.addEventListener('anav:invest-view',e=>{if(e.detail?.view==='boards'&&e.detail?.area==='invest'){ds=null;render();}});
    // ---------- formatting by unit ----------
    const fmt=(v,unit)=>v===null||v===undefined||!Number.isFinite(v)?F.DASH:unit==='ILS'||unit==='USD'?F.money(Math.round(v),unit,{signed:false}):unit==='pct'?F.pct(v):unit==='days'?F.num(Math.round(v*10)/10):F.num(Math.round(v*100)/100);
    const plain=(v,unit)=>!Number.isFinite(v)?'—':unit==='ILS'||unit==='USD'?(v<0?'−':'')+(unit==='USD'?'$':'₪')+Math.abs(v/100).toLocaleString('en-US',{maximumFractionDigits:0}):unit==='pct'?v.toFixed(1)+'%':(Math.round(v*10)/10).toLocaleString('en-US');
    const short=(v,unit)=>unit==='ILS'||unit==='USD'?F.compact(v,unit):unit==='pct'?(v>=0?'':'−')+Math.abs(v).toFixed(Math.abs(v)<10?1:0)+'%':Math.abs(v)>=1e4?(v/1e3).toFixed(0)+'K':String(Math.round(v*10)/10);
    const xLabel=(x,grain)=>{if(!x)return '';if(grain==='month')return x.slice(5,7)+'/'+x.slice(2,4);if(grain==='year'||grain==='quarter')return x;if(/^\d{4}-\d{2}-\d{2}$/.test(x))return x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(2,4);return x;};
    const ids=p=>p.ids&&p.ids.length?' data-ids="'+F.esc(p.ids.join(','))+'"':'';
    const title=(t)=>'<title>'+F.esc(t)+'</title>';
    // ---------- renderers (SVG with inline colours) ----------
    function render1(cfg,w){
      const d=datasets(),r=C.compute(cfg,d,rangeOf());
      if(r.errors)return '<div class="inv-ch-err">'+r.errors.map(F.esc).join('<br>')+'</div>';
      const t=cfg.type;
      if(t==='kpi'){const s=r.series[0],v=s.points[0].y;return '<div class="inv-ch-kpi" data-ids="'+F.esc(s.points[0].ids.join(','))+'"><strong>'+fmt(v,s.unit)+'</strong><small>'+F.esc(s.name)+' · '+r.count+' רשומות</small></div>';}
      if(t==='table')return table(r);
      if(t==='donut')return donut(r,cfg);
      if(t==='scatter')return scatter(r,w);
      if(t==='heatmap')return heat(r);
      return axes(r,cfg,w);
    }
    function legend(r,cfg){if(cfg.legend===false||r.series.length<2)return '';return '<ul class="inv-ch-legend">'+r.series.map((s,i)=>'<li><i style="background:'+(COLORS[(i+(cfg.color||0))%COLORS.length])+'"></i>'+F.esc(s.name)+(s.axis===1?' (ציר ימני)':'')+'</li>').join('')+'</ul>';}
    function axes(r,cfg,w){
      const Wd=Math.max(280,w||520),H=220,L=58,R=r.units.length>1?58:12,T=10,B=26;
      const xs=r.xs,n=xs.length;if(!n)return '<p class="inv-none">אין נתונים בטווח.</p>';
      const stacked=cfg.type==='stacked',bar=cfg.type==='bar'||stacked;
      const range=ax=>{let lo=0,hi=0;
        if(stacked){xs.forEach((x,i)=>{let p=0,m=0;for(const s of r.series)if(s.axis===ax){const y=s.points[i].y||0;if(y>=0)p+=y;else m+=y;}hi=Math.max(hi,p);lo=Math.min(lo,m);});}
        else for(const s of r.series)if(s.axis===ax)for(const p of s.points)if(Number.isFinite(p.y)){hi=Math.max(hi,p.y);lo=Math.min(lo,p.y);}
        if(!bar&&r.series.some(s=>s.axis===ax&&s.points.some(p=>Number.isFinite(p.y)))){const ys=r.series.filter(s=>s.axis===ax).flatMap(s=>s.points.map(p=>p.y)).filter(Number.isFinite);lo=Math.min(...ys);hi=Math.max(...ys);const pad=(hi-lo)*0.06||Math.abs(hi)*0.05||1;lo-=pad;hi+=pad;}
        if(hi===lo)hi=lo+1;return [lo,hi];};
      const rg=[range(0),r.units.length>1?range(1):null];
      const Y=(v,ax)=>{const [lo,hi]=rg[ax||0];return T+(1-(v-lo)/(hi-lo))*(H-T-B);};
      const slot=(Wd-L-R)/n,X=i=>L+slot*(i+.5);
      let g='';
      for(let k=0;k<=3;k++){const v=rg[0][0]+(rg[0][1]-rg[0][0])*k/3,y=Y(v,0);g+='<line x1="'+L+'" x2="'+(Wd-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+GRID+'"/><text x="'+(L-6)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" font-size="10" fill="#8b7f71">'+short(v,r.units[0])+'</text>';
        if(rg[1]){const v2=rg[1][0]+(rg[1][1]-rg[1][0])*k/3;g+='<text x="'+(Wd-R+6)+'" y="'+(y+3).toFixed(1)+'" font-size="10" fill="#8b7f71">'+short(v2,r.units[1])+'</text>';}}
      if(bar&&rg[0][0]<0&&rg[0][1]>0)g+='<line x1="'+L+'" x2="'+(Wd-R)+'" y1="'+Y(0,0).toFixed(1)+'" y2="'+Y(0,0).toFixed(1)+'" stroke="'+AXIS+'"/>';
      const every=Math.max(1,Math.ceil(n/Math.floor((Wd-L-R)/56)));
      xs.forEach((x,i)=>{if(i%every===0||i===n-1)g+='<text x="'+X(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#8b7f71">'+F.esc(xLabel(x,r.grain))+'</text>';});
      const single=r.series.length===1&&!r.series[0].group;
      if(bar){
        const bs=r.series.filter(s=>s.axis===0||!stacked);const per=stacked?1:bs.length,bw=Math.max(2,Math.min(34,slot*0.72/per));
        xs.forEach((x,i)=>{let p=0,m=0;bs.forEach((s,j)=>{const pt=s.points[i],y=pt.y;if(!Number.isFinite(y))return;
          const col=single?(y>=0?POS:NEG):COLORS[(j+(cfg.color||0))%COLORS.length];
          let y0,y1;if(stacked){if(y>=0){y0=Y(p,0);y1=Y(p+y,0);p+=y;}else{y0=Y(m,0);y1=Y(m+y,0);m+=y;}}else{y0=Y(Math.max(rg[s.axis][0],0),s.axis);y1=Y(y,s.axis);}
          const xx=stacked?X(i)-bw/2:X(i)-bw*per/2+bw*j;
          g+='<rect x="'+xx.toFixed(1)+'" y="'+Math.min(y0,y1).toFixed(1)+'" width="'+(bw-1).toFixed(1)+'" height="'+Math.max(1,Math.abs(y1-y0)).toFixed(1)+'" rx="2" fill="'+col+'" class="inv-ch-hit"'+ids(pt)+'>'+title(xLabel(x,r.grain)+' · '+s.name+': '+plain(y,s.unit))+'</rect>';});});
      }else{
        r.series.forEach((s,j)=>{const col=COLORS[(j+(cfg.color||0))%COLORS.length];let path='',pen=false,area='';
          s.points.forEach((pt,i)=>{if(!Number.isFinite(pt.y)){pen=false;return;}path+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(pt.y,s.axis).toFixed(1)+' ';pen=true;});
          if(cfg.type==='area'){const first=s.points.findIndex(p=>Number.isFinite(p.y)),last=s.points.length-1-[...s.points].reverse().findIndex(p=>Number.isFinite(p.y));
            if(first>=0)area='<path d="'+path+'L'+X(last).toFixed(1)+' '+(H-B)+' L'+X(first).toFixed(1)+' '+(H-B)+' Z" fill="'+col+'" fill-opacity=".14"/>';}
          g+=area+'<path d="'+path+'" fill="none" stroke="'+col+'" stroke-width="2.2" stroke-linejoin="round"'+(s.axis===1?' stroke-dasharray="6 4"':'')+'/>';
          s.points.forEach((pt,i)=>{if(Number.isFinite(pt.y)&&(n<=60||cfg.labels))g+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(pt.y,s.axis).toFixed(1)+'" r="'+(n>60?1.5:3)+'" fill="'+col+'" class="inv-ch-hit"'+ids(pt)+'>'+title(xLabel(xs[i],r.grain)+' · '+s.name+': '+plain(pt.y,s.unit))+'</circle>';});});
      }
      if(cfg.labels&&n<=24)r.series.forEach((s,j)=>s.points.forEach((pt,i)=>{if(Number.isFinite(pt.y))g+='<text x="'+X(i).toFixed(1)+'" y="'+(Y(pt.y,s.axis)-5).toFixed(1)+'" text-anchor="middle" font-size="9.5" fill="'+INK+'">'+short(pt.y,s.unit)+'</text>';}));
      return '<svg viewBox="0 0 '+Wd+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="Heebo, Arial, sans-serif" role="img" dir="ltr">'+g+'</svg>'+legend(r,cfg)+unitNote(r);
    }
    const unitNote=r=>'<small class="inv-ch-units">יחידות: '+r.units.map(u=>C.UNIT[u]?.label||u).join(' · ')+(r.units.length>1?' (ימין: '+(C.UNIT[r.units[1]]?.label||'')+')':'')+'</small>';
    function donut(r,cfg){
      const s=r.series[0],pts=s.points.filter(p=>p.y>0),tot=pts.reduce((a,p)=>a+p.y,0);
      if(!tot)return '<p class="inv-none">אין ערכים חיוביים לחלוקה.</p>';
      let a=-Math.PI/2,g='';const R1=64,r1=40,c=72;const pt=(rad,ang)=>(c+rad*Math.cos(ang)).toFixed(2)+' '+(c+rad*Math.sin(ang)).toFixed(2);
      const items=pts.map((p,i)=>{const fr=p.y/tot,a2=a+fr*Math.PI*2,lg=fr>.5?1:0,col=COLORS[(i+(cfg.color||0))%COLORS.length];
        const d=fr>.9999?'M'+pt(R1,0)+'A'+R1+' '+R1+' 0 1 1 '+pt(R1,Math.PI)+'A'+R1+' '+R1+' 0 1 1 '+pt(R1,0)+'M'+pt(r1,0)+'A'+r1+' '+r1+' 0 1 0 '+pt(r1,Math.PI)+'A'+r1+' '+r1+' 0 1 0 '+pt(r1,0)+'Z':'M'+pt(R1,a)+'A'+R1+' '+R1+' 0 '+lg+' 1 '+pt(R1,a2)+'L'+pt(r1,a2)+'A'+r1+' '+r1+' 0 '+lg+' 0 '+pt(r1,a)+'Z';
        a=a2;g+='<path d="'+d+'" fill="'+col+'" fill-rule="evenodd" class="inv-ch-hit"'+ids(p)+'>'+title(p.x+': '+plain(p.y,s.unit)+' · '+(fr*100).toFixed(1)+'%')+'</path>';return {p,fr,col};});
      return '<div class="inv-donut-row"><svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg" role="img" style="width:136px;flex:none">'+g+'</svg><ul class="inv-legend">'+items.map(x=>'<li class="inv-ch-hit"'+ids(x.p)+'><i style="background:'+x.col+'"></i><bdi>'+F.esc(x.p.x)+'</bdi><b>'+(x.fr*100).toFixed(1)+'%</b></li>').join('')+'</ul></div>'+unitNote({units:[s.unit]});
    }
    function scatter(r,w){
      const Wd=Math.max(280,w||520),H=230,L=56,R=12,T=10,B=30,P=r.points;if(!P.length)return '<p class="inv-none">אין נקודות.</p>';
      const xr=[Math.min(...P.map(p=>p.x)),Math.max(...P.map(p=>p.x))],yr=[Math.min(0,...P.map(p=>p.y)),Math.max(0,...P.map(p=>p.y))];
      if(xr[0]===xr[1])xr[1]++;if(yr[0]===yr[1])yr[1]++;
      const X=v=>L+(v-xr[0])/(xr[1]-xr[0])*(Wd-L-R),Y=v=>T+(1-(v-yr[0])/(yr[1]-yr[0]))*(H-T-B);
      let g='<line x1="'+L+'" x2="'+(Wd-R)+'" y1="'+Y(0).toFixed(1)+'" y2="'+Y(0).toFixed(1)+'" stroke="'+AXIS+'"/>';
      for(let k=0;k<=3;k++){const v=yr[0]+(yr[1]-yr[0])*k/3;g+='<text x="'+(L-6)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end" font-size="10" fill="#8b7f71">'+short(v,r.yMetric.f.unit)+'</text>';const xv=xr[0]+(xr[1]-xr[0])*k/3;g+='<text x="'+X(xv).toFixed(1)+'" y="'+(H-12)+'" text-anchor="middle" font-size="10" fill="#8b7f71">'+short(xv,r.xMetric.f.unit)+'</text>';}
      for(const p of P)g+='<circle cx="'+X(p.x).toFixed(1)+'" cy="'+Y(p.y).toFixed(1)+'" r="4" fill="'+(p.y>=0?POS:NEG)+'" fill-opacity=".75" class="inv-ch-hit"'+ids(p)+'>'+title(p.label+': '+plain(p.x,r.xMetric.f.unit)+' · '+plain(p.y,r.yMetric.f.unit))+'</circle>';
      return '<svg viewBox="0 0 '+Wd+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="Heebo, Arial, sans-serif" role="img" dir="ltr">'+g+'<text x="'+(Wd-R)+'" y="'+(H-1)+'" text-anchor="end" font-size="10" fill="'+INK+'">'+F.esc(r.xMetric.f.label)+' →</text></svg><small class="inv-ch-units">ציר אופקי: '+F.esc(r.xMetric.f.label)+' · ציר אנכי: '+F.esc(r.yMetric.f.label)+'</small>';
    }
    function heat(r){
      const s=r.series,vals=s.flatMap(x=>x.points.map(p=>p.y)).filter(Number.isFinite),mx=Math.max(1e-9,...vals.map(Math.abs));
      const cell=v=>{if(!Number.isFinite(v))return '#f4efe8';const a=Math.min(1,Math.abs(v)/mx);return v>=0?'rgba(46,122,79,'+(0.12+a*0.75).toFixed(2)+')':'rgba(178,74,60,'+(0.12+a*0.75).toFixed(2)+')';};
      return '<div class="inv-table-wrap"><table class="inv-table inv-heat"><thead><tr><th></th>'+r.xs.map(x=>'<th>'+F.esc(xLabel(x,r.grain))+'</th>').join('')+'</tr></thead><tbody>'+
        s.map(row=>'<tr><td>'+F.esc(row.group||row.name)+'</td>'+row.points.map(p=>'<td class="inv-ch-hit" style="background:'+cell(p.y)+'"'+ids(p)+' title="'+F.esc(plain(p.y,row.unit))+'">'+(Number.isFinite(p.y)?short(p.y,row.unit):'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    }
    function table(r){
      if(r.kind==='single')return '<div class="inv-table-wrap"><table class="inv-table"><tbody>'+r.series.map(s=>'<tr><td>'+F.esc(s.name)+'</td><td>'+fmt(s.points[0].y,s.unit)+'</td></tr>').join('')+'</tbody></table></div>';
      if(r.kind==='scatter')return '<p class="inv-none">טבלה לא זמינה לפיזור.</p>';
      return '<div class="inv-table-wrap"><table class="inv-table"><thead><tr><th></th>'+r.series.map(s=>'<th>'+F.esc(s.name||'ערך')+'</th>').join('')+'</tr></thead><tbody>'+
        r.xs.map((x,i)=>'<tr><td>'+F.esc(xLabel(x,r.grain))+'</td>'+r.series.map(s=>'<td class="inv-ch-hit"'+ids(s.points[i])+'>'+fmt(s.points[i].y,s.unit)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    }
    // ---------- shared period filter ----------
    function rangeOf(){const b=board(),t=A.E.todayIso(),days={'1m':30,'3m':91,'6m':182,'1y':365}[b.range];return days?{from:new Date(Date.parse(t+'T00:00:00Z')-days*864e5).toISOString().slice(0,10),to:t}:{};}
    // ---------- board view ----------
    function render(){
      const b=board(),RANGES=[['1m','חודש'],['3m','3 חודשים'],['6m','חצי שנה'],['1y','שנה'],['all','הכול']];
      let h='<div class="inv-toolbar inv-boards-bar"><label class="inv-board-pick"><span class="inv-sr">לוח</span><select data-bd="pick">'+store.boards.map(x=>'<option value="'+x.id+'"'+(x.id===b.id?' selected':'')+'>'+F.esc(x.name)+'</option>').join('')+'</select></label>'+
        '<button type="button" class="invest-btn" data-bd="new">לוח חדש</button><button type="button" class="invest-btn" data-bd="rename">שינוי שם</button>'+(store.boards.length>1?'<button type="button" class="invest-btn" data-bd="delete-board">מחיקת לוח</button>':'')+
        '<div class="inv-chips" role="group" aria-label="תקופה לכל הלוח">'+RANGES.map(([k,l])=>'<button type="button" class="inv-chip" data-bd="range" data-val="'+k+'" aria-pressed="'+(b.range===k)+'">'+l+'</button>').join('')+'</div>'+
        '<button type="button" class="invest-btn invest-primary" data-bd="add">+ גרף</button></div>';
      if(!A.pf.transactions.length){box.innerHTML=h+F.empty(A.ICON.line,'אין עדיין נתונים לגרפים','הגרפים נבנים מהפעולות, מהאחזקות ומהביצועים. אחרי רישום או ייבוא הם יתמלאו לבד.');return;}
      h+='<div class="inv-board">'+b.widgets.map((w,i)=>widget(w,i,b.widgets.length)).join('')+'</div>';
      h+='<p class="inv-foot">כל גרף שמור מתעדכן כשהנתונים משתנים. לחיצה על עמודה, נקודה או פרוסה מציגה את הרשומות שמאחוריה. התקופה למעלה חלה על כל הגרפים שיש להם תאריך. ייצוא SVG/PNG שומר תמונת מצב עם תאריך.</p>';
      box.innerHTML=h;
      // Draw each chart at the real width of its card, so text keeps its size.
      for(const w of b.widgets){const el=box.querySelector('[data-w="'+w.id+'"] .inv-w-body');if(el)el.innerHTML=render1(w.cfg,Math.max(260,el.clientWidth-4));}
    }
    function widget(w,i,n){
      return '<section class="inv-widget inv-w-'+w.size+'" data-w="'+w.id+'"><header><h3>'+F.esc(w.cfg.title||'גרף')+'</h3><div class="inv-w-tools">'+
        '<button type="button" data-bd="move" data-dir="-1" title="הזזה אחורה"'+(i===0?' disabled':'')+'>→</button><button type="button" data-bd="move" data-dir="1" title="הזזה קדימה"'+(i===n-1?' disabled':'')+'>←</button>'+
        '<button type="button" data-bd="size" title="שינוי גודל">'+({s:'S',m:'M',l:'L'}[w.size])+'</button><button type="button" data-bd="edit">עריכה</button>'+
        '<button type="button" data-bd="svg" title="ייצוא SVG">SVG</button><button type="button" data-bd="png" title="ייצוא PNG">PNG</button><button type="button" data-bd="remove" title="הסרה מהלוח">×</button></div></header>'+
        '<div class="inv-w-body"></div></section>';
    }
    // ---------- drill-down ----------
    function drill(cfg,idList){
      const d=datasets()[cfg.dataset];if(!d)return;
      const set=new Set(idList),rows=d.rows.filter(r=>set.has(String(r.id)));
      const cols=Object.entries(d.fields).slice(0,8);
      const body='<div class="inv-table-wrap"><table class="inv-table"><thead><tr>'+cols.map(([,f])=>'<th>'+F.esc(f.label)+'</th>').join('')+'</tr></thead><tbody>'+
        rows.map(r=>'<tr'+(cfg.dataset==='trades'?' class="inv-trade" data-open-trade="'+r.id+'"':'')+'>'+cols.map(([k,f])=>'<td>'+(f.type==='num'?fmt(r[k],f.unit):f.type==='date'?F.date(r[k]):F.esc(r[k]??'—'))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
        (cfg.dataset==='trades'?'<p class="inv-foot">לחיצה על עסקה פותחת את הניתוח שלה.</p>':'');
      openDialog('הרשומות שמאחורי הנקודה ('+rows.length+')',body,null);
    }
    // ---------- dialog (builder and drill-down share it) ----------
    document.body.insertAdjacentHTML('beforeend','<div class="tool-overlay inv-overlay" id="invChOverlay" hidden><section class="tool-dialog inv-dialog inv-builder" role="dialog" aria-modal="true" aria-labelledby="invChTitle">'+
      '<header class="tool-head"><div><h2 id="invChTitle"></h2></div><button type="button" class="tool-close" data-ch-close aria-label="סגירה">×</button></header><div class="tool-content" id="invChBody"></div></section></div>');
    const ov=q('invChOverlay');let opener=null,editing=null,draft=null;
    function openDialog(t,html,onOpen){opener=document.activeElement;q('invChTitle').textContent=t;q('invChBody').innerHTML=html;ov.hidden=false;document.body.classList.add('schedule-open');onOpen&&onOpen();}
    function closeDialog(){ov.hidden=true;document.body.classList.remove('schedule-open');editing=null;draft=null;opener?.focus?.();}
    ov.addEventListener('click',e=>{
      if(e.target.closest('[data-ch-close]')){closeDialog();return;}
      const tr=e.target.closest('[data-open-trade]');if(tr){const id=tr.dataset.openTrade;closeDialog();A.openTrade(id);return;}
      const ty=e.target.closest('[data-ch-type]');if(ty&&!ty.disabled){draft.type=ty.dataset.chType;builder();return;}
      if(e.target.closest('[data-ch-suggest]')){draft.type=C.suggest(draft,datasets());builder();return;}
      if(e.target.closest('[data-ch-save]'))saveDraft();
    });
    ov.addEventListener('pointerdown',e=>{if(e.target===ov)closeDialog();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden){e.preventDefault();closeDialog();}});
    // ---------- builder ----------
    function openBuilder(w){
      editing=w?w.id:null;
      draft=w?JSON.parse(JSON.stringify({...w.cfg,size:w.size})):{title:'',dataset:'trades',x:'endDate',grain:'month',group:'',metrics:[{field:'netUSD',agg:'sum'}],type:'bar',filters:[],legend:true,labels:false,color:0,size:'m'};
      openDialog(w?'עריכת גרף':'גרף חדש','',()=>builder());
    }
    function opt(v,l,sel){return '<option value="'+F.esc(v)+'"'+(String(sel)===String(v)?' selected':'')+'>'+F.esc(l)+'</option>';}
    function builder(){
      const D=datasets(),d=D[draft.dataset],fl=Object.entries(d.fields);
      const nums=fl.filter(([,f])=>f.type==='num'),cats=fl.filter(([,f])=>f.type==='cat'),xsel=fl.filter(([,f])=>f.type!=='num');
      if(draft.x&&!d.fields[draft.x])draft.x='';if(draft.group&&!d.fields[draft.group])draft.group='';
      draft.metrics=draft.metrics.filter(m=>m.agg==='count'||d.fields[m.field]);if(!draft.metrics.length)draft.metrics=[{field:nums[0]?.[0]||'',agg:nums[0]?C.aggsFor(nums[0][1])[0]:'count'}];
      for(const m of draft.metrics)if(m.agg!=='count'&&!C.aggsFor(d.fields[m.field]).includes(m.agg))m.agg=C.aggsFor(d.fields[m.field])[0];
      const chk=C.check({...draft,type:null},D);
      if(!chk.types.includes(draft.type))draft.type=C.suggest(draft,D);
      const xf=draft.x?d.fields[draft.x]:null;
      const metricRow=(m,i)=>'<div class="inv-ch-metric"><select data-ch="mfield" data-i="'+i+'" aria-label="מדד '+(i+1)+'">'+opt('__count','ספירת רשומות',m.agg==='count'?'__count':m.field)+nums.map(([k,f])=>opt(k,f.label,m.agg==='count'?'':m.field)).join('')+'</select>'+
        (m.agg==='count'?'':'<select data-ch="magg" data-i="'+i+'" aria-label="עיבוד">'+C.aggsFor(d.fields[m.field]).map(a=>opt(a,C.AGGS[a],m.agg)).join('')+'</select>')+
        (i>0?'<button type="button" class="inv-mini" data-ch="mdel" data-i="'+i+'">הסרה</button>':'')+'</div>';
      const fvals=draft.filters[0]?.field?[...new Set(d.rows.map(r=>r[draft.filters[0].field]).filter(v=>v!==null&&v!==undefined))].sort():[];
      const preview=render1({...draft},Math.min(640,(q('invChBody').clientWidth||640)-40));
      let h='<div class="inv-ch-grid">'+
        '<label class="inv-field"><span>1 · מקור נתונים</span><select data-ch="dataset">'+Object.entries(D).map(([k,v])=>opt(k,v.label+' ('+v.rows.length+')',draft.dataset)).join('')+'</select></label>'+
        '<label class="inv-field"><span>2 · ציר X</span><select data-ch="x">'+opt('','ללא ציר (כרטיס מדד / פיזור)',draft.x)+xsel.map(([k,f])=>opt(k,f.label,draft.x)).join('')+'</select></label>'+
        (xf?.type==='date'?'<label class="inv-field"><span>רזולוציה</span><select data-ch="grain">'+Object.entries(C.GRAINS).map(([k,l])=>opt(k,l,draft.grain)).join('')+'</select></label>':'')+
        '<label class="inv-field"><span>3 · חלוקה לקבוצות</span><select data-ch="group">'+opt('','ללא',draft.group)+cats.filter(([k])=>k!==draft.x).map(([k,f])=>opt(k,f.label,draft.group)).join('')+'</select></label>'+
        '<div class="inv-field inv-wide"><span>4 · מדדים ועיבוד</span>'+draft.metrics.map(metricRow).join('')+(draft.metrics.length<2?'<button type="button" class="inv-mini" data-ch="madd">+ מדד שני</button>':'')+'</div>'+
        '<label class="inv-field"><span>5 · סינון</span><select data-ch="ffield">'+opt('','ללא',draft.filters[0]?.field||'')+cats.map(([k,f])=>opt(k,f.label,draft.filters[0]?.field||'')).join('')+'</select></label>'+
        (draft.filters[0]?.field?'<label class="inv-field"><span>ערך</span><select data-ch="fvalue">'+opt('','—',draft.filters[0].value||'')+fvals.map(v=>opt(v,v,draft.filters[0].value)).join('')+'</select></label>':'')+
        '<div class="inv-field inv-wide"><span>6 · סוג גרף</span><div class="inv-ch-types">'+Object.entries(C.TYPES).map(([k,l])=>'<button type="button" data-ch-type="'+k+'" aria-pressed="'+(draft.type===k)+'"'+(chk.types.includes(k)?'':' disabled title="'+F.esc(chk.why[k]||'')+'"')+'>'+l+'</button>').join('')+
        '<button type="button" class="inv-mini" data-ch-suggest>הצעה מתאימה</button></div></div>'+
        '<label class="inv-field inv-wide"><span>7 · כותרת</span><input type="text" data-ch="title" maxlength="60" value="'+F.esc(draft.title||'')+'" placeholder="לדוגמה: רווח נטו לפי חודש"></label>'+
        '<label class="inv-field"><span>צבע</span><select data-ch="color">'+COLORS.map((c,i)=>opt(i,['טורקיז','זהב','כחול','שזיף','ירוק','חמרה','ים','סגול','חרדל','זית'][i],draft.color)).join('')+'</select></label>'+
        '<label class="inv-field"><span>גודל בלוח</span><select data-ch="size">'+opt('s','קטן',draft.size)+opt('m','בינוני',draft.size)+opt('l','רוחב מלא',draft.size)+'</select></label>'+
        '<label class="inv-check"><input type="checkbox" data-ch="legend"'+(draft.legend!==false?' checked':'')+'><span>מקרא</span></label>'+
        '<label class="inv-check"><input type="checkbox" data-ch="labels"'+(draft.labels?' checked':'')+'><span>תוויות ערכים</span></label>'+
        '</div><div class="inv-ch-preview"><h3>תצוגה מקדימה</h3>'+preview+'</div>'+
        '<div class="inv-form-actions"><button type="button" class="tool-primary" data-ch-save>'+(editing?'עדכון הגרף':'הוספה ללוח')+'</button><button type="button" class="inv-ghost" data-ch-close>ביטול</button></div>';
      q('invChBody').innerHTML=h;
    }
    ov.addEventListener('change',e=>{
      const el=e.target,k=el.dataset.ch;if(!k||!draft)return;const i=+el.dataset.i;
      if(k==='dataset'){draft.dataset=el.value;const d=datasets()[el.value],f=Object.entries(d.fields);draft.x=(f.find(([,x])=>x.type==='date')||[''])[0];draft.group='';draft.filters=[];const nm=f.find(([,x])=>x.type==='num');draft.metrics=[nm?{field:nm[0],agg:C.aggsFor(nm[1])[0]}:{agg:'count'}];}
      else if(k==='x')draft.x=el.value;
      else if(k==='grain')draft.grain=el.value;
      else if(k==='group')draft.group=el.value;
      else if(k==='mfield'){draft.metrics[i]=el.value==='__count'?{agg:'count'}:{field:el.value,agg:C.aggsFor(datasets()[draft.dataset].fields[el.value])[0]};}
      else if(k==='magg')draft.metrics[i].agg=el.value;
      else if(k==='ffield')draft.filters=el.value?[{field:el.value,value:''}]:[];
      else if(k==='fvalue')draft.filters[0].value=el.value;
      else if(k==='color')draft.color=+el.value;
      else if(k==='size')draft.size=el.value;
      else if(k==='legend')draft.legend=el.checked;
      else if(k==='labels')draft.labels=el.checked;
      else if(k==='title'){draft.title=el.value;return;}
      builder();
    });
    ov.addEventListener('input',e=>{if(e.target.dataset.ch==='title'&&draft)draft.title=e.target.value;});
    ov.addEventListener('click',e=>{const b=e.target.closest('[data-ch="madd"],[data-ch="mdel"]');if(!b||!draft)return;
      if(b.dataset.ch==='madd'){const n=Object.entries(datasets()[draft.dataset].fields).filter(([,f])=>f.type==='num');const cur=draft.metrics[0];const pick=n.find(([k])=>k!==cur.field)||n[0];draft.metrics.push(pick?{field:pick[0],agg:C.aggsFor(pick[1])[0]}:{agg:'count'});}
      else draft.metrics.splice(+b.dataset.i,1);builder();});
    function saveDraft(){
      const D=datasets(),chk=C.check(draft,D);if(chk.errors.length){A.toast(chk.errors[0]);return;}
      const {size,...cfg}=draft;if(!cfg.title)cfg.title=autoTitle(cfg,D);
      const b=board();
      if(editing){const w=b.widgets.find(x=>x.id===editing);if(w){w.cfg=cfg;w.size=size||w.size;}}
      else b.widgets.push({id:uid(),size:size||'m',cfg});
      save();closeDialog();render();A.toast(editing?'הגרף עודכן':'הגרף נוסף ללוח');
    }
    function autoTitle(cfg,D){const d=D[cfg.dataset],m=cfg.metrics[0],ml=m.agg==='count'?'מספר '+d.label:C.AGGS[m.agg]+' '+d.fields[m.field].label;return ml+(cfg.x?' לפי '+d.fields[cfg.x].label:'');}
    // ---------- export ----------
    function exportWidget(w,kind){
      const el=box.querySelector('[data-w="'+w.id+'"] .inv-w-body svg');
      if(!el){A.toast('לגרף הזה אין תמונה לייצוא (כרטיס או טבלה)');return;}
      const vb=el.viewBox.baseVal,stamp=new Date().toISOString().slice(0,16).replace('T',' ');
      const clone=el.cloneNode(true);clone.setAttribute('width',vb.width);clone.setAttribute('height',vb.height+34);clone.setAttribute('viewBox','0 -34 '+vb.width+' '+(vb.height+34));
      clone.insertAdjacentHTML('afterbegin','<rect x="0" y="-34" width="'+vb.width+'" height="'+(vb.height+34)+'" fill="#fffdf9"/><text x="'+(vb.width-8)+'" y="-14" text-anchor="end" font-size="13" font-weight="700" fill="#2b2621" direction="rtl">'+F.esc(w.cfg.title||'')+'</text><text x="8" y="-14" font-size="10" fill="#8b7f71">A.NAV · '+stamp+'</text>');
      clone.querySelectorAll('title').forEach(t=>t.remove());
      const svg=new XMLSerializer().serializeToString(clone),name=(w.cfg.title||'chart').replace(/[\\/:*?"<>|]+/g,'-')+' '+stamp.slice(0,10);
      const dl=(blob,ext)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name+'.'+ext;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);};
      if(kind==='svg'){dl(new Blob([svg],{type:'image/svg+xml'}),'svg');return;}
      const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
      img.onload=()=>{const c=document.createElement('canvas');c.width=vb.width*2;c.height=(vb.height+34)*2;const x=c.getContext('2d');x.scale(2,2);x.drawImage(img,0,0);URL.revokeObjectURL(url);c.toBlob(b=>b&&dl(b,'png'),'image/png');};
      img.onerror=()=>{URL.revokeObjectURL(url);A.toast('ייצוא PNG נכשל; אפשר לייצא SVG');};img.src=url;
    }
    // ---------- board events ----------
    box.addEventListener('click',e=>{
      const hit=e.target.closest('.inv-ch-hit[data-ids],.inv-ch-kpi[data-ids]');
      if(hit){const w=board().widgets.find(x=>x.id===hit.closest('[data-w]')?.dataset.w);if(w)drill(w.cfg,hit.dataset.ids.split(','));return;}
      const el=e.target.closest('[data-bd]');if(!el)return;
      const b=board(),act=el.dataset.bd,wid=el.closest('[data-w]')?.dataset.w,idx=b.widgets.findIndex(x=>x.id===wid),w=b.widgets[idx];
      if(act==='add')openBuilder(null);
      else if(act==='edit'&&w)openBuilder(w);
      else if(act==='remove'&&w){b.widgets.splice(idx,1);save();render();A.toast('הגרף הוסר',()=>{b.widgets.splice(idx,0,w);save();render();});}
      else if(act==='move'&&w){const j=idx+Number(el.dataset.dir);if(j>=0&&j<b.widgets.length){b.widgets.splice(idx,1);b.widgets.splice(j,0,w);save();render();}}
      else if(act==='size'&&w){w.size={s:'m',m:'l',l:'s'}[w.size]||'m';save();render();}
      else if((act==='svg'||act==='png')&&w)exportWidget(w,act);
      else if(act==='range'){b.range=el.dataset.val;save();render();}
      else if(act==='new'){const name=prompt('שם הלוח החדש','לוח '+(store.boards.length+1));if(!name)return;const nb={id:'b'+uid(),name:name.slice(0,40),range:'all',widgets:[]};store.boards.push(nb);store.active=nb.id;save();render();}
      else if(act==='rename'){const name=prompt('שם הלוח',b.name);if(name){b.name=name.slice(0,40);save();render();}}
      else if(act==='delete-board'){if(!confirm('למחוק את הלוח "'+b.name+'"? הגרפים שבו יימחקו.'))return;const i=store.boards.indexOf(b),rm=b;store.boards.splice(i,1);store.active=store.boards[0].id;save();render();A.toast('הלוח נמחק',()=>{store.boards.splice(i,0,rm);store.active=rm.id;save();render();});}
    });
    box.addEventListener('change',e=>{if(e.target.dataset.bd==='pick'){store.active=e.target.value;save();render();}});
    box.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.inv-ch-hit')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
    let rz=null;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(!box.closest('[hidden]'))render();},200);});
    if(!box.closest('[hidden]'))render();
  })();
