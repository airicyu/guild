# Changelog

## Unreleased — API 0.19.0 (0.3.0 Phase 3)

Mission retrospective — feedback tree, PO aggregation, signal gates.

- `retrospective/` scaffold: `members/{role}/feedback.md`, `workflow-report.md`, `skills-reports/`
- Member playbooks: exit contract + safety check; evaluator writes feedback before Task return
- PO playbook: aggregation steps, `workflow-report.md`, `skills-reports/` distillation
- `GET /missions/:id/room/retrospective/**` allowlisted
- `retrospective_complete` requires `workflow-report.md`; `mission_complete` requires prior `retrospective_complete`
- E2E extended: retro + dismiss gates

## Unreleased — API 0.18.0 (0.3.0 Phase 2)

Artifact release plan file, PO playbook close-out, release gate on signal.

- `artifact-release.md` scaffold in mission-room template (`mode`, `target`, `source_paths`, `status`)
- Handoff Round 2: draft release plan; Rounds 4–6: QA → release → retro → dismiss
- PO playbook: 0.3.0 close-out signals, release execution, approve tool usage
- `GET /missions/:id/room/artifact-release.md` allowlisted
- `artifact_release_complete` requires `status: released`; orchestrator logs milestone to `events.jsonl`
- E2E extended: release gate + milestone check

## Unreleased — API 0.17.0 (0.3.0 Phase 1)

Mission close-out lifecycle — approve / reject / abort; `mission_complete` only from `retrospective`.

- `POST /missions/:id/approve-artifacts` — guild master sign-off; `releasing` phase; inbox + guild-channel notify
- `POST /missions/:id/reject-artifacts` — `blocked` on working; inbox + channel
- `POST /missions/:id/abort` — **aborted/** board; frees slot; `retrospective/abort-note.md`
- New signals: `artifacts_ready_for_review`, `artifact_release_complete`, `retrospective_complete`
- **`mission_complete` breaking:** requires `phase: retrospective` (was: any active phase)
- `POST /missions/:id/archive` extended for **aborted** board
- Mission room tools: `approve-artifacts`, `reject-artifacts`, `abort`
- Boot `reconcileAbortedOnWorking()` migration
- Docs: [docs/phase1-migration.md](./docs/phase1-migration.md)

## 0.2.0 — 2026-06-29

Mission Discovery (Plan 3) — six-column board, idea intake, discovery pipeline, done column, periodic tick.

**API runtime:** `GET /health` → **0.16.0**

### Discovery pipeline

- `POST /ideas` — submit rough ideas to **ideas** column
- `orchestratorTick()` on `POST /bell` — discovery half (ideas → discovering) + execution half (queued → working)
- Discovery room scaffold, intake lead spawn, drafts API, approve → **parking**
- `POST /discoveries/:id/approve` — guild master or `tools/approve.sh`
- Discovery session restore ladder + `WS /ws/discoveries/:id/attach` (terminal attach)
- `POST /board/parking/:folder/promote` — one folder → **queued**

### Execution semantics (Phase 6)

- `mission_complete` → move **working/** → **done/** (frees execution slot)
- `POST /missions/:id/archive` from **done** board only
- Boot `reconcileLegacyDoneMissions()` for legacy `phase: done` on working

### Periodic tick (Phase 7)

- `GUILD_TICK_INTERVAL_MINUTES` — auto `orchestratorTick()`; `GET /health` → `tickIntervalMinutes`

### Web UI

- Six-column board: Ideas, Discovering, Parking, Queued, Working, Done
- Submit idea modal, Idea page (scratch, drafts, outbox, terminal, approve)
- Parking **Promote**, done-column archive, hall filters **working** only
- Auto-tick indicator on board header

### Docs & migration

- [docs/e2e-discovery-path.md](docs/e2e-discovery-path.md)
- `specs/` — product contracts, schemas, lifecycle rules; `docs/` — guides + API reference

### Breaking vs 0.1.0

- Board stages renamed; bell response fields (`missionsStarted`, `executionSlots`, discovery fields)
- Archive from **done** (not working); `mission_complete` moves to done column
- See `scripts/migrate-board-stages.ts` if renaming legacy `ready/` / `active/` folders on disk

---

## 0.1.0 — 2026-06-28

First product release: Guild House orchestrator API + Web UI (Plan 1 complete, Plan 2 through Phase 5).

### Orchestrator & API

- Bun daemon on `:3847` with Bearer auth and `GET /health`
- Mission board: parking / ready / active / archive (filesystem-first)
- `POST /bell` — pickup ready missions, mint mission id, spawn PO `--bg` session
- Checkpoint lifecycle: signals, pause/resume, boot recovery, session sync/restore ladder
- Outbox (escalate) and events audit log (`events.jsonl`, `POST /missions/:id/events`)
- Manual archive when `phase: done`; concurrent execution slots (max 4; done does not count toward limit)
- Mission room scaffold: brief copy, member memories, handoff prompt, tools

### Web UI (`guild-house/web/`)

- Kanban board + bell, slot visibility
- Mission hall with liveness and awaiting-guild-master state
- Mission room: Brief, Checkpoint, Events, Outbox tabs
- Guild master actions: archive, pause/resume/restore, mark outbox read
- Terminal attach: Bun PTY + WebSocket + xterm (WSL/Linux dev)

### Docs & templates

- API reference, session lifecycle, mission schema, E2E happy path
- Mission room and board templates for PO / evaluator / members
