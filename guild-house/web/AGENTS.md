# Guild House — Web UI

React **command center** for the guild-house orchestrator API. Derived view only — filesystem + API remain source of truth.

## Before you start

```cmd
rem Terminal 1 — API (repo root)
cd c:\Users\airic\airwave\guild-house
bun run dev

rem Terminal 2 — UI
bun run dev:ui
```

Open **http://127.0.0.1:3848**

### API key (dev)

Priority: `localStorage.guildApiKey` → `VITE_GUILD_API_KEY` in `.env.local` → fallback `change-me-in-production`.

Must match `GUILD_API_KEY` in `../.env`. Copy [`.env.example`](.env.example) → `.env.local`. Restart Vite after env changes.

**Security:** Never put the real key in input `value` in HTML — modal uses empty value + placeholder only.

## Stack

- Vite 5 + React 18 + TypeScript
- Tailwind 4 (`@tailwindcss/vite`)
- TanStack Query v5 — polling (board 15s, missions/hall 3–5s)
- React Router 6 · Lucide icons

Dev proxy: `/api/*` → `http://127.0.0.1:3847/*`, `/ws/*` → WebSocket on `:3847` ([`vite.config.ts`](vite.config.ts))

## Layout

```
web/src/
  pages/              Route entry points (thin — data + layout wiring)
  features/
    missions/         MissionCard, MissionActions, mission room tab panels
    discovery/        IdeaCard, SubmitIdeaModal, idea room tab panels
    terminal/         AttachTerminalPane, MissionTerminal, DiscoveryTerminal
  components/         Shared shell UI (Layout, Toast, PhasePill, auth modals, …)
  lib/
    api/              client.ts, board.ts, discovery.ts, missions.ts, outbox.ts
    auth.ts, board.ts, format.ts, queryKeys.ts
  providers/          AppProviders (QueryClient)
  styles/             guild-theme.css
  types/              mission.ts, discovery.ts
```

Import API helpers from `lib/api`. Domain UI lives under `features/<domain>/`; shared shell stays in `components/`.

## Routes

| Path | Page |
|------|--------|
| `/` | Board — kanban, bell, slot meter, live phases |
| `/hall` | Hall — `GET /missions` grid |
| `/outbox` | Outbox — cross-mission unread escalations |
| `/discovering` | Discovering hall — ideas on discovering board |
| `/ideas/:id` | Idea room — scratch, drafts, outbox, terminal |
| `/missions/:id` | Mission room — brief, checkpoint, events, outbox, terminal tabs |

## Rules

- **Read-mostly** — all writes go through existing REST (`POST /bell`, `/archive`, etc.). No direct `checkpoint.yaml` edits.
- **Comments** — only at product boundaries (session/attach queries, invalidation, locked semantics). Point to `specs/product.md` when behavior is non-obvious; do not narrate obvious JSX.
- **Reuse** `MissionCard`, `missionToCardData` / `toCardData` from `lib/board.ts` for consistent phase/session badges.
- **401 handling** — `ApiKeyBanner` in Layout; use `ApiError.status === 401` in pages.
- **Do not** embed production secrets in the built bundle; `.env.local` is gitignored.
- Match **guild command center** theme (`styles/guild-theme.css`) — dark bg, amber accent, phase color pills.

## API reference

REST + WS: [../docs/api.md](../docs/api.md). Bump `GET /health` version in `../server/src/server.ts` when shipping API changes.

## Commands

```cmd
bun run dev          rem port 3848
bun run build        rem tsc + vite → dist/
bun run preview      rem static preview
```
