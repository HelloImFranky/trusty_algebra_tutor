#!/usr/bin/env bash
# One-command Fly.io deploy for the Algebra Tutor.
#
#   ./scripts/deploy-fly.sh            # first run: creates app + Postgres, deploys
#   ./scripts/deploy-fly.sh            # later runs: just deploys the new version
#
# Needs the Fly CLI (https://fly.io/docs/flyctl/install/) and a Fly account
# (the free allowance is enough for a classroom). Everything else — database,
# volume for the login secret, secrets wiring — is set up for you.
set -euo pipefail
cd "$(dirname "$0")/.."

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

if ! command -v fly >/dev/null 2>&1 && ! command -v flyctl >/dev/null 2>&1; then
  red "The Fly CLI isn't installed."
  echo "Install it from https://fly.io/docs/flyctl/install/ then re-run."
  exit 1
fi
FLY=$(command -v fly || command -v flyctl)

if ! $FLY auth whoami >/dev/null 2>&1; then
  yellow "You're not logged in to Fly — opening the login flow…"
  $FLY auth login
fi

APP_NAME=$(sed -n 's/^app = "\(.*\)"/\1/p' fly.toml)

# ---- first-time setup ------------------------------------------------------
if ! $FLY apps list --json 2>/dev/null | grep -q "\"$APP_NAME\""; then
  yellow "App '$APP_NAME' doesn't exist yet."
  echo   "If the name is taken, edit the 'app = \"...\"' line in fly.toml and re-run."
  green  "Creating the app…"
  $FLY apps create "$APP_NAME"
fi

# volume for the auto-generated JWT secret (keeps students logged in across deploys)
if ! $FLY volumes list -a "$APP_NAME" 2>/dev/null | grep -q tutor_data; then
  green "Creating the data volume…"
  REGION=$(sed -n 's/^primary_region = "\(.*\)"/\1/p' fly.toml)
  $FLY volumes create tutor_data --size 1 -a "$APP_NAME" -r "${REGION:-ewr}" -y
fi

# managed Postgres, attached as DATABASE_URL
if ! $FLY secrets list -a "$APP_NAME" 2>/dev/null | grep -q DATABASE_URL; then
  green "Creating a Postgres database (this takes a minute)…"
  $FLY postgres create --name "$APP_NAME-db" --vm-size shared-cpu-1x \
    --volume-size 1 --initial-cluster-size 1 --region "$(sed -n 's/^primary_region = "\(.*\)"/\1/p' fly.toml)"
  $FLY postgres attach "$APP_NAME-db" -a "$APP_NAME" -y
fi

# optional AI tutor key from .env (the app works fine without one)
if [ -f .env ]; then
  KEYS=$(grep -E '^(ANTHROPIC_API_KEY|TUTOR_(PROVIDER|BASE_URL|MODEL|API_KEY)|HF_TOKEN)=' .env | grep -v '=$' || true)
  if [ -n "$KEYS" ]; then
    green "Setting tutor secrets from .env…"
    echo "$KEYS" | $FLY secrets import -a "$APP_NAME" --stage
  fi
fi

green "Deploying…"
$FLY deploy

green "Done! Your tutor is live at: https://$APP_NAME.fly.dev"
echo  "Point the mobile app at it with EXPO_PUBLIC_API_URL=https://$APP_NAME.fly.dev"
