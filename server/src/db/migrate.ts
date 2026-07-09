import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { pool } from './pool.js';

const dir = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../../migrations',
);

export async function migrate(): Promise<void> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [file]);
    if (done.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
