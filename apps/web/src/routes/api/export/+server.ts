import { error } from '@sveltejs/kit';import Papa from 'papaparse';import ExcelJS from 'exceljs';import { context,runtime,domainError } from '$lib/server/runtime';import { readModel } from '$lib/server/read-model';
import type { RequestHandler } from './$types';
const safe=(value:unknown)=>typeof value==='string'&&/^[=+\-@\t\r]/.test(value)?"'"+value:value;
export const GET:RequestHandler=async(event)=>{
 const {tenant,userId}=await context(event);if(!['owner','oenologist','office'].includes(tenant.role))error(403,'FORBIDDEN');const format=event.url.searchParams.get('format')??'json';if(!['json','csv','xlsx'].includes(format))error(400,'INVALID_FORMAT');
 const model=await readModel(tenant.id,userId,null);const snapshot={version:1,winery:{id:tenant.id,name:tenant.name,mode:tenant.mode},captured_at:new Date().toISOString(),...model};
 try{await runtime()`SELECT app.command(${tenant.id}::uuid,${userId},${crypto.randomUUID()},${JSON.stringify({type:'export_snapshot',kind:format,snapshot})}::jsonb)`;}catch(cause){domainError(cause);}
 const headers={'Content-Disposition':`attachment; filename="vinea-${new Date().toISOString().slice(0,10)}.${format}"`};
 if(format==='json')return new Response(JSON.stringify(snapshot,null,2),{headers:{...headers,'Content-Type':'application/json'}});
 if(format==='csv'){const rows=model.positions.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,safe(v)])));return new Response('\uFEFF'+Papa.unparse(rows),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}});}
 const book=new ExcelJS.Workbook();book.creator='Vinea';for(const [table,rows] of Object.entries(model)){const sheet=book.addWorksheet(table.slice(0,31));if(!rows.length)continue;const keys=Object.keys(rows[0]);sheet.addRow(keys);for(const row of rows)sheet.addRow(keys.map(key=>safe(typeof row[key]==='object'?JSON.stringify(row[key]):row[key])));sheet.getRow(1).font={bold:true};sheet.columns.forEach(column=>column.width=24);}
 return new Response(new Uint8Array(await book.xlsx.writeBuffer()),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
};
