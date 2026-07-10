/**
 * Runs once when the Next.js server starts (dev and production): apply the
 * SQL migrations and seed/sync the curriculum. This is what makes
 * `docker compose up` and `fly deploy` zero-step — no separate migrate/seed
 * commands for teachers to remember.
 *
 * The database may come up after the app (fresh docker compose, a Fly
 * Postgres that's still booting), so connection failures retry for a while
 * with a clear log line before giving up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrate, seed, prisma } = await import('@tutor/db');

  const attempts = 12;
  const delayMs = 5_000;
  try {
    for (let i = 1; ; i++) {
      try {
        await migrate();
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (i >= attempts) {
          console.error(
            `\ndatabase unreachable after ${attempts} attempts (${msg}).\n` +
              `DATABASE_URL is ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}.\n` +
              'On Fly.io: create/attach Postgres with\n' +
              '  fly postgres create --name <app>-db && fly postgres attach <app>-db -a <app>\n' +
              '(./scripts/deploy-fly.sh does this automatically). ' +
              'Locally: docker compose up starts the database for you.\n',
          );
          throw err;
        }
        console.warn(`database not ready (attempt ${i}/${attempts}): ${msg} — retrying in ${delayMs / 1000}s`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    await seed();
  } catch (err) {
    console.error('database setup failed', err);
    if (process.env.NODE_ENV === 'production') throw err;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
