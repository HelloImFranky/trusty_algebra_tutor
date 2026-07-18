#!/usr/bin/env bash
# Docs status-banner guard.
#
# Every doc in docs/ (except the README index itself) must lead with a status
# banner so a shipped plan can't be silently mistaken for outstanding work —
# the failure mode docs/README.md exists to prevent. The banner is a GitHub
# alert blockquote carrying a status marker in its first lines, e.g.:
#
#   > [!NOTE]
#   > **✅ SHIPPED — historical design record.** …
#
# Status convention (see docs/README.md): ✅ shipped · 🚧 live/outstanding ·
# 📗 living reference.
#
# The signature checked here is ASCII-only (alert marker + a bold blockquote
# line) so it holds under any locale, including the POSIX locale in CI.
#
# Usage: scripts/doc-banner-check.sh   (runs as part of `npm test`)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
# The index is the status map for everything else; it needs no banner.
INDEX="README.md"
# How many leading lines the banner must appear within (title + blank + banner).
HEAD_LINES=14

missing=()
checked=0
while IFS= read -r f; do
  base="$(basename "$f")"
  [[ "$base" == "$INDEX" ]] && continue
  checked=$((checked + 1))
  head_block="$(head -n "$HEAD_LINES" "$f")"
  # A banner = an alert blockquote AND a bold status blockquote line, both
  # near the top. Matching the ASCII skeleton keeps this locale-independent.
  if grep -qE '^> \[!(NOTE|IMPORTANT|WARNING|CAUTION|TIP)\]' <<<"$head_block" \
     && grep -qE '^> \*\*' <<<"$head_block"; then
    continue
  fi
  missing+=("$base")
done < <(find "$DOCS" -maxdepth 1 -name '*.md' | sort)

if (( ${#missing[@]} > 0 )); then
  echo "Docs banner check FAILED — no status banner in the first ${HEAD_LINES} lines of:" >&2
  for m in "${missing[@]}"; do echo "  - docs/$m" >&2; done
  echo >&2
  echo "Every doc in docs/ (except $INDEX) must lead with a status banner:" >&2
  echo >&2
  echo "  > [!NOTE]        (or [!IMPORTANT])" >&2
  echo "  > **✅ SHIPPED — …**   /   **🚧 … (outstanding)**   /   **📗 Living reference — current**" >&2
  echo >&2
  echo "Add one and register the doc in docs/README.md. See any existing" >&2
  echo "doc for the format, and docs/README.md for the status taxonomy." >&2
  exit 1
fi

echo "Docs banner check OK (${checked} docs carry a status banner)"
