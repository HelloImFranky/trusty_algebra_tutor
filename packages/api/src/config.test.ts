/**
 * JWT secret resolution against a real Postgres database: when the data dir
 * isn't writable (the serverless case that used to hard-fail signup/login),
 * the secret must fall back to the shared app_secrets row — one secret for
 * the whole deployment, stable across instances.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://tutor:tutor@localhost:5432/algebra_tutor_test';

const { prisma, migrate } = await import('@tutor/db');

describe('jwtSecret resolution (data dir not writable)', () => {
  const savedDataDir = process.env.DATA_DIR;
  const savedJwtSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    await migrate();
    await prisma.appSecret.deleteMany({ where: { name: 'jwt-secret' } });
    // A path "under" a regular file can never be created (ENOTDIR) — a fast,
    // root-proof stand-in for a read-only bundle fs. (Don't use /proc here:
    // mkdir on procfs hangs in some sandboxed CI environments.)
    process.env.DATA_DIR = '/etc/hostname/jwt-secret-test-unwritable';
    delete process.env.JWT_SECRET;
  }, 120_000);

  afterAll(async () => {
    if (savedDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = savedDataDir;
    if (savedJwtSecret !== undefined) process.env.JWT_SECRET = savedJwtSecret;
    await prisma.$disconnect();
  });

  it('persists the secret in app_secrets and reuses it across instances', async () => {
    vi.resetModules();
    const first = await import('./config.js');
    const secret = await first.jwtSecret();
    expect(secret).toMatch(/^[0-9a-f]{96}$/); // 48 random bytes, hex

    const row = await prisma.appSecret.findUnique({ where: { name: 'jwt-secret' } });
    expect(row?.value).toBe(secret);

    // A fresh module registry = a second cold-started instance: it must read
    // the same shared secret, not mint its own.
    vi.resetModules();
    const second = await import('./config.js');
    expect(await second.jwtSecret()).toBe(secret);
  });

  it('prefers JWT_SECRET from the environment and cleans up the database copy', async () => {
    // Row exists from the previous test — setting the env var must win AND
    // remove the DB copy so no signing-capable secret lingers in dumps.
    expect(await prisma.appSecret.findUnique({ where: { name: 'jwt-secret' } })).not.toBeNull();
    process.env.JWT_SECRET = 'env-secret-wins';
    try {
      vi.resetModules();
      const mod = await import('./config.js');
      expect(await mod.jwtSecret()).toBe('env-secret-wins');
      // cleanup is fire-and-forget — poll briefly for it to land
      await vi.waitFor(async () => {
        expect(await prisma.appSecret.findUnique({ where: { name: 'jwt-secret' } })).toBeNull();
      });
    } finally {
      delete process.env.JWT_SECRET;
    }
  });
});
