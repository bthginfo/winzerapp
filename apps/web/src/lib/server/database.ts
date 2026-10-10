import { env } from '$env/dynamic/private';
import { neon } from '@neondatabase/serverless';

/** Server-only, initialized on demand; no database access during builds. */
export function database() {
  if (!env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  return neon(env.DATABASE_URL);
}
