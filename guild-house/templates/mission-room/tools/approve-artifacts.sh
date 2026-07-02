#!/usr/bin/env bash
# Guild master approve artifacts — same as Web UI / POST /missions/:id/approve-artifacts.
# PO runs this when the guild master clearly approves deliverables in attach or inbox.
set -euo pipefail

MISSION_ID="$(basename "$(cd "$(dirname "$0")/.." && pwd)")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

curl -fsS -X POST "${URL}/missions/${MISSION_ID}/approve-artifacts" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json"

echo
