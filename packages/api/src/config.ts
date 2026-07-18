import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@tutor/db';

/** Where auto-generated runtime state (e.g. the JWT secret) is persisted. */
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');

/**
 * Read the persisted secret from DATA_DIR, generating and saving one if the
 * file doesn't exist yet. Throws when the directory isn't readable/writable
 * (typical on serverless, where the bundle filesystem is read-only).
 */
function fileSecret(): string {
  const secretFile = path.join(dataDir, 'jwt-secret');
  if (fs.existsSync(secretFile)) {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing) return existing;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  console.log(`generated a JWT secret and saved it to ${secretFile}`);
  return generated;
}

/**
 * Read-or-create the secret in the shared database (app_secrets). Atomic
 * across concurrent cold-starting instances: everyone INSERTs with
 * ON CONFLICT DO NOTHING, then reads back the single row that won — so the
 * whole deployment converges on one secret even when several serverless
 * instances race to create it.
 */
async function dbSecret(): Promise<string> {
  const existing = await prisma.appSecret.findUnique({ where: { name: 'jwt-secret' } });
  if (existing?.value) return existing.value;
  const generated = crypto.randomBytes(48).toString('hex');
  await prisma.$executeRaw`
    INSERT INTO app_secrets (name, value) VALUES ('jwt-secret', ${generated})
    ON CONFLICT (name) DO NOTHING`;
  const row = await prisma.appSecret.findUnique({ where: { name: 'jwt-secret' } });
  if (!row?.value) throw new Error('failed to persist the JWT secret in app_secrets');
  console.log('JWT secret persisted in the database (app_secrets) — data dir not writable');
  return row.value;
}

/**
 * Resolve the JWT signing secret with zero required setup:
 *   1. JWT_SECRET env var, if provided (recommended for production/multi-instance)
 *   2. else a secret persisted in DATA_DIR (survives restarts, so logins stay valid)
 *   3. else a secret persisted in the database — the writable shared store on
 *      serverless deploys (Vercel's filesystem is read-only), where a
 *      file-based secret can't work but every instance can read one DB row
 *   4. else: production fails hard (a per-instance ephemeral secret would be a
 *      silent, intermittent auth outage — tokens signed by one instance
 *      rejected by the next); development falls back to an ephemeral secret
 *      so the app still runs (tokens just don't survive a restart).
 */
async function resolveJwtSecret(): Promise<string> {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  let fileErr: unknown;
  try {
    return fileSecret();
  } catch (err) {
    fileErr = err;
  }

  try {
    return await dbSecret();
  } catch (dbErr) {
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    if (isProd) {
      throw new Error(
        'JWT_SECRET is not set and no secret could be persisted ' +
          '(data dir not writable, and the database fallback failed). ' +
          'Set JWT_SECRET in the environment' +
          (process.env.VERCEL
            ? ' (on Vercel: Settings → Environment Variables — npm run deploy sets it for you).'
            : '.'),
        { cause: dbErr },
      );
    }
    console.warn(
      'could not persist a JWT secret (data dir not writable, database fallback failed); ' +
        'using an ephemeral one. Set JWT_SECRET to keep logins valid across restarts.',
      fileErr instanceof Error ? fileErr.message : fileErr,
      dbErr instanceof Error ? dbErr.message : dbErr,
    );
    return crypto.randomBytes(48).toString('hex');
  }
}

let cached: Promise<string> | null = null;

/** Lazily resolved so importing the API package never touches the filesystem
 * or database. The in-flight promise is cached (not just the value) so
 * concurrent first callers share one resolution; a failed resolution clears
 * the cache so a transient DB outage at cold start doesn't wedge the
 * instance forever. */
export function jwtSecret(): Promise<string> {
  cached ??= resolveJwtSecret().catch((err: unknown) => {
    cached = null;
    throw err;
  });
  return cached;
}

export const authConfig = {
  accessTokenTtl: '20m',
  refreshTokenTtlDays: 7,
  dataDir,
};
