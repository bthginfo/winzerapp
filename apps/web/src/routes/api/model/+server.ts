import { json } from '@sveltejs/kit';import { context } from '$lib/server/runtime';import { readModel } from '$lib/server/read-model';
export const GET:import('./$types').RequestHandler=async(event)=>{const {tenant,userId}=await context(event);return json(await readModel(tenant.id,userId));};
