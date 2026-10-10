import {chromium} from '../apps/web/node_modules/@playwright/test/index.mjs';
import {neon} from '../apps/web/node_modules/@neondatabase/serverless/index.mjs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {browserOptions} from './browser.mjs';
const base=process.env.E2E_URL??'http://localhost:5173',owner=neon(process.env.DATABASE_URL);
const browser=await chromium.launch(browserOptions()),context=await browser.newContext(),page=await context.newPage();
async function post(path,body){const r=await context.request.post(base+path,{headers:{origin:base,'idempotency-key':randomUUID()},data:body});assert(r.ok(),await r.text());return r.json();}
try{
 await page.goto(base+'/login');const auth=await post('/api/auth/sign-up/email',{name:'Cost pagination verifier',email:'cost-'+randomUUID()+'@example.invalid',password:'Cost!'+randomUUID()});
 const tenant=await post('/api/tenants',{name:'Cost pagination '+randomUUID(),mode:'standalone'}),lot=await post('/api/commands',{type:'lot_create',code:'C-PAGE',name:'Pagination lot',grape:'Riesling',vintage:2026,kind:'wine',cost_per_l:'0'});
 // Only this newly created synthetic tenant is seeded; the application read uses its normal restricted role.
 await owner`SELECT app.command(${tenant.id}::uuid,${auth.user.id},'pagination-cost-'||i,jsonb_build_object('type','cost_record','lot_id',${lot.id}::text,'category','work','amount','1','currency','EUR','basis','actual','description','Pagination fixture','invoice','')) FROM generate_series(1,501) g(i)`;
 const first=await(await context.request.get(base+'/api/read?collection=costs&limit=500')).json();assert.equal(first.rows.length,500);assert(first.next_cursor);
 const second=await(await context.request.get(base+'/api/read?collection=costs&limit=500&cursor='+first.next_cursor)).json();assert.equal(second.rows.length,1);assert.equal(second.next_cursor,null);
 await page.goto(base+'/app/costing?lang=en');const row=page.getByRole('row').filter({hasText:'C-PAGE'}).first();await row.waitFor();assert.equal(Number((await row.getByRole('cell').nth(4).innerText()).replaceAll(',','')),501);
 console.log('PASS paginated API returns 500 + 1 rows while full cost includes all 501 entries');
}catch(cause){throw new Error(String(cause.message??cause).split('\n')[0]);}finally{await browser.close();}
