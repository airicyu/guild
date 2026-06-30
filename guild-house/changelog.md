# Changelog

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
