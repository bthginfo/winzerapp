import { json,error } from '@sveltejs/kit';import { z } from 'zod';import { context,runtime } from '$lib/server/runtime';
export const GET:import('./$types').RequestHandler=async(event)=>{
 const {tenant,userId}=await context(event);if(!z.uuid().safeParse(event.params.id).success)error(404,'NOT_FOUND');const sql=runtime();
 const results=await sql.transaction([sql`SELECT set_config('app.tenant_id',${tenant.id},true),set_config('app.actor_id',${userId},true)`,sql`SELECT id,code,name FROM app.lot WHERE id=${event.params.id}::uuid`,sql`
 WITH RECURSIVE ancestry AS (
  SELECT id AS lot_id,ARRAY[id] AS path,1::numeric AS fraction FROM app.lot WHERE id=${event.params.id}::uuid
  UNION ALL SELECT e.parent_lot_id,a.path||e.parent_lot_id,a.fraction*e.contribution_l/(SELECT sum(s.contribution_l) FROM app.lineage s WHERE s.tenant_id=e.tenant_id AND s.child_lot_id=e.child_lot_id)
   FROM ancestry a JOIN app.lineage e ON e.child_lot_id=a.lot_id WHERE NOT e.parent_lot_id=ANY(a.path) AND array_length(a.path,1)<100
 ) SELECT l.id,l.code,l.name,l.grape,l.vintage,h.code AS harvest_code,v.name AS vineyard_name,(sum(a.fraction)*100)::text AS percentage,
 CASE WHEN l.harvest_id IS NULL THEN 'unknown_vineyard' ELSE 'recorded_harvest' END AS evidence
 FROM ancestry a JOIN app.lot l ON l.id=a.lot_id LEFT JOIN app.harvest h ON h.tenant_id=l.tenant_id AND h.id=l.harvest_id LEFT JOIN app.vineyard v ON v.tenant_id=h.tenant_id AND v.id=h.vineyard_id
 WHERE NOT EXISTS(SELECT 1 FROM app.lineage child WHERE child.child_lot_id=l.id)
 GROUP BY l.id,l.code,l.name,l.grape,l.vintage,h.code,v.name,l.harvest_id`]);
 if(!results[1].length)error(404,'NOT_FOUND');return json({lot:results[1][0],kind:'actual-lineage',captured_at:new Date().toISOString(),origins:results[2],legal_classification:'not_checked'});
};
