import { runtime } from './runtime';
const tables={
 resource_bookings:"SELECT b.id,b.resource_id,r.name AS resource_name,b.vessel_id,b.project_id,b.title,b.starts_at,b.ends_at,b.route,b.status,b.version FROM app.resource_booking b JOIN app.resource r ON r.tenant_id=b.tenant_id AND r.id=b.resource_id ORDER BY b.starts_at",
 deliveries:"SELECT id,connection_id,bottling_id,status,attempts,external_id,last_error,created_at,updated_at FROM app.integration_delivery ORDER BY created_at DESC",
 import_profiles:"SELECT id,name,profile,revision,mapping,decimal_separator,created_at FROM app.import_profile ORDER BY name,revision DESC",
 settings:"SELECT country,region,modules,retention_days,version FROM app.tenant_settings",
 integration_snapshots:"SELECT id,connection_id,source,data,fetched_at FROM app.integration_snapshot ORDER BY fetched_at DESC",
 ai_usage:"SELECT id,connection_id,status,input_tokens,output_tokens,created_at FROM app.ai_usage ORDER BY created_at DESC",
 seasons:"SELECT s.id,s.vineyard_id,v.code AS vineyard_code,s.vintage,s.management,s.planned_kg::text FROM app.block_season s JOIN app.vineyard v ON v.tenant_id=s.tenant_id AND v.id=s.vineyard_id ORDER BY s.vintage DESC,v.code",
 field_operations:"SELECT f.id,f.vineyard_id,v.code AS vineyard_code,f.season_id,f.kind,f.description,f.performed_at,f.hours::text,f.area_ha::text,f.product,f.product_batch,f.quantity::text,f.unit,f.operator,f.authorization_ref AS authorization,f.source,f.approved_by,f.approved_at,f.version FROM app.field_operation f JOIN app.vineyard v ON v.tenant_id=f.tenant_id AND v.id=f.vineyard_id ORDER BY f.performed_at DESC",
 maturity_samples:"SELECT m.id,m.vineyard_id,v.code AS vineyard_code,m.code,m.sampled_at,m.location,m.sugar::text,m.sugar_unit,m.acidity::text,m.ph::text,m.method,m.quality FROM app.maturity_sample m JOIN app.vineyard v ON v.tenant_id=m.tenant_id AND v.id=m.vineyard_id ORDER BY m.sampled_at DESC",
 resources:"SELECT id,name,kind,description,status,version FROM app.resource ORDER BY name",
 harvest_plans:"SELECT p.id,p.vineyard_id,v.code AS vineyard_code,p.vintage,p.planned_kg::text,p.starts_at,p.ends_at,p.resource_id,r.name AS resource_name,p.target_vessel_id,p.supplier,p.instructions,p.status,p.version FROM app.harvest_plan p JOIN app.vineyard v ON v.tenant_id=p.tenant_id AND v.id=p.vineyard_id LEFT JOIN app.resource r ON r.tenant_id=p.tenant_id AND r.id=p.resource_id ORDER BY p.starts_at",
 harvest_yields:"SELECT y.id,h.code AS harvest_code,l.code AS lot_code,y.harvest_id,y.lot_id,y.input_kg::text,y.output_l::text,y.byproduct_kg::text,round(y.output_l/y.input_kg,4)::text AS litres_per_kg FROM app.harvest_yield y JOIN app.harvest h ON h.tenant_id=y.tenant_id AND h.id=y.harvest_id JOIN app.lot l ON l.tenant_id=y.tenant_id AND l.id=y.lot_id ORDER BY y.created_at DESC",
 fermentations:"SELECT f.id,f.lot_id,l.code AS lot_code,f.name,f.starts_at,f.ends_at,f.status,f.yeast,f.target_temperature::text,f.notes,f.version FROM app.fermentation_run f JOIN app.lot l ON l.tenant_id=f.tenant_id AND l.id=f.lot_id ORDER BY f.starts_at DESC",
 lab_rules:"SELECT id,name,lot_id,parameter,unit,method,minimum::text,maximum::text,max_age_hours FROM app.lab_rule ORDER BY name",
 lab_alerts:"SELECT r.id AS rule_id,r.name,l.id AS lot_id,l.code AS lot_code,r.parameter,r.unit,r.method,a.value::text,a.measured_at,CASE WHEN a.id IS NULL THEN 'missing' WHEN a.unit<>r.unit OR a.method<>r.method THEN 'incompatible' WHEN a.measured_at<now()-make_interval(hours=>r.max_age_hours) THEN 'stale' WHEN a.value<r.minimum OR a.value>r.maximum THEN 'outside_range' ELSE 'within_range' END AS status FROM app.lab_rule r JOIN app.lot l ON l.tenant_id=r.tenant_id AND (r.lot_id IS NULL OR r.lot_id=l.id) LEFT JOIN LATERAL (SELECT a.* FROM app.analysis a JOIN app.sample s ON s.tenant_id=a.tenant_id AND s.id=a.sample_id WHERE a.tenant_id=r.tenant_id AND s.lot_id=l.id AND a.parameter=r.parameter AND a.quality='measured' AND NOT EXISTS(SELECT 1 FROM app.analysis newer WHERE newer.tenant_id=a.tenant_id AND newer.supersedes=a.id) ORDER BY a.measured_at DESC LIMIT 1) a ON true ORDER BY l.code,r.name",
 materials:"SELECT id,code,name,kind,unit,cost_per_unit::text,reorder_at::text,app.material_available(id)::text AS available,version FROM app.material_item ORDER BY code",
 material_movements:"SELECT x.id,m.code AS material_code,m.unit,x.material_id,x.quantity::text,x.batch,x.reason,x.lot_id,x.bottling_id,x.created_at FROM app.material_movement x JOIN app.material_item m ON m.tenant_id=x.tenant_id AND m.id=x.material_id ORDER BY x.created_at DESC",
 cleanings:"SELECT id,vessel_id,resource_id,performed_at,method,product,product_batch,quantity::text,unit,checklist,result,verified_by FROM app.cleaning_record ORDER BY performed_at DESC",
 maintenance:"SELECT id,vessel_id,resource_id,title,performed_at,due_at,findings,status,version FROM app.maintenance_record ORDER BY due_at NULLS LAST",
 costs:"SELECT id,lot_id,vineyard_id,bottling_id,category,amount::text,currency,basis,description,invoice,correction_of,created_at FROM app.cost_entry ORDER BY created_at DESC",
 cost_allocations:"SELECT id,cost_id,lot_id,amount::text,basis FROM app.cost_allocation ORDER BY created_at DESC",
 lot_costs:"SELECT l.id,l.code,l.name,l.cost_per_l::text,coalesce((SELECT sum(c.amount) FROM app.cost_entry c WHERE c.tenant_id=l.tenant_id AND c.lot_id=l.id AND c.basis='actual'),0)::text AS actual_cost,coalesce((SELECT sum(c.amount) FROM app.cost_entry c WHERE c.tenant_id=l.tenant_id AND c.lot_id=l.id AND c.basis='planned'),0)::text AS planned_cost,coalesce((SELECT sum(a.amount) FROM app.cost_allocation a JOIN app.cost_entry c ON c.tenant_id=a.tenant_id AND c.id=a.cost_id WHERE a.tenant_id=l.tenant_id AND a.lot_id=l.id AND c.basis='actual'),0)::text AS allocated_cost FROM app.lot l ORDER BY l.code",
 bottling_plans:"SELECT id,name,position_id,sku_id,bottle_count,loss_l::text,starts_at,supplier,requirements,status,bottling_id,version FROM app.bottling_plan ORDER BY starts_at DESC",
 reference_samples:"SELECT id,lot_id,bottling_id,trial_id,code,location,sampled_at,review_at,description FROM app.reference_sample ORDER BY review_at NULLS LAST",
 packaged_stock:"SELECT b.id,b.code,b.sku_id,s.code AS sku_code,b.bottle_count,b.stock_authority,CASE WHEN b.stock_authority='app' THEN b.bottle_count+coalesce((SELECT sum(p.quantity) FROM app.packaged_movement p WHERE p.tenant_id=b.tenant_id AND p.bottling_id=b.id),0) END::text AS available FROM app.bottling b JOIN app.sku s ON s.tenant_id=b.tenant_id AND s.id=b.sku_id ORDER BY b.occurred_at DESC",
 packaged_movements:"SELECT id,bottling_id,quantity,kind,reason,external_reference,created_at FROM app.packaged_movement ORDER BY created_at DESC",
 rule_sets:"SELECT id,name,jurisdiction,valid_from,valid_to,source,reviewer,rules,tests,approved_at,supersedes FROM app.rule_set ORDER BY approved_at DESC",
 validation_findings:"SELECT id,rule_set_id,lot_id,checked_at,outcome,findings,snapshot FROM app.validation_finding ORDER BY checked_at DESC",
 weather:"SELECT id,vineyard_id,provider,issued_at,fetched_at,latitude::text,longitude::text,source,data FROM app.weather_snapshot ORDER BY fetched_at DESC",
 weather_rules:"SELECT id,vineyard_id,name,parameter,maximum::text,minimum::text FROM app.weather_rule ORDER BY name",
 sensors:"SELECT id,name,lot_id,parameter,unit,method,enabled,version FROM app.sensor ORDER BY name",
 briefs:"SELECT id,project_id,style,budget::text,targets,share_limits,reference_lot_id,version FROM app.blend_brief ORDER BY created_at DESC",
 connections:"SELECT id,name,adapter,capabilities,authority,configuration,enabled,version FROM app.connection ORDER BY name",
 external_references:"SELECT id,connection_id,entity_type,internal_id,external_id FROM app.external_reference ORDER BY created_at DESC",

 invitations:"SELECT id,email,role,scope,expires_at,accepted_at,revoked_at FROM app.invitation ORDER BY created_at DESC",
 reports:"SELECT id,created_at,snapshot->>'kind' AS kind FROM app.export_artifact WHERE kind='report' ORDER BY created_at DESC",
 statistics:"SELECT coalesce(sum(quantity_l),0)::text AS physical_l,coalesce(sum(app.available(id)),0)::text AS available_l,(SELECT count(*)::text FROM app.task WHERE status<>'done') AS open_tasks FROM app.position",
 assets:'SELECT id,lot_id,vineyard_id,filename,mime_type,created_at FROM app.asset ORDER BY created_at DESC',
 vineyards:'SELECT id,code,name,grape,area_ha::text,planted_year,geometry,version FROM app.vineyard ORDER BY code',
 harvests:'SELECT id,vineyard_id,code,vintage,quantity_kg::text,received_at,quality FROM app.harvest ORDER BY received_at DESC',
 vessels:'SELECT id,code,name,kind,capacity_l::text,status,version FROM app.vessel ORDER BY code',
 lots:'SELECT id,code,name,grape,vintage,material,cost_per_l::text,blocked,block_reason,harvest_id,version FROM app.lot ORDER BY code',
 positions:'SELECT p.id,p.lot_id,p.vessel_id,p.quantity_l::text,p.version,l.code AS lot_code,l.name AS lot_name,l.vintage,l.blocked,v.code AS vessel_code,app.available(p.id)::text AS available_l FROM app.position p JOIN app.lot l ON l.tenant_id=p.tenant_id AND l.id=p.lot_id JOIN app.vessel v ON v.tenant_id=p.tenant_id AND v.id=p.vessel_id ORDER BY v.code,l.code',
 projects:'SELECT id,name,briefing,target_l::text,status FROM app.blend_project ORDER BY created_at DESC',
 recipes:'SELECT id,project_id,revision,name,target_l::text,components,state,snapshot,version FROM app.recipe ORDER BY created_at DESC',
 orders:'SELECT id,recipe_id,target_vessel_id,status,snapshot,deviation_approved_by,deviation_snapshot,version FROM app.blend_order ORDER BY approved_at DESC',
 reservations:'SELECT r.id,r.position_id,r.order_id,r.original_l::text,r.remaining_l::text,r.status,r.expires_at,v.code AS vessel_code,l.code AS lot_code FROM app.reservation r JOIN app.position p ON p.tenant_id=r.tenant_id AND p.id=r.position_id JOIN app.lot l ON l.tenant_id=p.tenant_id AND l.id=p.lot_id JOIN app.vessel v ON v.tenant_id=p.tenant_id AND v.id=p.vessel_id ORDER BY r.created_at DESC',
 trials:"SELECT id,CASE WHEN created_by=app.actor_id() OR app.role() IN ('owner','oenologist') THEN recipe_id END AS recipe_id,sample_ml::text,CASE WHEN created_by=app.actor_id() OR app.role() IN ('owner','oenologist') THEN quantities END AS quantities,blind_code,prepared_at FROM app.trial ORDER BY encode(public.digest(id::text||app.actor_id(),'sha256'),'hex')",
 evaluations:'SELECT id,trial_id,evaluator_id,score,aroma,balance,comment,created_at FROM app.evaluation ORDER BY created_at DESC',
 analyses:'SELECT a.id,s.lot_id,s.code AS sample_code,s.sampled_at,a.parameter,a.value::text,a.unit,a.method,a.measured_at,a.quality,a.supersedes FROM app.analysis a JOIN app.sample s ON s.tenant_id=a.tenant_id AND s.id=a.sample_id ORDER BY a.measured_at DESC',
 products:'SELECT id,name FROM app.product ORDER BY name',
 skus:'SELECT id,product_id,code,fill_l::text,erp_reference FROM app.sku ORDER BY code',
 bottlings:'SELECT id,lot_id,sku_id,code,bottle_count,fill_l::text,loss_l::text,stock_authority,occurred_at FROM app.bottling ORDER BY occurred_at DESC',
 tasks:'SELECT id,title,description,due_at,assignee_id,status,lot_id,vineyard_id,checklist,created_by,version FROM app.task ORDER BY due_at NULLS LAST',
 notes:'SELECT id,lot_id,vineyard_id,body,captured_at,created_by FROM app.note ORDER BY captured_at DESC',
 ledger:'SELECT e.id,e.operation_id,e.position_id,e.lot_id,e.account,e.quantity_l::text,o.kind,o.occurred_at,o.recorded_at,o.actor_id,o.reason FROM app.ledger e JOIN app.operation o ON o.tenant_id=e.tenant_id AND o.id=e.operation_id ORDER BY o.recorded_at DESC',
 lineage:'SELECT parent_lot_id,child_lot_id,operation_id,contribution_l::text FROM app.lineage',
 members:'SELECT m.user_id,u.name,m.role,m.scope FROM app.membership m JOIN public.auth_user u ON u.id=m.user_id ORDER BY m.created_at',
 outbox:'SELECT id,event_type,aggregate_id,status,attempts,available_at,last_error FROM app.outbox ORDER BY created_at DESC'
};
export type Model = Record<string,Record<string,any>[]>;
export async function readModel(tenantId:string,userId:string,limit:number|null=500,collections?:readonly (keyof typeof tables)[]):Promise<Model> {
 const sql=runtime(); const keys=collections??Object.keys(tables) as (keyof typeof tables)[];
 const results=await sql.transaction([
  sql`SELECT set_config('app.tenant_id',${tenantId},true),set_config('app.actor_id',${userId},true)`,
  ...keys.map(key=>sql.query(tables[key]+(limit===null?'':' LIMIT '+Math.min(5000,Math.max(1,limit))),[]))
 ]);
 return Object.fromEntries(keys.map((key,i)=>[key,results[i+1]])) as Model;
}

export async function readPage(tenantId:string,userId:string,collection:string,offset:number,limit:number){
 if(!Object.hasOwn(tables,collection))throw new Error('INVALID_COLLECTION');
 const sql=runtime(),results=await sql.transaction([sql`SELECT set_config('app.tenant_id',${tenantId},true),set_config('app.actor_id',${userId},true)`,sql.query('SELECT * FROM ('+tables[collection as keyof typeof tables]+') AS rows LIMIT $1 OFFSET $2',[limit+1,offset])]);
 const rows=results[1];return {version:1,collection,rows:rows.slice(0,limit),next_cursor:rows.length>limit?Buffer.from(String(offset+limit)).toString('base64url'):null};
}
