  // Each calculator keeps its own inputs. The same snapshot is also stored locally
  // so that values survive tab changes, refreshes and reopening the file.
  const STORAGE_KEY='mirvach.finance.calculators.v1';
  let active='mortgage';
  const states={};
  for (const [key,c] of Object.entries(configs)) states[key]=Object.fromEntries(c.fields.map(f=>[f[0],f[5]]));
  states.mortgage.kind='first';
  const allowedKinds=['first','upgrade','invest'];
  const defaultOrder=Object.keys(configs);
  const tabLabels={mortgage:'משכנתא',savings:'חיסכון',index:'השקעה ב־S&P 500',loan:'הלוואה',budget:'תקציב חודשי'};
  const fieldLabels=Object.fromEntries(defaultOrder.map(tab=>[tab,{}]));
  // Missing entries keep the original (factory) reset point.
  const resetPoints=Object.fromEntries(defaultOrder.map(tab=>[tab,{}]));
  function getResetPoint(tab,id){
    const config=configs[tab]?.fields.find(f=>f[0]===id);
    if(!config)return 0;
    const override=resetPoints[tab]?.[id];
    return typeof override==='number'&&Number.isFinite(override)?override:config[5];
  }

  const fieldOrder=Object.fromEntries(defaultOrder.map(tab=>[tab,configs[tab].fields.map(f=>f[0])]));
  // Put the target near the top for first-time users while preserving saved custom order.
  for(const tab of ['savings','index'])fieldOrder[tab]=['goal',...fieldOrder[tab].filter(id=>id!=='goal')];
  let tabOrder=[...defaultOrder];
  let notesText=''; // Existing shared notebook, including notes created in older versions.
  let notesMode='shared';
  const notesByTab=Object.fromEntries(defaultOrder.map(tab=>[tab,'']));
  let notesCollapsed=false;
  const advanced={mortgage:{insurance:0,purchaseCosts:0,stressRise:0,income:0},index:{taxEnabled:false,taxRate:25},budget:{annualItems:[]}};
  const scenarios=Object.fromEntries(defaultOrder.map(tab=>[tab,[]]));
  const compareIds=Object.fromEntries(defaultOrder.map(tab=>[tab,null]));
  const chartModes={savings:false,index:false};
  const goalPlans={savings:{locked:false,solve:'monthly'},index:{locked:false,solve:'monthly'}};
  const goalFeedback={savings:null,index:null};
  const goalManuals={savings:null,index:null};
  const goalSolveChoices=[['monthly','הפקדה חודשית'],['years','משך ההשקעה'],['initial','השקעה התחלתית'],['rate','תשואה שנתית']];
  const goalPinned={savings:[],index:[]};
