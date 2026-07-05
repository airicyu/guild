## Workflows

### Ring the bell (orchestrator tick)

`POST /bell` runs **intake** (ideas → discovering) then **execution** (queued → working), slot-limited. **ideas-backlog** never auto-ticks.

1. `GET /health` — up + `guildMasterName` + `tickIntervalMinutes` + **`sessionPokeEnabled`** + `channelPushEnabled`
2. `GET /board` — Backlog, Ideas, Discovering, Parking, Queued, Working, Done, Aborted
3. `GET /queue` — preview what tick would start vs queue
4. `POST /bell`
5. Summarize `intakeStarted` / `missionsStarted` (legacy: `discoveriesStarted`), `queuedIntake` / `queuedExecution`, `errors`, slot meters
6. Per new mission id → `GET /missions/{id}/session?ensureLive=true`

When `tickIntervalMinutes` &gt; 0 on guild-house, tick runs automatically — guild master may skip manual bell.

### Submit a board note (rough prompt)

1. `POST /ideas` with JSON `{ "text": "…", "slug": "optional", "board": "backlog" }` — default **backlog**; use `"board": "ideas"` to skip incubation
2. Summarize `noteId` (or `ideaId`), `board`, and `briefPreview` / `scratchPreview`
3. If on **backlog** → promote first (below). If on **ideas** → ring bell when intake slots free

### Promote backlog → ideas

One board note at a time:

1. `GET /board` — list `ideas-backlog` ids
2. `POST /board/ideas-backlog/{noteId}/promote` — moves to **ideas** (validates non-empty `mission.md`)
3. Ring bell when ready for intake

### Approve intake (Option B — 0.4.0)

After intake-lead presents mission packages (`phase: mission_plan_presenting` or `mission_plan_awaiting_approval`):

1. `GET /mission-board-notes/{id}` — brief, `meta.type`, phase, drafts context
2. `GET /missions/{id}/drafts` — optional package list
3. `POST /missions/{id}/approve-discovery` — spawns child **work_execution** board notes on **parking**; parent **idea_exploring** → **done**
4. Summarize `parkingFolders` (child note ids)

Intake-lead may also run `./tools/approve.sh` in the mission room — same API.

**Do not** expect parent on parking/queued/working — parent lands on **done** with label *Mission plan complete*.

### Promote parking → queued

One folder at a time (no batch promote):

1. `GET /board` — list `parking` folder names (child board note ids)
2. Open mission detail in Web UI to review brief (recommended), or promote directly
3. `POST /board/parking/{folder}/promote` — moves folder to **queued**
4. Ring bell (or auto-tick) to pick up when execution slots free

### Approve mission artifacts (close-out)

After PO signals `artifacts_ready_for_review` (`phase: awaiting_artifact_review`):

1. `GET /health` — check **`sessionPokeEnabled`** (default on) and `channelPushEnabled` (default off)
2. `GET /missions/{id}` — confirm `board: working`, phase, `awaitingGuildMaster`
3. Review deliverables (room files, attach, or Web UI close-out tab)

**A — API poke path (default, 0.5.0)**

1. `POST /missions/{id}/approve-artifacts` — inbox + checkpoint → `releasing`; **`notify.poke`** when PO session is live
2. If `notify.poke.delivered: true` — PO should pick up without guild master attach
3. If `notify.poke.delivered: false` and `reason: session not live` — `GET .../session?ensureLive=true`, then attach or retry approve
4. If `reason: attach_in_use` — close browser terminal attach on mission room, then retry

**B — Attach fallback (poke failed or both wake paths off)**

1. `GET /missions/{id}/session?ensureLive=true`
2. Print attach commands for guild master (separate terminal)
3. Guild master directs PO in session; inbox/checkpoint may already be updated from API

**C — Channel path (optional, `GUILD_CHANNEL_PUSH=1`)**

Secondary to poke; `notify.channel` may deliver in parallel.

**Reject:** `POST /missions/{id}/reject-artifacts` — same poke semantics (`phase: blocked`).

When **`sessionPokeEnabled` and `channelPushEnabled` are both false**, Web UI hides approve/reject — use attach + inbox.

### Abort a board note (0.4.0)

From **ideas-backlog** through **working** (single entry point):

1. `POST /mission-board-notes/{id}/abort` with optional `{ "reason": "…" }`
2. Note → **aborted**; live mission session stopped and room archived when applicable

Legacy: `POST /missions/{id}/abort` (working only) — prefer board-note abort.

### Close a completed mission

After PO signals `mission_complete` (only from `retrospective` phase), board note moves to **done**:

1. `GET /missions` — find `board: "done"` / `archiveReady: true`
2. Review room artifacts under `mission-rooms/{id}/`
3. `POST /missions/{id}/archive` — board note `done/` → `archive/`; room → `mission-rooms/archive/{id}/`
4. **Done** and **aborted** boards do not consume execution slots

Archive also works from **aborted** board after guild master abort.

### Skills bank (read-only)

1. `GET /skills-bank` — catalog + skill list
2. `GET /skills-bank/{name}` — skill folder contents
3. Promote retrospective `skills-reports/` → `data/skills-bank/` **manually** (no write API)

### Show attach for a mission

1. `GET /missions/{id}` — board must be `discovering` (intake) or `working` (execution); check `awaiting_guild_master`, `sessionLive`, `restoreRequired`
2. `GET /missions/{id}/session?ensureLive=true` — auto-restore if needed
3. Only if `live: true` and `attachCmd` set, print:

```text
cd {cwd}
{attachCmd}
```

Intake and execution both use **`/missions/{id}/session`** (same room root `mission-rooms/{id}/`).

### Who is waiting?

1. `GET /outbox` — unread escalations (discovering + working missions)
2. `GET /mission-board-notes?stage=discovering` — phase / session liveness
3. `GET /missions` — `awaitingGuildMaster: true`, close-out phases (`awaiting_artifact_review`, `releasing`, `retrospective`)
4. For blocked missions with `restoreRequired`, use `ensureLive` before attach

---

See [api-reference.md](api-reference.md) for full curl catalog.
