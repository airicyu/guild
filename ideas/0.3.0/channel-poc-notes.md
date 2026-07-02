# Phase 0 — Guild channel PoC notes

**Status:** Phase 0 review gate **passed** (2026-07-02).  
**Operational docs:** [guild-house/docs/guild-channel.md](../../guild-house/docs/guild-channel.md)  
**Design:** [design.md](./design.md) §5

This file captures **what we learned validating the PoC** — gotchas, Claude Code behaviour, and settings semantics. Use `guild-channel.md` for day-to-day setup and API; use this file when onboarding or debugging channel/MCP issues.

---

## What we proved

| Check | Result |
|-------|--------|
| `guild-channel` MCP starts in mission room cwd | ✓ |
| Writes `.guild/channel-endpoint.json` with dynamic localhost port | ✓ |
| `Authorization: Bearer $GUILD_API_KEY` gate (403 without token) | ✓ |
| Orchestrator/PoC POST → channel accepts event | ✓ |
| Event forwarded to live `--bg` PO session | ✓ (`bun scripts/poc-guild-channel.ts`) |

**Exit criteria met:** POST → PO session receives channel event; playbook path uses `inbox.md` + checkpoint as ledger.

**Reference room (dev):** `data/mission-rooms/channel-poc-mr3mts83` — MCP approved, kept after cleanup.

---

## How MCP + channel fit together

```
mission-rooms/{id}/
  .mcp.json                    → Claude spawns guild-channel (stdio MCP)
  .claude/settings.json        → PO permissions (template; no MCP auto-enable)
  .claude/settings.local.json  → per-room MCP approval (created after user approves)
  .guild/channel-endpoint.json → HTTP port for orchestrator POST (written by MCP on bind)
```

1. **PO `--bg` spawn** (with `CLAUDE_DEV_CHANNELS=1`) → Claude loads `.mcp.json` → starts `guild-channel/launch.sh`.
2. **guild-channel** connects over stdio, binds `127.0.0.1:0`, writes `channel-endpoint.json`.
3. **Orchestrator** (or PoC) POSTs authenticated JSON to that port.
4. **MCP** emits `notifications/claude/channel` → PO sees `<channel source="guild-house" event="…">`.
5. **PO** reads `inbox.md` + checkpoint per channel instructions (filesystem = ledger).

**Degraded:** no endpoint / dead port / session stopped → update `inbox.md` + checkpoint only; PO picks up on restore/attach.

---

## Claude Code gotchas (PoC debugging)

### 1. Workspace trust ≠ MCP approval

Two separate gates:

| Gate | What it unlocks | How |
|------|-----------------|-----|
| **Workspace trust** | `settings.json` permissions; dev channel flag not ignored | Trust `~/airwave/guild` once (dialog or `hasTrustDialogAccepted: true` in `~/.claude.json`) |
| **MCP approval** | `guild-channel` server actually runs | Interactive prompt in **mission room** cwd, or `settings.local.json` with `enabledMcpjsonServers` |

Trusting `guild-house/` root **does not** approve MCP in `data/mission-rooms/*` — each room has its own `.mcp.json` scope.

### 2. Do **not** put `enableAllProjectMcpServers` in `settings.json`

We tried adding this to the template; with untrusted workspace it led to:

```text
--dangerously-load-development-channels ignored
Channels are not currently available
```

**Locked template rule:** `settings.json` = permissions only. MCP enablement lives in **`settings.local.json`** after user approval (not committed in template).

### 3. Spawn argument order

`claude --bg` requires **prompt before** channel flags:

```bash
# correct
claude --bg -n NAME --permission-mode auto "prompt text" \
  --dangerously-load-development-channels server:guild-channel

# wrong — prompt parsed as channel entry → exit 1
claude --bg ... --dangerously-load-development-channels server:guild-channel "prompt"
```

Implemented in `src/orchestrator/core/spawn.ts`.

### 4. Dev channel flag needs server name

```bash
--dangerously-load-development-channels server:guild-channel
```

Not bare `--dangerously-load-development-channels` (CLI requires `server:<name>`).

Guild env: `CLAUDE_DEV_CHANNELS=1` in `guild-house/.env` → orchestrator adds the flag on PO spawn.

### 5. `--bg` cannot show MCP approval UI

If MCP is `⏸ Pending approval`, PoC times out waiting for endpoint. Fix: run **interactive** `claude` once in that mission room cwd and approve (choose option 2).

### 6. Stale `channel-endpoint.json`

Reusing a room: old port in JSON may point at a dead server → `ConnectionRefused` on POST. PoC now deletes endpoint before spawn and probes port liveness before POST.

### 7. MCP subprocess env

Claude does not pass `GUILD_API_KEY` to MCP children. `guild-channel/server.ts` + `launch.sh` fall back to `../../../.env` (guild-house `.env`) from mission room cwd.

### 8. Terminal garble

Do not `claude attach` the same session while PoC polls `claude logs`. Run PoC to completion first; use `reset` if TTY corrupts.

---

## Settings files — correct shape

### `templates/mission-room/.claude/settings.json` (committed)

- `permissions.allow` / `deny` only
- **No** `enableAllProjectMcpServers`

### `settings.local.json` (per room, after approval)

```json
{
  "enabledMcpjsonServers": ["guild-channel"]
}
```

Created when user selects “Use this MCP server” in interactive Claude. Example: `channel-poc-mr3mts83/.claude/settings.local.json`.

### `.mcp.json` (committed in template)

```json
{
  "mcpServers": {
    "guild-channel": {
      "command": "bash",
      "args": ["../../../guild-channel/launch.sh"]
    }
  }
}
```

`launch.sh` resolves `bun` when Claude's PATH lacks `~/.bun/bin`.

---

## PoC commands (quick reference)

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd guild-house

# HTTP only (no Claude)
bun scripts/poc-guild-channel.ts --http-only

# Full E2E (default room: channel-poc-mr3mts83)
bun scripts/poc-guild-channel.ts

# Verify MCP in a room
cd data/mission-rooms/ROOM_ID && claude mcp list
```

---

## Production implications (Phase 1+)

- **First PO in a new mission room** may need one-time MCP approval (or guild-master attach) unless we automate trust another way.
- **Every mission room** gets its own channel HTTP port via MCP — orchestrator reads `channel-endpoint.json` per room.
- **Phase 1** will add `channel-notify` helper on approve-artifacts / reject / inbox writes.
- **Open question:** reduce per-room MCP friction for bell-spawned missions (document in guild-master runbook vs future tooling).

---

## Phase 0 review sign-off

- [x] Channel PoC validated on WSL with `--bg` PO
- [x] `guild-channel.md` + PoC script + spawn fix landed
- [x] Phase 1: lifecycle + `approve-artifacts` API (uses channel notify)
