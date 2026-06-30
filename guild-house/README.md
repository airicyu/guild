# Guild House

Filesystem-first mission orchestrator: Bun REST API daemon, six-column mission board, Claude Code PO and discovery sessions via `claudew --bg`.

| Doc | Purpose |
|-----|---------|
| [specs/product.md](specs/product.md) | **As-built product truth** (0.2.0) — start here |
| [specs/README.md](specs/README.md) | Schemas + lifecycle rules |
| [docs/README.md](docs/README.md) | Guides + API reference index |
| [docs/api.md](docs/api.md) | REST + WS reference |
| [docs/e2e-discovery-path.md](docs/e2e-discovery-path.md) | Plan 3 happy path |
| [docs/tests/](docs/tests/) | Manual QA + smoke scripts |

**Control plane:** [guild-desk](../guild-desk/) · **Web UI:** [web/](web/) · **Historical design:** [ideas/archive/](../ideas/archive/)

## Documentation layout

| Folder | Role |
|--------|------|
| **`specs/`** | Product contracts, schemas, lifecycle rules (scaffold copies `mission-schema.md` into rooms) |
| **`docs/`** | Walkthroughs and API reference — no runtime dependency except guild-desk links to `api.md` |

Product docs live **here** (`guild-house/`), not at the guild root. Root [CLAUDE.md](../CLAUDE.md) is the cross-repo index only.

## Quick start

```bash
cd guild/guild-house
cp .env.example .env
bun install
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

| Variable | Purpose |
|----------|---------|
| `GUILD_API_KEY` | Bearer auth |
| `GUILD_MASTER_NAME` | Display label (`/health`, Web UI); playbooks say **guild master** |
| `MAX_ACTIVE_MISSIONS` / `MAX_DISCOVERY_SESSIONS` | Slot limits |
| `GUILD_TICK_INTERVAL_MINUTES` | Auto tick (`0` = manual bell) |

## Layout

```
guild-house/
  src/              Bun server + orchestrator
  specs/            Product + schema + lifecycle specs
  docs/             Guides + API reference
  web/              React UI
  data/             Runtime data (gitignored)
  templates/        Room scaffolds
```
