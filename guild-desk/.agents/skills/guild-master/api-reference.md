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

Canonical **0.4.0** routes (`server/` API **0.30.0**). `POST /ideas` is retained for submit only.

```cmd
set GUILD_API_KEY=change-me-in-production
set AUTH=Authorization: Bearer %GUILD_API_KEY%

curl http://127.0.0.1:3847/health
curl -H "%AUTH%" http://127.0.0.1:3847/board
curl -H "%AUTH%" http://127.0.0.1:3847/queue
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/bell
curl -H "%AUTH%" http://127.0.0.1:3847/missions
curl -H "%AUTH%" "http://127.0.0.1:3847/mission-board-notes?stage=discovering"
curl -H "%AUTH%" http://127.0.0.1:3847/mission-board-notes/idea-20260704-a1b2c3
curl -X POST -H "%AUTH%" -H "Content-Type: application/json" -d "{\"text\":\"Rough idea here\"}" http://127.0.0.1:3847/ideas
curl -X POST -H "%AUTH%" -H "Content-Type: application/json" -d "{\"text\":\"Direct to ideas\",\"board\":\"ideas\"}" http://127.0.0.1:3847/ideas
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/board/ideas-backlog/idea-20260704-a1b2c3/promote
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/missions/idea-20260629-a1b2c3/approve-discovery
curl -H "%AUTH%" http://127.0.0.1:3847/missions/idea-20260629-a1b2c3/drafts
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/board/parking/my-mission-slug-20260629-abc123/promote
curl -X POST -H "%AUTH%" -H "Content-Type: application/json" -d "{\"reason\":\"cancelled\"}" http://127.0.0.1:3847/mission-board-notes/idea-20260704-a1b2c3/abort
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/missions/demo-001/approve-artifacts
curl -X POST -H "%AUTH%" -H "Content-Type: application/json" -d "{\"reason\":\"needs rework\"}" http://127.0.0.1:3847/missions/demo-001/reject-artifacts
curl -H "%AUTH%" "http://127.0.0.1:3847/missions/demo-001/session?ensureLive=true"
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/missions/demo-001/restore
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/missions/demo-001/archive
curl -H "%AUTH%" http://127.0.0.1:3847/skills-bank
curl -H "%AUTH%" http://127.0.0.1:3847/skills-bank/ad-hoc-create
curl -X POST -H "%AUTH%" http://127.0.0.1:3847/recover
curl -H "%AUTH%" http://127.0.0.1:3847/outbox
```

`POST /ideas` is **retained** for submit — it creates a mission board note (`mission.md` + `meta.yaml`).

`GET /health` also returns `tickIntervalMinutes`, **`sessionPokeEnabled`** (default on), and **`channelPushEnabled`** (default off).

## Session poke (0.5.0 — primary wake path)

| Health field | Env | Default |
|--------------|-----|---------|
| `sessionPokeEnabled` | `GUILD_SESSION_POKE=0` disables | **on** |
| `sessionPokeTimeoutMs` | `GUILD_SESSION_POKE_TIMEOUT_MS` | `8000` |

`POST /missions/{id}/approve-artifacts`, `reject-artifacts`, and `abort` return:

```json
"notify": {
  "channel": { "delivered": false, "reason": "GUILD_CHANNEL_PUSH disabled" },
  "poke": { "delivered": true, "durationMs": 2400 }
}
```

| `notify.poke` | Meaning |
|---------------|---------|
| `delivered: true` | Idle live PO received `[guild-house]` poke via ephemeral attach |
| `delivered: false`, `reason: session not live` | Inbox/checkpoint updated — restore + attach or retry |
| `delivered: false`, `reason: attach_in_use` | Browser terminal attach open — close tab and retry |

## Channel push (secondary)

| Health field | Env | Default |
|--------------|-----|---------|
| `channelPushEnabled` | `GUILD_CHANNEL_PUSH=1` on guild-house | **off** |

Orthogonal to session poke. Web UI shows approve/reject when **either** poke or channel is enabled.

## Intake phases (0.4.0)

| Phase | Guild master action |
|-------|---------------------|
| `mission_plan_presenting` | Review drafts; optional attach to intake-lead |
| `mission_plan_awaiting_approval` | `POST /missions/{id}/approve-discovery` |
| Parent on **done** (`idea_exploring`) | Manual `POST /missions/{id}/archive` when ready — *Mission plan complete* |

## Mission close-out phases

| Phase | Guild master action |
|-------|---------------------|
| `awaiting_artifact_review` | **`POST .../approve-artifacts`** or reject (poke wakes idle PO by default); attach fallback if `poke.delivered: false` |
| `releasing` | PO executes release — no guild master API |
| `retrospective` | PO aggregates retro — no guild master API |
| `done` (on **done** board) | `POST .../archive` |
| `aborted` (on **aborted** board) | `POST .../archive` |

`mission_complete` is a **PO signal** only — guild master does not call it.

## Session liveness

PO and intake-lead run in **background Claude Code jobs**. They can die while checkpoint/outbox still look active.

**Never attach from a stale session id.** Always use session API with restore.

| Field | Meaning |
|-------|---------|
| `live` | Bg agent in `claude agents --json` |
| `jobState` | `running` / `done` / `missing` from `~/.agents/jobs/{id}/state.json` |
| `restoreRequired` | Mission needs live session but process is dead |
| `attachCmd` | **`null` when not live** |

Restore triggers: **boot**, **`POST .../restore`**, **`POST .../resume`**, **`GET .../session?ensureLive=true`**.

Restore ladder: `respawn` → if fail, new `--bg` with resume prompt.

If `action: respawned_new`, tell guild master the session was respawned with a **new session id**.
