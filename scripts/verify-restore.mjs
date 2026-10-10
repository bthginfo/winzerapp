import { neon } from '../apps/web/node_modules/@neondatabase/serverless/index.mjs';
import { readFile,writeFile } from 'node:fs/promises';import { execFile } from 'node:child_process';import { promisify } from 'node:util';import { randomUUID } from 'node:crypto';import assert from 'node:assert/strict';
const execute=promisify(execFile);const owner=neon(process.env.DATABASE_URL);const name='vinea_restore_'+randomUUID().replaceAll('-','');const file='backups/restore-verification.enc';const original=await readFile('.env.runtime.local');
async function run(script,args=[],env=process.env){const result=await execute(process.execPath,[script,...args],{env,maxBuffer:1024*1024});console.log(result.stdout.trim());}
await run('packages/db/scripts/backup.mjs',['backup',file]);
const [can]=await owner`SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user`;if(!can.rolcreatedb)throw new Error('Isolated restore database creation is unavailable');
await owner.query('CREATE DATABASE '+name,[]);
try{
 const targetOwner=new URL(process.env.DATABASE_URL);targetOwner.pathname='/'+name;
 const targetRuntime=new URL(process.env.APP_DATABASE_URL);targetRuntime.pathname='/'+name;
 const isolated={...process.env,DATABASE_URL:targetOwner.toString(),APP_DATABASE_URL:targetRuntime.toString(),RESTORE_CONFIRM:'ISOLATED_EMPTY_DATABASE'};
 await run('packages/db/scripts/migrate.mjs',[],isolated);await run('packages/db/scripts/backup.mjs',['restore',file],isolated);
 const restored=neon(targetOwner.toString());const counts=await Promise.all([owner`SELECT count(*)::text AS n FROM app.operation`,restored`SELECT count(*)::text AS n FROM app.operation`]);assert.equal(counts[0][0].n,counts[1][0].n);
 const tables=await owner`SELECT table_schema||'.'||table_name AS name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_schema='app' OR (table_schema='public' AND table_name LIKE 'auth_%')) ORDER BY table_schema,table_name`;
 const quote=value=>'\"'+value.replaceAll('\"','\"\"')+'\"';const countSql=tables.map(t=>'SELECT '+"'"+t.name+"'"+' AS name,count(*)::text AS n FROM '+t.name.split('.').map(quote).join('.')).join(' UNION ALL ')+' ORDER BY name';assert.deepEqual(await owner.query(countSql,[]),await restored.query(countSql,[]));
 const [rebuilt]=await restored`SELECT count(*)::text AS n FROM app.position p WHERE p.quantity_l<>coalesce((SELECT sum(l.quantity_l) FROM app.ledger l WHERE l.tenant_id=p.tenant_id AND l.position_id=p.id AND l.account='stock'),0)`;assert.equal(rebuilt.n,'0');console.log('PASS every restored table count and positions rebuilt from the quantity journal');
 const mismatches=await restored`SELECT count(*)::text AS n FROM (SELECT operation_id FROM app.ledger GROUP BY tenant_id,operation_id HAVING sum(quantity_l)<>0) q`;assert.equal(mismatches[0].n,'0');
 const [files]=await restored`SELECT count(*)::text AS n FROM app.asset WHERE sha256<>encode(public.digest(content,'sha256'),'hex')`;assert.equal(files.n,'0');console.log('PASS isolated encrypted backup / restore, operation count, journal balance and private file hashes');
 await assert.rejects(run('packages/db/scripts/backup.mjs',['restore',file],isolated),/not empty/);console.log('PASS restore refuses a populated target');
}finally{await writeFile('.env.runtime.local',original,{mode:0o600});await owner.query('DROP DATABASE '+name+' WITH (FORCE)',[]);console.log('Removed only the temporary restore verification database');}
