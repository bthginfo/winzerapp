<script lang="ts">
 import Notifications from '$lib/components/Notifications.svelte';
 import Deliveries from '$lib/components/Deliveries.svelte';
 import Costs from '$lib/components/Costs.svelte';
 import Planning from '$lib/components/Planning.svelte';
 import Invitations from '$lib/components/Invitations.svelte';
 import OfflineCards from '$lib/components/OfflineCards.svelte';
 import Reports from '$lib/components/Reports.svelte';
 import Rules from '$lib/components/Rules.svelte';
 import Optimizer from '$lib/components/Optimizer.svelte';
 import RecipeComparison from '$lib/components/RecipeComparison.svelte';
 import LabChart from '$lib/components/LabChart.svelte';
 import Weather from '$lib/components/Weather.svelte';
 import VineyardMap from '$lib/components/VineyardMap.svelte';
 import Assistant from '$lib/components/Assistant.svelte';
 import Connections from '$lib/components/Connections.svelte';
 import WinerySettings from '$lib/components/WinerySettings.svelte';
 import Sensors from '$lib/components/Sensors.svelte';
 import Trials from '$lib/components/Trials.svelte';
 import Tanks from '$lib/components/Tanks.svelte';
 import TaskCards from '$lib/components/TaskCards.svelte';
 import Provenance from '$lib/components/Provenance.svelte';
 import Assets from '$lib/components/Assets.svelte';
 import { translator } from '$lib/app-i18n';import { allowed } from '$lib/forms';import CommandForm from '$lib/components/CommandForm.svelte';import DataTable from '$lib/components/DataTable.svelte';import Security from '$lib/components/Security.svelte';import { drafts,syncDrafts,removeDraft,type Draft } from '$lib/offline';import { onMount } from 'svelte';import { invalidateAll } from '$app/navigation';
 let {data}=$props();let t=$derived(translator(data.lang));let model=$derived(data.model);let offline=$state(false),pending=$state<Draft[]>([]),message=$state('');
 const config:Record<string,{forms:string[];tables:[string,string[]][]}>={
 today:{forms:['task_create','task_update','note_add'],tables:[['tasks',['title','due_at','status','version']],['notes',['body','captured_at']]]},
 vineyard:{forms:['vineyard_create','season_create','field_record','field_approve','weather_rule_create','note_add'],tables:[['vineyards',['code','name','grape','area_ha','planted_year']],['seasons',['vineyard_code','vintage','management','planned_kg']],['field_operations',['vineyard_code','kind','description','performed_at','hours','product','quantity','unit','operator','approved_at']]]},
 harvest:{forms:['maturity_record','resource_create','harvest_plan','harvest_plan_update','harvest_create','harvest_transform'],tables:[['maturity_samples',['vineyard_code','code','sampled_at','sugar','sugar_unit','acidity','ph','method']],['harvest_plans',['vineyard_code','planned_kg','starts_at','ends_at','resource_name','supplier','status']],['harvests',['code','vintage','quantity_kg','received_at','quality']],['harvest_yields',['harvest_code','lot_code','input_kg','output_l','byproduct_kg','litres_per_kg']]]},
 cellar:{forms:['vessel_create','vessel_update','lot_create','opening','transfer','loss','mix','reserve','reservation_release','lot_block','adjustment','treatment_record'],tables:[['positions',['vessel_code','lot_code','lot_name','quantity_l','available_l','blocked','version']],['vessels',['code','name','kind','capacity_l','status']],['lots',['code','name','vintage','cost_per_l','blocked']],['reservations',['vessel_code','lot_code','remaining_l','status','expires_at']]]},
 blends:{forms:['project_create','recipe_save','recipe_freeze','trial','evaluate','approve','produce','approve_deviation','order_cancel'],tables:[['projects',['name','briefing','target_l','status']],['recipes',['name','revision','target_l','state','version']],['trials',['blind_code','sample_ml','prepared_at']],['evaluations',['evaluator_id','score','aroma','balance','comment']],['orders',['id','status','version']]]},
 lab:{forms:['analysis_add','fermentation_start','fermentation_update','lab_rule_create','reference_record'],tables:[['fermentations',['lot_code','name','starts_at','ends_at','status','target_temperature']],['lab_alerts',['lot_code','name','parameter','value','unit','measured_at','status']],['analyses',['sample_code','parameter','value','unit','method','measured_at','quality']],['reference_samples',['code','location','sampled_at','review_at','description']]]},
 bottling:{forms:['product_create','sku_create','material_create','material_receive','bottling_plan','bottling_execute','bottling_plan_cancel','bottle','packaged_dispatch','reference_record'],tables:[['bottling_plans',['name','bottle_count','starts_at','supplier','status']],['materials',['code','name','kind','unit','available','reorder_at']],['packaged_stock',['code','sku_code','bottle_count','available','stock_authority']],['bottlings',['code','bottle_count','fill_l','loss_l','stock_authority','occurred_at']],['skus',['code','fill_l','erp_reference']]]},
 reports:{forms:[],tables:[['validation_findings',['lot_id','checked_at','outcome','findings']],['ledger',['kind','account','quantity_l','occurred_at','recorded_at','reason']],['lineage',['parent_lot_id','child_lot_id','contribution_l']]]},
 data:{forms:[],tables:[['outbox',['event_type','status','attempts','last_error']]]},
 hygiene:{forms:['resource_create','cleaning_record','maintenance_create','maintenance_update'],tables:[['cleanings',['vessel_id','resource_id','performed_at','method','product','result','verified_by']],['maintenance',['title','due_at','findings','status']],['resources',['name','kind','status']]]},
 costing:{forms:['cost_record','cost_allocate'],tables:[['lot_costs',['code','name','cost_per_l','actual_cost','planned_cost','allocated_cost']],['costs',['category','amount','currency','basis','description','invoice']],['cost_allocations',['cost_id','lot_id','amount','basis']]]},
 assistant:{forms:[],tables:[]},
 admin:{forms:['member_set'],tables:[['members',['user_id','role','scope']]]}
 };
 let view=$derived(config[data.section]);let total=$derived(Number(model?.statistics[0]?.physical_l??0));let available=$derived(Number(model?.statistics[0]?.available_l??0));
 onMount(()=>{const update=()=>{offline=!navigator.onLine;};update();window.addEventListener('online',update);window.addEventListener('offline',update);const refresh=()=>drafts(data.tenant.id).then(rows=>pending=rows);refresh();window.addEventListener('vinea-drafts-changed',refresh);return()=>{window.removeEventListener('vinea-drafts-changed',refresh);window.removeEventListener('online',update);window.removeEventListener('offline',update);};});
 async function sync(){await syncDrafts(data.tenant.id);pending=await drafts(data.tenant.id);await invalidateAll();}
 async function jobs(){const res=await fetch('/api/jobs',{method:'POST'});message=JSON.stringify(await res.json());await invalidateAll();}
</script>
{#if model}<p class="eyebrow">{data.tenant.name} · {t(data.tenant.mode)}</p><h1>{t(data.section)}</h1>{#if offline}<p class="offline" role="status">{t('offline')}</p>{/if}
{#if data.section==='today'||data.section==='cellar'}<div class="stats"><div class="card"><span>{t('physical')}</span><strong>{total.toLocaleString(data.lang,{maximumFractionDigits:3})}<small>L</small></strong></div><div class="card"><span>{t('available_l')}</span><strong>{available.toLocaleString(data.lang,{maximumFractionDigits:3})}<small>L</small></strong></div><div class="card"><span>{t('tasks')}</span><strong>{model.statistics[0]?.open_tasks??0}<small>{t('open')}</small></strong></div></div>{/if}
{#if data.section==='blends'}<p class="muted">{t('ph')}</p><a href="/">{t('blends')} · {t('draft')}</a>{/if}
{#if data.section==='cellar'}<Tanks {model} {t} lang={data.lang} />{/if}
{#if data.section==='today'}<TaskCards {model} {t} tenantId={data.tenant.id} userId={data.user.id} role={data.tenant.role} />{/if}
{#if data.section==='blends'&&['owner','oenologist'].includes(data.tenant.role)}<Optimizer {model} {t} /><RecipeComparison {model} {t} />{/if}
{#if data.section==='vineyard'&&data.tenant.role!=='external'}<VineyardMap {model} {t} canEdit={['owner','oenologist','vineyard'].includes(data.tenant.role)} /><Weather {model} {t} />{/if}
{#if data.section==='lab'}<LabChart {model} {t} />{/if}
{#if data.section==='assistant'&&data.tenant.role!=='external'}<Assistant {model} {t} lang={data.lang} tenantId={data.tenant.id} />{/if}
{#if data.section==='data'&&['owner','oenologist','office'].includes(data.tenant.role)}<Connections {model} {t} owner={data.tenant.role==='owner'} /><Deliveries {model} {t} lang={data.lang} timezone={data.tenant.timezone} />{/if}
{#if data.section==='admin'&&data.tenant.role==='owner'}<WinerySettings {model} {t} tenant={data.tenant} />{/if}
{#if data.section==='lab'&&['owner','oenologist'].includes(data.tenant.role)}<Sensors {model} {t} />{/if}
{#if data.section==='blends'&&['owner','oenologist','cellar','vineyard'].includes(data.tenant.role)}<Planning {model} {t} role={data.tenant.role} />{/if}
{#if data.section==='costing'&&data.fullCosts}<Costs results={data.fullCosts} {t} lang={data.lang} timezone={data.tenant.timezone} />{/if}
{#if data.section==='blends'}<Trials {model} {t} lang={data.lang} />{/if}
<div class="content"><div class="tables">{#each view.tables as [table,columns]}<section class="card"><h2>{t(table==='positions'?'physical':table==='ledger'?'history':table==='lineage'?'lineage':table==='vineyards'?'vineyard':table==='harvests'?'harvest':table==='analyses'?'lab':table==='bottlings'?'bottling':table==='members'?'admin':table==='recipes'?'recipe_id':table==='trials'?'trial_id':table==='orders'?'order_id':table==='vessels'?'vessel_id':table==='lots'?'lot_id':table==='projects'?'project_id':table==='reservations'?'reserve':table==='evaluations'?'evaluate':table==='skus'?'sku_id':table)}</h2><DataTable collection={table} rows={model[table]} {columns} {t} lang={data.lang} timezone={data.tenant.timezone} /></section>{/each}
{#if data.section==='reports'&&['owner','oenologist','office'].includes(data.tenant.role)}<Reports {model} {t} />{/if}
{#if data.section==='reports'&&['owner','oenologist'].includes(data.tenant.role)}<Rules {model} {t} />{/if}
{#if data.section==='today'&&data.tenant.role!=='external'}<Notifications {model} {t} email={data.user.email} /><OfflineCards {model} {t} tenantId={data.tenant.id} />{/if}
{#if data.section==='reports'}<Provenance {model} {t} />{/if}
{#if ['cellar','vineyard','harvest'].includes(data.section)&&data.tenant.role!=='external'}<Assets {model} {t} tenantId={data.tenant.id} />{/if}
{#if data.section==='admin'&&data.tenant.role==='owner'}<Invitations {model} {t} />{/if}
{#if data.section==='admin'}<Security enabled={data.user.twoFactorEnabled??false} {t} /><div class="card"><p>{t('user_id')}: <code>{data.user.id}</code></p><p class="muted">{t('demoErp')}</p></div>{/if}
{#if data.section==='data'}<div class="card"><h2>{t('download')}</h2><div class="actions">{#each ['json','csv','xlsx'] as format}<a href={'/api/export?format='+format}>{format.toUpperCase()}</a>{/each}<a href="/api/gis">GeoJSON</a></div></div><div class="card"><h2>{t('import')}</h2><a href="/app/data/import">{t('preview')}</a></div><div class="card"><p class="muted">{t('demoErp')}</p>{#if ['owner','oenologist','office'].includes(data.tenant.role)}<button onclick={jobs}>{t('runJobs')}</button>{/if}<p role="status">{message}</p></div>{/if}
{#if pending.length}<section class="card"><h2>{t('draft')}</h2><button onclick={sync} disabled={offline}>{t('sync')} ({pending.length})</button>{#each pending as draft}<div class="draft-row">{t(String(draft.command.type))} · {draft.capturedAt} {draft.state==='conflict'?t('conflict'):draft.requiresReview?t('onlineReviewRequired'):''} {#if draft.requiresReview}<button disabled={offline} onclick={async()=>{await invalidateAll();if(confirm(t('onlineReviewRequired'))){await syncDrafts(data.tenant.id,[draft.id]);pending=await drafts(data.tenant.id);await invalidateAll();}}}>{t('reviewDraft')}</button><details><summary>{t('draft')}</summary><pre>{JSON.stringify(draft.command,null,2)}</pre></details>{/if} <button onclick={async()=>{await removeDraft(draft.id);pending=await drafts(data.tenant.id);}}>{t('deleteDraft')}</button></div>{/each}</section>{/if}
</div>{#if view.forms.length}<div class="forms">{#each view.forms.filter(type=>allowed(type,data.tenant.role)) as type}<CommandForm {type} {model} lang={data.lang} tenantId={data.tenant.id} />{/each}</div>{/if}</div>{/if}
<style>.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.stats .card{padding:22px}.stats span{font-size:11px;color:#7a8675}.stats strong{font:36px Georgia,serif;display:block;margin-top:14px}.stats small{font:11px system-ui;margin-left:10px;color:#7c8876}.content{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px}.content:has(.tables:last-child){grid-template-columns:1fr}.tables{min-width:0}.forms{min-width:0}.actions{display:flex;gap:20px}.offline{background:#fff0cc;padding:15px;border-radius:8px}.card h2{margin-top:0}.card code{overflow-wrap:anywhere}@media(max-width:1150px){.content{grid-template-columns:1fr}.forms{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;align-items:start}}@media(max-width:600px){.stats{grid-template-columns:1fr}.stats strong{font-size:28px}.stats .card{margin-bottom:0}.stats{margin-bottom:20px}}</style>
