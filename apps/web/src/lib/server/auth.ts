import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';
import * as schema from './auth-schema';
let instance: ReturnType<typeof create> | undefined;
function create() {
  if (!env.APP_DATABASE_URL || !env.BETTER_AUTH_SECRET) throw new Error('AUTH_NOT_CONFIGURED');
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || undefined,
    database: drizzleAdapter(drizzle(env.APP_DATABASE_URL), { provider:'pg',schema }),
    emailAndPassword: { enabled:true,minPasswordLength:12,maxPasswordLength:128 },
    session: { expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false} },
    rateLimit: { enabled:true,storage:'database',window:60,max:60 },
    plugins:[twoFactor({issuer:'Vinea Winzerapp'}),sveltekitCookies(getRequestEvent)]
  });
}
export function getAuth() { return instance ??= create(); }
