# Changelog

## 0.3.0 — 2026-07-04

Guild Desk aligned with product **0.3.0** and Guild House API **0.22.0**.

### guild-master skill

- **Close-out:** approve / reject / abort artifacts workflows; phase reference table
- **Backlog:** submit with `board: "backlog"` (default), promote `ideas-backlog` → ideas
- **Board:** eight-column reference (Backlog through Aborted)
- **Skills bank:** read-only `GET /skills-bank` curl examples
- Updated api-reference with all 0.3.0 mission and board endpoints

### README

- Close-out and backlog workflow hints
- Links to [close-out-e2e.md](../guild-house/docs/tests/close-out-e2e.md), [skills-bank.md](../guild-house/docs/skills-bank.md)

### Conventions

- Desk still does not run mission or discovery PO work — attach commands for a separate terminal
- Complements Web UI as an alternate client to the same API

---

## 0.2.0 — 2026-06-29

Guild Desk control plane aligned with Mission Discovery (Plan 3) and product **0.2.0**.

### guild-master skill

- Workflows: submit idea (`POST /ideas`), approve discovery, promote parking → queued
- Updated bell/tick semantics (`orchestratorTick`, dual slot meters)
- Archive from **done** board; six-column board reference
- Discovery attach session commands (`GET /discoveries/:id/session?ensureLive=true`)
- `tickIntervalMinutes` from `GET /health`

### README

- Discovery pipeline table and curl examples
- `GUILD_TICK_INTERVAL_MINUTES` in setup
- Links to [e2e-discovery-path.md](../guild-house/docs/e2e-discovery-path.md)

### Conventions

- Desk still does not run mission or discovery PO work — attach commands for a separate terminal
- Complements Web UI as an alternate client to the same API (v0.16.0)

---

## 0.1.0 — 2026-06-28

First product release: Guild Desk control plane (Plan 1 Phase 6).

### Control plane

- Claude Code workspace for guild master (cwd = guild-desk)
- **guild-master** skill: bell, board, missions, session attach commands, outbox, archive via Guild House REST
- `guild-api.cmd` curl helper for Windows
- Documented env: `GUILD_HOUSE_URL`, `GUILD_API_KEY`, `GUILD_MASTER_NAME`

### Conventions

- Desk does not run mission PO work; attach commands are printed for a separate terminal
- Complements Web UI as an alternate client to the same API
