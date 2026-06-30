#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:?usage: ./tools/signal.sh <type> [summary]}"
SUMMARY="${2:-}"
IDEA_ID="$(basename "$(cd "$(dirname "$0")/.." && pwd)")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

JSON="{\"type\":\"${TYPE}\",\"by\":\"intake-lead\""
if [ -n "$SUMMARY" ]; then
  ESCAPED="${SUMMARY//\\/\\\\}"
  ESCAPED="${ESCAPED//\"/\\\"}"
  JSON+=",\"summary\":\"${ESCAPED}\""
fi
JSON+="}"

curl -sS -X POST "${URL}/discoveries/${IDEA_ID}/signals" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "${JSON}"

echo
