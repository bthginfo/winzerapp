import { neon } from '../../../apps/web/node_modules/@neondatabase/serverless/index.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const owner=neon(process.env.DATABASE_URL),sql=neon(process.env.APP_DATABASE_URL);
const user='verification-'+randomUUID();
await owner`INSERT INTO public.auth_user(id,name,email) VALUES(${user},'Automated verification',${user+'@example.invalid'})`;
const [{id:tid}]=await sql`SELECT app.bootstrap(${user},${'Verification '+user},'standalone') AS id`;
const [{id:other}]=await sql`SELECT app.bootstrap(${user},${'Other verification '+user},'standalone') AS id`;
async function cmd(body,key=randomUUID(),tenant=tid,actor=user){const [row]=await sql`SELECT app.command(${tenant}::uuid,${actor},${key},${JSON.stringify(body)}::jsonb) AS result`;return row.result;}
async function read(query,params=[],tenant=tid,actor=user){const rows=await sql.transaction([sql`SELECT set_config('app.tenant_id',${tenant},true),set_config('app.actor_id',${actor},true)`,sql.query(query,params)]);return rows[1];}
let passed=0;async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
const vessels=[];for(let i=0;i<8;i++)vessels.push((await cmd({type:'vessel_create',code:'T'+i,name:'Tank '+i,capacity_l:'5000'})).id);
const lot=(await cmd({type:'lot_create',code:'W1',name:'Wine 1',vintage:2026,cost_per_l:'2'})).id;
const pos=(await cmd({type:'opening',lot_id:lot,vessel_id:vessels[0],quantity_l:'1000'})).id;
await check('runtime role cannot bypass RLS',async()=>{const [r]=await sql`SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user`;assert.equal(r.rolbypassrls,false);assert.equal(r.rolsuper,false);assert.equal((await sql`SELECT * FROM app.position`).length,0);});
await check('two simultaneous 600 L commands cannot spend 1000 L twice',async()=>{
 const outcomes=await Promise.allSettled([1,2].map(i=>cmd({type:'transfer',position_id:pos,target_vessel_id:vessels[i],quantity_l:'600',expected_version:1})));
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal((await read('SELECT quantity_l::text AS q FROM app.position WHERE id=$1',[pos]))[0].q,'400.000');
});
await check('retry returns original result and payload mismatch fails',async()=>{const body={type:'loss',position_id:pos,quantity_l:'1',expected_version:2};const key=randomUUID();const first=await cmd(body,key);assert.deepEqual(await cmd(body,key),first);await assert.rejects(cmd({...body,quantity_l:'2'},key),/IDEMPOTENCY_CONFLICT/);});
await check('journal conserves volume and matches physical projection',async()=>{const rows=await read('SELECT operation_id,sum(quantity_l)::text AS q FROM app.ledger GROUP BY operation_id');assert(rows.every(r=>Number(r.q)===0));const [r]=await read("SELECT p.quantity_l=sum(e.quantity_l) AS matches FROM app.position p JOIN app.ledger e ON e.tenant_id=p.tenant_id AND e.position_id=p.id WHERE p.id=$1 AND e.account='stock' GROUP BY p.quantity_l",[pos]);assert.equal(r.matches,true);});
await check('cross-tenant references and reads rejected',async()=>{assert.equal((await read('SELECT * FROM app.position WHERE id=$1',[pos],other)).length,0);await assert.rejects(cmd({type:'opening',lot_id:lot,vessel_id:vessels[0],quantity_l:'1'},randomUUID(),other),/NOT_FOUND/);});
await check('runtime cannot mutate append-only ledger',async()=>{await assert.rejects(sql`UPDATE app.ledger SET quantity_l=0`,/permission denied/);});
await check('blocked lots cannot be spent',async()=>{await cmd({type:'lot_block',lot_id:lot,blocked:true,reason:'Quality review',expected_version:1});await assert.rejects(cmd({type:'loss',position_id:pos,quantity_l:'1',expected_version:3}),/BLOCKED_SOURCE/);await cmd({type:'lot_block',lot_id:lot,blocked:false,reason:'Quality released',expected_version:2});});
const lot2=(await cmd({type:'lot_create',code:'W2',name:'Wine 2',vintage:2026})).id;
const pos2=(await cmd({type:'opening',lot_id:lot2,vessel_id:vessels[3],quantity_l:'1000'})).id;
await check('occupied tank does not silently mix wine',async()=>{await assert.rejects(cmd({type:'transfer',position_id:pos2,target_vessel_id:vessels[0],quantity_l:'1',expected_version:1}),/OCCUPIED_VESSEL/);});
const project=(await cmd({type:'project_create',name:'Verification blend',target_l:'100'})).id;
const recipe=(await cmd({type:'recipe_save',project_id:project,name:'60 / 40',components:[{position_id:pos,quantity_l:'60'},{position_id:pos2,quantity_l:'40'}]})).id;
await check('frozen recipes preserve evidence and stock-taking trial consumes exactly 250ml',async()=>{
 await cmd({type:'recipe_freeze',recipe_id:recipe,expected_version:1});await assert.rejects(cmd({type:'recipe_freeze',recipe_id:recipe,expected_version:2}),/RECIPE_FROZEN/);
 const trial=await cmd({type:'trial',recipe_id:recipe,sample_ml:'250'});const [r]=await read('SELECT quantities FROM app.trial WHERE id=$1',[trial.id]);assert.equal(r.quantities.reduce((s,q)=>s+Number(q.actual_l),0),.25);
});
const order=(await cmd({type:'approve',review_acknowledged:true,recipe_id:recipe,expected_version:2,target_vessel_id:vessels[4]})).id;
let partialResult;
await check('partial production consumes its own reservations and preserves remainder',async()=>{
 const [a]=await read('SELECT version FROM app.position WHERE id=$1',[pos]);const [b]=await read('SELECT version FROM app.position WHERE id=$1',[pos2]);
 const result=partialResult=await cmd({type:'produce',order_id:order,order_version:1,target_vessel_id:vessels[4],code:'BL1',name:'Partial blend',vintage:2026,sources:[{position_id:pos,quantity_l:'30',expected_version:a.version},{position_id:pos2,quantity_l:'20',expected_version:b.version}]});
 const [r]=await read('SELECT status FROM app.blend_order WHERE id=$1',[order]);assert.equal(r.status,'partial');const reserves=await read('SELECT remaining_l::text FROM app.reservation WHERE order_id=$1 ORDER BY remaining_l',[order]);assert.deepEqual(reserves.map(x=>x.remaining_l),['20.000','30.000']);
 const ancestry=await read('SELECT contribution_l::text FROM app.lineage WHERE child_lot_id=$1 ORDER BY contribution_l',[result.id]);assert.deepEqual(ancestry.map(x=>x.contribution_l),['20.000','30.000']);
});
await check('reservations protect stock from unrelated commands',async()=>{const [p]=await read('SELECT quantity_l::text,version FROM app.position WHERE id=$1',[pos]);await assert.rejects(cmd({type:'loss',position_id:pos,quantity_l:p.quantity_l,expected_version:p.version}),/INSUFFICIENT_STOCK/);});
await check('bottling 1000 × 0.75 L plus 5 L loss consumes 755 L',async()=>{const product=(await cmd({type:'product_create',name:'Verification bottles'})).id;const sku=(await cmd({type:'sku_create',product_id:product,code:'075',fill_l:'0.75'})).id;const [p]=await read('SELECT version FROM app.position WHERE id=$1',[pos2]);await cmd({type:'bottle',position_id:pos2,expected_version:p.version,sku_id:sku,code:'B1',bottle_count:1000,loss_l:'5'});const [r]=await read('SELECT quantity_l::text FROM app.position WHERE id=$1',[pos2]);assert.equal(r.quantity_l,'224.900');});
await check('offline stale versions report conflict',async()=>{const task=(await cmd({type:'task_create',title:'Check tank'})).id;await cmd({type:'task_update',task_id:task,status:'doing',expected_version:1});await assert.rejects(cmd({type:'task_update',task_id:task,status:'done',expected_version:1}),/VERSION_CONFLICT/);});
await check('remaining partial order finishes in occupied target with explicit carry-over lineage',async()=>{
 const [a]=await read('SELECT version FROM app.position WHERE id=$1',[pos]);const [b]=await read('SELECT version FROM app.position WHERE id=$1',[pos2]);const [c]=await read('SELECT version,quantity_l::text FROM app.position WHERE id=$1',[partialResult.position_id]);
 const produced=await cmd({type:'produce',order_id:order,order_version:2,target_vessel_id:vessels[4],code:'BL2',name:'Finished blend',vintage:2026,sources:[{position_id:pos,quantity_l:'30',expected_version:a.version},{position_id:pos2,quantity_l:'20',expected_version:b.version},{position_id:partialResult.position_id,quantity_l:c.quantity_l,expected_version:c.version}]});
 assert.equal(produced.quantity_l,'100.000');const [r]=await read('SELECT status FROM app.blend_order WHERE id=$1',[order]);assert.equal(r.status,'completed');
});
await check('500 L transfer with 3 L documented loss and target capacity enforcement',async()=>{
 const third=(await cmd({type:'lot_create',code:'W3',name:'Wine 3',vintage:2026})).id;const source=(await cmd({type:'opening',lot_id:third,vessel_id:vessels[5],quantity_l:'1000'})).id;
 const small=(await cmd({type:'vessel_create',code:'SMALL',name:'Small tank',capacity_l:'10'})).id;
 await assert.rejects(cmd({type:'transfer',position_id:source,expected_version:1,target_vessel_id:small,quantity_l:'500',loss_l:'3'}),/CAPACITY_EXCEEDED/);
 await cmd({type:'transfer',position_id:source,expected_version:1,target_vessel_id:vessels[6],quantity_l:'500',loss_l:'3'});
 const [r]=await read('SELECT quantity_l::text FROM app.position WHERE lot_id=$1 AND vessel_id=$2',[third,vessels[6]]);assert.equal(r.quantity_l,'497.000');
});
await check('external laboratory reads only authorized lots and cannot issue stock commands',async()=>{
 const ext='external-'+randomUUID();await owner`INSERT INTO public.auth_user(id,name,email) VALUES(${ext},'External verifier',${ext+'@example.invalid'})`;
 await cmd({type:'member_set',user_id:ext,role:'external',scope:[lot]});
 const visible=await read('SELECT id FROM app.lot',[],tid,ext);assert.deepEqual(visible.map(l=>l.id),[lot]);assert.equal((await read('SELECT * FROM app.position',[],tid,ext)).length,0);
 await assert.rejects(cmd({type:'loss',position_id:pos,quantity_l:'1',expected_version:1},randomUUID(),tid,ext),/FORBIDDEN/);
 const [{id:alien}]=await sql`SELECT app.bootstrap(${ext},'External own winery','standalone') AS id`;
 await assert.rejects(sql`SELECT app.process_jobs(${other}::uuid,${ext},1)`,/FORBIDDEN/);
});
await check('ambiguous ERP outcome reconciles receipt before any repeated write',async()=>{
 const event=randomUUID();await owner`INSERT INTO app.outbox(tenant_id,id,event_type,data) VALUES(${tid}::uuid,${event}::uuid,'verification',${JSON.stringify({demo_behavior:'ambiguous'})}::jsonb)`;
 for(let i=0;i<5;i++)await sql`SELECT app.process_jobs(${tid}::uuid,${user},100)`;
 const [r]=await read('SELECT status,attempts FROM app.outbox WHERE id=$1',[event]);assert.equal(r.status,'succeeded');assert.equal(r.attempts,1);
 assert.equal((await read('SELECT * FROM app.demo_receipt WHERE event_id=$1',[event])).length,1);
});
await check('deviations require exact approval and release unused plan reservations on completion',async()=>{
 const pr=(await cmd({type:'project_create',name:'Deviation check',target_l:'100'})).id;const r=(await cmd({type:'recipe_save',project_id:pr,name:'60/40 deviation',components:[{position_id:pos,quantity_l:'60'},{position_id:pos2,quantity_l:'40'}]})).id;await cmd({type:'recipe_freeze',recipe_id:r,expected_version:1});
 const o=(await cmd({type:'approve',review_acknowledged:true,recipe_id:r,expected_version:2,target_vessel_id:vessels[7]})).id;
 const [a]=await read('SELECT version FROM app.position WHERE id=$1',[pos]);const [b]=await read('SELECT version FROM app.position WHERE id=$1',[pos2]);
 const body={type:'produce',order_id:o,order_version:1,target_vessel_id:vessels[7],code:'DEV',name:'Approved deviation',vintage:2026,sources:[{position_id:pos,quantity_l:'50',expected_version:a.version},{position_id:pos2,quantity_l:'50',expected_version:b.version}]};
 await assert.rejects(cmd(body),/DEVIATION_REQUIRES_APPROVAL/);await cmd({type:'approve_deviation',order_id:o,expected_version:1,reason:'Reviewed 50/50 actual ratio',sources:body.sources.map(({expected_version,...source})=>source)});await cmd({...body,order_version:2});
 const [row]=await read('SELECT status FROM app.blend_order WHERE id=$1',[o]);assert.equal(row.status,'completed');const [active]=await read("SELECT count(*)::text AS n FROM app.reservation WHERE order_id=$1 AND status='active'",[o]);assert.equal(active.n,'0');
});
await check('blind evaluations remain private to each evaluator',async()=>{
 const evaluator='taster-'+randomUUID();await owner`INSERT INTO public.auth_user(id,name,email) VALUES(${evaluator},'Taster verifier',${evaluator+'@example.invalid'})`;await cmd({type:'member_set',user_id:evaluator,role:'cellar',scope:[]});const [trial]=await read('SELECT id FROM app.trial LIMIT 1');await cmd({type:'evaluate',trial_id:trial.id,score:80,aroma:8,balance:8},randomUUID(),tid,user);await cmd({type:'evaluate',trial_id:trial.id,score:70,aroma:7,balance:7},randomUUID(),tid,evaluator);
 const own=await read('SELECT evaluator_id FROM app.evaluation',[],tid,evaluator);assert.equal(own.length,1);assert.equal(own[0].evaluator_id,evaluator);assert.equal((await read('SELECT * FROM app.evaluation')).length,2);
});
await check('ERP-mode bottling records ERP authority without a duplicate bottle stock',async()=>{
 const [{id:erp}]=await sql`SELECT app.bootstrap(${user},'ERP verification','erp') AS id`;
 const call=body=>cmd(body,randomUUID(),erp);const v=(await call({type:'vessel_create',code:'ERP-T',name:'ERP tank',capacity_l:'1000'})).id;const l=(await call({type:'lot_create',code:'ERP-L',name:'ERP wine',vintage:2026})).id;const p=(await call({type:'opening',vessel_id:v,lot_id:l,quantity_l:'1000'})).id;const product=(await call({type:'product_create',name:'ERP product'})).id;const sku=(await call({type:'sku_create',product_id:product,code:'ERP-075',fill_l:'0.75'})).id;const bottled=await call({type:'bottle',position_id:p,expected_version:1,sku_id:sku,code:'ERP-1000',bottle_count:1000,loss_l:'5'});const [row]=await read('SELECT stock_authority FROM app.bottling WHERE id=$1',[bottled.id],erp);assert.equal(row.stock_authority,'erp');
});
console.log(`${passed} real PostgreSQL checks passed. Test fixtures are isolated in verification wineries.`);
