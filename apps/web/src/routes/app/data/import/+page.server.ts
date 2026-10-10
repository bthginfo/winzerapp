import { error } from '@sveltejs/kit';
export const load:import('./$types').PageServerLoad=async({parent})=>{const data=await parent();if(!data.tenant||!['owner','oenologist','office'].includes(data.tenant.role))error(403,'FORBIDDEN');return {};};
