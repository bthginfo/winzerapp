import { runtime } from './runtime';
const tables={
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
 members:'SELECT user_id,role,scope FROM app.membership ORDER BY created_at',
 outbox:'SELECT id,event_type,aggregate_id,status,attempts,available_at,last_error FROM app.outbox ORDER BY created_at DESC'
};
export type Model = Record<string,Record<string,any>[]>;
export async function readModel(tenantId:string,userId:string,limit:number|null=500):Promise<Model> {
 const sql=runtime(); const keys=Object.keys(tables) as (keyof typeof tables)[];
 const results=await sql.transaction([
  sql`SELECT set_config('app.tenant_id',${tenantId},true),set_config('app.actor_id',${userId},true)`,
  ...keys.map(key=>sql.query(tables[key]+(limit===null?'':' LIMIT '+Math.min(5000,Math.max(1,limit))),[]))
 ]);
 return Object.fromEntries(keys.map((key,i)=>[key,results[i+1]])) as Model;
}
