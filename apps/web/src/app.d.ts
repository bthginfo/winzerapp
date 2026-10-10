import type { Language } from '$lib/i18n';
import type { getAuth } from '$lib/server/auth';
declare global { namespace App { interface Locals { lang:Language; identity: typeof getAuth extends ()=>infer A ? A extends { $Infer:{ Session:infer S }} ? S|null : never : never; } } }
export {};
