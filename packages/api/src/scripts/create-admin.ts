/**
 * Bootstrap an admin account — the single out-of-band step in the teacher
 * provisioning flow (docs/teacher-dashboard-plan.md, Stage 2). Admins are
 * never self-registerable through the API; this is how the first one (and any
 * more) come to exist.
 *
 * Any of these work (npm rewrites --flags across its own arg parsing, so
 * positionals and env are the most robust through `npm run`):
 *   ADMIN_USERNAME=principal ADMIN_PASSWORD='s3cret!!' npm run create-admin
 *   npm run create-admin -- principal 's3cret!!' "Ada Admin"
 *   npm run create-admin --workspace @tutor/api -- --username principal --password 's3cret!!'
 *
 * Idempotent-safe: it refuses to clobber an existing username.
 */
import url from 'node:url';
import { prisma } from '@tutor/db';
import { hashPassword } from '../auth.js';

interface Args {
  username?: string;
  password?: string;
  name?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--username') out.username = argv[++i];
    else if (a === '--password') out.password = argv[++i];
    else if (a === '--name' || a === '--displayName') out.name = argv[++i];
    else if (!a.startsWith('--')) positional.push(a);
  }
  // Fall back to positionals: <username> <password> [displayName].
  out.username ??= positional[0];
  out.password ??= positional[1];
  out.name ??= positional[2];
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = (args.username ?? process.env.ADMIN_USERNAME ?? '').trim();
  const password = args.password ?? process.env.ADMIN_PASSWORD ?? '';
  const displayName = (args.name ?? process.env.ADMIN_DISPLAY_NAME ?? 'Administrator').trim();

  if (!username || !password) {
    console.error(
      'Usage: npm run create-admin -- <username> <password> ["Display Name"]\n' +
        '   or: ADMIN_USERNAME=<name> ADMIN_PASSWORD=<pw> npm run create-admin',
    );
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    console.error('username must be 3–32 chars: letters, numbers, _ . -');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('password must be at least 8 characters');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) {
    console.error(`refusing to clobber: a user named "${username}" already exists`);
    process.exit(1);
  }

  const admin = await prisma.user.create({
    data: {
      role: 'admin',
      status: 'active',
      username,
      passwordHash: await hashPassword(password),
      displayName,
      locale: 'en',
    },
    select: { id: true },
  });
  console.log(`created admin "${username}" (id ${admin.id}). They can now sign in and approve teachers.`);
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
