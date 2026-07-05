# Guild

Filesystem-first **mission orchestration product**: drop briefs on a board, ring the bell, PO agents work in isolated mission rooms, guild master supervises via API + attach.

This folder is the **Guild product root**. Everything for Guild lives here — runtime code, control plane, and design notes.

## What Guild is

Guild automates multi-agent mission workflows:

- **Discovery** — guild master submits a rough idea → discovery team explores → produces mission package(s) → approve to **parking**
- **Intake** — promote parking → **queued**; or legacy drop `mission.md` on **queued** (`ready/` in 0.1.0)
- **Bell / tick** — orchestrator picks up ideas and queued missions when slots allow, scaffolds rooms, spawns agents
- **Execution** — PO + specialist agents work in `mission-rooms/{id}/` with filesystem artifacts and memory files
- **Supervision** — guild master monitors board/hall/outbox, attaches when needed, archives from **done**

**Design principle:** filesystem = source of truth; orchestrator = watcher + process manager; UI = derived view.

## Layout

```
guild/
  CLAUDE.md           ← you are here — product-level how we work
  ideas/              ← design docs only (no runtime code)
  guild-house/        ← system: server/ API, data/, templates, web/ UI
  guild-desk/         ← guild master CC control plane + guild-master skill
```

| Path | Role | Agent guide |
|------|------|-------------|
| **`guild-house/`** | Orchestrator API, mission data, PO sessions, React command center | [guild-house/CLAUDE.md](./guild-house/CLAUDE.md) · [server/CLAUDE.md](./guild-house/server/CLAUDE.md) · [web/CLAUDE.md](./guild-house/web/CLAUDE.md) |
| **`guild-desk/`** | Guild master opens CC here; uses **guild-master** skill to call API | [guild-desk/CLAUDE.md](./guild-desk/CLAUDE.md) |
| **`ideas/`** | Archive + backlog only — no new idea files | [ideas/README.md](./ideas/README.md) |

**Naming three-piece:** `guild-house` (system) · `guild-desk` (your desk) · `guild-master` (skill — guild master commands the house)

## How we work

### Guild master has three surfaces

1. **Guild Desk (CC + skill)** — submit idea, bell, approve, promote, list missions, outbox, print attach commands. Natural language → REST via guild-master skill.
2. **Web UI (`guild-house/web/`)** — six-column board, idea page, mission room, terminal attach. Read-mostly; writes go through REST.
3. **Direct attach (terminal)** — `claude attach {shortId}` in mission room cwd when intervening in a live PO session. Run in a **separate terminal**, not inside guild-desk.

### Typical workflow (Plan 3 — 0.2.0)

```
1. Submit idea     →  POST /ideas  (Web UI or guild-desk skill)
2. Ring bell       →  POST /bell  (or GUILD_TICK_INTERVAL_MINUTES auto-tick)
3. Discovery       →  intake lead produces artifacts/missions/*/mission.md
4. Approve         →  POST /discoveries/:id/approve  →  parking
5. Promote         →  POST /board/parking/:folder/promote  →  queued
6. Ring bell       →  PO handoff on working board
7. Monitor         →  web UI hall / GET /outbox
8. Intervene       →  GET /missions/:id/session?ensureLive=true  →  attach
9. Close mission   →  mission_complete  →  done  →  POST /missions/:id/archive
```

**Legacy execution-only:** drop brief on `queued/{slug}/mission.md` → bell (skip steps 1–5). See [execution-e2e.md](./guild-house/docs/tests/execution-e2e.md).

### Session boundaries

| Where | cwd | Runs |
|-------|-----|------|
| **Guild Desk** | `guild-desk/` | Control plane only — no mission PO work |
| **Mission room** | `guild-house/data/mission-rooms/{id}/` | PO `--bg` session + attach |
| **Web UI** | browser → API proxy | Derived view + guild master actions |

## Dev setup

### Prerequisites

- **Bun** for guild-house API and web build
- **Claude Code** (`claudew` or `claude`) for PO sessions and guild-desk
- **WSL/Linux** for browser terminal attach (Phase 5 PTY path; Windows PTY stdin was dropped)

### Start locally

```bash
# Terminal 1 — API (:3847)
cd guild/guild-house
cp .env.example .env   # set GUILD_API_KEY, GUILD_MASTER_NAME
bun run install:all
bun run dev

# Terminal 2 — Web UI (:3848)
cd guild/guild-house
bun run dev:ui
```

Open **http://127.0.0.1:3848** · API health: **http://127.0.0.1:3847/health**

### Env that must match

| Variable | Where | Purpose |
|----------|-------|---------|
| `GUILD_API_KEY` | `guild-house/.env` ↔ `web/.env.local` (`VITE_GUILD_API_KEY`) | REST auth |
| `GUILD_MASTER_NAME` | `guild-house/.env` (required); desk for docs | Display name in `/health` + Web UI; playbooks use role **guild master** |
| `GUILD_HOUSE_URL` | guild-desk session | API base (default `http://127.0.0.1:3847`) |
| `CLAUDE_COMMAND` | guild-house `.env` | Spawn command (e.g. `claudew`) |
| `GUILD_TICK_INTERVAL_MINUTES` | guild-house `.env` | Auto `orchestratorTick` interval; `0` = manual bell only |

### Smoke / E2E

- Plan 3 discovery path: [guild-house/docs/e2e-discovery-path.md](./guild-house/docs/e2e-discovery-path.md)
- Execution test: [guild-house/docs/tests/execution-e2e.md](./guild-house/docs/tests/execution-e2e.md)
- WS attach scripts: `guild-house/server/scripts/test-ws-attach.ts`, `test-ws-input.ts`
- Windows batch smoke: `guild-house/server/scripts/e2e-smoke.cmd`

## Canonical docs (read before big changes)

| Doc | Use when |
|-----|----------|
| [guild-house/specs/product.md](./guild-house/specs/product.md) | **As-built product truth** — start here |
| [guild-house/specs/README.md](./guild-house/specs/README.md) | Schemas + lifecycle rules |
| [guild-house/docs/api.md](./guild-house/docs/api.md) | REST + WS reference |
| [guild-house/docs/e2e-discovery-path.md](./guild-house/docs/e2e-discovery-path.md) | Plan 3 walkthrough |
| [guild-house/docs/tests/](./guild-house/docs/tests/) | Manual QA + smoke scripts |
| [ideas/backlog.md](./ideas/backlog.md) | Deferred items |
| [ideas/archive/](./ideas/archive/) | Historical plans (read-only) |

**When code and prose disagree:** trust `specs/product.md` + `GET /health` version, then update specs/docs in the same change.

Product documentation lives under **`guild-house/specs/`** and **`guild-house/docs/`** — not at the guild root. Root `CLAUDE.md` is the cross-repo index.

## Locked semantics (do not break)

Full list: [guild-house/specs/product.md](./guild-house/specs/product.md). Summary:

1. **Attach existing PO** — terminal attach connects to the live `--bg` job (`claude attach {shortId}`), not a fresh Claude spawn (unlike Freeflow).
2. **`ensureMissionSessionLive`** — WS attach and `?ensureLive=true` restore PO before attach.
3. **WS close = detach only** — kills server attach PTY; does **not** stop the PO background job.
4. **Terminal tab lazy mount** — xterm mounts when tab opens; do not make always-on like Freeflow.
5. **`mission_complete`** → `phase: done`, move **working/** → **done/**; **no** auto-archive.
6. **`POST /missions/:id/archive`** — only when on **done** board with `phase: done`; moves `done/` → `archive/`; mission room moves to `mission-rooms/achive/{id}/`.
7. **Slots** — `MAX_ACTIVE_MISSIONS` (4); only **working** board counts; **done** does not.
8. **GET never spawns** — session restore only on boot / `POST /restore` / `POST /resume` / `?ensureLive=true`.
9. **`checkpoint.yaml`** — orchestrator-only writer; PO uses signals API.
10. **Filesystem-first** — agents read/write mission files; UI does not edit checkpoint or board folders directly.

## Current state (2026-07-04)

- **Product release:** **0.3.0** (`guild-house/version.md`, `guild-desk/version.md` + changelogs)
- **API:** v**0.22.0** (`GET /health`) — Phases 0–6 complete
- **Plan 1 (API MVP):** complete
- **Plan 2 (Web UI):** complete (Phases 0–6 — board, hall, mission room, guild master actions, Bun PTY terminal attach, polish)
- **Plan 3 (Mission Discovery):** complete (product **0.2.0**)

Terminal attach highlights (Phase 5 + polish):

- Bun native PTY (`Bun.spawn` + `terminal`); bash → auto `claude attach`; `node-pty` removed
- `@xterm/xterm` 6 + **WebGL**; dark theme; `preferDragSelection`; fit-before-WS with `?cols=&rows=`
- **No `backdrop-filter`** on terminal pane (compositing fix for attach exit); hide legacy `.xterm-viewport`
- Alt-screen: hide scrollbar; classic bash: visible scrollback
- Dev attach: **WSL/Linux**

## Conventions for agents

### Scope

- **`ideas/`** — design and plans only; no runtime code
- **`guild-house/server/`** — orchestrator logic; match patterns in `server/src/orchestrator/`
- **`guild-house/web/`** — derived UI; all writes through REST; see [web/CLAUDE.md](./guild-house/web/CLAUDE.md)
- **`guild-desk/`** — skill + control-plane docs; no mission runtime

### Code style

- Minimize scope — smallest correct diff
- Match existing naming, types, and folder conventions in each repo
- Use `path.join`; abstract spawn where platform matters
- Bump `GET /health` version in `guild-house/server/src/server.ts` when shipping API changes
- Update `guild-house/specs/` and `guild-house/docs/` when behavior changes — especially [specs/product.md](./guild-house/specs/product.md)

### Do not

- Commit `guild-house/data/`, `.env`, or secrets
- Background `bun run dev` without user ask (orphans cause `EADDRINUSE` on 3847)
- Paste stale `attachCmd` — session ids go stale; always fetch fresh from API
- Hardcode guild master name in API/checkpoint — use `GUILD_MASTER_NAME`
- Spawn a second PO from attach path — attach only

### Where to work from

| Task | Start in |
|------|----------|
| API / orchestrator / data model | `guild-house/server/` + [guild-house/CLAUDE.md](./guild-house/CLAUDE.md) |
| Web UI | `guild-house/web/` + [web/CLAUDE.md](./guild-house/web/CLAUDE.md) |
| Guild master skill / control plane | `guild-desk/` + `.claude/skills/guild-master/SKILL.md` |
| Design / phase planning | `ideas/archive/` (historical) · `ideas/backlog.md` |
