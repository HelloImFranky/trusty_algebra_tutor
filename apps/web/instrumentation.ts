/**
 * Runs once when the Next.js server starts (dev and production): apply the
 * SQL migrations and seed/sync the curriculum. This is what makes
 * `./scripts/start.sh` and the dev server zero-step — no separate
 * migrate/seed commands for teachers to remember.
 *
 * On Vercel there is no long-lived server to do this from — functions cold
 * start concurrently — so migrate + seed run once at build time instead
 * (the buildCommand in apps/web/vercel.json) and this hook stays out of the
 * way.
 *
 * A local Postgres may still be starting up when the app boots, so
 * connection failures retry briefly with a clear log line before giving up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.VERCEL) return; // migrated + seeded at build time

  const { migrate, seed, prisma } = await import('@tutor/db');

  const attempts = 5;
  const delayMs = 2_000;
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
              'On Vercel: create a Postgres database (project → Storage → Create Database)\n' +
              'so DATABASE_URL is set (npm run deploy checks this for you). ' +
              'Locally: ./scripts/start.sh sets up the database for you.\n',
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
