#!/usr/bin/env bash
set -euo pipefail

QUESTION="${1:?usage: ./tools/escalate.sh <question> [urgency] [context]}"
URGENCY="${2:-normal}"
CONTEXT="${3:-}"
ROOM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IDEA_ID="$(basename "${ROOM_DIR}")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

case "${URGENCY}" in
  low|normal|high) ;;
  *)
    echo "Invalid urgency: ${URGENCY} (use low, normal, or high)" >&2
    exit 1
    ;;
esac

escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  printf '%s' "$s"
}

PAYLOAD="{\"question\":\"$(escape "${QUESTION}")\",\"urgency\":\"${URGENCY}\""
if [ -n "${CONTEXT}" ]; then
  PAYLOAD+=",\"context\":\"$(escape "${CONTEXT}")\""
fi
PAYLOAD+="}"

curl -sS -X POST "${URL}/missions/${IDEA_ID}/escalate" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}"

echo
