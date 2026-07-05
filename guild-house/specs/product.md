# Guild House — product specification (as-built)

Living product truth for **release 0.4.0**. When code and prose disagree, trust this file + `GET /health` → `version`, then update specs/docs in the same change.

## Release

| Kind | Location | Current |
|------|----------|---------|
| Product | `version.md` + `changelog.md` | **0.4.0** |
| API runtime | `GET /health` → `version` | **0.30.0** |

## Domain language (0.4.0)

| Term | Where | Moves with column? |
|------|-------|-------------------|
| **Mission board note** | `mission-board/{stage}/{id}/` — `mission.md` + `meta.yaml` | Yes |
| **Mission** | `mission-rooms/{id}/` — checkpoint, squad, artifacts | No (stable by id) |

Unqualified **mission** in API means **room runtime**. Intake and execution are **modes** in one mission room root (not `discovery-rooms/`).

## Board pipeline

```
ideas-backlog → ideas → discovering → [approve] → parking → queued → working → done → archive
                         parent idea_exploring → done (mission_plan_complete)
                         children work_execution → parking
```

| Stage | Who moves | Mechanism |
|-------|-----------|-----------|
| submit | Guild master | `POST /ideas` → `mission.md` + `meta.yaml` |
| ideas-backlog → ideas | Guild master | `POST /board/ideas-backlog/:id/promote` |
| ideas → discovering | Orchestrator | `POST /bell` — intake mission in `mission-rooms/` |
| approve discovering | Guild master | `POST /missions/:id/approve-discovery` — Option B |
| parking → queued | Guild master | `POST /board/parking/:folder/promote` |
| queued → working | Orchestrator | bell — fresh execution scaffold |
| working → done | PO | `mission_complete` from `retrospective` |
| abort (any pre-terminal) | Guild master | `POST /mission-board-notes/:id/abort` |
| done / aborted → archive | Guild master | `POST /missions/:id/archive` |

## Locked semantics

1. **Attach** — `claude attach {shortId}` to live `--bg` job at `mission-rooms/{id}/`.
2. **`ensureLive`** — restore before attach when `?ensureLive=true` or WS connect.
3. **WS close = detach only** — does not stop bg job.
4. **`mission_complete`** → `phase: done`, board note → `done/`; from `retrospective` only.
5. **Frozen brief** — `mission-brief.md` at mission room root (orchestrator write).
6. **Approve Option B** — spawn child board notes to `parking/`; parent `idea_exploring` → `done/`.
7. **Archive** — board → `archive/`; room → `mission-rooms/archive/` (legacy `achive/` read compat).
8. **Slots** — `MAX_DISCOVERY_SESSIONS` (discovering + live intake); `MAX_ACTIVE_MISSIONS` (working).
9. **GET never spawns** — restore on boot / `POST /restore` / `?ensureLive=true`.
10. **`checkpoint.yaml`** — orchestrator-only; unified phases (intake + execution).
11. **`meta.type`** — `idea_exploring` \| `work_execution`; immutable after mint.
12. **Skills bank** — `data/skills-bank/`; `GET /skills-bank`.
13. **Session poke** — orchestrator ephemeral `claude attach` inject on guild-master directives; **no second PO**; best-effort; poke PTY teardown does not stop `--bg` job. Option A: poke only if session already live (no `ensureLive` on notify path). See [docs/session-poke.md](../docs/session-poke.md).

## API (canonical)

| Operation | Route |
|-----------|-------|
| Submit | `POST /ideas` |
| List board notes | `GET /mission-board-notes?stage=` |
| Board note detail | `GET /mission-board-notes/:id` |
| Mission runtime | `GET /missions/:id`, signals, session, attach |
| Draft packages | `GET /missions/:id/drafts` |
| Approve intake | `POST /missions/:id/approve-discovery` |
| Abort note | `POST /mission-board-notes/:id/abort` |

`POST /ideas` is the only retained legacy path name (submit). `GET /ideas*` and `/discoveries/*` were removed in **0.4.0** Phase 11.

## Component map

| Topic | Doc |
|-------|-----|
| REST + WS | [docs/api.md](../docs/api.md) |
| Mission schema | [mission-schema.md](./mission-schema.md) |
| E2E discovery | [docs/e2e-discovery-path.md](../docs/e2e-discovery-path.md) |
| 0.4.0 design | [ideas/0.4.0/design.md](../../ideas/0.4.0/design.md) |
