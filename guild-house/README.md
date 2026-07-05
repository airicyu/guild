# Guild House

Filesystem-first mission orchestrator: **server/** (Bun API) + **web/** (React command center), shared `templates/`, `specs/`, `data/`.

| Doc | Purpose |
|-----|---------|
| [specs/product.md](specs/product.md) | **As-built product truth** (0.2.0) — start here |
| [specs/README.md](specs/README.md) | Schemas + lifecycle rules |
| [docs/README.md](docs/README.md) | Guides + API reference index |
| [docs/api.md](docs/api.md) | REST + WS reference |
| [docs/e2e-discovery-path.md](docs/e2e-discovery-path.md) | Plan 3 happy path |
| [docs/tests/](docs/tests/) | Manual QA + smoke scripts |

**Control plane:** [guild-desk](../guild-desk/) · **Server:** [server/](server/) · **Web UI:** [web/](web/) · **Historical design:** [ideas/archive/](../ideas/archive/)

## Layout

```
guild-house/
  server/        API daemon — see server/CLAUDE.md
  web/           React UI — see web/CLAUDE.md
  templates/     mission-intake, mission-execution scaffolds
  specs/ docs/   product + API docs
  data/          gitignored runtime state
  .env           house root (server loads via --env-file=../.env)
```

## Quick start

```bash
cd guild/guild-house
cp .env.example .env
bun run install:all
bun run dev          # API :3847
bun run dev:ui       # Web :3848 (second terminal)
```

Open **http://127.0.0.1:3848** · health: **http://127.0.0.1:3847/health**

## Mission Discovery (0.2.0)

```
Ideas → discovering → [approve] → parking → [promote] → queued → working → done → archive
```

Full walkthrough: [docs/e2e-discovery-path.md](docs/e2e-discovery-path.md). Locked semantics: [specs/product.md](specs/product.md).

## Legacy execution intake

Drop `mission.md` on **queued/** → bell. See [docs/tests/execution-e2e.md](docs/tests/execution-e2e.md) and [specs/mission-schema.md](specs/mission-schema.md).

## Environment

See [.env.example](.env.example). Web UI needs matching `VITE_GUILD_API_KEY` in `web/.env.local` (see [web/README.md](web/README.md)).

| Variable | Purpose |
|----------|---------|
| `GUILD_HOME` | Data root (default `data/`) |
| `GUILD_API_KEY` | REST + WS auth |
| `GUILD_MASTER_NAME` | Display name in health + UI |
| `GUILD_TICK_INTERVAL_MINUTES` | Auto tick (`0` = manual bell) |
| `CLAUDE_COMMAND` | PO / intake spawn (`claude` / `claudew`) |

## Scripts

Server E2E and WS tests live under `server/scripts/` (e.g. `bun server/scripts/e2e-040.ts` from house root, or `bun scripts/e2e-040.ts` from `server/`).
