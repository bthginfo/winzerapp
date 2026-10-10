import { neon } from '../../../apps/web/node_modules/@neondatabase/serverless/index.mjs';
import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
const sql=neon(process.env.DATABASE_URL);
const key=Buffer.from(process.env.BACKUP_KEY??'','base64url');if(key.length!==32)throw new Error('BACKUP_KEY must contain 32 random bytes (base64url)');
const quote=s=>'"'+s.replaceAll('"','""')+'"';const qualified=name=>name.split('.').map(quote).join('.');
const tables=await sql`SELECT table_schema||'.'||table_name AS name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_schema='app' OR (table_schema='public' AND table_name LIKE 'auth_%')) ORDER BY table_schema,table_name`;
async function columns(name){return sql`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=${name.split('.')[0]} AND table_name=${name.split('.')[1]} ORDER BY ordinal_position`;}
const file=process.argv[3]??'backups/vinea-'+new Date().toISOString().replaceAll(':','-')+'.enc';
async function main(){
 if(process.argv[2]==='restore'){
  if(process.env.RESTORE_CONFIRM!=='ISOLATED_EMPTY_DATABASE')throw new Error('Restore requires RESTORE_CONFIRM=ISOLATED_EMPTY_DATABASE');
  for(const table of tables){const [row]=await sql.query('SELECT count(*)::text AS n FROM '+qualified(table.name),[]);if(row.n!=='0')throw new Error('Restore target is not empty: '+table.name);}
  const bytes=await readFile(file);if(bytes.subarray(0,8).toString()!=='VINEABK1')throw new Error('Invalid encrypted backup');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(8,20));decipher.setAuthTag(bytes.subarray(20,36));
  const snapshot=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(36)),decipher.final()]).toString());
  const known=new Set(tables.map(t=>t.name));const queries=[];
  for(const table of snapshot.tables){if(!known.has(table.name))throw new Error('Unknown restore table');const actual=await columns(table.name);if(JSON.stringify(actual)!==JSON.stringify(table.columns))throw new Error('Restore schema mismatch: '+table.name);
   // One INSERT statement per table resolves self-referencing history FKs at statement end.
   if(!table.rows.length)continue;
   const values=[];const groups=table.rows.map(row=>'('+actual.map(col=>{const value=row[col.column_name];values.push(col.data_type==='jsonb'||col.data_type==='json'?JSON.stringify(value):value);return '$'+values.length;}).join(',')+')');
   queries.push(sql.query('INSERT INTO '+qualified(table.name)+' ('+actual.map(c=>quote(c.column_name)).join(',')+') VALUES '+groups.join(','),values));
  }
  await sql.transaction(queries);console.log('Restored '+snapshot.tables.reduce((n,t)=>n+t.rows.length,0)+' rows into verified empty database');return;
 }
 const dependencies=await sql`SELECT ns.nspname||'.'||child.relname AS child,pns.nspname||'.'||parent.relname AS parent FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace JOIN pg_class parent ON parent.oid=c.confrelid JOIN pg_namespace pns ON pns.oid=parent.relnamespace WHERE c.contype='f' AND (ns.nspname='app' OR (ns.nspname='public' AND child.relname LIKE 'auth_%'))`;
 const remaining=[...tables.map(t=>t.name)],ordered=[];
 while(remaining.length){const index=remaining.findIndex(name=>!dependencies.some(d=>d.child===name&&d.parent!==name&&remaining.includes(d.parent)));if(index<0)throw new Error('Unsupported cyclic schema dependency');ordered.push(...remaining.splice(index,1));}
 const snapshot={format:1,captured_at:new Date().toISOString(),tables:[]};
 // Single database transaction gives every table the same MVCC snapshot.
 const descriptions=[];for(const name of ordered){const cols=await columns(name);descriptions.push({name,columns:cols});}
 const results=await sql.transaction(descriptions.map(table=>sql.query('SELECT '+table.columns.map(col=>col.data_type==='numeric'?quote(col.column_name)+'::text AS '+quote(col.column_name):col.data_type==='bytea'?"'\\x'||encode("+quote(col.column_name)+",'hex') AS "+quote(col.column_name):quote(col.column_name)).join(',')+' FROM '+qualified(table.name),[])),{isolationLevel:'RepeatableRead',readOnly:true});
 snapshot.tables=descriptions.map((table,i)=>({...table,rows:results[i]}));
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(snapshot)),cipher.final()]);
 await mkdir(new URL('../../../backups',import.meta.url),{recursive:true,mode:0o700});await writeFile(file,Buffer.concat([Buffer.from('VINEABK1'),iv,cipher.getAuthTag(),encrypted]),{mode:0o600});
 console.log('Encrypted backup: '+file+'; '+snapshot.tables.reduce((n,t)=>n+t.rows.length,0)+' rows');
}
await main().catch(error=>{console.error(error.message);process.exit(1);});
