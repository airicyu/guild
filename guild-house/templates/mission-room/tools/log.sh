#!/usr/bin/env bash
set -euo pipefail

FROM="${1:?usage: ./tools/log.sh <from> <type> <body>}"
TYPE="${2:?usage: ./tools/log.sh <from> <type> <body>}"
BODY="${3:?usage: ./tools/log.sh <from> <type> <body>}"
ROOM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MISSION_ID="$(basename "${ROOM_DIR}")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  printf '%s' "$s"
}

PAYLOAD="{\"from\":\"$(escape "${FROM}")\",\"type\":\"$(escape "${TYPE}")\",\"body\":\"$(escape "${BODY}")\"}"

curl -sS -X POST "${URL}/missions/${MISSION_ID}/events" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}"

echo
