#!/usr/bin/env node
/**
 * One-command Vercel deploy for the Algebra Tutor — works the same on
 * Windows, macOS, and Linux:
 *
 *   npm run deploy        # first run: links the project, sets secrets, deploys
 *   npm run deploy        # later runs: just deploys the new version
 *
 * Needs a free Vercel account (https://vercel.com/signup) — the Vercel CLI
 * itself is fetched with npx, so there's nothing to install. Vercel builds
 * and hosts the Next.js app natively; the database is the one thing created
 * in the dashboard (Storage → Create Database → Postgres/Neon, free tier),
 * because the Vercel CLI can't provision Marketplace databases yet.
 * Everything else — project linking, the JWT secret, tutor keys — is set up
 * for you.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

process.chdir(path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..'));

const green = (s) => console.log(`\x1b[0;32m${s}\x1b[0m`);
const yellow = (s) => console.log(`\x1b[0;33m${s}\x1b[0m`);
const red = (s) => console.log(`\x1b[0;31m${s}\x1b[0m`);

// npx is npx.cmd on Windows, which needs a shell to resolve. Every argument
// we pass is a plain token (never user input), so shell quoting is a non-issue.
const vercel = (args, opts = {}) =>
  spawnSync('npx', ['--yes', 'vercel', ...args], {
    shell: process.platform === 'win32',
    ...opts,
  });
const interactive = (args) => vercel(args, { stdio: 'inherit' });
const quiet = (args) => vercel(args, { encoding: 'utf8' });
const withInput = (args, input) =>
  vercel(args, { input, stdio: ['pipe', 'inherit', 'inherit'] });

/** KEY=VALUE lines of .env (no expansion — same as the docker-era parser). */
function dotEnv() {
  if (!fs.existsSync('.env')) return {};
  const entries = fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.+)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]);
  return Object.fromEntries(entries);
}

if (quiet(['whoami']).status !== 0) {
  yellow("You're not logged in to Vercel — opening the login flow…");
  if (interactive(['login']).status !== 0) process.exit(1);
}

// ---- first-time setup ------------------------------------------------------
if (!fs.existsSync(path.join('.vercel', 'project.json'))) {
  yellow("This folder isn't linked to a Vercel project yet.");
  console.log("You'll be asked a few questions. The one that matters:");
  console.log("  'In which directory is your code located?'  →  answer:  apps/web");
  console.log("(That's where the Next.js app lives; Vercel finds the monorepo root itself.)");
  if (interactive(['link']).status !== 0) process.exit(1);
}

const envList = quiet(['env', 'ls', 'production']).stdout ?? '';
const hasEnv = (key) => new RegExp(`^ *${key} `, 'm').test(envList);
const env = dotEnv();

// login-token key: Vercel functions have no persistent disk, so the app can't
// auto-generate-and-save one — set it once here (keeps students logged in
// across deploys)
if (!hasEnv('JWT_SECRET')) {
  green('Generating a JWT secret…');
  withInput(['env', 'add', 'JWT_SECRET', 'production'], crypto.randomBytes(48).toString('hex'));
}

// managed Postgres, exposed as DATABASE_URL (needed at build time too — the
// build runs the migrations and seeds the curriculum)
if (!hasEnv('DATABASE_URL')) {
  if (env.DATABASE_URL) {
    green('Setting DATABASE_URL from .env…');
    withInput(['env', 'add', 'DATABASE_URL', 'production'], env.DATABASE_URL);
  } else {
    red('No database is connected yet.');
    console.log('Create one (takes a minute, free tier is enough for a class):');
    console.log('  1. Open your project on https://vercel.com → Storage → Create Database');
    console.log('  2. Pick Postgres (Neon), accept the defaults, and connect it to the project');
    console.log('     (that sets DATABASE_URL automatically)');
    console.log('  3. Re-run: npm run deploy');
    console.log('Or put a DATABASE_URL=postgres://… line in a .env file here and re-run.');
    process.exit(1);
  }
}

// optional AI tutor key from .env (the app works fine without one)
for (const key of ['ANTHROPIC_API_KEY', 'TUTOR_PROVIDER', 'TUTOR_BASE_URL', 'TUTOR_MODEL', 'TUTOR_API_KEY', 'HF_TOKEN']) {
  if (env[key] && !hasEnv(key)) {
    green(`Setting ${key} from .env…`);
    withInput(['env', 'add', key, 'production'], env[key]);
  }
}

green('Deploying…');
// vercel prints build progress to stderr and the deployment URL to stdout
const deploy = vercel(['deploy', '--prod'], {
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'inherit'],
});
if (deploy.status !== 0) {
  red('Deploy failed.');
  console.log('See what the build printed:                  npx vercel inspect --logs');
  console.log('Most common cause: no database connected →   project → Storage → Create Database');
  process.exit(1);
}

const deployUrl = (deploy.stdout ?? '').trim().split(/\s+/).pop();
green(`Done! Your tutor is live at: ${deployUrl}`);
console.log(`Point the mobile app at it with EXPO_PUBLIC_API_URL=${deployUrl}`);
