import { json } from '@sveltejs/kit';
import { database } from '$lib/server/database';

/** Infrastructure probe only: no credentials, tenant data or SQL errors exposed. */
export async function GET() {
  try {
    const sql = database();
    const result = await sql`SELECT 1 AS connected`;
    if (result[0]?.connected !== 1) throw new Error('DATABASE_UNAVAILABLE');
    return json({ status: 'ok', database: 'connected' }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return json({ status: 'unavailable', database: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
