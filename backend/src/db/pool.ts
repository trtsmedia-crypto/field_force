import pg from 'pg';
import { config } from '../config.js';

// Numeric columns come back as strings by default; the API sends JSON numbers.
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

// Cloud Run and similar platforms connect to Cloud SQL over a local Unix
// socket (the URL contains "/cloudsql/"), which the Cloud SQL Auth Proxy
// sidecar already encrypts — wrapping that in TLS again breaks the
// connection. A plain TCP connection to anything other than localhost still
// needs TLS, since that traffic is on the open network.
const isSocketConnection = config.databaseUrl.includes('/cloudsql/');
const isLocal = config.databaseUrl.includes('localhost');

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal || isSocketConnection ? undefined : { rejectUnauthorized: false },
  max: 10,
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function one<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
