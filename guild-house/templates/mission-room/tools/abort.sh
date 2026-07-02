#!/usr/bin/env bash
# Guild master abort mission — same as Web UI / POST /missions/:id/abort.
# Chat path: PO writes retrospective/abort-note.md first when possible, then runs this.
set -euo pipefail

REASON="${1:-}"
MISSION_ID="$(basename "$(cd "$(dirname "$0")/.." && pwd)")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

if [ -n "$REASON" ]; then
  ESCAPED="${REASON//\\/\\\\}"
  ESCAPED="${ESCAPED//\"/\\\"}"
  BODY="{\"reason\":\"${ESCAPED}\"}"
else
  BODY="{}"
fi

curl -fsS -X POST "${URL}/missions/${MISSION_ID}/abort" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "${BODY}"

echo
