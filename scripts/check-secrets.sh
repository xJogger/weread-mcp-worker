#!/usr/bin/env bash
set -euo pipefail

# Heuristic scan for high-risk values. It intentionally avoids matching short placeholders
# such as wrk-xxxxxxxx and documentation examples such as Bearer $WEREAD_API_KEY.
PATTERN='(wrk-[A-Za-z0-9_-]{20,}|wr_vid=[^ ;]{6,}|wr_skey=[^ ;]{6,}|/mcp/v1_[A-Za-z0-9_-]{80,}|Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{20,})'

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES=$(git ls-files)
else
  FILES=$(find . -type f \
    -not -path './node_modules/*' \
    -not -path './.git/*' \
    -not -path './.wrangler/*')
fi

if [[ -z "${FILES}" ]]; then
  echo "No files to scan."
  exit 0
fi

MATCHES=$(printf '%s\n' "$FILES" | xargs grep -nE "$PATTERN" 2>/dev/null || true)
if [[ -n "$MATCHES" ]]; then
  echo "Potential secrets or sensitive generated URLs found:"
  echo "$MATCHES"
  echo
  echo "Review these matches before publishing."
  exit 1
fi

echo "No obvious secret patterns found."
