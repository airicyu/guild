# Session lifecycle design

> Status: **implemented** (v0.6.0)  
> Related: [api.md](../docs/api.md)

---

## Problem

Guild House tracks **mission state** on disk (`checkpoint.yaml`, outbox, mission room).  
PO runs in a **Claude Code background job** outside the repo.

These diverge: checkpoint may say `claude_session.status: running` while the CC job is gone.  
Guild-master may receive a stale `attachCmd` that fails.

---

## Two worlds

| Layer | Owner | Durability | Examples |
|-------|-------|------------|----------|
| **Mission room** | Guild House | Persistent | `squad.md`, `memory.md`, `outbox.jsonl`, `inbox.md`, `checkpoint.yaml` |
| **PO bg job** | Claude Code | Ephemeral | short id (`b4c04387`), `~/.claude/jobs/{id}/state.json` |

**Mission alive ≠ PO session alive.**

Durability for “continue later” lives in the **mission room**, not in CC’s `--resume UUID` (foreground-only) or completed bg jobs.

---

## Two live states

### Mission live state (`checkpoint.phase`)

| Phase | PO expected? | Auto-restore on boot? |
|-------|--------------|------------------------|
| `evaluating` | yes | yes |
| `running` | yes | yes |
| `blocked` | yes (idle, awaiting guild master) | yes |
| `paused` | no (intentional stop) | **no** |
| `done` | no | **no** |

### Session live state (CC)

Check **both**:

1. **`claude agents --json`** — is there a background agent with this `id`? (`process_live`)
2. **`~/.claude/jobs/{shortId}/state.json`** — `state`: `running` | `done`; folder missing → `missing`

Short `id` is the bg **job handle** (`attach`, `stop`, `respawn`).  
Full `sessionId` UUID in `state.json` / agents JSON is the **conversation** identity (not used for `--resume` on bg jobs).

There is **no** user-facing `claude --resume` for completed background jobs.

---

## Sync vs restore

### Sync (read-only side effects on checkpoint fields only)

**Rule: GET never spawns.**

On `GET /missions/:id*` (at least session-related routes), orchestrator:

1. Reads `checkpoint.claude_session.id`
2. Reads job folder / `state.json` → `job_state`
3. Runs `claude agents --json` → `process_live`
4. Updates checkpoint session fields (`status`, `job_state`, `synced_at`)
5. Returns `live`, `restoreRequired`, `attachCmd: null` when not live

`restoreRequired = true` when mission needs PO (`evaluating|running|blocked`) and session is not live.

### Restore (may respawn or spawn new PO)

**Rule: explicit triggers only.**

| Trigger | Action |
|---------|--------|
| Daemon **boot** | restore active missions (skip `paused`, `done`) |
| **POST** `/missions/:id/restore` | restore ladder |
| **POST** `/missions/:id/resume` | same as restore (+ unpause `paused` → `running`) |
| **GET** `/missions/:id/session?ensureLive=true` | sync → restore if needed → return live attach |

**Restore ladder**

```
process_live (agents --json)?
  yes → done (already_running)

job_state running, not in agents?
  → try claude respawn {shortId}
  → success → done (respawned)

job_state done | missing | respawn failed?
  → new claudew --bg with resume prompt (read memory/squad/outbox/phase)
  → update checkpoint with new short id (respawned_new)
```

Do **not** delete old session id from history; overwrite `id` on recreate (optional log in `last_signal`).

**Resume spawn prompt** (new bg job): PO reads mission room artifacts and continues from `phase` / `round`; does not rerun full handoff unless memory is empty.

---

## Signals / escalate when session dead

**Decision: A — no auto-restore on POST.**

- `POST /signals`, `POST /escalate`, etc. still write outbox / checkpoint as today.
- Do **not** auto-restore on these POSTs.
- Guild master restores via `ensureLive` / `POST restore` before attach.

Rationale: dead PO will not call these tools; outbox remains valid for guild master even when PO is offline.

---

## Checkpoint fields (proposed)

```yaml
claude_session:
  id: "b4c04387"                    # short job id (attach/respawn)
  session_id: "b4c04387-...."       # optional UUID from state.json / agents
  name: "mission-demo-001-po"
  cwd: "..."
  status: stopped                   # running | stopped (synced)
  job_state: done                   # running | done | missing (synced)
  synced_at: "2026-06-27T12:00:00Z"
```

Orchestrator-only fields; PO must not edit `checkpoint.yaml`.

---

## API surface (proposed)

### GET `/missions/:id/session`

Returns session commands + liveness. **Does not spawn.**

| Field | Meaning |
|-------|---------|
| `live` | `process_live` from agents |
| `jobState` | `running` \| `done` \| `missing` |
| `restoreRequired` | mission needs PO and not live |
| `attachCmd` | `null` when not live |
| `restorePath` | `POST /missions/:id/restore` |

Query: `?ensureLive=true` — run restore ladder, then return live attach (guild-master path).

### POST `/missions/:id/restore`

Run restore ladder; return `{ action, checkpoint, session }`.

`action`: `already_running` | `respawned` | `respawned_new`

### GET `/missions`

Add per mission: `sessionLive`, optionally `restoreRequired`.

### POST `/recover` (optional)

On-demand boot-style recovery for all active missions.

---

## Guild-master skill

| User intent | API |
|-------------|-----|
| Who is waiting? | `GET /outbox` + `GET /missions` (`awaitingGuildMaster`, `sessionLive`) |
| Give attach command | `GET .../session?ensureLive=true` only |
| PO was respawned new | Tell guild master new session id |

Never paste `attachCmd` from a prior message or stale checkpoint.

---

## Scenarios covered

| Scenario | Behavior |
|----------|----------|
| Bell new mission | always new `--bg` |
| Boot / guild-house restart | auto restore (non-paused, non-done) |
| Guild master attach | `ensureLive` → restore if needed |
| Session restart signal | stop + restore ladder |
| `mission_complete` | stop PO, `phase: done`, move `working/` → `done/`; guild master `POST .../archive` from done board; no restore |
| `paused` | no boot restore; explicit resume |
| Job `state: done` | restore = new `--bg` |
| Job folder missing | restore = new `--bg` |
| CC unavailable | sync fails gracefully; no fake spawn |
| Outbox unread, PO dead | outbox valid; guild master ensureLive then attach |
| Manual `claude --bg` in room | orphan job; do not adopt into checkpoint |

---

## Not in scope (prototype)

- Adopt orphan bg jobs by cwd/name matching
- `--resume UUID` as PO restore path
- Auto-restore on every GET
- Auto-restore on POST signals/escalate
- Periodic background sync loop (boot + GET sync + explicit restore is enough for v1)

---

## Implementation note

Single module: `syncSessionState()` + `restoreMissionSession()` shared by boot, GET sync, POST restore, and `ensureLive`.

Fix `session.ts` to use `config.claudeCommand` (e.g. `claudew`) for stop/respawn, not hardcoded `claude`.
