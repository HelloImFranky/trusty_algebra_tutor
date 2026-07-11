#!/usr/bin/env bash
# One-command Vercel deploy for the Algebra Tutor.
#
#   ./scripts/deploy-vercel.sh    # first run: links the project, sets secrets, deploys
#   ./scripts/deploy-vercel.sh    # later runs: just deploys the new version
#
# Needs a free Vercel account (https://vercel.com/signup) — the CLI itself is
# fetched with npx, so there's nothing to install. Vercel builds and hosts the
# Next.js app natively; the database is the one thing created in the
# dashboard (Storage → Create Database → Postgres/Neon, free tier), because
# the Vercel CLI can't provision Marketplace databases yet.
# Everything else — project linking, the JWT secret, tutor keys — is set up
# for you.
set -euo pipefail
cd "$(dirname "$0")/.."

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

if command -v vercel >/dev/null 2>&1; then
  VERCEL=vercel
elif command -v npx >/dev/null 2>&1; then
  VERCEL="npx --yes vercel"
else
  red "Neither the Vercel CLI nor npx is available."
  echo "Install Node.js (https://nodejs.org) or the Vercel CLI (npm i -g vercel), then re-run."
  exit 1
fi

if ! $VERCEL whoami >/dev/null 2>&1; then
  yellow "You're not logged in to Vercel — opening the login flow…"
  $VERCEL login
fi

# ---- first-time setup ------------------------------------------------------
if [ ! -f .vercel/project.json ]; then
  yellow "This folder isn't linked to a Vercel project yet."
  echo   "You'll be asked a few questions. The one that matters:"
  echo   "  'In which directory is your code located?'  →  answer:  apps/web"
  echo   "(That's where the Next.js app lives; Vercel finds the monorepo root itself.)"
  $VERCEL link
fi

ENV_LIST=$($VERCEL env ls production 2>/dev/null || true)

# login-token key: Vercel functions have no persistent disk, so the app can't
# auto-generate-and-save one — set it once here (keeps students logged in
# across deploys)
if ! grep -q '^ *JWT_SECRET ' <<<"$ENV_LIST"; then
  green "Generating a JWT secret…"
  node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("hex"))' \
    | $VERCEL env add JWT_SECRET production
fi

# managed Postgres, exposed as DATABASE_URL (needed at build time too — the
# build runs the migrations and seeds the curriculum)
if ! grep -q '^ *DATABASE_URL ' <<<"$ENV_LIST"; then
  if [ -f .env ] && grep -qE '^DATABASE_URL=.+' .env; then
    green "Setting DATABASE_URL from .env…"
    grep -E '^DATABASE_URL=' .env | cut -d= -f2- | $VERCEL env add DATABASE_URL production
  else
    red "No database is connected yet."
    echo "Create one (takes a minute, free tier is enough for a class):"
    echo "  1. Open your project on https://vercel.com → Storage → Create Database"
    echo "  2. Pick Postgres (Neon), accept the defaults, and connect it to the project"
    echo "     (that sets DATABASE_URL automatically)"
    echo "  3. Re-run ./scripts/deploy-vercel.sh"
    echo "Or put a DATABASE_URL=postgres://… line in a .env file here and re-run."
    exit 1
  fi
fi

# optional AI tutor key from .env (the app works fine without one)
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    [ -n "$value" ] || continue
    if ! grep -q "^ *$key " <<<"$ENV_LIST"; then
      green "Setting $key from .env…"
      printf '%s' "$value" | $VERCEL env add "$key" production
    fi
  done < <(grep -E '^(ANTHROPIC_API_KEY|TUTOR_(PROVIDER|BASE_URL|MODEL|API_KEY)|HF_TOKEN)=' .env || true)
fi

green "Deploying…"
if ! URL=$($VERCEL deploy --prod); then
  red "Deploy failed."
  echo "See what the build printed:                  $VERCEL inspect --logs"
  echo "Most common cause: no database connected →   project → Storage → Create Database"
  exit 1
fi

green "Done! Your tutor is live at: $URL"
echo  "Point the mobile app at it with EXPO_PUBLIC_API_URL=$URL"
