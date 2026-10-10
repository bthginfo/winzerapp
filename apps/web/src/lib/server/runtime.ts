import { neon } from '@neondatabase/serverless';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
export function runtime() { if(!env.APP_DATABASE_URL) error(503,'DATABASE_NOT_CONFIGURED'); return neon(env.APP_DATABASE_URL); }
export function actor(event:RequestEvent) { if(!event.locals.identity) error(401,'UNAUTHENTICATED'); return event.locals.identity.user.id; }
export async function memberships(userId:string) { return runtime()`SELECT * FROM app.my_tenants(${userId})`; }
export async function context(event:RequestEvent) {
  const userId=actor(event); const tenants=await memberships(userId);
  const tid=event.cookies.get('winery'); const tenant=tenants.find(t=>t.id===tid)??tenants[0];
  if(!tenant) error(409,'WINERY_REQUIRED'); return {userId,tenant,tenants};
}
export function domainError(cause:unknown):never {
  const message=cause instanceof Error?cause.message:'UNKNOWN_ERROR';
  const code=message.match(/\b[A-Z][A-Z_]{4,}\b/)?.[0]??'DATABASE_ERROR';
  const status=code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:code==='DATABASE_ERROR'?500:409;
  error(status,code);
}
