## Workflows

### Ring the bell (orchestrator tick)

`POST /bell` runs **discovery** (ideas → discovering) then **execution** (queued → working), slot-limited.

1. `GET /health` — up + `guildMasterName` + optional `tickIntervalMinutes`
2. `GET /board` — six columns (ideas, discovering, parking, queued, working, done)
3. `GET /queue` — preview what tick would start vs queue
4. `POST /bell`
5. Summarize `discoveriesStarted`, `missionsStarted`, `queuedDiscovery`, `queuedExecution`, `errors`, slot meters
6. Per new mission id → `GET /missions/{id}/session?ensureLive=true`

When `tickIntervalMinutes` &gt; 0 on guild-house, tick runs automatically — guild master may skip manual bell.

### Submit an idea

1. `POST /ideas` with JSON `{ "text": "…", "slug": "optional-prefix" }`
2. Summarize `ideaId` and `scratchPreview`
3. Ring bell (or wait for auto-tick) to move idea → **discovering** when discovery slots free

### Approve discovery

After intake lead presents mission packages (`phase: presenting` or `awaiting_approval`):

1. `GET /ideas/{id}` — scratch, drafts, phase
2. `GET /ideas/{id}/drafts` — optional package list
3. `POST /discoveries/{id}/approve` — copies valid `artifacts/missions/*/mission.md` packages to **parking**
4. Summarize `parkingFolders` returned

Discovery lead may also run `./tools/approve.sh` in the discovery room — same API.

### Promote parking → queued

One folder at a time (no batch promote in Plan 3):

1. `GET /board` — list `parking` folder names
2. `POST /board/parking/{folder}/promote` — moves folder to **queued**
3. Ring bell (or auto-tick) to pick up when execution slots free

### Close a completed mission

After PO signals `mission_complete`, mission moves to **done** board:

1. `GET /missions` — find `board: "done"` / `archiveReady: true`
2. Review room artifacts under `mission-rooms/{id}/`
3. `POST /missions/{id}/archive` — moves `done/` → `archive/` (room stays on disk)
4. **Done** board does not consume execution slots

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
2. `GET /ideas` — discovering entries with `phase` / `awaitingGuildMaster`
3. `GET /missions` — `awaitingGuildMaster: true`, check `sessionLive` / `restoreRequired`
4. For blocked missions with `restoreRequired`, use `ensureLive` before attach

---

See [api-reference.md](api-reference.md) for full curl catalog.