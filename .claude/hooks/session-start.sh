#!/usr/bin/env bash
# SessionStart hook: make sure the app's port is free at the start of every
# session, so a leftover Next.js server from an earlier run can't hold port
# 3000 and force new work onto a different port (or crash `next start`).
#
# Fast and idempotent: if nothing is listening it exits immediately.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PORT="${PORT:-3000}"

"$PROJECT_DIR/scripts/free-port.sh" "$PORT" || true
