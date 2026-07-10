#!/usr/bin/env bash
# One-command launcher for the Algebra Tutor.
#
#   ./scripts/start.sh
#
# Prefers Docker (truly one command, nothing else to install). If Docker isn't
# available it falls back to running directly with Node + PostgreSQL. Either
# way it sets everything up for you — no environment variables, no database
# commands. When it's ready it prints the URL to open.
set -euo pipefail
cd "$(dirname "$0")/.."

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

echo
green "  ∑  Algebra Tutor — starting up"
echo

# ---- Path 1: Docker (recommended, one command) ----------------------------
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
   && docker info >/dev/null 2>&1; then
  green "Docker detected — starting the app (first run builds; give it a few minutes)."
  echo   "When it says the app is ready, open:  http://localhost:8080"
  echo
  exec docker compose up --build
fi

yellow "Docker isn't available — running directly with Node + PostgreSQL instead."
echo

# ---- Path 2: local Node + PostgreSQL --------------------------------------
if ! command -v node >/dev/null 2>&1; then
  red "Node.js isn't installed. Install Docker Desktop (easiest) or Node 20+, then re-run."
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
  yellow "Easiest fix: install Docker Desktop and run ./scripts/start.sh again —"
  yellow "it needs nothing else. Or start PostgreSQL and/or set DATABASE_URL, then re-run."
  exit 1
fi

echo "Building the app…"
npx turbo build --filter=@tutor/web

green "Starting the app. It sets up the curriculum on first run."
echo  "When it says it's ready, open:  http://localhost:${PORT:-3000}"
echo
cd apps/web && exec npx next start -p "${PORT:-3000}"
