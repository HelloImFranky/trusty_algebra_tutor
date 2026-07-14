#!/usr/bin/env bash
# Free a TCP port by stopping whatever is listening on it.
#
#   ./scripts/free-port.sh [PORT]      # defaults to 3000 (or $PORT)
#
# Used by scripts/start.sh and the SessionStart hook so a stale dev/prod
# server left over from an earlier run can't hold the port and make you
# talk to an old build. Sends SIGTERM first, then SIGKILL if needed.
# Always exits 0 — a busy port that we couldn't identify shouldn't abort
# the caller; the subsequent bind will surface a clear error if it's still
# taken. Works with whichever of lsof / fuser / ss is available.
set -uo pipefail

PORT="${1:-${PORT:-3000}}"

# Print the PIDs listening on $PORT, one per line, using whatever tool exists.
listeners() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null
  elif command -v ss >/dev/null 2>&1; then
    # e.g. users:(("next-server",pid=1234,fd=21))
    ss -ltnpH "sport = :${PORT}" 2>/dev/null |
      grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
  elif command -v fuser >/dev/null 2>&1; then
    fuser "${PORT}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$'
  fi
}

pids="$(listeners)"
if [ -z "${pids// /}" ]; then
  echo "Port ${PORT} is already free."
  exit 0
fi

echo "Port ${PORT} in use by PID(s): $(echo "$pids" | tr '\n' ' ')— stopping them…"
# shellcheck disable=SC2086
kill $pids 2>/dev/null || true

# Give them up to ~3s to exit cleanly, then force-kill any survivors.
for _ in 1 2 3 4 5 6; do
  pids="$(listeners)"
  [ -z "${pids// /}" ] && break
  sleep 0.5
done

pids="$(listeners)"
if [ -n "${pids// /}" ]; then
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 0.5
fi

if [ -z "$(listeners)" ]; then
  echo "Port ${PORT} freed."
else
  echo "Warning: port ${PORT} still appears busy; the next bind will report the error." >&2
fi
exit 0
