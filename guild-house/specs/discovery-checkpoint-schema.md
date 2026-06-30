# Discovery checkpoint schema

Orchestrator-only writer for `discovery-rooms/{ideaId}/checkpoint.yaml`. Discovery team lead must **not** edit this file — use `POST /discoveries/:id/signals` (Plan 3 Phase 3).

Related: [ideas/archive/mission-discovery-plan.md](../../ideas/archive/mission-discovery-plan.md) · [api.md](../docs/api.md#discovery-plan-3)

---

## Phases

| `phase` | Meaning |
|---------|---------|
| `exploring` | Clarifying scope, questioning |
| `drafting` | Writing mission package(s) under `artifacts/missions/` |
| `presenting` | Packages ready; guild master may review |
| `awaiting_approval` | Outbox asked guild master to join; `awaiting_guild_master: true` |
| `closed` | Approved; board entry removed; artifacts copied to parking |

Typical flow: `exploring` → `drafting` → `presenting` → (`awaiting_approval`) → `closed`.

---

## Example

```yaml
idea_id: "idea-20260629-a1b2c3"
phase: drafting
awaiting_guild_master: false
inbox_pending: false
picked_up_at: "2026-06-29T12:00:00.000Z"

claude_session:
  id: "d4e5f6a7"
  name: "discovery-idea-20260629-a1b2c3-lead"
  cwd: ".../discovery-rooms/idea-20260629-a1b2c3"
  status: running       # running | stopped
  session_id: "d4e5f6a7-...."
  job_state: running    # running | done | missing | unknown
  synced_at: "2026-06-29T12:00:00.000Z"

last_signal:
  at: "2026-06-29T12:05:00.000Z"
  by: "intake-lead"
  type: packages_ready
  summary: "Two mission drafts under artifacts/missions/"
```

---

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `idea_id` | string | Matches board folder id (`idea-{YYYYMMDD}-{6hex}`) |
| `phase` | enum | See table above |
| `awaiting_guild_master` | boolean | Set when presentation / approval needed |
| `inbox_pending` | boolean | Guild master wrote to `inbox.md` since last sync |
| `picked_up_at` | ISO8601 | When idea moved Ideas → Discovering |
| `claude_session` | object | Same shape as mission checkpoint session block |
| `last_signal` | object \| null | Last discovery signal (`start_drafting`, `packages_ready`, `request_approval`, `awaiting_input`) |

Parser may accept legacy `awaiting_eric` as alias for `awaiting_guild_master` (parity with mission checkpoints).

---

## Approve gate

`POST /discoveries/:id/approve` (Phase 3) requires:

1. At least one folder under `artifacts/missions/` with `mission.md`
2. Discovery board entry under `discovering/{ideaId}`

**Who calls it:**

| Path | Caller |
|------|--------|
| Web UI **Approve** | Guild master (browser → API) |
| Attach / inbox | Discovery intake lead runs `tools/approve.sh` when guild master clearly approves in chat |

On success: copy each mission folder → `mission-board/parking/{folder}/`, set `phase: closed`, remove `discovering/{ideaId}` (retain `discovery-rooms/{ideaId}/`).

Lead must **not** `cp` folders manually or log approval before `approve.sh` succeeds.
