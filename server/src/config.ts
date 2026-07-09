import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** Where auto-generated runtime state (e.g. the JWT secret) is persisted. */
const dataDir =
  process.env.DATA_DIR ??
  path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../.data');

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
        'Set JWT_SECRET to keep logins valid across restarts.',
      err instanceof Error ? err.message : err,
    );
    return crypto.randomBytes(48).toString('hex');
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://tutor:tutor@localhost:5432/algebra_tutor',
  jwtSecret: resolveJwtSecret(),
  accessTokenTtl: '20m',
  refreshTokenTtlDays: 7,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  tutorMaxTurns: Number(process.env.TUTOR_MAX_TURNS ?? 12),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  /** Absolute path to the built web app to serve, if present (single-service mode). */
  webDist: process.env.WEB_DIST ?? defaultWebDist(),
  dataDir,
};

function defaultWebDist(): string {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  // dev/build: <repo>/server/src|dist/.. -> <repo>/web/dist
  return path.resolve(here, '../../web/dist');
}
