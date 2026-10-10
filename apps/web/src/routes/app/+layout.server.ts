import { redirect } from '@sveltejs/kit';
import { runtime,memberships } from '$lib/server/runtime';
export const load:import('./$types').LayoutServerLoad=async({locals,cookies})=>{
 if(!locals.identity) redirect(303,'/login');
 const tenants=await memberships(locals.identity.user.id);
 const tenant=tenants.find(t=>t.id===cookies.get('winery'))??tenants[0]??null;
 let settings=null;if(tenant){const sql=runtime();const rows=await sql.transaction([sql`SELECT set_config('app.tenant_id',${tenant.id},true),set_config('app.actor_id',${locals.identity.user.id},true)`,sql`SELECT country,region,modules,version FROM app.tenant_settings`]);settings=rows[1][0]??null;}
 return {settings,lang:locals.lang,user:{id:locals.identity.user.id,name:locals.identity.user.name,email:locals.identity.user.email,emailVerified:locals.identity.user.emailVerified,twoFactorEnabled:locals.identity.user.twoFactorEnabled},tenants,tenant};
};
