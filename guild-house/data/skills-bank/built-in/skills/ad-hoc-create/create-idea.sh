#!/usr/bin/env bash
set -euo pipefail

# === create-idea.sh ===
# Scaffold a scratch.md idea on the mission board.
# Usage: create-idea.sh <content> [slug] [board]
#   content  - plain text content for scratch.md (required)
#   slug     - used to mint folder id; defaults to "idea"
#   board    - "backlog" (→ ideas-backlog) or "ideas"; defaults to "backlog"
#
# Produces: ../../mission-board/{ideas-backlog|ideas}/{slug}-YYYYMMDD-6hex/scratch.md

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

die() { echo "ERROR: $*" >&2; exit 1; }

# Generate 6 hex chars; prefer openssl, fallback xxd
rand_hex() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 3 2>/dev/null || true
  elif command -v xxd &>/dev/null; then
    xxd -l 3 -p /dev/urandom 2>/dev/null || true
  else
    die "neither openssl nor xxd found — cannot generate hex id"
  fi
}

# Derive a safe folder slug: lowercase, [a-z0-9-] only, collapse hyphens, max 64
slugify() {
  local raw="$1"
  local s
  s=$(echo "$raw" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/-\+/-/g' | sed 's/^-//;s/-$//')
  echo "${s:0:64}"
}

# ---------------------------------------------------------------------------
# args
# ---------------------------------------------------------------------------

CONTENT="${1:-}"
SLUG="${2:-idea}"
BOARD="${3:-backlog}"

if [ -z "$CONTENT" ]; then
  die "usage: create-idea.sh <content> [slug] [board]"
fi

# Validate board
case "$BOARD" in
  backlog) BOARD_DIR="ideas-backlog" ;;
  ideas)   BOARD_DIR="ideas" ;;
  *)       die "board must be 'backlog' or 'ideas', got '$BOARD'" ;;
esac

# ---------------------------------------------------------------------------
# mint id & paths
# ---------------------------------------------------------------------------

SAFE_SLUG=$(slugify "$SLUG")
HEX=$(rand_hex)
DATE=$(date +%Y%m%d)
ID="${SAFE_SLUG}-${DATE}-${HEX}"

BOARD_PATH="../../mission-board/${BOARD_DIR}/${ID}"

# Idempotency guard
if [ -d "$BOARD_PATH" ]; then
  die "folder already exists: $BOARD_PATH"
fi

# ---------------------------------------------------------------------------
# scaffold
# ---------------------------------------------------------------------------

mkdir -p "$BOARD_PATH"
echo "$CONTENT" > "$BOARD_PATH/scratch.md"

echo "Created: $BOARD_PATH/"