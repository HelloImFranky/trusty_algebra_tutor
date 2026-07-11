/**
 * Plain-SQL migration runner (migrations/*.sql embedded at generate time,
 * applied in filename order, tracked in schema_migrations). The SQL files are
 * idempotent, so both fresh databases and volumes from older versions of the
 * app upgrade in place — no separate baseline/reset step for teachers to run.
 */
import url from 'node:url';
import pg from 'pg';
import { migrations } from './migrationsData.js';

export async function migrate(databaseUrl?: string): Promise<void> {
  // On Vercel the localhost fallback can never work, and this runs during the
  // build — fail with the fix instead of a cryptic ECONNREFUSED.
  if (!databaseUrl && !process.env.DATABASE_URL && process.env.VERCEL) {
    throw new Error(
      'DATABASE_URL is not set, so the build cannot run the database migrations.\n' +
        'Connect a Postgres database to this Vercel project:\n' +
        '  1. On vercel.com open the project → Storage → Create Database\n' +
        '  2. Pick Postgres (Neon, free tier) and connect it (sets DATABASE_URL automatically)\n' +
        '  3. Redeploy (npm run deploy)',
    );
  }
  const client = new pg.Client({
    connectionString:
      databaseUrl ?? process.env.DATABASE_URL ?? 'postgres://tutor:tutor@localhost:5432/algebra_tutor',
  });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    for (const { name, sql } of migrations) {
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
      if (done.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`applied ${name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
