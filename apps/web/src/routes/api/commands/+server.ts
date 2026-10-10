import { json,error } from '@sveltejs/kit';
import { context,runtime,domainError } from '$lib/server/runtime';
import { commandSchema } from '$lib/server/contracts';
import type { RequestHandler } from './$types';
export const POST:RequestHandler=async(event)=>{
 const {userId,tenant}=await context(event);
 if(Number(event.request.headers.get('content-length')??0)>100000) error(413,'REQUEST_TOO_LARGE');
 const parsed=commandSchema.safeParse(await event.request.json()); if(!parsed.success) return json({error:'INVALID_INPUT',issues:parsed.error.issues},{status:400});
 const key=event.request.headers.get('idempotency-key'); if(!key || key.length<8 || key.length>120) error(400,'IDEMPOTENCY_KEY_REQUIRED');
 if(['approve','approve_deviation','adjustment','member_set','field_approve'].includes(String(parsed.data.type)) && !event.locals.identity?.user.twoFactorEnabled) error(403,'MFA_REQUIRED');
 try {const [row]=await runtime()`SELECT app.command(${tenant.id}::uuid,${userId},${key},${JSON.stringify(parsed.data)}::jsonb) AS result`;return json(row.result); }catch(cause){domainError(cause);}
};
