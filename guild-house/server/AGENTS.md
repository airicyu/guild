# Guild House — Server (Bun API)

Filesystem-first **mission orchestrator** daemon. Deterministic lifecycle only — PO and intake agents run in `data/mission-rooms/` via `claudew --bg`, not in this process.

**Source of truth:** `../data/` (board folders + mission rooms). This server watches, moves, spawns, and exposes REST/WS.

## Before you start

```bash
# From guild-house root (recommended)
cd guild/guild-house
cp .env.example .env          # house root — not server/.env
bun run install:all
bun run dev                   # → :3847

# Or from server/
cd server && bun install
bun run dev
```

- Health: `GET http://127.0.0.1:3847/health`
- Web UI (separate): `bun run dev:ui` from house root → `:3848`

### Env

| File | Role |
|------|------|
| `../.env` | Orchestrator secrets — loaded via `--env-file=../.env` in `package.json` scripts |
| `../.env.example` | Template |

`config.projectRoot` resolves to **`guild-house/`** (not `server/`). Paths use `../templates/`, `../data/`, `../specs/`.

When running scripts from `server/`, prefer house root:

```bash
bun server/scripts/e2e-040.ts
# or: bun --env-file=../.env scripts/e2e-040.ts
```

## Stack

- **Bun** — `Bun.serve`, native routing, WebSocket, PTY attach, `Bun.cron`, `Bun.YAML`, `Bun.JSONL`
- **TypeScript** — strict, `tsc --noEmit` in this package
- Entry: [`src/server.ts`](src/server.ts)

## Layout

```
server/
  src/
    server.ts              Bun.serve boot, WS upgrade, error handler
    routes.ts              buildRoutes() — auth + CORS wrap
    config.ts              env → frozen config (projectRoot = house root)
    paths.ts               mission-board/, mission-rooms/ path helpers
    errors.ts              mapOrchestratorError, readJsonBody
    handlers/              Thin route handlers → orchestrator
    middleware/cors.ts
    websocket/attach-pty.ts  Browser terminal attach (Bun PTY)
    orchestrator/
      tick.ts              orchestratorTick — bell + cron
      tick-scheduler.ts    Bun.cron when GUILD_TICK_INTERVAL_MINUTES > 0
      core/                board, spawn, session, note-id, jsonl, room-achive
      board-notes/         Submit, list, abort board notes
      discovery/           Intake pickup, session, approve (canonical /missions/*)
      mission/             Execution pickup, lifecycle, checkpoint, scaffold
      skills-bank/
    types/
  scripts/                 E2E + WS smoke — see scripts/README.md
  package.json
```

**House root (read/write via `config`):** `../templates/`, `../specs/`, `../docs/`, `../data/`, `../guild-channel/` (MCP sidecar — path contract from mission rooms).

## Request flow

```
Bun.serve routes  ←  handlers/*.ts export *Routes(config) slices
       ↓
orchestrator/*    ←  filesystem ops, spawn, checkpoint
       ↓
../data/          ←  mission-board/, mission-rooms/
```

Add routes: new handler in `handlers/`, merge in `routes.ts`, bump `version` in `routes.ts` `/health` when shipping API changes.

## Locked semantics (do not break)

Full list: [../specs/product.md](../specs/product.md). Summary:

1. **Attach existing PO** — WS/terminal attach connects to live `--bg` job; do not spawn a second Claude from attach.
2. **`ensureMissionSessionLive`** — WS attach and `?ensureLive=true` restore PO before attach.
3. **WS close = detach only** — kills server attach PTY; does **not** stop the PO background job.
4. **`mission_complete`** → `phase: done`, move **working/** → **done/**; no auto-archive.
5. **`POST /missions/:id/archive`** — only from **done** with `phase: done`.
6. **Slots** — `MAX_ACTIVE_MISSIONS` (working only); intake uses `MAX_DISCOVERY_SESSIONS`.
7. **GET never spawns** — session restore only on boot / `POST /restore` / `?ensureLive=true`.
8. **`checkpoint.yaml`** — orchestrator-only writer; agents use signals API.
9. **Filesystem-first** — UI does not edit board folders or checkpoint directly.

## Conventions

- Minimize scope — match patterns in `orchestrator/`
- Use `path.join`; `config.projectRoot` for templates/specs
- Board note IDs: `orchestrator/core/note-id.ts`
- JSONL: `orchestrator/core/jsonl.ts` (`Bun.JSONL.parse`)
- YAML read: `Bun.YAML.parse`; frontmatter: `frontmatter.ts`
- Do not hardcode guild master name — use `GUILD_MASTER_NAME` / `config.guildMasterName`
- Do not commit `../data/`, `../.env`

## Commands

```bash
bun run dev          # watch :3847
bun run start        # production-style
bun run typecheck    # tsc --noEmit

# E2E (API must be running)
bun run test:e2e       # primary: e2e-040
bun run test:closeout  # close-out only
bun scripts/test-ws-attach.ts <missionId>
```

## Key docs

| Doc | Use when |
|-----|----------|
| [../specs/product.md](../specs/product.md) | Product truth — start here |
| [../docs/api.md](../docs/api.md) | REST + WS reference |
| [../docs/e2e-discovery-path.md](../docs/e2e-discovery-path.md) | Plan 3 walkthrough |
| [../docs/tests/](../docs/tests/) | Manual QA + script index |
| [../docs/guild-channel.md](../docs/guild-channel.md) | Channel MCP PoC |
| [../CLAUDE.md](../CLAUDE.md) | House-level index |
| [../web/CLAUDE.md](../web/CLAUDE.md) | Web UI |

## Do not

- Background `bun run dev` without user ask (`EADDRINUSE` on 3847)
- Put `.env` only under `server/` — breaks `guild-channel` `../../../.env` contract
- Move `templates/` or `specs/` into `server/` without updating `projectRoot` and all callers
