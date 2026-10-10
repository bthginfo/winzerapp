import { json,error } from '@sveltejs/kit';import { z } from 'zod';import { context,runtime,domainError } from '$lib/server/runtime';
import type { RequestHandler } from './$types';
export const POST:RequestHandler=async(event)=>{
 const {tenant,userId}=await context(event);if(tenant.role==='external')error(403,'FORBIDDEN');
 if(Number(event.request.headers.get('content-length')??0)>2200000)error(413,'ASSET_TOO_LARGE');
 const data=await event.request.formData();const file=data.get('file');if(!(file instanceof File)||file.size>2097152||!file.size)error(400,'INVALID_ASSET');
 const bytes=Buffer.from(await file.arrayBuffer());const mime=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':null;
 if(!mime)error(400,'INVALID_ASSET_TYPE');
 const refs=z.object({lot_id:z.uuid().optional(),vineyard_id:z.uuid().optional()}).safeParse({lot_id:data.get('lot_id')||undefined,vineyard_id:data.get('vineyard_id')||undefined});if(!refs.success)error(400,'INVALID_INPUT');
 const meta={...refs.data,filename:file.name.replace(/[\r\n\x00]/g,'').slice(0,160),mime_type:mime};
 try{const [row]=await runtime()`SELECT app.store_asset(${tenant.id}::uuid,${userId},${JSON.stringify(meta)}::jsonb,${bytes.toString('base64')}) AS id`;return json(row,{status:201});}catch(cause){domainError(cause);}
};
