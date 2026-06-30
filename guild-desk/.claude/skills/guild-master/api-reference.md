# API Reference

## Config environment variables

| Env | Default |
|-----|---------|
| `GUILD_HOUSE_URL` | `http://127.0.0.1:3847` |
| `GUILD_API_KEY` | required (match guild-house `.env`) |
| `GUILD_MASTER_NAME` | `Guild Master` (display name; also in `GET /health` → `guildMasterName`) |

See [SKILL.md](SKILL.md#config) for full details.

## Auth

Every request except `GET /health` needs:

```text
Authorization: Bearer $GUILD_API_KEY
```

See [SKILL.md](SKILL.md#auth) for full details.

## curl patterns (Windows cmd)

```cmd
set GUILD_API_KEY=change-me-in-production
set AUTH=Authorization: Bearer %GUILD_API_KEY%

curl http://127.0.0.1:3847/health
curl -H "%AUTH%" http://127.0.0.1:3847/board
curl -H "%AUTH%" http://127.0.0.1:3847/queue
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/bell
curl -H "%AUTH%" http://127.0.0.1:3847/missions
curl -H "%AUTH%" http://127.0.0.1:3847/ideas
curl -X POST -H "%AUTH%" -H "Content-Type: application/json" -d "{\"text\":\"Rough idea here\"}" http://127.0.0.1:3847/ideas
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/discoveries/idea-20260629-a1b2c3/approve
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/board/parking/my-mission-slug-20260629-abc123/promote
curl -H "%AUTH%" "http://127.0.0.1:3847/missions/demo-001/session?ensureLive=true"
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/missions/demo-001/restore
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/missions/demo-001/archive
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/recover
curl -H "%AUTH%" http://127.0.0.1:3847/outbox
```

`GET /health` also returns `tickIntervalMinutes` — when &gt; 0, guild-house runs `orchestratorTick()` on that interval (same as bell).

## Session liveness (v0.6+)

PO runs in a **background Claude Code job**. It can die while checkpoint/outbox still look active.

**Never attach from a stale session id.** Always use session API with restore.

| Field | Meaning |
|-------|---------|
| `live` | Bg agent in `claude agents --json` |
| `jobState` | `running` / `done` / `missing` from `~/.claude/jobs/{id}/state.json` |
| `restoreRequired` | Mission needs PO but not live |
| `attachCmd` | **`null` when not live** |

Restore triggers: **boot**, **`POST .../restore`**, **`POST .../resume`**, **`GET .../session?ensureLive=true`**.

Restore ladder: `respawn` → if fail, new `--bg` with resume prompt.

If `action: respawned_new`, tell guild master PO was respawned with a **new session id**.