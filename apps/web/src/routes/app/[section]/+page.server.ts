import { error } from '@sveltejs/kit';
import { readModel } from '$lib/server/read-model';
export const load:import('./$types').PageServerLoad=async({params,parent})=>{
 if(!['today','vineyard','harvest','cellar','blends','lab','bottling','reports','data','admin'].includes(params.section)) error(404,'NOT_FOUND');
 const {tenant,user}=await parent();
 return {section:params.section,model:tenant?await readModel(tenant.id,user.id):null};
};
