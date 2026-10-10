import { error } from '@sveltejs/kit';import { z } from 'zod';import { context,runtime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';
export const GET:RequestHandler=async(event)=>{
 const {tenant,userId}=await context(event);if(!z.uuid().safeParse(event.params.id).success)error(404,'NOT_FOUND');const sql=runtime();
 const rows=await sql.transaction([sql`SELECT set_config('app.tenant_id',${tenant.id},true),set_config('app.actor_id',${userId},true)`,sql`SELECT filename,mime_type,encode(content,'base64') AS data FROM app.asset WHERE id=${event.params.id}::uuid`]);const row=rows[1][0];if(!row)error(404,'NOT_FOUND');
 return new Response(Buffer.from(row.data,'base64'),{headers:{'Content-Type':row.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
};
