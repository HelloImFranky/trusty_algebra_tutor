/**
 * Runs once when the Next.js server starts (dev and production): apply the
 * SQL migrations and seed/sync the curriculum. This is what makes
 * `docker compose up` and `fly deploy` zero-step — no separate migrate/seed
 * commands for teachers to remember.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrate, seed, prisma } = await import('@tutor/db');
  try {
    await migrate();
    await seed();
  } catch (err) {
    console.error('database setup failed (is DATABASE_URL reachable?)', err);
    if (process.env.NODE_ENV === 'production') throw err;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
