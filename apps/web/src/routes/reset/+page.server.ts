import {mailConfigured} from '$lib/server/mail';export const load:import('./$types').PageServerLoad=({locals})=>({lang:locals.lang,mailEnabled:mailConfigured()});
