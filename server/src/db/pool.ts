import pg from 'pg';
import { config } from '../config.js';

// BIGINT (int8) and NUMERIC come back as strings by default; our ids and
// aggregates fit comfortably in JS numbers.
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
pg.types.setTypeParser(1700, (v) => parseFloat(v));
// int8[] (e.g. exit_tickets.problem_ids) — OID 1016 is missing from pg's TypeId union
(pg.types.setTypeParser as (oid: number, fn: (v: string) => unknown) => void)(
  1016,
  (v) => (v === '{}' ? [] : v.slice(1, -1).split(',').map(Number)),
);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? config.databaseUrl,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}
