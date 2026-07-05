#!/usr/bin/env bash
# Guild master reject artifacts — same as Web UI / POST /missions/:id/reject-artifacts.
set -euo pipefail

REASON="${1:?usage: ./tools/reject-artifacts.sh <reason>}"
MISSION_ID="$(basename "$(cd "$(dirname "$0")/.." && pwd)")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

ESCAPED="${REASON//\\/\\\\}"
ESCAPED="${ESCAPED//\"/\\\"}"

curl -fsS -X POST "${URL}/missions/${MISSION_ID}/reject-artifacts" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"reason\":\"${ESCAPED}\"}"

echo
