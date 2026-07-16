#!/usr/bin/env bash
# Theme guardrail: count every hard-coded color literal + light-only
# palette identifier used across packages/app/src, and compare to a
# committed baseline (scripts/theme-baseline.txt).
#
# The check is deliberately whole-tree with no per-file exclusions —
# any new literal, in any file, requires an explicit baseline bump.
# That makes PR review the checkpoint: reviewers see "theme-baseline
# went from X to Y" and ask whether the new literal is intentional
# (medal metal, brand-invariant, etc.) or should have been a token.
#
# Rationale + which existing literals are intentional-invariant vs
# migration-target: see docs/dark-mode-audit-plan.md § "Current state".
#
# Usage:
#   scripts/theme-baseline.sh              # check against baseline
#   scripts/theme-baseline.sh --update     # write current counts as new baseline
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$ROOT/scripts/theme-baseline.txt"
SRC="$ROOT/packages/app/src"

# Count 1: hex color literals — any string like "#abc" or "#aabbcc"
# used as a value.
count_hex() {
  grep -rE "'#[0-9a-fA-F]{3,8}'|\"#[0-9a-fA-F]{3,8}\"" "$SRC" 2>/dev/null \
    | wc -l | tr -d ' '
}

# Count 2: symbolic light-only palette identifiers used as color values.
# INK, NEUTRAL[...], BRAND, COLORS.muted/border — every one of these
# should be tokens.* instead. Excludes matches inside line comments so
# doc paragraphs referencing "the old NEUTRAL[200]" don't trip the count.
count_symbols() {
  grep -rEn '\bINK\b|NEUTRAL\[|\bBRAND\b|COLORS\.muted|COLORS\.border' "$SRC" 2>/dev/null \
    | grep -vE ':\s*\*|:\s*//' \
    | wc -l | tr -d ' '
}

HEX="$(count_hex)"
SYM="$(count_symbols)"
CURRENT="hex=$HEX symbols=$SYM"

if [[ "${1:-}" == "--update" ]]; then
  echo "$CURRENT" > "$BASELINE"
  echo "Baseline updated: $CURRENT"
  exit 0
fi

if [[ ! -f "$BASELINE" ]]; then
  echo "No baseline at $BASELINE — run '$0 --update' to create one." >&2
  echo "Current: $CURRENT" >&2
  exit 2
fi

BASE="$(cat "$BASELINE")"
BASE_HEX="${BASE#hex=}"; BASE_HEX="${BASE_HEX%% *}"
BASE_SYM="${BASE#*symbols=}"

FAIL=0
if (( HEX > BASE_HEX )); then
  echo "Theme baseline: hex literal count rose ($BASE_HEX → $HEX)." >&2
  echo "  A new '#rrggbb' color appeared in packages/app/src." >&2
  echo "  Use tokens (useTokens / useFeedbackColors / useAccent / HINT) instead." >&2
  echo "  See docs/theme-tokens.md." >&2
  echo "  If the new literal is deliberately theme-invariant (brand red," >&2
  echo "  medal metal, scaffold JPG bg, storyboard focus tint, …), run" >&2
  echo "    scripts/theme-baseline.sh --update" >&2
  echo "  and mention the exception in the PR description." >&2
  FAIL=1
fi
if (( SYM > BASE_SYM )); then
  echo "Theme baseline: symbolic-color usage rose ($BASE_SYM → $SYM)." >&2
  echo "  A new INK/NEUTRAL/BRAND/COLORS.{muted,border} appeared." >&2
  echo "  Use tokens.* from useTokens() instead. See docs/theme-tokens.md." >&2
  FAIL=1
fi
if (( HEX < BASE_HEX )) || (( SYM < BASE_SYM )); then
  echo "Theme baseline: count DECREASED ($BASE → $CURRENT)." >&2
  echo "  Nice — run '$0 --update' to commit the new baseline." >&2
  FAIL=1
fi

if (( FAIL == 0 )); then
  echo "Theme baseline OK ($CURRENT)"
fi
exit "$FAIL"
