import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Where auto-generated runtime state (e.g. the JWT secret) is persisted. */
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');

/**
 * Resolve the JWT signing secret with zero required setup:
 *   1. JWT_SECRET env var, if provided (recommended for production/multi-instance)
 *   2. else a secret persisted in DATA_DIR (survives restarts, so logins stay valid)
 *   3. else generate a strong random one and persist it
 * Falls back to an in-memory secret if the data dir isn't writable (the app
 * still runs; tokens just won't survive a restart).
 */
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const secretFile = path.join(dataDir, 'jwt-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing) return existing;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.log(`generated a JWT secret and saved it to ${secretFile}`);
    return generated;
  } catch (err) {
    console.warn(
      'could not persist a JWT secret (data dir not writable); using an ephemeral one. ' +
        'Set JWT_SECRET to keep logins valid across restarts' +
        (process.env.VERCEL
          ? ' (on Vercel: Settings → Environment Variables — ./scripts/deploy-vercel.sh sets it for you).'
          : '.'),
      err instanceof Error ? err.message : err,
    );
    return crypto.randomBytes(48).toString('hex');
  }
}

let cachedSecret: string | null = null;

/** Lazily resolved so importing the API package never touches the filesystem. */
export function jwtSecret(): string {
  cachedSecret ??= resolveJwtSecret();
  return cachedSecret;
}

export const authConfig = {
  accessTokenTtl: '20m',
  refreshTokenTtlDays: 7,
  dataDir,
};
