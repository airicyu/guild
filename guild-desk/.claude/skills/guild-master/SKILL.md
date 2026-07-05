---
name: guild-master
description: Operate Guild House orchestrator API for the guild master — bell/tick, board notes, intake approve, parking promote, mission close-out (approve/reject/abort artifacts), missions, skills bank, session attach commands, outbox. Use when asked to ring the bell, submit a board note, promote backlog, approve discovery, approve artifacts, promote parking, abort a board note or mission, list missions, check who is awaiting a decision, get attach/resume commands, or control guild-house without editing mission runtime directly.
---

# Guild Master

Control-plane skill for **Guild House** (Bun API at `GUILD_HOUSE_URL`).

**You call the API.** You do **not** attach to intake-lead or PO sessions yourself — output copy-paste terminal commands for the **guild master** (the human at this desk).

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

## Domain language (0.4.0)

| Term | Meaning |
|------|---------|
| **Mission board note** | Kanban card under `mission-board/{stage}/{id}/` — `mission.md` + `meta.yaml` |
| **Mission** | Agent workspace at `mission-rooms/{id}/` — session, checkpoint, attach |

Unqualified **mission** in API = **room runtime**, not the board card.

## Boundaries

| Do | Don't |
|----|-------|
| curl API | Edit `checkpoint.yaml` |
| Use `session?ensureLive=true` for attach | Paste attach from old messages |
| Promote parking one folder at a time | Batch-promote all parking |
| Approve intake via `POST /missions/{id}/approve-discovery` when guild master decides | Let intake-lead narrate approval without HTTP 200 |
| Close-out via `POST .../approve-artifacts` when `sessionPokeEnabled` (default) | Fire-and-forget approve when `poke.delivered: false` without restore/attach |
| Abort any pre-terminal board note via `POST /mission-board-notes/{id}/abort` | Use `POST /missions/{id}/abort` (legacy alias) |
| Promote backlog → ideas one id at a time | Expect bell to pick up **ideas-backlog** |

**Primary intake:** `POST /ideas` (default `board: "backlog"`) — creates a **mission board note** with `mission.md` + `meta.yaml`. Legacy filesystem drop: `mission-board/queued/{slug}/mission.md` (+ `meta.yaml` recommended) still works via bell execution half.

Intake and execution both use **`mission-rooms/{id}/`** (no `discovery-rooms/`). Attach is always **`GET /missions/{id}/session?ensureLive=true`** and **`/ws/missions/{id}/attach`**.

## Session poke (close-out, 0.5.0)

`GET /health` → **`sessionPokeEnabled`** (default **on**; `GUILD_SESSION_POKE=0` disables).

| `notify.poke` | Guild master action |
|---------------|---------------------|
| `delivered: true` | PO should resume — monitor outbox/phase |
| `delivered: false`, `session not live` | `ensureLive` + attach, or retry approve |
| `delivered: false`, `attach_in_use` | Close Web UI terminal tab, retry |

Inbox + checkpoint are **always** written before poke. Channel push (`GUILD_CHANNEL_PUSH=1`) is optional and secondary.

**Intake `approve-discovery`** does not use poke — orchestrator filesystem only.

## Sub-files

- [workflows.md](workflows.md) — Ring bell, close-out, backlog, show attach, who's waiting
- [api-reference.md](api-reference.md) — Full curl catalog, session liveness, restore ladder
