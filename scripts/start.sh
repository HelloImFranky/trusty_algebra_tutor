#!/usr/bin/env bash
# One-command local launcher for the Algebra Tutor.
#
#   ./scripts/start.sh
#
# Runs the app directly with Node + PostgreSQL and sets everything up for
# you — no environment variables, no database commands. When it's ready it
# prints the URL to open. (For internet hosting use `npm run deploy` instead.)
set -euo pipefail
cd "$(dirname "$0")/.."

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

echo
green "  ∑  Algebra Tutor — starting up"
echo

if ! command -v node >/dev/null 2>&1; then
  red "Node.js isn't installed. Install Node 20+ (https://nodejs.org), then re-run."
  exit 1
fi

DB_URL="${DATABASE_URL:-postgres://tutor:tutor@localhost:5432/algebra_tutor}"
export DATABASE_URL="$DB_URL"

db_ready() { node -e '
  const{Client}=require("pg");
  new Client({connectionString:process.env.DATABASE_URL}).connect()
    .then(c=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1));
' 2>/dev/null; }

echo "Installing dependencies (first run only)…"
npm install --silent

if ! db_ready; then
  # Try to create the default role/database on a running local PostgreSQL.
  if command -v psql >/dev/null 2>&1 && pg_isready -q 2>/dev/null; then
    yellow "Setting up the local database…"
    psql -v ON_ERROR_STOP=0 postgres >/dev/null 2>&1 <<'SQL' || true
CREATE ROLE tutor WITH LOGIN PASSWORD 'tutor' CREATEDB;
CREATE DATABASE algebra_tutor OWNER tutor;
SQL
  fi
fi

if ! db_ready; then
  red   "Couldn't reach a PostgreSQL database at:"
  echo  "    $DB_URL"
  echo
  yellow "Install and start PostgreSQL (https://www.postgresql.org/download/),"
  yellow "or set DATABASE_URL to an existing database, then re-run."
  exit 1
fi

echo "Building the app…"
npx turbo build --filter=@tutor/web

green "Starting the app. It sets up the curriculum on first run."
echo  "When it says it's ready, open:  http://localhost:${PORT:-3000}"
echo
cd apps/web && exec npx next start -p "${PORT:-3000}"
