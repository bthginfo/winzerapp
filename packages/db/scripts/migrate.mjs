import { readFile, readdir, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { neon } from '../../../apps/web/node_modules/@neondatabase/serverless/index.mjs';
import { statements as splitSql } from './sql.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migrations');
const sql = neon(process.env.DATABASE_URL);
// Independent runtime role: application requests never use the Neon owner credential.
const runtimeUrl = new URL(process.env.DATABASE_URL);
const password = process.env.APP_DATABASE_URL ? new URL(process.env.APP_DATABASE_URL).password : randomBytes(36).toString('base64url');
const exists = await sql`SELECT 1 FROM pg_roles WHERE rolname='vinea_runtime'`;
const creation = await sql`SELECT format(${exists.length ? 'ALTER ROLE vinea_runtime PASSWORD %L' : 'CREATE ROLE vinea_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L'}::text,${password}::text) AS statement`;
await sql.query(creation[0].statement,[]);

await sql`CREATE TABLE IF NOT EXISTS public.vinea_migration (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter(x=>x.endsWith('.sql')).sort()) {
  const source = await readFile(new URL('../migrations/'+name, import.meta.url),'utf8');
  const checksum = createHash('sha256').update(source).digest('hex');
  const found = await sql`SELECT checksum FROM public.vinea_migration WHERE name=${name}`;
  if (found.length) {
    if (found[0].checksum !== checksum) throw new Error('Changed applied migration: '+name);
    console.log('Unchanged migration: '+name); continue;
  }
  await sql.transaction([
    ...splitSql(source).map(statement=>sql.query(statement,[])),
    sql`INSERT INTO public.vinea_migration(name,checksum) VALUES(${name},${checksum})`
  ]);
  console.log('Applied migration: '+name);
}

await sql.transaction(splitSql(`
  GRANT USAGE ON SCHEMA app,public TO vinea_runtime;
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  GRANT SELECT ON ALL TABLES IN SCHEMA app TO vinea_runtime;
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.auth_user,public.auth_session,public.auth_account,public.auth_verification,public.auth_rate_limit,public.auth_two_factor TO vinea_runtime;
  GRANT EXECUTE ON FUNCTION app.command(uuid,text,text,jsonb),app.bootstrap(text,text,text),app.my_tenants(text),app.tenant_id(),app.actor_id(),app.is_member(uuid),app.role(),app.current_member(uuid),app.available(uuid,uuid) TO vinea_runtime;
`).map(statement=>sql.query(statement,[])));
runtimeUrl.username='vinea_runtime'; runtimeUrl.password=password;
await writeFile(new URL('../../../.env.runtime.local',import.meta.url),'APP_DATABASE_URL='+JSON.stringify(runtimeUrl.toString())+'\n',{mode:0o600});
console.log('Runtime role provisioned; URL stored in ignored .env.runtime.local');
