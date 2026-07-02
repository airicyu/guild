# Guild House

Filesystem-first **mission orchestrator**: Bun REST API daemon, six-column mission board, Claude Code PO and discovery sessions via `claudew --bg`.

**Not an agent** — deterministic lifecycle logic only. PO/agents live in mission and discovery rooms.

## Related repos

| Path | Role |
|------|------|
| `guild-house/` (here) | API daemon + `data/` + templates + **web/** UI |
| `../guild-desk/` | CC control plane + **guild-master** skill |
| `../ideas/archive/` | Historical design only (do not extend) |

## Before you start

```bash
cd guild/guild-house
cp .env.example .env
bun install
bun run dev
```

- API: `http://127.0.0.1:3847` · **Web UI:** `bun run dev:ui` → `http://127.0.0.1:3848`
- Health: `GET /health` → API **0.18.0** · product **0.2.0**

## Layout

```
guild-house/
  src/           server.ts, routes/, orchestrator/
  specs/         product.md, schemas, session-lifecycle rules
  docs/          api.md, E2E guides (no runtime dep except api.md for desk)
  web/           React command center — see web/CLAUDE.md
  data/          gitignored
  templates/     mission-room, discovery-room scaffolds
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

- **Product 0.2.0** — Mission Discovery complete (API 0.16.0)
