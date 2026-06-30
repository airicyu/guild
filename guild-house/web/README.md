# Guild House Web UI

React command center for the guild-house orchestrator API.

**Agent / contributor guide:** [CLAUDE.md](./CLAUDE.md) · **API:** [../docs/api.md](../docs/api.md)

## Dev

Terminal 1 — API (from `guild-house/`):

```cmd
cd guild-house
set GUILD_API_KEY=change-me-in-production
bun run dev
```

Terminal 2 — UI (from `guild-house/`):

```cmd
bun run dev:ui
```

Runs `bun run --cwd=web dev` (Vite on **:3848**). API proxied via `/api` → `:3847`.

Open http://127.0.0.1:3848

## API key (priority order)

1. **localStorage** — saved via **API key** in the header (overrides everything)
2. **`web/.env.local`** — `VITE_GUILD_API_KEY=…` (copy from `web/.env.example`; gitignored)
3. **Fallback** — `change-me-in-production` if neither is set

Must match `GUILD_API_KEY` in `guild-house/.env`. On mismatch, a red banner offers **Set API key**.

```cmd
cd web
copy .env.example .env.local
rem Edit .env.local — paste same key as guild-house/.env
bun run dev
```

Restart Vite after changing `.env.local`.

## Build

```cmd
cd web
bun run build
bun run preview
```

## Status

Plan 2 (Web UI) **complete** — board, hall, discovery, mission/idea rooms, guild master actions, terminal attach. Deferred work: [../../ideas/backlog.md](../../ideas/backlog.md).
