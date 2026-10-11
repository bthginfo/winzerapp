/** Seed a private, resumable demonstration winery through the deployed application.
 * Credentials are supplied in memory via DEMO_PASSWORD; never stored in the fixture.
 * Usage: DEMO_URL=https://your-app.example DEMO_PASSWORD=... node scripts/seed-demo.mjs
 * Keep DEMO_STATE (default /tmp/vinea-demo-<host/email hash>.json) to resume safely.
 */
import {chromium} from '../apps/web/node_modules/@playwright/test/index.mjs';
import {createHash,createHmac} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import pdfLib from '../apps/web/node_modules/pdf-lib/cjs/index.js';
import {browserOptions} from './browser.mjs';

const base=process.env.DEMO_URL?.replace(/\/$/,''),password=process.env.DEMO_PASSWORD;
assert(base&&password?.length>=12,'DEMO_URL and a DEMO_PASSWORD of at least 12 characters are required');
delete process.env.DEMO_PASSWORD;
process.env.E2E_URL=base;
const email=process.env.DEMO_EMAIL??'vadmin@demo.winzerapp.invalid';
const name=process.env.DEMO_NAME??'VAdmin',winery='Demo-Weingut Vinea';
const fingerprint=createHash('sha256').update(base+'|'+email).digest('hex').slice(0,20);
const statePath=process.env.DEMO_STATE??'/tmp/vinea-demo-'+fingerprint+'.json';
let state;
try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(cause){if(cause.code!=='ENOENT')throw cause;state={base,email,started_at:new Date().toISOString(),completed:{}};}
assert.equal(state.base,base);assert.equal(state.email,email);
async function save(){await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});}
const now=new Date(state.started_at),year=now.getUTCFullYear();
const at=(days,hour=10)=>new Date(Date.UTC(year,now.getUTCMonth(),now.getUTCDate()+days,hour)).toISOString();
const browser=await chromium.launch(browserOptions()),context=await browser.newContext(),page=await context.newPage();
let enrolled=false,verified=false;
function totp(uri){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',secret=new URL(uri).searchParams.get('secret'),bits=[...secret.replace(/=+$/,'')].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join(''),key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))),counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',key).update(counter).digest(),offset=h[19]&15;return((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
async function api(path,body,method='POST',label=path){
 const response=await context.request.fetch(base+path,{method,timeout:60000,headers:{origin:base,'idempotency-key':'demo-'+fingerprint+'-'+createHash('sha256').update(label).digest('hex').slice(0,32)},...(body?{data:body}:{})});
 const data=await response.json();
 if(!response.ok())throw new Error(label+': HTTP '+response.status()+' '+(data.message??data.error??JSON.stringify(data.issues??[])));
 return data;
}
async function once(label,run){if(Object.hasOwn(state.completed,label))return state.completed[label];const result=await run();state.completed[label]=result??true;await save();return result;}
const command=(label,body)=>once(label,async()=>{
 // Persist exact versioned command bodies before sending. If a response is lost,
 // retry the original body with the same key instead of recomputing its version.
 state.commands??={};state.commands[label]??=body;await save();
 return api('/api/commands',state.commands[label],'POST',label);
});
const model=()=>api('/api/model',undefined,'GET');
const position=async lot=>(await model()).positions.find(p=>p.lot_id===lot);
const post=(label,path,body,method)=>once(label,()=>api(path,body,method,label));
function csv(rows){const keys=Object.keys(rows[0]),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\n');}
async function imported(label,profile,rows,{commit=true,separator='.'}={}){
 const text=csv(rows),mapping=Object.fromEntries(Object.keys(rows[0]).map(k=>[k,k]));
 const preview=await post(label+'-preview','/api/import',{csv:text,filename:'DEMO-'+label+'.csv',profile,mapping,decimal_separator:separator,original_base64:Buffer.from(text).toString('base64')});
 if(commit){assert(preview.rows.every(r=>!r.error),label+' has invalid import rows');const done=await post(label+'-commit','/api/import',{batch_id:preview.id},'PUT');assert(done.report.every(r=>r.status==='imported'),label+' import did not finish');}
 return preview;
}
function progress(message){console.log(message);}
try{
 await page.goto(base+'/login');
 let identity;
 try{identity=await api('/api/auth/sign-in/email',{email,password});}catch(cause){if(!String(cause.message).includes('HTTP 401'))throw cause;identity=await api('/api/auth/sign-up/email',{name,email,password});}
 assert(!identity.twoFactorRedirect,'This account already has its own authenticator. Do not replace it with a demo factor.');
 state.user_id=identity.user.id;
 const tenants=await api('/api/tenants',undefined,'GET');
 const existing=tenants.find(t=>t.name===winery&&t.role==='owner');
 const tenant=existing??await api('/api/tenants',{name:winery,mode:'standalone'});
 state.tenant_id=tenant.id;await save();await api('/api/tenants',{id:tenant.id},'PUT');
 if(!state.verified){
  // Use the normal MFA flow for privileged fixture operations, then remove this
  // temporary factor so the owner can enroll their own authenticator.
  const setup=await api('/api/auth/two-factor/enable',{password});enrolled=true;
  await api('/api/auth/two-factor/verify-totp',{code:totp(setup.totpURI)});
  await post('settings','/api/settings',{country:'DE',region:'Mosel · synthetischer Demo-Betrieb',timezone:'Europe/Berlin',mode:'standalone',modules:['vineyard','harvest','cellar','blends','lab','bottling','hygiene','costing','assistant','reports','data'],retention_days:3650,authority_acknowledged:true});
  progress('VAdmin created with the owner role; all modules enabled in its private demo winery.');

  const vineyards=[];
  for(const [i,code,title,grape,area,planted] of [[0,'DEMO-R','Sonnenhang – Riesling','Riesling','2.4',2004],[1,'DEMO-W','Kalkgarten – Weißburgunder','Weißburgunder','1.8',2010],[2,'DEMO-P','Abendrot – Spätburgunder','Spätburgunder','1.2',2008]]){
   const v=await command('vineyard-'+code,{type:'vineyard_create',code,name:title,grape,area_ha:area,planted_year:planted});vineyards.push(v.id);
   const x=7.12+i*.008,y=50.08+i*.005;
   await command('geometry-'+code,{type:'vineyard_geometry',vineyard_id:v.id,expected_version:1,geometry:{type:'Polygon',coordinates:[[[x,y],[x+.002,y],[x+.002,y+.001],[x,y+.001],[x,y]]]}});
   const season=await command('season-'+code,{type:'season_create',vineyard_id:v.id,vintage:year,management:'DEMO · integrierter Weinbau, fiktive Arbeitsnachweise',planned_kg:String([9600,7200,4800][i])});
   for(const [j,kind,description,hours,quantity,unit] of [[0,'pruning','DEMO · Winterschnitt und Bindearbeiten abgeschlossen','24','0','kg'],[1,'canopy','DEMO · Entblätterung der Traubenzone','12','0','kg'],[2,'irrigation','DEMO · dokumentierte Bewässerung einer Teilfläche','3','600','l'],[3,'observation','DEMO · Reifekontrolle, gesunde Trauben; keine realen Befunde','1','0','kg']])await command('field-'+code+'-'+j,{type:'field_record',vineyard_id:v.id,season_id:season.id,kind,description,performed_at:at([-200,-60,-30,-2][j]),hours,area_ha:area,quantity,unit,operator:'Demo-Team Weinberg',source:'Synthetische Beispieldaten'});
   for(let j=0;j<3;j++)await command('maturity-'+code+'-'+j,{type:'maturity_record',vineyard_id:v.id,season_id:season.id,code:code+'-REIFE-'+(j+1),sampled_at:at(-21+j*7),location:'DEMO · repräsentative Mischprobe, Reihe '+(i+1),sugar:String(75+j*6+i*2),sugar_unit:'°Oe',acidity:(9.2-j*.8).toFixed(1),ph:(3.05+j*.05).toFixed(2),method:'Demo-Refraktometer und Titration',quality:'measured'});
  }
  const evidence=await command('protection-demo',{type:'field_record',vineyard_id:vineyards[0],kind:'protection',description:'DEMO · Ablauf eines prüfpflichtigen Pflanzenschutz-Nachweises; kein tatsächlicher Einsatz',performed_at:at(-40),hours:'2',area_ha:'2.4',product:'Fiktives Demo-Produkt – NICHT anwenden',product_batch:'DEMO-PROTECT-01',quantity:'1.2',unit:'kg',operator:'Demo-Team Weinberg',authorization:'DEMO-Nachweis, keine Zulassung oder Rechtsfreigabe',source:'Synthetische Schulungsdaten'});
  await command('protection-review',{type:'field_approve',field_id:evidence.id,expected_version:1,review_acknowledged:true});
  await imported('wetterstation','weather',[{vineyard_code:'DEMO-R',issued_at:at(0,7),latitude:'50.08',longitude:'7.12',temperature:'12.5',precipitation:'0.8',wind_speed:'7.5',source:'https://example.invalid/DEMO-synthetische-wetterstation'},{vineyard_code:'DEMO-R',issued_at:at(0,8),latitude:'50.08',longitude:'7.12',temperature:'14.2',precipitation:'0',wind_speed:'9',source:'https://example.invalid/DEMO-synthetische-wetterstation'}]);
  await command('weather-rule-rain',{type:'weather_rule_create',vineyard_id:vineyards[0],name:'DEMO · Regenwarnung ab 5 mm',parameter:'precipitation',maximum:'5'});
  await command('weather-rule-frost',{type:'weather_rule_create',vineyard_id:vineyards[0],name:'DEMO · Frostwarnung unter 1 °C',parameter:'temperature',minimum:'1'});
  progress('Vineyards, map polygons, seasons, field evidence, maturity samples and demo weather seeded.');

  const resources={};
  for(const [code,title,kind] of [['team','Demo-Leseteam','team'],['press','Demo-Presse P1','machine'],['pump','Demo-Pumpe P1','pump'],['pump2','Demo-Pumpe P2 – Wartung','pump'],['filter','Demo-Filter F1','equipment']])resources[code]=(await command('resource-'+code,{type:'resource_create',name:title,kind,description:'DEMO · fiktive Ressource zur Funktionsbesichtigung'})).id;
  const tanks={};
  for(const [code,title,capacity,kind] of [['R25','Riesling 2025','6000','tank'],['W25','Weißburgunder 2025','4000','tank'],['P25','Spätburgunder 2025','1500','barrel'],['R26','Riesling-Most 2026','5000','tank'],['W26','Weißburgunder-Most 2026','3000','tank'],['BL1','Cuvée – Produktion','5000','tank'],['BL2','Cuvée – freigeplanter Zieltank','4000','tank'],['READY','Freier gereinigter Tank','3000','tank'],['CLEAN','Reinigung noch nicht freigegeben','1500','tank'],['MAINT','Tank in Wartung','1000','tank']])tanks[code]=(await command('tank-'+code,{type:'vessel_create',code:'DEMO-T-'+code,name:title,capacity_l:capacity,kind})).id;
  const wines={};
  for(let i=0;i<3;i++){
   const code=['R25','W25','P25'][i],grape=['Riesling','Weißburgunder','Spätburgunder'][i];
   const harvest=await command('historic-harvest-'+code,{type:'harvest_create',vineyard_id:vineyards[i],code:'DEMO-LESE-'+code,vintage:year-1,quantity_kg:String([6500,4300,1200][i]),received_at:new Date(Date.UTC(year-1,8,25+i,9)).toISOString(),quality:'DEMO · fiktiver Herkunftsnachweis der Vorjahresbestände'});
   wines[code]=(await command('wine-'+code,{type:'lot_create',code:'DEMO-'+code,name:grape+' '+(year-1)+' · Demo-Bestand',grape,vintage:year-1,cost_per_l:['2.4','2.8','3.6'][i],material:'wine',harvest_id:harvest.id})).id;
  }
  await imported('eroeffnungsbestand','opening',[
   {lot_code:'DEMO-R25',vessel_code:'DEMO-T-R25',name:'Riesling '+(year-1),grape:'Riesling',vintage:year-1,quantity_l:'4500',capacity_l:'6000',cost_per_l:'2,4'},
   {lot_code:'DEMO-W25',vessel_code:'DEMO-T-W25',name:'Weißburgunder '+(year-1),grape:'Weißburgunder',vintage:year-1,quantity_l:'3000',capacity_l:'4000',cost_per_l:'2,8'},
   {lot_code:'DEMO-P25',vessel_code:'DEMO-T-P25',name:'Spätburgunder '+(year-1),grape:'Spätburgunder',vintage:year-1,quantity_l:'800',capacity_l:'1500',cost_per_l:'3,6'}],{separator:','});
  for(const [i,code,kg,litres,byproduct] of [[0,'R26','5000','3600','900'],[1,'W26','2600','1800','500']]){
   const plan=await command('harvest-plan-'+code,{type:'harvest_plan',vineyard_id:vineyards[i],vintage:year,planned_kg:kg,starts_at:at(-7+i,7),ends_at:at(-7+i,15),resource_id:resources.team,target_vessel_id:tanks[code],supplier:'DEMO · eigene Trauben',instructions:'DEMO · Handlese, getrennte Behälter und Probenahme am Eingang'});
   await command('harvest-plan-done-'+code,{type:'harvest_plan_update',plan_id:plan.id,expected_version:1,status:'completed'});
   const harvest=await command('harvest-'+code,{type:'harvest_create',vineyard_id:vineyards[i],code:'DEMO-LESE-'+code,vintage:year,quantity_kg:kg,received_at:at(-7+i,14),quality:'DEMO · gesundes Lesegut, Prüfwerte sind synthetisch'});
   wines[code]=(await command('must-'+code,{type:'harvest_transform',harvest_id:harvest.id,input_kg:kg,output_l:litres,byproduct_kg:byproduct,code:'DEMO-'+code,name:['Riesling','Weißburgunder'][i]+' '+year+' · Demo-Most',target_vessel_id:tanks[code],cost_per_l:'1.8'})).id;
   const run=await command('fermentation-'+code,{type:'fermentation_start',lot_id:wines[code],name:'DEMO · temperaturgeführte Gärung '+code,starts_at:at(-6+i),yeast:'Demo-Reinzuchthefe – fiktiver Ansatz',target_temperature:'17',notes:'Alle Kurvenwerte sind synthetisch und dienen der Besichtigung.'});
   if(i===1)await command('fermentation-complete-'+code,{type:'fermentation_update',run_id:run.id,expected_version:1,status:'completed',ends_at:at(-1)});
  }
  await command('future-harvest-plan',{type:'harvest_plan',vineyard_id:vineyards[2],vintage:year,planned_kg:'1200',starts_at:at(3,7),ends_at:at(3,13),resource_id:resources.team,target_vessel_id:tanks.READY,supplier:'DEMO · eigene Spätburgunder-Trauben',instructions:'Offener Demo-Termin: Menge, Team und Zieltank können angepasst werden.'});
  const initial=await model(),r=initial.positions.find(p=>p.lot_id===wines.R25),w=initial.positions.find(p=>p.lot_id===wines.W25);
  // Include real balanced split/transfer/loss examples without changing source identity.
  await command('split-riesling',{type:'split',position_id:r.id,target_vessel_id:tanks.READY,quantity_l:'100',loss_l:'0',expected_version:r.version});
  const small=(await model()).positions.find(p=>p.lot_id===wines.R25&&p.vessel_id===tanks.READY);
  await command('return-split',{type:'transfer',position_id:small.id,target_vessel_id:tanks.R25,quantity_l:'100',loss_l:'0',expected_version:small.version});
  const freshR=await position(wines.R25);
  await command('loss-riesling',{type:'loss',position_id:freshR.id,quantity_l:'2',expected_version:freshR.version,reason:'DEMO · dokumentierter Probenahme- und Filtrationsverlust'});
  progress('Harvest plans, grape-to-must yields, fermentation, valued stocks and balanced cellar movements seeded.');

  for(const [code,values] of [['R25',['12','4.2','6.8','3.15','24','17']],['W25',['12.8','3.5','6.1','3.3','18','18']],['P25',['15.2','2.2','5.7','3.55','8','16']]])for(const [j,parameter,unit,method] of [[0,'alcohol','% vol','distillation'],[1,'sugar','g/l','enzymatic'],[2,'acidity','g/l','titration'],[3,'ph','pH','electrode'],[4,'free_so2','mg/l','aeration-oxidation'],[5,'temperature','C','Demo-Probe']])await command('lab-'+code+'-'+parameter,{type:'analysis_add',lot_id:wines[code],sample_code:'DEMO-LAB-'+code+'-'+parameter,sampled_at:at(code==='P25'&&parameter==='ph'?-60:-1),parameter,value:values[j],unit,method,measured_at:at(code==='P25'&&parameter==='ph'?-60:-1),source:'laboratory',quality:'measured'});
  for(const code of ['R26','W26'])for(let day=0;day<6;day++)for(const [parameter,value,unit] of [['temperature',String(16+day*.5),'C'],['sugar',String((code==='R26'?160:100)-day*15),'g/l']])await command('curve-'+code+'-'+day+'-'+parameter,{type:'analysis_add',lot_id:wines[code],sample_code:'DEMO-GAER-'+code+'-'+day+'-'+parameter,sampled_at:at(day-5),parameter,value,unit,method:parameter==='temperature'?'Demo-Sensor':'enzymatic',measured_at:at(day-5),source:'manual',quality:'measured'});
  for(const [code,parameter,unit,method,min,max,age] of [['R25','alcohol','% vol','distillation','11','14',720],['P25','alcohol','% vol','distillation','11','14',720],['P25','free_so2','mg/l','aeration-oxidation','15','40',720],['P25','ph','pH','electrode','3','3.7',168],['R26','temperature','C','Demo-Sensor','14','18',24],['R26','alcohol','% vol','distillation','10','14',24]])await command('lab-rule-'+code+'-'+parameter,{type:'lab_rule_create',name:'DEMO · '+code+' '+parameter,lot_id:wines[code],parameter,unit,method,minimum:min,maximum:max,max_age_hours:age});
  await once('sensor',async()=>{const sensor=await api('/api/sensors',{name:'DEMO · Temperaturfühler am Riesling-Most',lot_id:wines.R26,parameter:'temperature',unit:'C',method:'Demo-Sensor'});const response=await context.request.post(base+'/api/sensors/ingest',{headers:{authorization:'Bearer '+sensor.token},data:{message_id:'demo-'+fingerprint+'-sensor',records:[{measured_at:at(0,12),value:'21.5'}]}});assert(response.ok(),'Demo sensor ingestion failed');return{id:sensor.id};});
  progress('Laboratory measurements, fermentation curves and passed, missing, stale and out-of-range alerts seeded.');

  const materials={};
  for(const [code,title,kind,unit,cost,quantity,reorder] of [['GLASS','Demo-Glasflasche 0,75 L','bottle','piece','0.42','5000','500'],['CORK','Demo-Schraubverschluss','closure','piece','0.12','5000','500'],['LABEL','Demo-Etikett Vinea','label','piece','0.08','4000','500'],['BOX','Demo-Geschenkkarton für 1 Flasche','box','piece','0.5','3000','200'],['YEAST','Demo-Trockenhefe','treatment','kg','18','10','2'],['LIQUID','Demo-Flüssigbehandlung – keine Anwendungsempfehlung','treatment','l','8','20','3'],['CLEANER','Demo-CIP-Reiniger','cleaner','l','3.5','30','5']]){
   materials[code]=(await command('material-'+code,{type:'material_create',code:'DEMO-'+code,name:title,kind,unit,cost_per_unit:cost,reorder_at:reorder})).id;
   await command('receive-'+code,{type:'material_receive',material_id:materials[code],expected_version:1,quantity,batch:'DEMO-BATCH-'+code,reason:'DEMO · fiktive Lieferantenanlieferung mit nachvollziehbarer Charge'});
  }
  const must=await position(wines.R26);
  await command('dry-addition',{type:'treatment_record',position_id:must.id,expected_version:must.version,material_id:materials.YEAST,quantity:'1.2',added_volume_l:'0',batch:'DEMO-BATCH-YEAST',reason:'DEMO · Ablauf einer dokumentierten Trockenhefezugabe',authorization:'Fiktiver Demo-Arbeitsauftrag; keine Anwendungsempfehlung',operator:'Demo-Kellerteam'});
  progress('Packaging and treatment stock, receipt batches and a documented addition seeded.');

  const project=(await command('project-production',{type:'project_create',name:'DEMO · Vinea Blanc '+(year-1),briefing:'Frische Hauscuvée aus Riesling und Weißburgunder. Drei Varianten vergleichen, blind verkosten und nachvollziehbar freigeben.',target_l:'2000'})).id;
  await post('brief-production','/api/planning',{action:'brief',project_id:project,style:'DEMO · frisch, mineralisch, Zitrus und Birne; Vorjahres-Riesling als Referenz',budget:'5500',targets:{alcohol:{minimum:'12',maximum:'13'},sugar:{minimum:'3',maximum:'5'},acidity:{minimum:'6',maximum:'7'}},share_limits:{[r.id]:{minimum:'50',maximum:'75'},[w.id]:{minimum:'25',maximum:'50'}},reference_lot_id:wines.R25});
  const recipes=[];
  for(const [i,title,rl,wl,score] of [[0,'60/40 · favorisierte Variante','1200','800',92],[1,'50/50 · weichere Variante','1000','1000',85],[2,'70/30 · Rieslingbetonte Variante','1400','600',89]]){
   const recipe=await command('recipe-'+i,{type:'recipe_save',project_id:project,name:'DEMO · '+title,components:[{position_id:r.id,quantity_l:rl},{position_id:w.id,quantity_l:wl}]});recipes.push(recipe.id);
   await command('freeze-'+i,{type:'recipe_freeze',recipe_id:recipe.id,expected_version:1});
   const trial=await command('trial-'+i,{type:'trial',recipe_id:recipe.id,sample_ml:'250'});
   await command('evaluate-'+i,{type:'evaluate',trial_id:trial.id,score,aroma:i===0?9:8,balance:i===0?9:8,comment:'DEMO · synthetische Blindbewertung: '+['ausgewogen, frische Säure und klare Frucht','runder, etwas weniger Spannung','frisch und mineralisch'][i]});
   await command('reference-trial-'+i,{type:'reference_record',trial_id:trial.id,code:'DEMO-TRIAL-REF-'+(i+1),location:'Demo-Probenkühlschrank · Fach A'+(i+1),sampled_at:at(0),review_at:at(30),description:'DEMO · Rückstellprobe der Bench-Trial-Variante'});
  }
  const order=await command('approve-production',{type:'approve',review_acknowledged:true,review_note:'DEMO · fachlich fiktive Freigabe nach Vergleich dreier Blindproben',recipe_id:recipes[0],target_vessel_id:tanks.BL1,expected_version:2});
  const before=await model(),ar=before.positions.find(p=>p.id===r.id),bw=before.positions.find(p=>p.id===w.id);
  const blend=await command('produce-blend',{type:'produce',target_vessel_id:tanks.BL1,order_id:order.id,order_version:1,sources:[{position_id:r.id,quantity_l:'1200',expected_version:ar.version},{position_id:w.id,quantity_l:'800',expected_version:bw.version}],code:'DEMO-CUVEE-BLANC',name:'Vinea Blanc '+(year-1)+' · Demo-Cuvée',vintage:year-1,loss_l:'0'});wines.BLEND=blend.id;
  const followup=(await command('project-planned',{type:'project_create',name:'DEMO · nächste Vinea-Blanc-Charge',briefing:'Freigegebener Auftrag mit offenen Reservierungen: Produktionsschritt selbst ausprobieren.',target_l:'1200'})).id;
  const reservedRecipe=await command('reserved-recipe',{type:'recipe_save',project_id:followup,name:'DEMO · 60/40 Folgecharge',components:[{position_id:r.id,quantity_l:'720'},{position_id:w.id,quantity_l:'480'}]});
  await command('reserved-freeze',{type:'recipe_freeze',recipe_id:reservedRecipe.id,expected_version:1});
  await command('reserved-order',{type:'approve',review_acknowledged:true,review_note:'DEMO · offener Folgeauftrag',recipe_id:reservedRecipe.id,target_vessel_id:tanks.BL2,expected_version:2});
  const draftProject=(await command('project-draft',{type:'project_create',name:'DEMO · Rosé-Idee in Planung',briefing:'Unverbindlicher Entwurf zum Bearbeiten und Optimieren; keine Bestandsreservierung.',target_l:'500'})).id;
  const pp=await position(wines.P25);
  await command('draft-recipe',{type:'recipe_save',project_id:draftProject,name:'DEMO · Rosé-Entwurf 80/20',components:[{position_id:pp.id,quantity_l:'400'},{position_id:r.id,quantity_l:'100'}]});
  await post('booking-pump','/api/planning',{action:'booking',resource_id:resources.pump,vessel_id:tanks.BL2,project_id:followup,title:'DEMO · Folgecuvée pumpen',starts_at:at(2,8),ends_at:at(2,10),route:'DEMO-T-R25 + DEMO-T-W25 → gereinigte Pumpe P1 → DEMO-T-BL2; Freigaben vor Durchführung prüfen.'});
  await post('booking-filter','/api/planning',{action:'booking',resource_id:resources.filter,vessel_id:tanks.BL1,project_id:project,title:'DEMO · Filtrationslauf abgeschlossen',starts_at:at(-1,8),ends_at:at(-1,10),route:'DEMO · Filter F1, separate Probenahme am Ausgang'});
  const booked=state.completed['booking-filter'];await post('booking-filter-done','/api/planning',{action:'status',id:booked.id,expected_version:1,status:'done'});
  progress('Three blind trials, frozen recipes, ratings, a produced blend, an approved follow-up and a draft seeded.');

  for(const [j,parameter,value,unit,method] of [[0,'alcohol','12.32','% vol','distillation'],[1,'sugar','3.92','g/l','enzymatic'],[2,'acidity','6.52','g/l','titration'],[3,'ph','3.21','pH','electrode'],[4,'free_so2','22','mg/l','aeration-oxidation']])await command('blend-lab-'+j,{type:'analysis_add',lot_id:blend.id,sample_code:'DEMO-CUVEE-ANALYSE-'+j,sampled_at:at(0),parameter,value,unit,method,measured_at:at(0),source:'laboratory',quality:'measured'});
  const product=(await command('product-blend',{type:'product_create',name:'DEMO · Vinea Blanc 0,75 L'})).id;
  const sku=(await command('sku-blend',{type:'sku_create',product_id:product,code:'DEMO-VINEA-BLANC-075',fill_l:'0.75',erp_reference:'DEMO-ERP-SKU-1001'})).id;
  const requirements=['GLASS','CORK','LABEL','BOX'].map(code=>({material_id:materials[code],per_bottle:'1',batch:'DEMO-BATCH-'+code}));
  const blendPosition=await position(blend.id);
  const plan=await command('bottling-plan-done',{type:'bottling_plan',name:'DEMO · Vinea Blanc – erste Abfüllung',position_id:blendPosition.id,sku_id:sku,bottle_count:1200,loss_l:'5',starts_at:at(0),supplier:'Demo-Abfülllinie',requirements});
  const bottled=await command('bottling-execute',{type:'bottling_execute',plan_id:plan.id,expected_version:1,position_version:blendPosition.version,code:'DEMO-FUELL-1200',bottle_count:1200,loss_l:'5'});
  await command('packaged-dispatch',{type:'packaged_dispatch',bottling_id:bottled.id,quantity:240,kind:'dispatch',reason:'DEMO · fiktive Lieferung an den Musterhandel',external_reference:'DEMO-LIEF-001'});
  await command('packaged-return',{type:'packaged_dispatch',bottling_id:bottled.id,quantity:12,kind:'return',reason:'DEMO · fiktive Rücknahme ungeöffneter Kartons',external_reference:'DEMO-RET-001'});
  await command('bottling-plan-open',{type:'bottling_plan',name:'DEMO · offene Abfüllung – selbst ausführen',position_id:blendPosition.id,sku_id:sku,bottle_count:300,loss_l:'2',starts_at:at(4),supplier:'Demo-Abfülllinie',requirements});
  const cancelled=await command('bottling-plan-cancel',{type:'bottling_plan',name:'DEMO · verschobener Abfülltermin',position_id:blendPosition.id,sku_id:sku,bottle_count:100,loss_l:'1',starts_at:at(5),supplier:'Demo-Abfülllinie',requirements});
  await command('cancel-plan',{type:'bottling_plan_cancel',plan_id:cancelled.id,expected_version:1});
  for(const [code,lot] of Object.entries(wines))await command('reference-'+code,{type:'reference_record',lot_id:lot,code:'DEMO-REF-'+code,location:'Demo-Probenkühlschrank · Fach '+code,sampled_at:at(0),review_at:at(90),description:'DEMO · physische Musterflasche, synthetischer Lagerort'});
  await command('reference-bottling',{type:'reference_record',bottling_id:bottled.id,code:'DEMO-REF-FUELL',location:'Demo-Musterlager · Abfüllregal 1',sampled_at:at(0),review_at:at(180),description:'DEMO · Rückstellprobe der Abfüllung mit Charge und Wiedervorlage'});
  progress('Finished and open bottling plans, packaging consumption, dispatch, returns and reference samples seeded.');

  const hygiene=await model();
  await command('clean-ready',{type:'cleaning_record',vessel_id:tanks.READY,expected_version:hygiene.vessels.find(v=>v.id===tanks.READY).version,performed_at:at(-1),method:'DEMO · CIP mit Wasser und Sichtkontrolle',product:'Wasser',quantity:'100',unit:'l',checklist:[{label:'Sichtprüfung',done:true},{label:'Spülung dokumentiert',done:true},{label:'Freigabe bestätigt',done:true}],result:'ready',verified_by:'VAdmin · Demo'});
  await command('clean-blocked',{type:'cleaning_record',vessel_id:tanks.CLEAN,expected_version:1,performed_at:at(0),method:'DEMO · noch offene Reinigung',product:'Demo-CIP-Reiniger',product_batch:'DEMO-BATCH-CLEANER',quantity:'2',unit:'l',checklist:[{label:'Vorreinigung',done:true},{label:'Nachspülen und Freigabe',done:false}],result:'blocked',verified_by:'VAdmin · Demo'});
  await command('maintenance-tank',{type:'maintenance_create',vessel_id:tanks.MAINT,title:'DEMO · Dichtung am Tankauslauf prüfen',performed_at:at(-2),due_at:at(3),findings:'DEMO · fiktive undichte Dichtung; Tank bleibt gesperrt bis Wartung und separate Reinigung abgeschlossen sind.'});
  const pumpMaintenance=await command('maintenance-pump',{type:'maintenance_create',resource_id:resources.pump2,title:'DEMO · Pumpendichtung erneuern',performed_at:at(-7),due_at:at(-1),findings:'DEMO · Ersatzteil eingesetzt, Funktionsprüfung dokumentieren.'});
  await command('maintenance-pump-done',{type:'maintenance_update',maintenance_id:pumpMaintenance.id,expected_version:1,status:'done',findings:'DEMO · Wartung abgeschlossen; Reinigung und erneute Freigabe folgen separat.'});
  await command('clean-pump',{type:'cleaning_record',resource_id:resources.pump2,expected_version:2,performed_at:at(-1),method:'DEMO · Pumpenkreislauf spülen',product:'Wasser',quantity:'40',unit:'l',checklist:[{label:'Funktionsprüfung',done:true},{label:'Spülung und Sichtkontrolle',done:true}],result:'ready',verified_by:'VAdmin · Demo'});
  progress('Released and blocked cleaning checklists, open maintenance and completed maintenance/release seeded.');

  const indirect=await command('cost-vineyard',{type:'cost_record',vineyard_id:vineyards[0],category:'work',amount:'900',currency:'EUR',basis:'actual',description:'DEMO · gemeinsamer Lese- und Weinbergaufwand',invoice:'DEMO-RE-100'});
  await command('cost-allocation-1',{type:'cost_allocate',cost_id:indirect.id,lot_id:wines.R26,amount:'600',basis:'DEMO · dokumentierte Einsatzstunden 2/3'});
  await command('cost-allocation-2',{type:'cost_allocate',cost_id:indirect.id,lot_id:wines.W26,amount:'300',basis:'DEMO · dokumentierte Einsatzstunden 1/3'});
  for(const [code,lot,category,amount,basis,description] of [['r-work',wines.R25,'work','180','actual','Kellerarbeit Riesling'],['w-service',wines.W25,'service','120','actual','Analytik Weißburgunder'],['blend-work',blend.id,'work','220','actual','Cuvée und Filtration'],['blend-plan',blend.id,'service','210','planned','Geplante Labor- und Abfüllbegleitung'],['r26-energy',wines.R26,'energy','95','actual','Kühlenergie Gärung'],['p25-store',wines.P25,'service','75','actual','Fasslager und Kontrolle']])await command('cost-'+code,{type:'cost_record',lot_id:lot,category,amount,currency:'EUR',basis,description:'DEMO · '+description,invoice:'DEMO-RE-'+code});
  const originalCost=await command('cost-bottling',{type:'cost_record',bottling_id:bottled.id,category:'service',amount:'180',currency:'EUR',basis:'actual',description:'DEMO · externe Abfüllbegleitung',invoice:'DEMO-RE-FUELL'});
  await command('cost-correction',{type:'cost_record',bottling_id:bottled.id,category:'service',amount:'-15',currency:'EUR',basis:'actual',description:'DEMO · Rechnungskorrektur zur Abfüllbegleitung',invoice:'DEMO-GUTSCHRIFT-FUELL',correction_of:originalCost.id});

  const pack=JSON.parse(await readFile(new URL('../apps/web/static/rule-pack-example.json',import.meta.url),'utf8'));
  pack.name='DEMO · interne Alkoholspanne 11–14 % vol – KEINE Rechtsregel';pack.jurisdiction='Synthetische interne Demo-Kriterien';pack.source='Synthetische Schulungsregeln; keine gesetzliche Freigabe oder tatsächliche Prüfung';pack.reviewer='VAdmin · Demo-Review';pack.rules.validFrom=year+'-01-01';pack.rules.validTo=year+'-12-31';
  for(const test of pack.tests){test.input.asOf=at(0);if(test.input.values.alcohol)test.input.values.alcohol.measuredAt=at(-1);}
  const rules=await post('rules-create','/api/rules',{...pack,action:'create',review_acknowledged:true});
  for(const code of ['R25','P25','R26'])await post('rules-check-'+code,'/api/rules',{action:'check',rule_set_id:rules.id,lot_id:wines[code]});
  progress('Actual/planned costs, overhead allocations, correction and pass/fail/unknown demo findings seeded.');

  for(const [i,title,description,days,status,lot,vineyard] of [
   [0,'DEMO starten: alle Module ansehen','Heute → Weinberg → Lese → Keller → Cuvées → Labor → Abfüllung → Hygiene → Kosten → Assistent → Berichte → Datenhub → Verwaltung. Alle Fachdatensätze sind synthetisch.',0,'open'],
   [1,'Gärtemperatur Riesling-Most prüfen','Im Labor ist eine absichtlich zu hohe Demo-Temperatur hinterlegt. Messung prüfen und Kontrollwert dokumentieren.',0,'doing',wines.R26],
   [2,'SO2-Probe Spätburgunder nachmessen','Demo-Alarm: niedriger freier SO2-Wert. Dies ist keine Behandlungs- oder Dosierempfehlung.',1,'open',wines.P25],
   [3,'Folgecuvée herstellen','Cuvées: freigegebene 60/40-Folgecharge mit Reservierungen. Zieltank BL2 ist frei; tatsächliche Mengen bestätigen.',2,'open'],
   [4,'Offene Abfüllung ausführen','Abfüllung: 300 Flaschen geplant, Verpackung und Wein verfügbar. Vor Ausführung Bestände und Hygiene prüfen.',4,'open',blend.id],
   [5,'Tankwartung und Freigabe abschließen','Hygiene: Tank MAINT ist bewusst gesperrt. Wartung abschließen, anschließend gereinigten Zustand dokumentieren.',3,'doing'],
   [6,'Weinberg-Reifeprobe ergänzen','Weinberg: DEMO-R auswählen; Saison und Probenverlauf prüfen.',1,'open',undefined,vineyards[0]],
   [7,'Offline-Karte auf dem eigenen Gerät speichern','Heute: Objektkarte eines Lots oder Weinbergs speichern, dann Offline-Funktion ausprobieren. Browserdaten bleiben gerätebezogen.',1,'open',wines.R25],
   [8,'Demo-Kostenbericht kontrollieren','Kosten: direkte Kosten, Gemeinkostenanteile, Plan/Ist und Gutschrift vergleichen.',0,'done',blend.id],
   [9,'Demo-Verkostung abgeschlossen','Drei echte Bench-Trial-Buchungen und synthetische Blindbewertungen vorhanden.',-1,'done',blend.id],
   [10,'Anlieferung und Materialcharge geprüft','Demo-Verpackungen eingelagert und Chargen dokumentiert.',-1,'done'],
   [11,'Eigene Zwei-Faktor-Anmeldung einrichten','Verwaltung: vor Freigaben, Regelpflege und Teamverwaltung eigenen Authenticator verbinden. Demo-Zugang verwendet anfangs nur das gewünschte Passwort.',1,'open']
  ]){
   const task=await command('task-'+i,{type:'task_create',title,description,due_at:at(days),assignee_id:state.user_id,...(lot?{lot_id:lot}:{}),...(vineyard?{vineyard_id:vineyard}:{}),checklist:[{label:'Daten und Beispiel öffnen',done:status==='done'},{label:'Vorgang prüfen und Ergebnis dokumentieren',done:status==='done'}]});
   if(status!=='open')await command('task-status-'+i,{type:'task_update',task_id:task.id,expected_version:1,status,checklist:[{label:'Daten und Beispiel öffnen',done:true},{label:'Vorgang prüfen und Ergebnis dokumentieren',done:status==='done'}]});
  }
  for(const [code,body] of [['R25','DEMO · Riesling-Vorjahresbestand, bewertet mit 2,40 EUR/L. Herkunft über Demo-Lese nachverfolgbar.'],['R26','DEMO · synthetische Gärkurve mit bewusst ausgelöstem Temperatur-Alarm.'],['BLEND','DEMO · Vinea Blanc: drei Varianten, Blindproben, Rezeptfreigabe, tatsächliche Produktion, Abfüllung und Rückverfolgung vorhanden.']])await command('note-'+code,{type:'note_add',lot_id:wines[code],body,captured_at:at(0)});
  await command('note-admin',{type:'note_add',body:'DEMO · VAdmin ist Betriebsleitung (Owner) mit Zugriff auf alle Fachmodule dieses Demo-Betriebs. Anmeldung per Demo-E-Mail und gewünschtem Passwort. Eigene MFA für kritische Freigaben in Verwaltung aktivieren. ERP/KI sind deaktiviert; SMTP ist nicht eingerichtet. Sprachen DE, EN, IT, FR verfügbar.'});
  await command('note-assistant',{type:'note_add',lot_id:wines.R26,body:'DEMO · Beispiel für Sprache und OCR: Tank DEMO-T-R26 hat 21,5 °C. Bitte Temperatur kontrollieren und eine Aufgabe zur Nachmessung erstellen. Im Assistenten diesen Text, ein eigenes Foto oder die hinterlegte Demo-PDF verwenden. Ohne Anbieter sind lokale OCR und manuelle Aufgaben verfügbar.'});
  await once('demo-pdf',async()=>{const document=await pdfLib.PDFDocument.create(),font=await document.embedFont(pdfLib.StandardFonts.Helvetica),sheet=document.addPage([595,842]);['Vinea - DEMO Laborbeleg','Nur synthetische Schulungsdaten, keine reale Laborfreigabe.','Tank: DEMO-T-R26 / Riesling-Most','Temperatur: 21.5 C; Zucker: 85 g/l','Aufgabe: Temperatur nachmessen und Kontrolle dokumentieren.','Lokale OCR im Assistenten ausprobieren.'].forEach((line,i)=>sheet.drawText(line,{x:40,y:760-i*35,size:i===0?20:11,font}));const response=await context.request.post(base+'/api/assets',{headers:{origin:base},multipart:{file:{name:'DEMO-Laborbeleg-R26.pdf',mimeType:'application/pdf',buffer:Buffer.from(await document.save())},lot_id:wines.R26}});assert(response.ok(),'Demo PDF upload failed');return response.json();});
  await imported('analysen-beispiel','analyses',[{lot_code:'DEMO-R26',sample_code:'DEMO-IMPORT-TEMP',sampled_at:at(0,13),parameter:'temperature',value:'17.2',unit:'C',method:'Demo-Recheck',measured_at:at(0,13),quality:'measured'}]);
  await imported('tank-beispiel','vessels',[{code:'DEMO-T-IMPORT',name:'Demo-Tank aus CSV-Import',kind:'tank',capacity_l:'2000'}]);
  await imported('fehlerhafte-vorschau','opening',[{lot_code:'DEMO-INVALID',vessel_code:'DEMO-T-INVALID',name:'DEMO · absichtlich fehlerhafte Importvorschau',grape:'Riesling',vintage:year,quantity_l:'ungueltig',capacity_l:'1000',cost_per_l:'2'}],{commit:false});
  for(const [label,adapter,title,enabled] of [['files','file','DEMO · CSV / JSON / XLSX / GeoJSON',true],['erp','winestro','DEMO · ERP-Auswahl – noch nicht verbunden',false],['ai','openai-compatible','DEMO · OpenAI – kein Anbieter verbunden',false]])await post('connection-'+label,'/api/connections',{name:title,adapter,enabled,authority:{wine:'app',bottles:'app'},configuration:{daily_requests:20,max_output_tokens:1000,data_consent:false,cost_consent:false}});
  await post('notifications-off','/api/notifications',{email_digest:false});
  // Invitations are deliberately not sent. The UI can demonstrate invitation creation
  // after the owner chooses their own authenticator and real recipient addresses.
  progress('Tasks, checklists, capture notes, private OCR PDF, successful/invalid imports and disabled future integrations seeded.');
  for(const [label,body] of [['field',{kind:'field',vineyard_id:vineyards[0]}],['laboratory',{kind:'laboratory',lot_id:wines.R26}],['costs',{kind:'costs',lot_id:blend.id}],['provenance',{kind:'provenance',lot_id:blend.id}]])await post('report-'+label,'/api/reports',body);
  await post('export-json','/api/export?format=json',undefined,'GET');
  await post('demo-jobs','/api/jobs',undefined);
 }

 const m=await model();
 for(const collection of ['vineyards','seasons','field_operations','maturity_samples','weather','harvest_plans','harvests','harvest_yields','vessels','lots','positions','ledger','projects','recipes','trials','evaluations','orders','reservations','lineage','analyses','sensors','lab_alerts','materials','material_movements','bottling_plans','bottlings','packaged_stock','packaged_movements','reference_samples','cleanings','maintenance','costs','cost_allocations','tasks','notes','assets','connections','reports','rule_sets','validation_findings','members','outbox'])assert(m[collection]?.length>0,collection+' missing demo data');
 assert(m.members.some(member=>member.user_id===state.user_id&&member.role==='owner'));
 assert.deepEqual(new Set(m.validation_findings.map(f=>f.outcome)),new Set(['passed','failed','unknown']));
 assert.equal(m.packaged_stock.find(b=>b.code==='DEMO-FUELL-1200').available,'972');
 assert(m.connections.filter(c=>c.adapter!=='file').every(c=>!c.enabled));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const section of ['today','vineyard','harvest','cellar','blends','lab','bottling','hygiene','costing','assistant','reports','data','admin']){
  const response=await page.goto(base+'/app/'+section+'?lang=de');assert.equal(response.status(),200,section+' page');await page.locator('main h1').waitFor();
 }
 for(const lang of ['en','it','fr']){await page.goto(base+'/app/today?lang='+lang);await page.locator('main h1').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),lang);}
 assert.deepEqual(errors,[],'Browser errors');
 const report=state.completed['report-provenance'];const response=await context.request.get(base+report.pdf);assert(response.ok());assert((await response.body()).subarray(0,5).equals(Buffer.from('%PDF-')));
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app/today?lang=de');await page.screenshot({path:'/tmp/vinea-vadmin-demo.png',fullPage:true});
 state.counts=Object.fromEntries(Object.entries(m).map(([key,rows])=>[key,rows.length]));state.verified=true;state.verified_at=new Date().toISOString();await save();verified=true;
 progress('Verified all 13 module pages, four languages, owner permissions, demo findings and downloadable PDF.');
}catch(cause){throw new Error(String(cause.message??cause).split('\n')[0]);}
finally{
 try{
  if(enrolled){await api('/api/auth/two-factor/disable',{password});progress('Temporary seed authenticator removed; VAdmin can enroll its own MFA.');}
  if(verified){
   const fresh=await browser.newContext(),login=await fresh.newPage();
   try{
    await login.goto(base+'/login?lang=de');
    await login.getByLabel('E-Mail',{exact:true}).fill(email);
    await login.getByLabel('Passwort (mindestens 12 Zeichen)',{exact:true}).fill(password);
    await login.getByRole('button',{name:'Anmelden',exact:true}).first().click();
    await login.waitForURL('**/app/today');await login.locator('main h1').waitFor();
    const response=await fresh.request.get(base+'/api/tenants');assert(response.ok());
    const memberships=await response.json();assert(memberships.some(t=>t.id===state.tenant_id&&t.role==='owner'));
    await login.screenshot({path:'/tmp/vinea-vadmin-login-verified.png',fullPage:true});
    state.login_verified_at=new Date().toISOString();await save();
    progress('Verified a fresh browser login with the requested password and demo owner access.');
   }finally{await fresh.close();}
  }
 }
 finally{await browser.close();}
}
if(verified)console.log(JSON.stringify({url:base+'/login',email,name,winery,role:'owner',counts:state.counts,verified_at:state.verified_at},null,2));
