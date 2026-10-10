import { redirect } from '@sveltejs/kit';
import { memberships } from '$lib/server/runtime';
export const load:import('./$types').LayoutServerLoad=async({locals,cookies})=>{
 if(!locals.identity) redirect(303,'/login');
 const tenants=await memberships(locals.identity.user.id);
 const tenant=tenants.find(t=>t.id===cookies.get('winery'))??tenants[0]??null;
 return {lang:locals.lang,user:{id:locals.identity.user.id,name:locals.identity.user.name,email:locals.identity.user.email,twoFactorEnabled:locals.identity.user.twoFactorEnabled},tenants,tenant};
};
