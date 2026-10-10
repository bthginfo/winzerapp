import { error } from '@sveltejs/kit';
import { readModel } from '$lib/server/read-model';
import {costSummary} from '@vinea/domain/costs';
export const load:import('./$types').PageServerLoad=async({params,parent})=>{
 if(!['today','vineyard','harvest','cellar','blends','lab','bottling','hygiene','costing','assistant','reports','data','admin'].includes(params.section)) error(404,'NOT_FOUND');
 const {tenant,user}=await parent();
 if(!tenant)return {section:params.section,model:null,fullCosts:null};
 const [model,costModel]=await Promise.all([readModel(tenant.id,user.id),params.section==='costing'?readModel(tenant.id,user.id,null,['lots','ledger','costs','cost_allocations','bottlings']):Promise.resolve(null)]);
 return {section:params.section,model,fullCosts:costModel?costSummary(costModel):null};
};
