---
name: guild-master
description: Operate Guild House orchestrator API for the guild master — bell/tick, board, ideas, discovery approve, parking promote, missions, session attach commands, outbox. Use when asked to ring the bell, submit an idea, approve discovery, promote parking, list missions, check who is awaiting a decision, get attach/resume commands, or control guild-house without editing mission runtime directly.
---

# Guild Master

Control-plane skill for **Guild House** (Bun API at `GUILD_HOUSE_URL`).

**You call the API.** You do **not** attach to PO or discovery sessions yourself — output copy-paste terminal commands for the **guild master** (the human at this desk).

## Config

| Env | Default |
|-----|---------|
| `GUILD_HOUSE_URL` | `http://127.0.0.1:3847` |
| `GUILD_API_KEY` | required (match guild-house `.env`) |
| `GUILD_MASTER_NAME` | `Guild Master` | Display name for user + `GET /health` (playbooks use role **guild master**) |

If unset, assume `change-me-in-production` for local API key (match `guild-house/.env`). Read `guildMasterName` from `GET /health` when addressing the user by name.

**API doc:** [../../../guild-house/docs/api.md](../../../guild-house/docs/api.md)  
**Session lifecycle:** [../../../guild-house/specs/session-lifecycle.md](../../../guild-house/specs/session-lifecycle.md)

**Helper (cmd):** `scripts\guild-api.cmd /board`

## Auth

Every request except `GET /health` needs:

```text
Authorization: Bearer $GUILD_API_KEY
```

## Boundaries

| Do | Don't |
|----|-------|
| curl API | Edit `checkpoint.yaml` |
| Use `session?ensureLive=true` for attach | Paste attach from old messages |
| Print attach only when `live: true` | Run `claudew attach` here |
| Promote parking one folder at a time | Batch-promote all parking |
| Approve via API when guild master decides | Let discovery lead narrate approval without HTTP 200 |

**Primary intake:** `POST /ideas` or Web UI **Submit idea**. Legacy filesystem drop: `mission-board/ready/{slug}/mission.md` still works via bell execution half.

## Sub-files

- [workflows.md](workflows.md) — Ring bell, close mission, show attach, who's waiting
- [api-reference.md](api-reference.md) — Full curl catalog, session liveness, restore ladder