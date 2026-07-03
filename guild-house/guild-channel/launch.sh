#!/usr/bin/env bash
# Resolve bun for Claude Code MCP spawn (PATH often lacks ~/.bun/bin).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOM_CWD="$(pwd)"
BUN="${BUN_BIN:-$(command -v bun 2>/dev/null || true)}"
if [[ -z "$BUN" && -x "${HOME}/.bun/bin/bun" ]]; then
  BUN="${HOME}/.bun/bin/bun"
fi
if [[ -z "$BUN" ]]; then
  echo "[guild-channel] bun not found — add ~/.bun/bin to PATH or set BUN_BIN" >&2
  exit 1
fi
if [[ -f "$ROOM_CWD/../../../.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOM_CWD/../../../.env"
  set +a
fi
exec "$BUN" "$DIR/server.ts"
