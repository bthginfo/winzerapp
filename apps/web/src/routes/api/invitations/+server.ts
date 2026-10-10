import {json,error} from '@sveltejs/kit';import {z} from 'zod';import {randomBytes,createHash} from 'node:crypto';import {context,actor,runtime,domainError} from '$lib/server/runtime';import {mailConfigured,sendMail} from '$lib/server/mail';import type {RequestHandler} from './$types';
export const POST:RequestHandler=async event=>{
 const input=await event.request.json();
 if(input.action==='accept'){
  const userId=actor(event),parsed=z.object({token:z.string().regex(/^[\w-]{43}$/)}).safeParse(input);if(!parsed.success)error(400,'INVALID_INPUT');
  try{const [row]=await runtime()`SELECT app.invite_accept(${userId},${createHash('sha256').update(parsed.data.token).digest('hex')}) AS id`;event.cookies.set('winery',row.id,{path:'/',httpOnly:true,sameSite:'lax',secure:event.url.protocol==='https:'});return json(row);}catch(cause){domainError(cause);}
 }
 const {tenant,userId}=await context(event);if(tenant.role!=='owner')error(403,'FORBIDDEN');if(!event.locals.identity?.user.twoFactorEnabled)error(403,'MFA_REQUIRED');
 const parsed=z.object({email:z.email().max(254),role:z.enum(['owner','oenologist','cellar','vineyard','office','external']),scope:z.array(z.uuid()).max(500).default([])}).safeParse(input);if(!parsed.success)error(400,'INVALID_INPUT');
 const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
 try{const [row]=await runtime()`SELECT app.invite_create(${tenant.id}::uuid,${userId},${parsed.data.email},${parsed.data.role},${JSON.stringify(parsed.data.scope)}::jsonb,${hash}) AS id`;const link=event.url.origin+'/join#'+token;let mailed=false;if(mailConfigured()){try{await sendMail(parsed.data.email,'Vinea · '+tenant.name,'Vinea invitation / Einladung / Invito / Invitation\n'+tenant.name+'\n'+link+'\nExpires in 7 days.');mailed=true;}catch{/* The invitation remains usable via the privately shared link. */}}return json({...row,link,mailed},{status:201});}catch(cause){domainError(cause);}
};
export const DELETE:RequestHandler=async event=>{const {tenant,userId}=await context(event);if(tenant.role!=='owner')error(403,'FORBIDDEN');if(!event.locals.identity?.user.twoFactorEnabled)error(403,'MFA_REQUIRED');const input=z.object({id:z.uuid()}).safeParse(await event.request.json());if(!input.success)error(400,'INVALID_INPUT');try{await runtime()`SELECT app.invite_revoke(${tenant.id}::uuid,${userId},${input.data.id}::uuid)`;return json({ok:true});}catch(cause){domainError(cause);}};
