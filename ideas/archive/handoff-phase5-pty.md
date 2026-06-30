# Handoff — Plan 2 Phase 5: Terminal PTY attach

> Paste the **New chat prompt** below into a fresh Cursor session.  
> Plan: [web-ui-implementation-plan.md](./web-ui-implementation-plan.md) · Backlog: [backlog.md](./backlog.md) · Spec: [idea-v2.md](./idea-v2.md)

---

## New chat prompt (copy from here)

```
Continue Guild House **Plan 2 Phase 5** — browser terminal attach to live PO sessions.

## Goal
Ship `WS /ws/missions/:id/attach` on guild-house (Bun + node-pty) and a **Terminal** tab in the mission room web UI (xterm.js). Guild master can CHAT with the PO from the browser; closing the tab must **detach only** — the PO `claudew --bg` job keeps running.

## Current state (2026-06-27)
- API **v0.9.0** · Web UI Phases **0–4 done** (board, missions, mission room tabs, guild master actions)
- Mission room tabs: Brief · Checkpoint · Events · Outbox — **no Terminal tab yet**
- `MissionActions.tsx` has disabled **Terminal (soon)** stub
- Checkpoint tab already shows `attachCmd` + copy button from `GET /missions/:id/session`
- **No WebSocket route exists** in guild-house yet; `server.ts` is REST-only `Bun.serve({ fetch })`
- **No xterm** in `guild-house/web/package.json` yet
- Reference PTY implementation: `airwave/freeflow/bun-server/server.ts` + `freeflow/web-client/src/components/TerminalPanel.tsx`

## Locked semantics (do not break)
1. PO session = existing `claudew --bg` bg job (NOT spawn a new Claude from scratch like Freeflow)
2. PTY runs **`claudew attach {shortId}`** with **cwd = mission room** (from session API)
3. On WS connect: call **`ensureLive`** server-side (`GET .../session?ensureLive=true` logic) before attach
4. On last WS close: **kill attach PTY only** — never `claudew stop` the PO bg job
5. Dead session: UI shows **Restore session** (existing button) before enabling terminal
6. Auth: same Bearer API key (query token or subprotocol — pick one, document it)
7. Close tab ≠ stop PO (match idea-v2 attach semantics)

## Backend tasks
- [ ] Add `node-pty` dependency to `guild-house/package.json`
- [ ] Extend `Bun.serve` with `websocket` handler OR separate upgrade path in `server.ts`
- [ ] `WS /ws/missions/:id/attach` — validate API key, resolve mission, `ensureMissionSessionLive`
- [ ] Spawn PTY: Windows `cmd /c claudew attach {id}` (see Freeflow — cmd.exe not PowerShell); cwd from checkpoint
- [ ] Message protocol (JSON, mirror Freeflow where sensible):
  - client → `{ type: "chat_input", data }` (keystrokes)
  - client → `{ type: "pty_resize", cols, rows }`
  - server → `{ type: "pty_output", data }`
  - server → `{ type: "connected" }` / `{ type: "error", message }`
- [ ] Track attach PTY per WS client; cleanup on disconnect
- [ ] Bump `GET /health` version (e.g. 0.9.1 or 0.10.0); update `docs/api.md`
- [ ] CORS: ensure WS upgrade allowed from `http://127.0.0.1:3848`

## Frontend tasks
- [ ] Add deps: `xterm`, `xterm-addon-fit`, (optional) `xterm-addon-web-links`
- [ ] Vite proxy: **WebSocket** for `/api` or dedicated `/ws` path to `:3847` (ws: true)
- [ ] Port/adapt `TerminalPanel` → `guild-house/web/src/components/MissionTerminal.tsx`
- [ ] Mission room: add **Terminal** tab (or enable stub button → tab)
- [ ] Connection status: connecting / connected / disconnected; reconnect button
- [ ] Before connect: if `restoreRequired`, block terminal + show restore CTA
- [ ] xterm theme: match **light UI** (`guild-theme.css`), not Freeflow dark `#1e1e1e`
- [ ] Pass API key on WS connect (same as REST Bearer)

## Acceptance (from plan)
- [ ] Attach to live PO; type in xterm; ESC interrupts current turn
- [ ] Close browser tab / disconnect WS; PO still shows in `claude agents --json`
- [ ] Dead session: restore from UI, then attach works

## Key files
| Area | Path |
|------|------|
| Plan | `ideas/archive/web-ui-implementation-plan.md` |
| Web CLAUDE | `guild-house/web/CLAUDE.md` |
| Server | `guild-house/src/server.ts` |
| Routes | `guild-house/src/routes/api.ts` |
| Session live | `guild-house/src/orchestrator/session-lifecycle.ts` |
| Attach cmd | `guild-house/src/orchestrator/spawn.ts` → `sessionCommands()` |
| Mission UI | `guild-house/web/src/pages/MissionPage.tsx` |
| Actions stub | `guild-house/web/src/components/MissionActions.tsx` |
| API client | `guild-house/web/src/lib/api.ts` |
| Freeflow ref | `freeflow/bun-server/server.ts`, `freeflow/web-client/src/components/TerminalPanel.tsx` |

## Dev setup (Windows)
```cmd
cd c:\Users\airic\airwave\guild-house
bun run dev

cd c:\Users\airic\airwave\guild-house\web
bun run dev
```
- API: http://127.0.0.1:3847 · UI: http://127.0.0.1:3848
- Keys: `GUILD_API_KEY` in `guild-house/.env` ↔ `VITE_GUILD_API_KEY` in `web/.env.local`
- Test mission: pick an **active** mission with live session, or bell a ready mission first

## Risk — spike first (~half day)
Windows PTY + `claudew attach` inside cmd.exe. Freeflow notes: use **cmd.exe**, not PowerShell, for node-pty reliability.

## After Phase 5

Plan 2 Phase 6 complete. See [backlog.md](../backlog.md) for Files tab and other deferred UI work.

## Do NOT
- Kill PO bg session on WS close (Freeflow kills PTY when no clients — different model)
- Spawn a brand-new Claude instead of attaching to existing session
- Edit checkpoint.yaml from UI
- Add chatroom — events.jsonl is audit-only
```

---

## Context summary

### What Phase 5 is

Browser **xterm** pane wired to the **existing PO background session** via `claudew attach {shortId}`. This is guild master **CHAT intervention** (idea-v2 § Guild master 介入 — 方式 A).

### What Phase 5 is NOT

| Freeflow | Guild House Phase 5 |
|----------|---------------------|
| Spawns new Claude in PTY on connect | **Attach** to already-running `--bg` PO |
| PTY = the agent process | PTY = attach wrapper; PO bg job survives detach |
| Kills PTY when last client leaves | Kill **attach PTY only**; PO keeps running |

### Architecture sketch

```
Browser (MissionPage → Terminal tab)
    │  WS + Bearer token
    │  { chat_input, pty_resize } ↔ { pty_output, connected, error }
    ▼
guild-house Bun :3847
    │  ensureMissionSessionLive(missionId)
    │  node-pty: cmd /c claudew attach {shortId}
    │  cwd = data/mission-rooms/{id}/
    ▼
Existing PO claudew --bg session (unchanged on detach)
```

### REST already available (no new read routes needed)

```http
GET /missions/:id/session?ensureLive=true
```

Returns `attachCmd`, `cwd`, `live`, `restoreRequired`. UI already uses this on Checkpoint tab.

### Web UI state

| Item | Status |
|------|--------|
| Board, Missions nav, Outbox | Done |
| Mission tabs: Brief, Checkpoint, Events, Outbox | Done |
| Light theme, colored kanban columns | Done |
| Terminal tab / xterm | **Not started** |
| Vite WS proxy | **Not configured** |

### Suggested implementation order

1. **Spike** — minimal WS + node-pty + `claudew attach` on Windows (curl/wscat or tiny HTML page)
2. **Backend** — route + auth + lifecycle in guild-house
3. **Vite proxy** — `ws: true` for dev
4. **MissionTerminal component** — adapt Freeflow TerminalPanel
5. **MissionPage tab** — wire session query + restore gate
6. **Docs** — `docs/api.md`, update `web/CLAUDE.md`, bump health version

### Related docs

- [docs/api.md](../../guild-house/docs/api.md) — session endpoint
- [docs/session-lifecycle.md](../../guild-house/docs/session-lifecycle.md) — restore ladder
- [docs/e2e-happy-path.md](../../guild-house/docs/e2e-happy-path.md) — manual attach flow today
- [idea-v2.md](./idea-v2.md) — attach = detach-only semantics
