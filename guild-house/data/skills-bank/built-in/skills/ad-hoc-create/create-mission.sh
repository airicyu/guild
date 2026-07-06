#!/usr/bin/env bash
set -euo pipefail

# === create-mission.sh ===
# Scaffold a mission.md on the mission board.
# Usage: create-mission.sh <title> <intent> [board]
#   title  - human-readable mission title (required)
#   intent - one-line goal description (required)
#   board  - "parking" or "queued"; defaults to "parking"
#
# Produces: ../../mission-board/{parking|queued}/{slug}-YYYYMMDD-6hex/mission.md

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

TITLE="${1:-}"
INTENT="${2:-}"
BOARD="${3:-parking}"

if [ -z "$TITLE" ] || [ -z "$INTENT" ]; then
  die "usage: create-mission.sh <title> <intent> [board]"
fi

# Validate board
case "$BOARD" in
  parking) BOARD_DIR="parking" ;;
  queued)  BOARD_DIR="queued" ;;
  *)       die "board must be 'parking' or 'queued', got '$BOARD'" ;;
esac

# ---------------------------------------------------------------------------
# mint id & paths
# ---------------------------------------------------------------------------

SAFE_SLUG=$(slugify "$TITLE")
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

cat > "$BOARD_PATH/mission.md" << MISSIONEOF
---
title: ${TITLE}
intent: ${INTENT}
---

# ${TITLE}

## Background

<!-- Why this mission exists (2–5 sentences) -->

## Deliverables

<!-- Concrete outputs -->

## Acceptance criteria

- [ ] <!-- Testable criterion -->

## Out of scope

<!-- Explicit non-goals -->

## Notes

<!-- Links, references, open questions -->
MISSIONEOF

echo "Created: $BOARD_PATH/"