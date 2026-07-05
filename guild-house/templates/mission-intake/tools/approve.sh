#!/usr/bin/env bash
# Guild master Approve — same as Web UI / POST /missions/:id/approve-discovery.
# Intake lead runs this when the guild master clearly approves in attach or inbox.
set -euo pipefail

IDEA_ID="$(basename "$(cd "$(dirname "$0")/.." && pwd)")"
URL="${GUILD_HOUSE_URL:-http://127.0.0.1:3847}"
KEY="${GUILD_API_KEY:?Set GUILD_API_KEY}"

curl -fsS -X POST "${URL}/missions/${IDEA_ID}/approve-discovery" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json"

echo
