import {createHash} from 'node:crypto';import { json,error } from '@sveltejs/kit';
import Papa from 'papaparse';import ExcelJS from 'exceljs';import {context} from '$lib/server/runtime';
import type { RequestHandler } from './$types';
export const POST:RequestHandler=async event=>{
 const {tenant}=await context(event);if(!['owner','oenologist','office'].includes(tenant.role))error(403,'FORBIDDEN');
 if(Number(event.request.headers.get('content-length')??0)>3100000)error(413,'IMPORT_TOO_LARGE');
 const form=await event.request.formData();const file=form.get('file');if(!(file instanceof File)||file.size>2097152)error(413,'IMPORT_TOO_LARGE');
 let rows:Record<string,string>[];
 if(file.name.endsWith('.json')){
  let parsed;try{parsed=JSON.parse(await file.text());}catch{error(400,'INVALID_JSON');}
  if(!Array.isArray(parsed)||parsed.length>5000||parsed.some(row=>typeof row!=='object'||row===null||Array.isArray(row)))error(400,'JSON_ARRAY_REQUIRED');
  rows=parsed.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='object'?JSON.stringify(value):String(value??'')])));
 }else if(file.name.endsWith('.xlsx')){
  try{const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());const sheet=workbook.worksheets[0];if(!sheet||sheet.rowCount>5001||sheet.columnCount>50)error(413,'IMPORT_TOO_LARGE');const columns=Array.from({length:sheet.columnCount},(_,i)=>sheet.getRow(1).getCell(i+1).text);if(new Set(columns).size!==columns.length)error(400,'DUPLICATE_COLUMNS');rows=[];sheet.eachRow((row,i)=>{if(i>1)rows.push(Object.fromEntries(columns.map((key,j)=>[key,row.getCell(j+1).text])));});}catch(cause){if(cause&&typeof cause==='object'&&'status' in cause)throw cause;error(400,'INVALID_XLSX');}
 }else {const parsed=Papa.parse<Record<string,string>>(await file.text(),{header:true,skipEmptyLines:'greedy'});if(parsed.errors.length)error(400,'CSV_PARSE_ERROR');rows=parsed.data;}
 if(rows.length>5000||!rows.length||Object.keys(rows[0]).length>50)error(400,'INVALID_IMPORT');
 const original=Buffer.from(await file.arrayBuffer()).toString('base64');const csv=Papa.unparse(rows);if(csv.length>3000000)error(413,'IMPORT_TOO_LARGE');return json({csv,columns:Object.keys(rows[0]),filename:file.name,original_base64:original,original_sha256:createHash('sha256').update(new Uint8Array(await file.arrayBuffer())).digest('hex')});
};
