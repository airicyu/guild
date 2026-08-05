# Guild channel — orchestrator → live PO notification

Per-mission-room [Claude Code Channels](https://code.claude.com/docs/en/channels-reference) bridge for Guild 0.3.0. Pushes guild-master / orchestrator events into a running `--bg` PO session.

## Requirements (Phase 0 spike)

| Requirement | Notes |
|-------------|--------|
| **Claude Code** | v2.1.80+ (`claude --version`) |
| **Runtime** | Bun (`~/.bun/bin/bun` or on PATH) |
| **Dev flag** | Custom channels are research-preview; PO spawn must include `--dangerously-load-development-channels` until allowlisted |
| **WSL/Linux** | Dev attach and channel PoC tested on WSL2; same machine as orchestrator |

Verify locally:

```bash
claude --version   # expect 2.1.80+
bun --version
```

## Architecture

```
Orchestrator (guild-house API)
  → POST http://127.0.0.1:{port}/  (Bearer GUILD_API_KEY)
       ↑
  .guild/channel-endpoint.json  (written by guild-channel on PO session start)
       ↑
  guild-channel MCP (stdio) ← Claude Code spawns from mission-room/.mcp.json
       ↑
  PO --bg session cwd = mission-rooms/{id}/
```

**Ledger (always):** `checkpoint.yaml` + `inbox.md`  
**Wake-up bus (live session):** guild-channel HTTP → `<channel source="guild-house" event="…">`

## Dev setup

### 1. Enable development channels on PO spawn

In `guild-house/.env`:

```bash
CLAUDE_DEV_CHANNELS=1
```

When set, orchestrator adds `--dangerously-load-development-channels server:guild-channel` **after** the spawn prompt on `claude --bg` (prompt must precede channel flags). **Dev only** — skips channel allowlist during research preview.

Mission rooms scaffold `templates/mission-room/.agents/settings.local.json` with `enabledMcpjsonServers: ["guild-channel"]` so **`--bg` PO does not block on MCP approval** (interactive UI cannot answer the prompt). If you see the approval dialog on an older room, copy that file from the template or approve once interactively (`claude attach` → option 2).

Startup banner shows: `Channels (experimental) messages from server:guild-channel inject directly in this session`.

### 1b. Orchestrator channel push (optional)

HTTP POST from approve / reject / abort is **off by default** — idle PO sessions often miss channel delivery (see [ideas/0.3.0/channel-poc-notes.md](../../ideas/0.3.0/channel-poc-notes.md)). Inbox + checkpoint are always written (degraded mode).

```bash
# Enable orchestrator → guild-channel HTTP push (experimental)
GUILD_CHANNEL_PUSH=1
```

`GET /health` includes `channelPushEnabled`. API logs `[channel-notify] skip … reason=GUILD_CHANNEL_PUSH disabled` when off.

### 2. Mission room layout

Scaffolded from `templates/mission-room/`:

| Path | Role |
|------|------|
| `.mcp.json` | Spawns `guild-channel` via `../../../guild-channel/launch.sh` |
| `.guild/channel-endpoint.json` | `{ "host": "127.0.0.1", "port": N, "path": "/" }` — written when channel binds |
| `inbox.md` | Orchestrator directive text (PO reads on every guild-master action) |

### 3. POST an event (orchestrator or manual test)

```bash
PORT=$(jq -r .port data/mission-rooms/MISSION_ID/.guild/channel-endpoint.json)
curl -sS -X POST "http://127.0.0.1:${PORT}/" \
  -H "Authorization: Bearer $GUILD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"artifacts_approved","content":"Guild master approved artifacts. Read inbox.md and continue release per playbook."}'
```

Plain text body also works; optional `X-Guild-Event` header sets the `event` attribute.

**Sender gating:** Ungated localhost HTTP is a prompt-injection vector. guild-channel requires `Authorization: Bearer` matching `GUILD_API_KEY` or `GUILD_CHANNEL_SECRET`. The MCP subprocess reads env vars, then falls back to `guild-house/.env` (`../../../.env` from mission room cwd).

## Degraded mode (no push)

When the PO session is stopped or the channel never started:

| Condition | Behavior |
|-----------|----------|
| No `.guild/channel-endpoint.json` | Orchestrator updates checkpoint + inbox only; no HTTP POST |
| Stale endpoint / connection refused | Same — treat as degraded; log and continue |
| PO restore / attach | PO reads `inbox.md` + checkpoint via existing resume prompt (see `resumeSpawnPrompt` in scaffold) |

PO playbook: on restore, always read `inbox.md` before continuing. Channel is an optimization for **live** sessions, not the source of truth.

## PoC script (archived — `GUILD_CHANNEL_PUSH=0` by default)

```bash
cd guild-house
# Automated: channel server + auth gate (no Claude session)
bun server/scripts/archive/channel/poc-guild-channel.ts --http-only

# Full E2E: spawn PO, POST event, pass (default; no logs poll — avoids TTY clash if you attach elsewhere)
bun server/scripts/archive/channel/poc-guild-channel.ts

# Optional: also poll claude logs for <channel> (do not attach the same session while this runs)
bun server/scripts/archive/channel/poc-guild-channel.ts --verify-logs
```

See [server/scripts/archive/channel/README.md](../server/scripts/archive/channel/README.md).

Automates: version check → temp mission room → PO spawn (with dev channels) → wait for endpoint → POST test event → poll `claude logs` for channel delivery.

Manual fallback if spawn consent is pending: approve MCP in the PO session, re-run curl using the port from `channel-endpoint.json`.

## References

- [ideas/0.3.0/design.md](../../ideas/0.3.0/design.md) §5
- [ideas/0.3.0/channel-poc-notes.md](../../ideas/0.3.0/channel-poc-notes.md) — PoC findings & gotchas
- [Claude Code Channels reference](https://code.claude.com/docs/en/channels-reference)
- Implementation: `guild-channel/server.ts`, `guild-channel/launch.sh`, `templates/mission-room/.mcp.json`
