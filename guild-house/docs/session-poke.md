# Session poke (0.5.0)

Orchestrator-initiated **ephemeral attach** that injects a short `[guild-house]` user message into a live `--bg` PO session after guild-master directives update inbox + checkpoint.

Design: [ideas/0.5.0/design.md](../../ideas/0.5.0/design.md)

## When it runs

After successful inbox write on:

- `POST /missions/:id/approve-artifacts`
- `POST /missions/:id/reject-artifacts`
- `POST /missions/:id/abort` (execution)

**Not** on `approve-discovery` or `escalate` (0.5.0).

## Flow

1. Write `comm/inbox.md` + update `checkpoint.yaml` (always)
2. Optional guild-channel HTTP (`GUILD_CHANNEL_PUSH=1`)
3. Session poke (`GUILD_SESSION_POKE`, default on):
   - `probeSession` — **no** `ensureLive` (Option A)
   - Dedicated short-lived Bun PTY → `claude attach {shortId}` → inject message → kill poke PTY only
   - Background `--bg` job keeps running

## Configuration

| Env | Default | Meaning |
|-----|---------|---------|
| `GUILD_SESSION_POKE` | on | `0` = inbox-only degraded mode |
| `GUILD_SESSION_POKE_TIMEOUT_MS` | `8000` | Attach + inject timeout |
| `GUILD_SESSION_POKE_MESSAGE` | unset | Optional template with `{{event}}`, `{{phase}}`, `{{role}}`, `{{phasePart}}` |

`GET /health` → `sessionPokeEnabled`.

## API response

```json
"notify": {
  "channel": { "delivered": false, "reason": "GUILD_CHANNEL_PUSH disabled" },
  "poke": { "delivered": true, "durationMs": 2400 }
}
```

| `poke.reason` | Guild master action |
|---------------|---------------------|
| `session not live` | Restore + attach, or retry after `ensureLive` |
| `attach_in_use` | Close browser terminal attach tab, retry |
| `GUILD_SESSION_POKE disabled` | Attach manually |

## vs channel vs manual attach

| Path | Role |
|------|------|
| inbox + checkpoint | **Source of truth** (always) |
| Session poke | Primary wake bus (0.5.0) |
| guild-channel | Optional secondary (`GUILD_CHANNEL_PUSH=1`) |
| Manual attach | Long conversation, poke failure fallback |

See also [guild-channel.md](./guild-channel.md).

## Manual / spike QA

```bash
cd guild-house/server
bun --env-file=../.env scripts/poc-session-poke.ts --spawn
bun --env-file=../.env scripts/e2e-050-session-poke.ts
```
