## Workflows

### Ring the bell (orchestrator tick)

`POST /bell` runs **discovery** (ideas → discovering) then **execution** (queued → working), slot-limited. **ideas-backlog** never auto-ticks.

1. `GET /health` — up + `guildMasterName` + optional `tickIntervalMinutes`
2. `GET /board` — Backlog, Ideas, Discovering, Parking, Queued, Working, Done, Aborted
3. `GET /queue` — preview what tick would start vs queue
4. `POST /bell`
5. Summarize `discoveriesStarted`, `missionsStarted`, `queuedDiscovery`, `queuedExecution`, `errors`, slot meters
6. Per new mission id → `GET /missions/{id}/session?ensureLive=true`

When `tickIntervalMinutes` &gt; 0 on guild-house, tick runs automatically — guild master may skip manual bell.

### Submit an idea

1. `POST /ideas` with JSON `{ "text": "…", "slug": "optional", "board": "backlog" }` — default **backlog**; use `"board": "ideas"` to skip incubation
2. Summarize `ideaId`, `board`, and `scratchPreview`
3. If on **backlog** → promote first (below). If on **ideas** → ring bell when discovery slots free

### Promote backlog → ideas

One idea at a time:

1. `GET /board` — list `ideas-backlog` ids
2. `POST /board/ideas-backlog/{ideaId}/promote` — moves to **ideas**
3. Ring bell when ready for discovery

### Approve discovery

After intake lead presents mission packages (`phase: presenting` or `awaiting_approval`):

1. `GET /ideas/{id}` — scratch, drafts, phase
2. `GET /ideas/{id}/drafts` — optional package list
3. `POST /discoveries/{id}/approve` — copies valid `artifacts/missions/*/mission.md` packages to **parking**
4. Summarize `parkingFolders` returned

Discovery lead may also run `./tools/approve.sh` in the discovery room — same API.

### Promote parking → queued

One folder at a time (no batch promote):

1. `GET /board` — list `parking` folder names
2. Open mission detail in Web UI to review brief (recommended), or promote directly
3. `POST /board/parking/{folder}/promote` — moves folder to **queued**
4. Ring bell (or auto-tick) to pick up when execution slots free

### Approve mission artifacts (0.3.0 close-out)

After PO signals `artifacts_ready_for_review` (`phase: awaiting_artifact_review`):

1. `GET /missions/{id}` — confirm `board: working`, phase, `awaitingGuildMaster`
2. Review deliverables (Web UI close-out tab, attach, or room files)
3. `POST /missions/{id}/approve-artifacts` — → `releasing`; PO notified via inbox + guild-channel (if live)
4. PO executes release, retro, then `mission_complete` — **do not** approve for the PO

**Reject:** `POST /missions/{id}/reject-artifacts` with optional `{ "reason": "…" }` → `blocked` on working.

**Abort:** `POST /missions/{id}/abort` with optional `{ "reason": "…" }` → **aborted** board; frees slot.

### Close a completed mission

After PO signals `mission_complete` (only from `retrospective` phase), mission moves to **done** board:

1. `GET /missions` — find `board: "done"` / `archiveReady: true`
2. Review room artifacts under `mission-rooms/{id}/`
3. `POST /missions/{id}/archive` — moves `done/` → `archive/` (room stays on disk)
4. **Done** and **aborted** boards do not consume execution slots

Archive also works from **aborted** board after guild master abort.

### Skills bank (read-only)

1. `GET /skills-bank` — catalog + skill list
2. `GET /skills-bank/{name}` — skill folder contents
3. Promote retrospective `skills-reports/` → `data/skills-bank/` **manually** (no write API)

### Show attach for a mission

1. `GET /missions/{id}` — board must be `working`; check `awaiting_guild_master`, `sessionLive`, `restoreRequired`
2. `GET /missions/{id}/session?ensureLive=true` — auto-restore if needed
3. Only if `live: true` and `attachCmd` set, print:

```text
cd {cwd}
{attachCmd}
```

Discovery attach: `GET /discoveries/{id}/session?ensureLive=true` (discovering board only).

### Who is waiting?

1. `GET /outbox` — unread escalations (discovering + working missions)
2. `GET /ideas` — backlog, ideas, discovering entries with `phase` / session liveness
3. `GET /missions` — `awaitingGuildMaster: true`, check `sessionLive` / `restoreRequired`; note close-out phases (`awaiting_artifact_review`, `releasing`, `retrospective`)
4. For blocked missions with `restoreRequired`, use `ensureLive` before attach

---

See [api-reference.md](api-reference.md) for full curl catalog.
