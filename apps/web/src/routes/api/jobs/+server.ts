import { json,error } from '@sveltejs/kit';import { context,runtime,domainError } from '$lib/server/runtime';
import type { RequestHandler } from './$types';
export const POST:RequestHandler=async(event)=>{const {tenant,userId}=await context(event);if(!['owner','oenologist','office'].includes(tenant.role))error(403,'FORBIDDEN');try{const [row]=await runtime()`SELECT app.process_jobs(${tenant.id}::uuid,${userId},50) AS result`;return json(row.result);}catch(cause){domainError(cause);}};
