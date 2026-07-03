---
name: guild-master
description: Operate Guild House orchestrator API for the guild master — bell/tick, board, backlog ideas, discovery approve, parking promote, mission close-out (approve/reject/abort artifacts), missions, skills bank, session attach commands, outbox. Use when asked to ring the bell, submit an idea, promote backlog, approve discovery, approve artifacts, promote parking, abort a mission, list missions, check who is awaiting a decision, get attach/resume commands, or control guild-house without editing mission runtime directly.
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
**Close-out QA:** [../../../guild-house/docs/tests/close-out-e2e.md](../../../guild-house/docs/tests/close-out-e2e.md)  
**Skills bank:** [../../../guild-house/docs/skills-bank.md](../../../guild-house/docs/skills-bank.md)

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
| Promote parking one folder at a time | Batch-promote all parking |
| Approve discovery via API when guild master decides | Let discovery lead narrate approval without HTTP 200 |
| Approve/reject/abort mission artifacts via API | Call `mission_complete` for the PO |
| Promote backlog → ideas one id at a time | Expect bell to pick up **ideas-backlog** |

**Primary intake:** `POST /ideas` (default `board: "backlog"`) or Web UI **Submit idea**. Legacy filesystem drop: `mission-board/queued/{slug}/mission.md` still works via bell execution half.

## Sub-files

- [workflows.md](workflows.md) — Ring bell, close-out, backlog, show attach, who's waiting
- [api-reference.md](api-reference.md) — Full curl catalog, session liveness, restore ladder
