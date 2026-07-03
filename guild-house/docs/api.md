# Guild House API

**Base URL:** `http://127.0.0.1:3847` (default)  
**Version:** `0.19.0` (see `GET /health` → `version`)

> **Plan 3 (v0.11.0+):** Six board stages, `orchestratorTick()` on `POST /bell` and optional periodic tick. Legacy `ready/` / `active/` folder names are still read by the API if present on disk.

**CORS (v0.8.0):** Browser clients (e.g. web UI on `:3848`) send `Origin`; allowed origins from `GUILD_UI_ORIGIN` (default `http://127.0.0.1:3848,http://localhost:3848`). Preflight `OPTIONS` supported. Direct browser navigation to `/api/*` without Bearer still returns 401 — use the web app or curl with `Authorization`.

**Auth:** All routes except `GET /health` require:

```text
Authorization: Bearer $GUILD_API_KEY
```

Windows cmd setup (match `guild-house/.env`):

```cmd
set GUILD_API_KEY=change-me-in-production
set AUTH=Authorization: Bearer %GUILD_API_KEY%
```

Code fallback if env unset at startup: `dev-key-change-me` (`src/config.ts`).

Related: [session-lifecycle.md](../specs/session-lifecycle.md) · [mission-schema.md](../specs/mission-schema.md) · [discovery-checkpoint-schema.md](../specs/discovery-checkpoint-schema.md) · [tests/execution-e2e.md](./tests/execution-e2e.md)

---

## Route index

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | no | Service status |
| GET | `/board` | yes | Mission-board folder names by stage |
| POST | `/board/parking/:folder/promote` | yes | Move parking folder → queued |
| POST | `/bell` | yes | Orchestrator tick (discovery + execution pickup) |
| GET | `/queue` | yes | Ready missions vs active slot availability |
| GET | `/missions` | yes | Working + done + aborted missions + session liveness summary |
| GET | `/missions/:id` | yes | Single mission detail |
| GET | `/missions/:id/brief` | yes | Mission brief markdown (room copy or board fallback) |
| GET | `/missions/:id/summary` | yes | Mission + checkpoint + brief title + squad + outbox unread |
| GET | `/missions/:id/room/:path` | yes | Read-only file under mission room (allowlisted paths) |
| GET | `/missions/:id/events` | yes | Event log entries (audit trail) |
| POST | `/missions/:id/events` | yes | Append event log entry |
| GET | `/missions/:id/session` | yes | Attach/resume commands + liveness |
| WS | `/ws/missions/:id/attach` | yes | Browser terminal attach to live PO (PTY) |
| POST | `/missions/:id/restore` | yes | Restore ladder for PO session |
| POST | `/missions/:id/resume` | yes | Unpause + restore (same ladder as restore) |
| POST | `/missions/:id/pause` | yes | Stop PO; `phase: paused` |
| POST | `/missions/:id/signals` | yes | Lifecycle signals (orchestrator writes checkpoint) |
| POST | `/missions/:id/approve-artifacts` | yes | Guild master approve deliverables (`awaiting_artifact_review` → `releasing`) |
| POST | `/missions/:id/reject-artifacts` | yes | Guild master reject deliverables → `blocked` on working |
| POST | `/missions/:id/abort` | yes | Guild master abort → **aborted** board; frees slot |
| POST | `/missions/:id/archive` | yes | Move done or aborted → archive |
| GET | `/outbox` | yes | Unread escalations (active + archive) |
| GET | `/missions/:id/outbox` | yes | Mission outbox entries |
| POST | `/missions/:id/outbox/read` | yes | Mark outbox entries read |
| POST | `/missions/:id/escalate` | yes | Atomic outbox append + `blocked` signal |
| POST | `/recover` | yes | Manual boot-style recovery |
| POST | `/ideas` | yes | Submit rough idea → **ideas** column |
| GET | `/ideas` | yes | List ideas + discovering entries |
| GET | `/ideas/:id` | yes | Idea detail + discovery checkpoint |
| GET | `/ideas/:id/drafts` | yes | Mission draft packages under discovery room |
| POST | `/discoveries/:id/approve` | yes | Copy packages to **parking**; close discovery |
| POST | `/discoveries/:id/signals` | yes | Discovery lifecycle signals |
| GET | `/discoveries/:id/session` | yes | Discovery lead attach/resume commands |
| POST | `/discoveries/:id/restore` | yes | Restore ladder for discovery lead |
| WS | `/ws/discoveries/:id/attach` | yes | Browser terminal attach to discovery lead |
| GET | `/discoveries/:id/outbox` | yes | Discovery outbox entries |
| POST | `/discoveries/:id/outbox/read` | yes | Mark discovery outbox read |
| POST | `/discoveries/:id/escalate` | yes | Discovery escalate + blocked signal |
| GET | `/discoveries/:id/events` | yes | Discovery event log |
| POST | `/discoveries/:id/events` | yes | Append discovery event |

Discovery routes: [Discovery (Plan 3)](#discovery-plan-3). Full E2E: [e2e-discovery-path.md](./e2e-discovery-path.md).

---

## `GET /health`

Public. No Bearer token.

**Response 200**

```json
{
  "ok": true,
  "service": "guild-house",
  "version": "0.16.0",
  "guildHome": "C:\\...\\guild-house\\data",
  "guildMasterName": "Eric",
  "tickIntervalMinutes": 0
}
```

`guildMasterName` comes from `GUILD_MASTER_NAME` (default `Guild Master`). **Display only** — Web UI header; not substituted into room playbooks (use role term **guild master**; see [specs/product.md](../specs/product.md) § Guild master).

`tickIntervalMinutes` from `GUILD_TICK_INTERVAL_MINUTES` (default `0` = disabled). When &gt; 0, server runs `orchestratorTick()` on that interval (same as `POST /bell`); logs to stdout as `[tick] …`.

---

## `GET /board`

Lists folder names for each board stage (Plan 3 six-column model). Legacy `ready/` merges into `queued`; legacy `active/` merges into `working`.

**Response 200**

```json
{
  "ideas": ["idea-20260629-a1b2c3"],
  "discovering": [],
  "parking": ["split-guild-master-skill-20260629-8d133b"],
  "queued": ["hello-world"],
  "working": ["demo-001"],
  "done": [],
  "archive": ["demo-002", "demo-003"]
}
```

`archive` is hidden in the Web UI board; still returned for tooling.

---

## `POST /bell`

Calls **`orchestratorTick()`** — same as periodic auto-tick when `GUILD_TICK_INTERVAL_MINUTES` &gt; 0.

**Discovery half** (FIFO, slot-limited by `MAX_DISCOVERY_SESSIONS`):

1. Pick ideas from `ideas/` → scaffold discovery room → spawn intake lead `--bg` → move to `discovering/`

**Execution half** (FIFO, slot-limited by `MAX_ACTIVE_MISSIONS` on **working** only):

1. **Mint id** if queued folder is a slug → `{slug}-{YYYYMMDD}-{6hex}`
2. Move `queued/{id}` → `working/{id}`
3. Scaffold mission room, copy brief, spawn PO `--bg`, write `checkpoint.yaml`

**Response 200**

```json
{
  "discoveriesStarted": ["idea-20260629-a1b2c3"],
  "missionsStarted": ["hello-world-20260627-a3f9c2"],
  "queuedDiscovery": [],
  "queuedExecution": [],
  "errors": [],
  "discoverySlots": { "used": 1, "max": 2, "available": 1 },
  "executionSlots": { "used": 1, "max": 4, "available": 3 }
}
```

| Field | Meaning |
|-------|---------|
| `discoveriesStarted` | Idea ids moved to discovering with lead spawned |
| `missionsStarted` | Mission ids moved to working with PO spawned |
| `queuedDiscovery` / `queuedExecution` | Skipped because slots full |
| `errors` | Per-item failures `{ id, error, pipeline? }` |

---

## `GET /queue`

Preview what the next tick would start vs queue (discovery + execution).

**Response 200**

```json
{
  "discovery": {
    "slots": { "used": 0, "max": 2, "available": 2 },
    "ideas": ["idea-20260629-a1b2c3"],
    "discovering": [],
    "wouldStartOnTick": ["idea-20260629-a1b2c3"],
    "wouldQueueOnTick": []
  },
  "execution": {
    "slots": { "used": 1, "max": 4, "available": 3 },
    "queued": ["hello-world"],
    "wouldPickupOnTick": ["hello-world"],
    "wouldQueueOnTick": []
  }
}
```

**Slot counting:** Only **working** board missions count toward execution slots. **Done** board does not consume slots.

---

## `GET /missions`

Lists **working** and **done** board missions with checkpoint summary. Working missions include synced session liveness.

**Response 200**

```json
{
  "missions": [
    {
      "id": "hello-world-20260627-a3f9c2",
      "board": "working",
      "phase": "running",
      "sessionId": "a1b2c3d4",
      "sessionLive": true,
      "jobState": "running",
      "restoreRequired": false,
      "awaitingGuildMaster": false,
      "archiveReady": false
    },
    {
      "id": "demo-003",
      "board": "done",
      "phase": "done",
      "sessionId": "1510ca5b",
      "sessionLive": false,
      "jobState": "done",
      "restoreRequired": false,
      "awaitingGuildMaster": false,
      "archiveReady": true
    }
  ],
  "count": 2
}
```

| Field | Meaning |
|-------|---------|
| `board` | `working` (live PO) or `done` (complete, awaiting archive) |
| `archiveReady` | `true` when on **done** board with `phase: done` — guild master may `POST .../archive` |
| `awaitingGuildMaster` | `true` when blocked and waiting for guild master decision |
| `sessionLive` | PO bg agent present in `claude agents --json` (working only) |
| `restoreRequired` | Mission needs PO but session not live (working only) |

**Slot counting:** Only missions on **working** board count toward `MAX_ACTIVE_MISSIONS`. **Done** board does not consume slots.

---

## `POST /board/parking/:folder/promote`

Move one parking folder → **queued** (guild master promotes approved missions before bell).

**Path:** `folder` — parking board folder name (e.g. `split-guild-master-skill-20260629-8d133b`).

**Response 200**

```json
{
  "ok": true,
  "folder": "split-guild-master-skill-20260629-8d133b",
  "stage": "queued"
}
```

**404** — not on parking board or folder missing on disk.  
**409** — queued entry already exists.

---

## `GET /missions/:id`

**Active mission — Response 200**

```json
{
  "id": "hello-world-20260627-a3f9c2",
  "board": "active",
  "roomPath": "C:\\...\\mission-rooms\\hello-world-20260627-a3f9c2",
  "checkpoint": { "...": "..." },
  "sessionLive": true,
  "jobState": "running",
  "restoreRequired": false
}
```

**Ready / parking / archive — Response 200**

```json
{
  "id": "demo-003",
  "board": "archive",
  "roomPath": "C:\\...\\mission-rooms\\demo-003",
  "checkpoint": { "...": "..." }
}
```

**404** — mission id not found on any board stage.

---

## `GET /missions/:id/summary`

Single payload for mission room UI: mission metadata, checkpoint, brief title, squad members, unread outbox count.

**Response 200**

```json
{
  "id": "hello-world-20260627-5e422e",
  "board": "archive",
  "roomPath": "C:\\...\\mission-rooms\\hello-world-20260627-5e422e",
  "checkpoint": { "...": "..." },
  "briefTitle": "Hello-world artifact",
  "squadMembers": ["project-owner", "developer", "qa"],
  "outboxUnreadCount": 0,
  "archiveReady": false,
  "awaitingGuildMaster": false
}
```

Active missions also include `sessionLive`, `jobState`, `restoreRequired`.

**404** — mission not found.

---

## `GET /missions/:id/room/:path`

Read-only file under the mission room. Path is URL-encoded; slashes separate segments (e.g. `memories/common/mission-brief.md`).

**Allowlist:** `squad.md`, `inbox.md`, `outbox.jsonl`, `artifact-release.md`, `retrospective/**`, `memories/**`, `mission-reports/**`. Path traversal (`..`) rejected.

**Response 200**

```json
{
  "path": "memories/common/mission-brief.md",
  "content": "---\ntitle: Hello-world artifact\n---\n..."
}
```

**400** — path not allowed. **404** — mission or file not found.

If `memories/common/mission-brief.md` is missing in the room (legacy missions), the API falls back to `mission-board/{stage}/{id}/mission.md` on the mission's board stage.

---

## `GET /missions/:id/session`

Returns PO session commands and liveness. **GET never spawns** — only syncs checkpoint session fields.

**Query:** `?ensureLive=true` — sync, then run restore ladder if needed, return live attach command (guild-master path).

**Response 200**

```json
{
  "id": "a1b2c3d4",
  "name": "mission-hello-world-20260627-a3f9c2-po",
  "cwd": "C:\\...\\mission-rooms\\hello-world-20260627-a3f9c2",
  "attachCmd": "claudew attach a1b2c3d4",
  "resumeCmd": "claudew -r mission-hello-world-20260627-a3f9c2-po",
  "stopCmd": "claudew stop a1b2c3d4",
  "respawnCmd": "claudew respawn a1b2c3d4",
  "logsCmd": "claudew logs a1b2c3d4",
  "live": true,
  "jobState": "running",
  "restoreRequired": false,
  "restorePath": "/missions/hello-world-20260627-a3f9c2/restore"
}
```

When not live: `attachCmd` is `null`, `restoreRequired` is `true` (if mission phase needs PO).

**404** — mission not active or no checkpoint.

See [session-lifecycle.md](../specs/session-lifecycle.md) for restore ladder and boot recovery.

---

## `WS /ws/missions/:id/attach`

Browser terminal attach to the **existing** PO `claudew --bg` session. Spawns a **bash** PTY in the mission room cwd, then auto-sends `claudew attach {shortId}` (not a fresh foreground Claude spawn). **Closing the WebSocket kills the attach PTY only** — the background PO job keeps running.

**Implementation (WSL/Linux):** Bun native PTY via `Bun.spawn({ terminal })` in `src/websocket/attach-pty.ts` — no `node-pty` dependency.

**Client UX:** [specs/terminal-attach.md](../specs/terminal-attach.md) · manual QA: [tests/terminal-attach.md](./tests/terminal-attach.md)

**Auth:** Query param `?token=$GUILD_API_KEY` or HTTP upgrade header `Authorization: Bearer $GUILD_API_KEY`.

**Origin:** Must match `GUILD_UI_ORIGIN` (same as REST CORS).

**Query (optional):** `?cols=120&rows=30` — initial PTY size from client xterm fit-before-connect (defaults 80×24).

**On connect:** Server calls `ensureMissionSessionLive` (same as `GET .../session?ensureLive=true`) before spawning the attach PTY.

**Client → server (JSON text frames)**

| type | fields | description |
|------|--------|-------------|
| `chat_input` | `data: string` | Keystrokes to forward to attach PTY |
| `pty_resize` | `cols`, `rows` | Terminal dimensions |

**Server → client**

| type | fields | description |
|------|--------|-------------|
| `connected` | `resourceId`, `pipeline` | Attach PTY ready (`pipeline`: `mission` \| `discovery`) |
| `pty_output` | `data: string` | PTY stdout (ANSI) |
| `error` | `message` | Session not live or attach failed |

**Example (dev UI via Vite proxy)**

```text
ws://127.0.0.1:3848/ws/missions/demo-001/attach?token=change-me-in-production
```

**4403** — session not live (restore required). **401** — bad token. **403** — origin not allowed.

---

## `POST /missions/:id/restore`

Run restore ladder: `respawn` → if fail, new `--bg` with resume prompt. Updates checkpoint session id.

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "action": "respawned_new",
  "previousSessionId": "a1b2c3d4",
  "checkpoint": { "...": "..." },
  "session": { "...": "..." }
}
```

`action`: `already_running` | `respawned` | `respawned_new`

**404** — not active or missing checkpoint.  
**409** — mission already `done`.

---

## `POST /missions/:id/resume`

Same restore ladder as `/restore`. If mission was `paused`, unpauses to `running`.

**Response 200** — same shape as `/restore`.

---

## `POST /missions/:id/pause`

Stops PO session; sets `phase: paused`. Boot recovery skips paused missions.

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "checkpoint": { "...": "..." }
}
```

**409** — mission already `done`.

---

## `POST /missions/:id/signals`

PO updates lifecycle via orchestrator (**only** orchestrator writes `checkpoint.yaml` besides sync).

**Body**

```json
{
  "type": "blocked",
  "summary": "Need guild master to choose auth strategy",
  "by": "project-owner"
}
```

**Types**

| type | Orchestrator behavior |
|------|----------------------|
| `round_complete` | `round++`; `evaluating`/`blocked` → `running`; clear `awaiting_guild_master` |
| `blocked` | `phase: blocked`, `awaiting_guild_master: true` |
| `artifacts_ready_for_review` | `phase: awaiting_artifact_review`, `awaiting_guild_master: true` (from `running`/`evaluating`/`blocked`) |
| `artifact_release_complete` | `releasing` → `retrospective`; requires `artifact-release.md` `status: released`; logs milestone |
| `retrospective_complete` | requires `retrospective/workflow-report.md`; logs milestone; phase stays `retrospective` |
| `request_session_restart` | stop + restore ladder |
| `mission_complete` | requires prior `retrospective_complete` signal + workflow report; stop PO; move **working/** → **done/** |

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "checkpoint": { "...": "..." }
}
```

**404** — not active. **400** — invalid type or JSON.

Mission room tool:

```cmd
cd data\mission-rooms\{id}
set GUILD_API_KEY=change-me-in-production
tools\signal.cmd mission_complete "QA pass — all criteria met"
```

---

## `POST /missions/:id/approve-artifacts`

Guild master approves mission deliverables after internal QA. **Does not** stop PO or move board.

Requires mission on **working** with `phase: awaiting_artifact_review`.

**Side effects:** `phase: releasing`; writes `inbox.md`; POST guild-channel `artifacts_approved` when endpoint live.

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "checkpoint": { "...": "..." },
  "notify": { "channel": { "delivered": true } }
}
```

**404** — not on working board. **409** — wrong phase.

Mission room tool: `tools/approve-artifacts.sh` (PO runs when guild master clearly approves in attach).

---

## `POST /missions/:id/reject-artifacts`

Guild master rejects deliverables. Mission stays on **working**; `phase: blocked`, `awaiting_guild_master: true`.

**Body** (optional)

```json
{ "reason": "Acceptance criteria 2 and 3 not met" }
```

**Response 200** — same shape as approve-artifacts (`notify.channel` may be `delivered: false` in degraded mode).

Mission room tool: `tools/reject-artifacts.sh "<reason>"`

---

## `POST /missions/:id/abort`

Guild master early terminal close. Stops PO; moves **working/** → **aborted/**; frees execution slot.

**Body** (optional)

```json
{ "reason": "Wrong scope — duplicate of existing work" }
```

Writes `retrospective/abort-note.md` (orchestrator stub on Web path). Skips approve → release → retro success path.

**Response 200** — same notify shape as approve-artifacts.

Mission room tool: `tools/abort.sh [reason]` (PO may write abort-note first on chat path).

---

## `POST /missions/:id/archive`

Guild master closes mission after acceptance. Requires mission on **done** board with `phase: done`, **or** **aborted** board with `phase: aborted`.

Moves board entry `done/{id}` or `aborted/{id}` → `archive/{id}`. Mission room stays at `mission-rooms/{id}/`.

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "checkpoint": { "...": "..." }
}
```

**404** — not on done board.  
**409** — `phase` is not `done`.

---

## `GET /outbox`

Unread escalations across **discovering ideas** and **working + archive** missions.

**Response 200**

```json
{
  "items": [
    {
      "ideaId": "idea-20260629-a1b2c3",
      "id": "mabc123-xyz789",
      "ts": "2026-06-27T18:00:00.000Z",
      "from": "intake-lead",
      "question": "Ready for approval — two mission drafts",
      "urgency": "normal",
      "read": false
    },
    {
      "missionId": "hello-world-20260627-a3f9c2",
      "id": "mabc123-xyz789",
      "ts": "2026-06-27T18:00:00.000Z",
      "from": "project-owner",
      "question": "Which auth provider?",
      "urgency": "normal",
      "context": "OAuth vs JWT",
      "read": false
    }
  ],
  "count": 1
}
```

---

## `GET /missions/:id/outbox`

All outbox entries for one mission (active or archive).

**Response 200**

```json
{
  "missionId": "hello-world-20260627-a3f9c2",
  "board": "active",
  "entries": [ "..." ],
  "unreadCount": 1
}
```

**404** — mission not found.

---

## `POST /missions/:id/outbox/read`

Mark entries read. Optional body `{ "ids": ["entry-id"] }`; omit body to mark all unread for mission.

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "marked": 1
}
```

---

## `POST /missions/:id/escalate`

Atomic: append outbox entry + `blocked` signal. Rolls back outbox entry if signal fails.

**Body**

```json
{
  "question": "Which auth provider?",
  "urgency": "normal",
  "context": "OAuth vs JWT",
  "from": "project-owner"
}
```

`urgency`: `low` | `normal` | `high` (default `normal`).

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-a3f9c2",
  "entry": { "...": "..." },
  "checkpoint": { "...": "..." }
}
```

Does **not** auto-restore dead PO sessions. Guild master uses `GET .../session?ensureLive=true` before attach.

Mission room tool:

```cmd
tools\escalate.cmd "Which auth provider?" normal "OAuth vs JWT"
```

---

## `GET /missions/:id/brief`

Returns mission brief markdown. Prefers frozen `memories/common/mission-brief.md`; falls back to board `mission.md`.

**Response 200**

```json
{
  "missionId": "demo-001",
  "board": "active",
  "content": "---\ntitle: Demo mission\n---\n..."
}
```

**404** — mission or brief not found.

---

## `GET /missions/:id/events`

Returns all event log entries (active or archive). Append-only audit trail — not an agent chat channel.

**Response 200**

```json
{
  "missionId": "hello-world-20260627-5e422e",
  "board": "archive",
  "entries": [
    {
      "ts": "2026-06-27T18:00:00.000Z",
      "from": "qa",
      "type": "qa_pass",
      "body": "hello.cmd prints Guild House OK"
    }
  ],
  "count": 1
}
```

---

## `POST /missions/:id/events`

Append an event log entry. `type` is validated by writer role.

**Body**

```json
{
  "from": "qa",
  "type": "qa_pass",
  "body": "All acceptance criteria pass"
}
```

**PO types:** `milestone`, `directive`, `evaluator_done`, `round_note`  
**Member types:** `status`, `evidence`, `qa_pass`, `qa_fail`

**Response 200**

```json
{
  "ok": true,
  "missionId": "hello-world-20260627-5e422e",
  "entry": { "...": "..." }
}
```

Mission room tool:

```cmd
tools\log.cmd qa qa_pass "hello.cmd prints Guild House OK"
```

---

## `POST /recover`

Manual boot-style recovery for all **active** missions. Skips `paused` and `done`.

**Response 200**

```json
{
  "ok": true,
  "recovered": [
    {
      "missionId": "hello-world-20260627-a3f9c2",
      "action": "respawned",
      "previousSessionId": "a1b2c3d4"
    },
    {
      "missionId": "demo-001",
      "action": "skipped",
      "error": "paused"
    },
    {
      "missionId": "demo-003",
      "action": "skipped",
      "error": "done — awaiting guild master archive"
    }
  ]
}
```

Daemon startup runs the same recovery automatically (see `server.ts` boot hook).

---

## Checkpoint fields (reference)

Orchestrator-only. PO must not edit `checkpoint.yaml`.

```yaml
mission_id: "hello-world-20260627-a3f9c2"
phase: running          # evaluating | running | blocked | paused | awaiting_artifact_review | releasing | retrospective | done | aborted
round: 1
awaiting_guild_master: false
inbox_pending: false
picked_up_at: "2026-06-27T18:00:00.000Z"

claude_session:
  id: "a1b2c3d4"
  name: "mission-hello-world-20260627-a3f9c2-po"
  cwd: "..."
  status: running       # running | stopped
  session_id: "a1b2c3d4-...."
  job_state: running    # running | done | missing | unknown
  synced_at: "2026-06-27T18:00:00.000Z"

last_signal:
  at: "2026-06-27T18:05:00.000Z"
  by: "project-owner"
  type: mission_complete
  summary: "QA pass"
```

Legacy checkpoints may use `awaiting_eric`; parser accepts both.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUILD_API_KEY` | `change-me-in-production` (`.env`) · fallback `dev-key-change-me` if unset | Bearer token |
| `GUILD_HOME` | `data` | Mission data root (relative to project) |
| `PORT` | `3847` | Listen port |
| `CLAUDE_COMMAND` | `claude` | CC CLI for spawn/stop/respawn/attach |
| `CLAUDE_PERMISSION_MODE` | `acceptEdits` | Passed to `--bg` spawn |
| `GUILD_MASTER_NAME` | `Guild Master` | Display name in `/health` + Web UI (not baked into playbooks) |
| `MAX_ACTIVE_MISSIONS` | `4` | Concurrent PO slots on **working** board (excludes `phase: done`) |
| `MAX_DISCOVERY_SESSIONS` | `2` | Concurrent live discovery lead sessions on **discovering** board |
| `GUILD_TICK_INTERVAL_MINUTES` | `0` | Auto `orchestratorTick()` interval; `0` = manual bell only |
| `GUILD_UI_ORIGIN` | `http://127.0.0.1:3848,…` | CORS allowed origins for Web UI |

See `.env.example`.

---

## Discovery (Plan 3)

Canonical spec: [ideas/archive/mission-discovery-plan.md](../../ideas/archive/mission-discovery-plan.md) · Discovery checkpoint: [discovery-checkpoint-schema.md](../specs/discovery-checkpoint-schema.md) · E2E walkthrough: [e2e-discovery-path.md](./e2e-discovery-path.md) · Template: `templates/discovery-room/`

Board/list/tick/queue semantics are documented in the main sections above (`GET /board`, `POST /bell`, `GET /queue`).

### `POST /ideas`

Create a rough idea on the **Ideas** column.

**Body**

```json
{
  "text": "Build a kanban for mission discovery with six columns.",
  "slug": "mission-kanban"
}
```

`text` required. Optional `slug` prefixes minted id as `{slug}-{YYYYMMDD}-{6hex}`; default prefix is `idea`.

**Response 201**

```json
{
  "ok": true,
  "ideaId": "idea-20260629-a1b2c3",
  "board": "ideas",
  "scratchPreview": "Build a kanban for mission discovery…"
}
```

Creates `mission-board/ideas/{ideaId}/scratch.md`.

#### `GET /ideas`

Lists ideas on **ideas** and **discovering** stages.

**Response 200**

```json
{
  "ideas": [
    {
      "id": "idea-20260629-a1b2c3",
      "board": "ideas",
      "scratchPreview": "Build a kanban…"
    }
  ],
  "count": 1
}
```

Discovering entries include `phase` and `sessionLive` when checkpoint exists.

#### `GET /ideas/:id`

Idea detail: full scratch, board stage, discovery checkpoint + session liveness when on **discovering**.

**Response 200**

```json
{
  "id": "idea-20260629-a1b2c3",
  "board": "discovering",
  "scratch": "Build a kanban for mission discovery…",
  "scratchPreview": "Build a kanban…",
  "checkpoint": {
    "idea_id": "idea-20260629-a1b2c3",
    "phase": "exploring",
    "awaiting_guild_master": false,
    "inbox_pending": false,
    "picked_up_at": "2026-06-29T12:00:00.000Z",
    "claude_session": {
      "id": "d4e5f6a7",
      "name": "discovery-idea-20260629-a1b2c3-lead",
      "cwd": ".../discovery-rooms/idea-20260629-a1b2c3",
      "status": "running",
      "job_state": "running"
    },
    "last_signal": null
  },
  "sessionLive": true,
  "jobState": "running",
  "roomPath": ".../discovery-rooms/idea-20260629-a1b2c3",
  "phase": "exploring"
}
```

**Bell discovery pickup:** `POST /bell` moves `ideas/{id}` → `discovering/{id}`, scaffolds `discovery-rooms/{id}/`, spawns `discovery-{id}-lead` `--bg`, writes discovery `checkpoint.yaml` (`phase: exploring`).

### Shipped in v0.13.0 (Phase 3)

#### `POST /discoveries/:id/signals`

Discovery phase transitions (orchestrator writes `checkpoint.yaml`).

**Body**

```json
{
  "type": "packages_ready",
  "by": "intake-lead",
  "summary": "Two mission drafts under artifacts/missions/"
}
```

Types: `start_drafting` → `drafting`; `packages_ready` → `presenting`; `request_approval` → `awaiting_approval` + `awaiting_guild_master: true`; `awaiting_input` → `awaiting_guild_master: true` (phase unchanged).

#### `GET /discoveries/:id/outbox` · `POST /discoveries/:id/outbox/read` · `POST /discoveries/:id/escalate`

Mirror mission outbox/escalate; escalate appends outbox and signals `awaiting_input`.

#### `POST /discoveries/:id/events` · `GET /discoveries/:id/events`

Discovery team log (`events.jsonl` in discovery room). Types: `note`, `milestone`, `status`.

Room tools: `templates/discovery-room/tools/signal.sh`, `escalate.sh`, `log.sh` (`.cmd` on Windows).

#### `GET /ideas/:id/drafts`

List/preview `artifacts/missions/*` (title from `mission.md` frontmatter).

**Response 200**

```json
{
  "ideaId": "idea-20260629-a1b2c3",
  "count": 2,
  "drafts": [
    {
      "folder": "auth-flow-20260629-a1b2c3",
      "title": "Auth flow hardening",
      "preview": "…",
      "hasMissionMd": true
    }
  ]
}
```

#### `POST /discoveries/:id/approve`

Guild master approves discovery packages → **Parking**.

Requires ≥1 folder under `artifacts/missions/` with `mission.md`; idea on **discovering** board.

Each draft is copied to parking under an orchestrator-minted id `{slug}-{YYYYMMDD}-{6hex}` (`slug` from draft folder name; `6hex` from `crypto.getRandomValues`). Draft folder names in the discovery room are not preserved on the board.

**Callers:** Web UI **Approve** button, or discovery intake lead via `tools/approve.sh` when guild master approves in attach/inbox (same endpoint).

**Response 200**

```json
{
  "ok": true,
  "ideaId": "idea-20260629-a1b2c3",
  "parkingFolders": ["auth-flow-20260629-a1b2c3", "admin-ui-20260629-d4e5f6"],
  "checkpoint": { "phase": "closed", "...": "..." }
}
```

Removes `discovering/{ideaId}` from board; retains `discovery-rooms/{ideaId}/`.

### Shipped in v0.14.0 (Phase 5)

#### `GET /discoveries/:id/session`

Mirror `GET /missions/:id/session` for the discovery intake lead on the **discovering** board.

**Query:** `?ensureLive=true` — sync, restore ladder if needed, return live attach command.

**Response 200** — same shape as mission session (`attachCmd`, `resumeCmd`, `live`, `restoreRequired`, `restorePath: /discoveries/:id/restore`, …).

#### `POST /discoveries/:id/restore`

Restore ladder for discovery lead (respawn → new `--bg` with `resumeDiscoverySpawnPrompt`).

#### `WS /ws/discoveries/:id/attach`

Same protocol as [`WS /ws/missions/:id/attach`](#ws-wsmissionsidattach): bash PTY → auto `claude attach {shortId}`; `ensureDiscoverySessionLive` on connect; WS close kills attach PTY only.

**Example (dev UI via Vite proxy)**

```text
ws://127.0.0.1:3848/ws/discoveries/idea-20260629-a1b2c3/attach?token=change-me-in-production&cols=120&rows=30
```

Web UI: Idea page **Terminal** tab — shared stack; see [specs/terminal-attach.md](../specs/terminal-attach.md).

### Parking promote (v0.15+)

#### `POST /board/parking/:folder/promote`

Move one parking folder → `queued/`. See [POST /board/parking/:folder/promote](#post-boardparkingfolderpromote) above.

Existing `/missions/:id/*` routes serve **working** and **done** missions (terminal attach: working only).

