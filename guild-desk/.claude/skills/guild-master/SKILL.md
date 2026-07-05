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
| Close-out approve/reject **only with attach** when `channelPushEnabled` is false | Call `approve-artifacts` / `reject-artifacts` alone and claim PO will act (idle sessions miss channel) |
| Abort any pre-terminal board note via `POST /mission-board-notes/{id}/abort` | Use `POST /missions/{id}/abort` (legacy alias) |
| Promote backlog → ideas one id at a time | Expect bell to pick up **ideas-backlog** |

**Primary intake:** `POST /ideas` (default `board: "backlog"`) — creates a **mission board note** with `mission.md` + `meta.yaml`. Legacy filesystem drop: `mission-board/queued/{slug}/mission.md` (+ `meta.yaml` recommended) still works via bell execution half.

Intake and execution both use **`mission-rooms/{id}/`** (no `discovery-rooms/`). Attach is always **`GET /missions/{id}/session?ensureLive=true`** and **`/ws/missions/{id}/attach`**.

## Channel push (close-out)

`GET /health` → **`channelPushEnabled`** (`GUILD_CHANNEL_PUSH=1` on guild-house). **Default is off.**

| `channelPushEnabled` | `approve-artifacts` / `reject-artifacts` |
|----------------------|------------------------------------------|
| `false` | Updates `inbox.md` + checkpoint only — **does not wake idle PO**. Guild master must **attach** (or Web UI terminal) in the same turn; direct PO in session. Do not fire-and-forget API approve. |
| `true` | API may wake live PO via guild-channel (experimental; idle wake still unreliable). |

**Intake `approve-discovery`** does not depend on channel push — orchestrator filesystem only.

## Sub-files

- [workflows.md](workflows.md) — Ring bell, close-out, backlog, show attach, who's waiting
- [api-reference.md](api-reference.md) — Full curl catalog, session liveness, restore ladder
