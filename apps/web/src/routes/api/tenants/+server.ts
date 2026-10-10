import { json,error } from '@sveltejs/kit';
import { z } from 'zod';
import { actor,memberships,runtime,domainError } from '$lib/server/runtime';
import type { RequestHandler } from './$types';
export const GET:RequestHandler=async(event)=>json(await memberships(actor(event)));
export const POST:RequestHandler=async(event)=>{
 const userId=actor(event); const parsed=z.object({name:z.string().trim().min(2).max(120),mode:z.enum(['standalone','erp','companion']).default('standalone')}).safeParse(await event.request.json());
 if(!parsed.success) error(400,'INVALID_INPUT');
 try {const [row]=await runtime()`SELECT app.bootstrap(${userId},${parsed.data.name},${parsed.data.mode}) AS id`; event.cookies.set('winery',row.id,{path:'/',httpOnly:true,sameSite:'lax',secure:event.url.protocol==='https:'}); return json(row,{status:201}); }catch(cause){domainError(cause);}
};
export const PUT:RequestHandler=async(event)=>{
 const userId=actor(event); const {id}=await event.request.json(); if(!(await memberships(userId)).some(t=>t.id===id)) error(403,'FORBIDDEN');
 event.cookies.set('winery',id,{path:'/',httpOnly:true,sameSite:'lax',secure:event.url.protocol==='https:'}); return json({id});
};
