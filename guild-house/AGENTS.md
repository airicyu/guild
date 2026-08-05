# Guild House

Filesystem-first **mission orchestrator**: Bun REST API daemon (`server/`), six-column mission board, Claude Code PO and discovery sessions via `claudew --bg`.

**Not an agent** — deterministic lifecycle logic only. PO/agents live in mission and discovery rooms.

## Related repos

| Path | Role |
|------|------|
| `guild-house/` (here) | **server/** API + `data/` + templates + **web/** UI |
| `../guild-desk/` | CC control plane + **guild-master** skill |
| `../ideas/archive/` | Historical design only (do not extend) |

## Before you start

```bash
cd guild/guild-house
cp .env.example .env
bun run install:all
bun run dev
```

- API: `http://127.0.0.1:3847` · **Web UI:** `bun run dev:ui` → `http://127.0.0.1:3848`
- Health: `GET /health` → API version in `server/src/server.ts`

## Layout

```
guild-house/
  server/        Bun API — src/, scripts/ — see server/CLAUDE.md
  web/           React command center — see web/CLAUDE.md
  specs/         product.md, schemas, session-lifecycle rules
  docs/          api.md, E2E guides
  templates/     mission-intake, mission-execution scaffolds
  data/          gitignored
```

## Rules (orchestrator)

See [specs/product.md](specs/product.md) for locked semantics. Summary:

- **`checkpoint.yaml`** — orchestrator-only writer
- **Discovery** — `POST /ideas`; tick moves ideas → discovering
- **`mission_complete`** → **done/**; archive from **done** only
- **Slots** — working + discovering only; done does not count
- **GET never spawns** — restore on boot / `POST /restore` / `?ensureLive=true`

## Key docs

- Product: [specs/product.md](specs/product.md)
- API: [docs/api.md](docs/api.md)
- E2E: [docs/e2e-discovery-path.md](docs/e2e-discovery-path.md) · Tests: [docs/tests/](docs/tests/)

## Current state

- **Product 0.3.0** — close-out, channel, backlog, skills bank (API **0.22.0**)
