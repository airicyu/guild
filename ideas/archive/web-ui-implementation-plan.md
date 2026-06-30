# Guild House — Web UI Implementation Plan (Plan 2)

> **Historical — Plan 2 complete (2026).** Active docs: [guild-house/web/CLAUDE.md](../../guild-house/web/CLAUDE.md) · [guild-house/docs/api.md](../../guild-house/docs/api.md) · [backlog.md](../backlog.md).

> **Prerequisite:** [implementation-plan.md](./implementation-plan.md) (Plan 1) complete — API **v0.9.0** (mission room design fix: events, brief, member memory)  
> Spec: [idea-v2.md](./idea-v2.md) · UI section + MVP 順序  
> Code: `airwave/guild-house/web/` (new) · API extensions in `guild-house/src/`  
> Reference PTY/UI: `airwave/freeflow/` (xterm + WebSocket patterns)

---

## Goals

Ship a **cool, local-first web client** for the guild master — derived view over the existing orchestrator, not a second source of truth.

1. **Mission board** — kanban: parking / ready / active / archive + **Bell**
2. **Mission hall** — live cards for active missions (phase, session liveness, awaiting guild master)
3. **Mission room** — detail: brief, checkpoint, **events** (audit log), outbox, attach terminal
4. **Guild master actions** — bell, archive, pause/resume, restore, mark outbox read (via existing REST)
5. **Terminal attach** — xterm pane → `claudew attach {sessionId}` in mission room cwd (Freeflow-style PTY relay)

**Non-goals (Plan 2):** see [backlog.md](./backlog.md) — Web UI deferred section.

---

## Progress

| Phase | Status | Target API | Notes |
|-------|--------|------------|-------|
| 0 — Design + scaffold | **Done** | — | `guild-house/web/` shell, proxy, theme |
| 1 — Board + Bell | **Done** | v0.8.0 | kanban, slots, bell, CORS |
| 2 — Hall + mission list | **Done** | v0.8.0 | outbox nav badge, refetchOnWindowFocus |
| 3 — Mission room (read) | **Done** | v0.8.1 | summary + room routes; MissionPage tabs |
| 4 — Guild master actions | **Done** | v0.9.0 | archive, pause/resume/restore, outbox read |
| 5 — Terminal attach (PTY) | **Done** | v0.10.0 | Bun PTY + WS + xterm (WSL/Linux) |
| 6 — Polish + E2E | **Done** | v0.10.0 | build, README/CLAUDE, refactor — optional items in [backlog.md](../backlog.md) |

**Current:** Plan 2 **complete** (Phases 0–6). Product shipped through **0.2.0** with Plan 3 (Mission Discovery).

**Next:** [Mission Discovery Plan (Plan 3)](./mission-discovery-plan.md) — also complete; see [product.md](../../guild-house/specs/product.md).

---

## Session handoff (2026-06-28, updated)

**Phase 5 terminal attach — done (WSL/Linux):**

- **`WS /ws/missions/:id/attach`** — Bun native PTY (`Bun.spawn` + `terminal`); **`node-pty` removed**; Windows attach path dropped (dev on WSL)
- Server: persistent bash PTY per mission; `claude attach {shortId}` after client size known; `ensureMissionSessionLive` on connect; WS close kills attach PTY only
- Client: **`@xterm/xterm` 6** + fit + web-links; **dark terminal theme** (matches Claude TUI); tab-lazy mount (unlike Freeflow always-on)
- Initial fit: `fit()` before WS; `?cols=&rows=` on upgrade; `pty_resize` on open + ResizeObserver
- Selection/copy: `preferDragSelection` (plain drag over Claude mouse mode); Ctrl+Shift+C / Ctrl+C with selection
- UI polish: removed misleading board **Archive →** badge (archive button stays on mission page only); **Missions** nav highlights on `/missions/:id`
- Docs: `guild-house/docs/wsl-handoff-phase5-terminal.md`, `docs/api.md`
- Smoke: `scripts/test-ws-attach.ts`, `test-ws-input.ts`, UI typing, reconnect, restore gate

**2026-06-29 terminal UX polish (done):**

- `@xterm/addon-webgl` 0.19; `trackAltScreen` — hide scrollbar in `claude attach` alt screen
- **No `guild-glass` / `backdrop-filter`** on terminal pane (fixes ghost UI after ← exit attach)
- Hide legacy `.xterm-viewport`; force scrollbar visible in classic/bash mode
- Full detail: [wsl-handoff-phase5-terminal.md](../guild-house/docs/wsl-handoff-phase5-terminal.md#terminal-ux-as-built-2026-06-29)

**Mission Room 设计修正（backend v0.9.0，仍有效）：**

- `chatroom.jsonl` → **`events.jsonl`** — audit / milestone log（非 agent 沟通 channel）；`GET/POST /missions/:id/events`；移除 `/chatroom`
- Agent 协作走 **CC agent team / Task**；evaluator 通过 Task 返回给 PO
- **`tools/log`**（`from type body`）；type 白名单（PO vs member）
- **`memories/members/{role}/memory.md`** scaffold 于 pickup / active sync
- **`mission-brief.md`** — orchestrator 于 bell 复制；`GET /missions/:id/brief`

**Web UI Plan 2 progress:**

| Phase | Done |
|-------|------|
| 0–1 | Scaffold, board, bell, CORS, auth |
| 2 | Hall, outbox nav badge, `refetchOnWindowFocus` |
| 3 | Mission room read: brief / checkpoint / events / outbox tabs |
| 4 | Archive, pause/resume/restore, mark outbox read |
| 5 | Terminal PTY attach (Bun + xterm + WS) — **done** |
| 6 | Polish + E2E — **done** |

**Local dev:**

```bash
cd guild-house && bun run dev
cd guild-house && bun run dev:ui
```

Key: `GUILD_API_KEY` in `.env` ↔ `web/.env.local` `VITE_GUILD_API_KEY`. **WSL/Linux** for terminal attach.

## Locked decisions (prior handoff — 2026-06-27)

| Item | Choice |
|------|--------|
| **Location** | `guild-house/web/` — Vite + React + TS; co-located with daemon |
| **Dev ports** | API `3847` · Vite `3848` (proxy `/api` → 3847) |
| **Prod serve** | Bun serves `web/dist/` on same port (or `GUILD_UI=1` static mount) |
| **Data model** | **No UI DB** — filesystem remains truth; UI reads API + new read-only file routes |
| **Auth** | Same Bearer key; store in `localStorage` after first visit (local dev) |
| **Real-time v1** | TanStack Query polling (3–5s active, 15s board); SSE → [backlog.md](./backlog.md) |
| **Intake** | Still IDE / drop `mission.md` — no mission authoring UI in Plan 2 |
| **Attach semantics** | Close tab = **detach only**; PO bg session continues (match idea-v2) |
| **PTY spawn** | WSL/Linux: **Bun.spawn** + persistent bash PTY per mission → `claude attach {shortId}`; cwd = mission room; **not** Freeflow-style new Claude |
| **Terminal lifecycle** | Tab-lazy: xterm + WS mount on Terminal tab only; teardown on tab leave; server PTY per mission while WS active |
| **Terminal UX** | Dark xterm theme; fit before connect + `cols`/`rows` query; drag-to-select + copy shortcuts |
| **Control plane** | Web UI **complements** guild-desk skill; skill remains for CC users |
| **Mission room API** | `GET /brief`, `GET /summary`, `GET /events` — not raw disk paths in UI for common reads |
| **Event log** | `events.jsonl` = guild master / UI audit trail; **not** agent-to-agent chat (CC team handles live coordination) |

---

## Architecture

```
Browser (guild-house/web)
    │  REST + Bearer
    │  poll: /board, /missions, /outbox, /missions/:id/events
    ▼
Guild House Bun (3847) — **v0.10.0**
    │  CORS, read routes, guild-master POST actions
    │  WS /ws/missions/:id/attach (Bun PTY)
    ▼
data/mission-board/ + mission-rooms/ + claudew --bg PO sessions
```

### Pages (v1)

| Route | View |
|-------|------|
| `/` | **Board** — 4 columns + bell + slot meter |
| `/hall` | **Mission hall** — grid of active mission cards |
| `/missions/:id` | **Mission room** — tabs: Brief · Checkpoint · Events · Outbox · **Terminal** |
| `/outbox` | **Inbox** — cross-mission unread escalations |

### Mission card (hall)

Derived from `GET /missions` + optional file reads:

- Title from `memories/common/mission-brief.md` frontmatter or slug
- Phase pill (`evaluating` / `running` / `blocked` / `paused` / `done`)
- Session dot: `sessionLive` + `restoreRequired`
- `awaitingGuildMaster` banner
- Archive: **mission page only** (`MissionActions` when `archiveReady`) — no badge on board card
- Last signal summary from checkpoint

Reporter `mission-reports/visualization/overview.html` — iframe when file exists (see [backlog.md](./backlog.md)); card fallback in place.

---

## API extensions (guild-house backend)

Plan 2 adds routes; bump **`GET /health` → version** per phase.

### v0.8.0 — UI foundation

| Change | Purpose |
|--------|---------|
| **CORS** | `Access-Control-*` for `http://127.0.0.1:3848` (dev) + configurable `GUILD_UI_ORIGIN` |

### v0.8.1 — Mission room reads

| Change | Purpose |
|--------|---------|
| **`GET /missions/:id/summary`** | Mission + checkpoint + brief title + squad members + unread outbox count |
| **`GET /missions/:id/room/:path`** | Read-only allowlisted files under mission room (optional; UI prefers `/brief`) |
| **`GET /missions/:id/brief`** | Mission brief markdown (room copy or board fallback) |

### v0.9.0 — Events + guild master actions

| Change | Purpose |
|--------|---------|
| **`GET /missions/:id/events`** | Event log entries (`memories/common/events.jsonl`) |
| **`POST /missions/:id/events`** | Append audit event (`tools/log`); type whitelist by role |
| **Remove `/chatroom`** | Breaking rename from Plan 1 chatroom routes |
| **Member memory scaffold** | `memories/members/{role}/memory.md` on pickup / active sync |
| **`ensureMissionBriefInRoom`** | Copy board `mission.md` if room brief missing |

UI uses existing Plan 1 routes for archive, pause, resume, restore, outbox read — no new write paths for checkpoint.

### v0.10.0 — Terminal attach (Phase 5, done)

| Change | Purpose |
|--------|---------|
| **`WS /ws/missions/:id/attach`** | Bearer via `?token=` or header; `ensureLive` server-side; Bun PTY |
| **PTY lifecycle** | Per-mission server bash PTY; `attachGen` / supersede for StrictMode; WS close → kill attach PTY only (not PO bg job) |
| **Client sizing** | Optional `?cols=&rows=` on WS upgrade; deferred `claude attach` until size known |
| **Platform** | **WSL/Linux** — Bun native PTY; `node-pty` removed; Windows attach not supported |

Reference: `guild-house/src/websocket/attach-pty.ts`, `web/src/components/MissionTerminal.tsx`, `guild-house/docs/wsl-handoff-phase5-terminal.md`.

### Optional API (backlog)

See [backlog.md](./backlog.md) — SSE push, `GET /board/summary`.

---

## Deferred → backlog

Phase 3 Files tab, artifacts tree, and all “not in Plan 2” items → **[backlog.md](./backlog.md)**.

---

## Tech stack (web/)

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Routing | React Router 6 |
| Data | TanStack Query v5 |
| Styling | Tailwind CSS 4 + CSS variables (guild theme) |
| Markdown | `react-markdown` + `remark-gfm` (squad, memory, brief) |
| Terminal | **@xterm/xterm** 6 + `@xterm/addon-fit` + `@xterm/addon-web-links` |
| Icons | Lucide React |

---

## Visual direction (“cool”)

**Guild command center** — light shell for board/hall; **mission terminal pane uses dark xterm** (Claude TUI).

- **App chrome:** light `#f4f5f7` / glass cards (see `guild-theme.css`)
- **Terminal pane:** `#1e1e1e` background, VS Code–style ANSI palette
- **Accent:** amber/gold `#b8832e` (bell, primary actions, terminal cursor)
- **Phase colors:** evaluating= violet, running= emerald, blocked= rose, paused= slate, done= gold
- **Typography:** display font for headings (e.g. *Cinzel* or *DM Serif*), UI body *DM Sans*
- **Board columns:** glassmorphism cards, drag affordance (read-only v1 — no drag between columns; moves via API only)
- **Session indicator:** pulsing dot when `live: true`; hollow + warning when `restoreRequired`
- **Bell button:** prominent, satisfying click + slot animation
- **Sound:** optional subtle bell chime (muted by default)

---

## Phase 0 — Design + scaffold (~1 day)

**Tasks**

- [x] Create `guild-house/web/` — Vite React TS + Tailwind
- [x] `vite.config.ts` — proxy `/api` → `127.0.0.1:3847`, strip prefix in client
- [x] Env: `VITE_GUILD_API_URL`, api client wrapper with Bearer header
- [x] Layout shell: sidebar nav (Board · Hall · Outbox), header (health, guild master name, API key settings)
- [x] Design tokens in `src/styles/guild-theme.css`
- [x] Mock screen — board mock cards + live GET /board when API up

**Acceptance:** `cd web && bun run dev` → empty shell at `:3848`, health ping via proxy works.

---

## Phase 1 — Board + Bell (~2 days)

**Tasks**

- [x] CORS middleware in `guild-house/src/server.ts`
- [x] Board page: 4 columns from `GET /board`
- [x] Enrich cards: for active ids, merge `GET /missions` phase + badges
- [x] Slot meter from `GET /queue` (`used/max/available`)
- [x] **Bell** button → `POST /bell` → toast with `pickedUp` / `queued` / `errors`
- [x] API key modal (persist `localStorage.guildApiKey`; env via `VITE_GUILD_API_KEY`; no secret in DOM `value`)

**Acceptance**

- [x] Visual kanban matches disk folders
- [x] Bell picks up ready mission; UI refreshes without manual reload
- [x] 401 shows “check API key” not blank screen

---

## Phase 2 — Mission hall (~2 days)

**Tasks**

- [x] Hall grid from `GET /missions`
- [x] Mission card component (phase, live, awaiting guild master, archive ready)
- [x] Click card → `/missions/:id` (active missions)
- [x] Outbox badge in nav from `GET /outbox` count
- [x] Poll every 3s on hall (`refetchInterval: 3000`)
- [x] `refetchOnWindowFocus` on hall + board

**Acceptance**

- [x] Active missions visible with correct `sessionLive` / `restoreRequired`
- [x] Phase matches API (e.g. `demo-001` **done**, not stale mock blocked)
- [x] Done + `archiveReady`: archive via mission page **Archive** button (Phase 4); no board card badge

---

## Phase 3 — Mission room read-only (~2–3 days)

**Tasks**

- [x] `GET /missions/:id/summary` backend
- [x] `GET /missions/:id/brief` backend (+ board fallback for legacy rooms)
- [x] `GET /missions/:id/room/:path` backend (path traversal guards) — optional; UI uses `/brief`
- [x] Checkpoint tab: checkpoint, last signal, session commands (copy buttons)
- [x] Events tab: `GET /missions/:id/events`, styled by `type`
- [x] Outbox tab: entries + read state

Deferred items (Files tab, artifacts tree) → [backlog.md](./backlog.md)

**Acceptance**

- [x] Open archived `hello-world-20260627-5e422e` — see events, brief, checkpoint from E2E run
- [x] No write to checkpoint from UI

---

## Phase 4 — Guild master actions (~2 days)

**Tasks**

- [x] Archive button → `POST /missions/:id/archive` (confirm dialog)
- [x] Pause / Resume → `POST .../pause`, `.../resume`
- [x] Restore → `POST .../restore`
- [x] Mark outbox read → `POST .../outbox/read` (mission tab + global outbox page)
- [x] Copy attach command; Terminal tab live (Phase 5)
- [x] Error toasts for 409/404 (MissionActions)

**Acceptance**

- [x] Full happy path doable from UI: bell → watch mission → archive
- [x] Archive only offered when `archiveReady` / `phase: done`

---

## Phase 5 — Terminal attach PTY (~3–4 days) — **Done**

> **Handoff / acceptance:** [guild-house/docs/wsl-handoff-phase5-terminal.md](../../guild-house/docs/wsl-handoff-phase5-terminal.md)

**Tasks**

- [x] `WS /ws/missions/:id/attach` (auth query token + origin check)
- [x] Server: `ensureMissionSessionLive` → Bun PTY; persistent bash per mission; `claude attach {shortId}`
- [x] `MissionTerminal.tsx` — tab-lazy xterm; fit/resize; reconnect; restore gate
- [x] `@xterm/xterm` 6 + **WebGL**; dark theme; alt-screen scrollbar; compositing fixes (2026-06-29)
- [x] Drag select + copy shortcuts
- [x] Document: closing tab ≠ stopping PO

**Acceptance**

- [x] Attach to live PO; type in xterm; input reaches PO
- [x] Close tab; PO still in `claude agents --json`
- [x] Dead session: UI shows restore before attach
- [x] Reconnect after detach

**Note:** Dev validated on **WSL/Linux**. Freeflow patterns borrowed for fit/resize only — **not** lifecycle (tab-lazy vs always-mounted).

---

## Phase 6 — Polish + E2E (~2 days) — **Done**

**Tasks**

- [x] `bun run build` in web
- [x] README + `web/CLAUDE.md` (no second-brain links)
- [x] Update `idea-v2.md` + this plan for Phase 5 as-built
- [x] Web `features/` refactor + targeted comments

Deferred to [backlog.md](../backlog.md): dedicated Settings route, `docs/web-ui.md`, Playwright smoke, `dev:all`

**Acceptance**

- [x] Plan 1 E2E happy path reproducible from UI (bell → mission room → archive)

---

## Dev workflow

```cmd
rem Terminal 1 — API
cd airwave\guild-house
bun run dev

rem Terminal 2 — UI
cd airwave\guild-house\web
set VITE_GUILD_API_URL=/api
bun run dev
```

Open `http://127.0.0.1:3848` · enter API key `change-me-in-production`.

**package.json scripts (target)**

```json
{
  "dev:all": "concurrently \"bun run dev\" \"cd web && bun run dev\"",
  "build:ui": "cd web && bun run build"
}
```

---

## Relationship to guild-desk

| Channel | When |
|---------|------|
| **Web UI** | Visual board, hall, outbox triage, terminal attach in browser |
| **guild-master skill** | Claude Code control plane, scripting, “ring the bell” in chat |

Both call the same API. Web UI does **not** replace guild-desk — it replaces curl-for-humans.

---

## Out of scope (backlog)

Items explicitly deferred from Plan 2 → **[backlog.md](./backlog.md)** (intake editor, inbox nudge, notifications, mailbox, timeout, SSE, multi-user auth, etc.).

---

## Open questions (decide in Phase 0)

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Separate repo `guild-hall` vs `guild-house/web/`? | **web/** subfolder — one release unit |
| 2 | API key in browser localStorage? | OK for localhost; document “local dev only” |
| 3 | Poll vs SSE first? | **Poll** — simpler; SSE Phase 6 optional |
| 4 | Serve UI from 3847 or always 3848? | Dev: 3848 · Prod: 3847 serves static |
| 5 | Mobile layout? | Best-effort responsive; desktop-first |

---

## Suggested Cursor workflow

One session per phase; context files:

- This plan · [backlog.md](./backlog.md)
- `guild-house/docs/api.md`
- `idea-v2.md` UI section
- `guild-house/docs/wsl-handoff-phase5-terminal.md` (Phase 5)
- `freeflow/freeflow-web/src/components/TerminalPanel.tsx` (fit/resize reference only)

After each phase: demo screenshot in `guild-house/docs/web-ui.md`.

---

## Success criteria (Plan 2 complete)

Guild master can **operate entirely from the browser** for day-to-day:

1. See board + hall at a glance  
2. Ring bell  
3. Triage outbox  
4. Open mission room — read brief, events, checkpoint, outbox  
5. Attach terminal and intervene  
6. Archive completed missions  

Filesystem + API v0.9 behavior unchanged; UI is a derived, read-mostly lens with explicit action buttons.
