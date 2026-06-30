# Guild — Mission Discovery Implementation Plan (Plan 3)

> **Prerequisite:** [implementation-plan.md](./implementation-plan.md) (Plan 1) + [web-ui-implementation-plan.md](./web-ui-implementation-plan.md) (Plan 2) — product baseline **0.1.0**  
> Spec: [idea-v2.md](./idea-v2.md) · Prior intake: IDE drop `mission.md` (superseded for primary UX by this plan)  
> Code: `guild/guild-house/` (orchestrator + web) · `guild/guild-desk/` (alternate client)

---

## Goals

Ship **Mission Discovery** — a second pipeline before execution:

1. **Web submission** — guild master types a rough idea → appears on board **Ideas**
2. **Discovery team** — explores the idea, asks questions, produces **executable mission package(s)**; purpose is **not** to execute the mission
3. **Guild master in the loop** — attach, brainstorm, explicit **Approve** after presentation
4. **Parking → Queued → Working** — approved packages promote one-by-one; unified **Bell** tick starts discovery and execution when slots allow
5. **Filesystem-first** — discovery output lands as real `mission.md` folders on the board; execution pipeline reuses existing PO handoff

**Non-goals (Plan 3):** full mission editor; batch promote parking→queued; SSE; multi-user auth; archive column in UI.

---

## Product baseline (0.1.0)

Plan 1 + Plan 2 (through Web UI Phase 5) ship as **product release 0.1.0**. See:

- `guild-house/version.md` · `guild-house/changelog.md`
- `guild-desk/version.md` · `guild-desk/changelog.md`

| Version kind | Location | Purpose |
|--------------|----------|---------|
| **Product release** | `{repo}/version.md` + `changelog.md` | Guild master-facing releases |
| **API runtime** | `GET /health` → `version` | Incremental API changes during dev |

**Release process:** guild master says *「prepare for release X.X.X for guild-house」* (or guild-desk) → bump `version.md`, append `changelog.md`, note breaking changes.

Plan 3 target product release: **0.2.0** — **shipped 2026-06-29** (see `guild-house/version.md`).

**Baseline tasks (0.1.0 — done)**

- [x] `guild-house/version.md` → 0.1.0
- [x] `guild-desk/version.md` → 0.1.0
- [x] `guild-house/changelog.md` — 0.1.0 entry
- [x] `guild-desk/changelog.md` — 0.1.0 entry

---

## Progress

| Phase | Status | Target | Notes |
|-------|--------|--------|-------|
| 0 — Spec + board migration design | **Done** | — | Template + docs; column sign-off pending |
| 1 — Board stages + tick refactor | **Done** | API v0.11.0 | Six columns; `orchestratorTick()` skeleton; legacy folder tolerance |
| 2 — Idea submission + discovering spawn | **Done** | API v0.12.0 | `POST /ideas`; discovery room scaffold; discovery tick + slots |
| 3 — Discovery lifecycle + approve | **Done** | API v0.13.0 | Signals, outbox, drafts, approve → parking |
| 4 — Web: board + submission + Ideas page | **Done** | Web | Six-column kanban; submit idea; `/ideas/:id`; Approve |
| 4b — PO terminal UX polish | **Done** | Web | WebGL xterm; alt-screen attach; scroll/compositing fixes — [terminal doc](../guild-house/docs/wsl-handoff-phase5-terminal.md#terminal-ux-as-built-2026-06-29) |
| 5 — Discovery terminal attach | **Done** | API v0.14.0 | `GET/POST .../session|restore`; WS attach; Idea page Terminal tab |
| 6 — Execution semantics + done column | **Next** | API + Web | `working`/`done`; promote parking→queued |
| 7 — Periodic tick + guild-desk client | Pending | API + desk | `GUILD_TICK_INTERVAL_MINUTES`; skill/API parity |
| 8 — Docs + migration + release 0.2.0 | Pending | — | `idea-v2` as-built; E2E path; changelog |

**Current:** Plan 3 Phase 5 complete (discovery terminal attach). API runtime **0.14.0**; product release still **0.1.0**. **Next: Phase 6** — `working`/`done` column semantics + promote parking → queued.

---

## Locked decisions

| Item | Choice |
|------|--------|
| **Primary intake UX** | Web mission submission → **Ideas** column (guild-desk = alternate client, same API) |
| **Board columns (UI)** | Ideas · Discovering · Parking · Queued · Working · Done — **no Archive column** |
| **Board folders** | Same names under `data/mission-board/` (must match UI stage) |
| **Archive** | `mission-board/archive/` remains on disk; UI hidden; guild master uses filesystem or future browse |
| **Bell (UI)** | **One button** — triggers `orchestratorTick()`: try discovery pickups, then execution pickups |
| **Periodic job (later)** | Same `orchestratorTick()` every N minutes (`GUILD_TICK_INTERVAL_MINUTES`) |
| **Discovery slots** | Max **2** concurrent discovery sessions |
| **Execution slots** | Max **4** concurrent working missions; **Done does not count** |
| **1 idea → N missions** | Discovery writes `discovery-rooms/{ideaId}/artifacts/missions/{slug}-{date}-{hex}/` — approve copies **each** to `parking/` |
| **Idea after approve** | **Removed from board** (missions live in parking; idea workspace retained under `discovery-rooms/` for history) |
| **Parking → Queued** | **One mission at a time** promote (manual folder move or API still OK; batch deferred) |
| **Discovery complete** | Mission artifacts ready in **presenting** phase; guild master **explicit Approve** required |
| **Approve paths** | (1) Attach/inbox: guild master approves → lead runs `tools/approve.sh` → same `POST /discoveries/:id/approve`; (2) Web **Approve** on Ideas page — **same API** |
| **Discovery vs execution PO** | Separate room type, template, spawn prompt; **not** PO handoff |
| **Requirements clarify (execution)** | Evaluator → PO team lead → (if needed) guild master; **do not** silently rewrite `mission-brief.md` |
| **Orchestrator** | Deterministic for moves/copy/spawn; **no LLM** in tick |
| **Attach** | WS close = detach only; discovery bg job continues |
| **checkpoint.yaml** | Orchestrator-only writer (both discovery and mission rooms) |

---

## Board rename map (0.1.0 → Plan 3)

| 0.1.0 folder | Plan 3 folder | UI column |
|--------------|---------------|-----------|
| *(new)* | `ideas/` | Ideas |
| *(new)* | `discovering/` | Discovering |
| `parking/` | `parking/` | Parking *(semantic change: approved mission packages)* |
| `ready/` | `queued/` | Queued |
| `active/` (phase ≠ done) | `working/` | Working |
| `active/` (phase = done) | `done/` | Done |
| `archive/` | `archive/` | *(hidden)* |

**Breaking:** `POST /bell` reads `queued/` not `ready/`; `mission_complete` moves board entry to `done/` instead of staying on `active/`.

---

## Two pipelines

```
Pipeline A — Discovery (define missions)
  Ideas → [tick] → Discovering → [Approve] → Parking (1..N mission folders)
                         ↑
              guild master attach / brainstorm

Pipeline B — Execution (run missions)
  Parking → [promote] → Queued → [tick] → Working → Done
                                              ↑
                                   PO team (existing handoff)
```

---

## Unified orchestrator tick

**Manual:** `POST /bell` (UI single Bell button)  
**Automatic (Phase 7):** interval calls same function

```text
orchestratorTick():
  1. discoverySlots = MAX_DISCOVERY - count(discovering with live session)
     for each idea in ideas/ (FIFO) while discoverySlots > 0:
       move ideas/{id} → discovering/{id}
       scaffold discovery-rooms/{id}, spawn discovery lead --bg
       discoverySlots--

  2. executionSlots = MAX_WORKING - count(working where phase != done)
     for each mission in queued/ (FIFO) while executionSlots > 0:
       mint id if needed, move queued → working
       scaffold mission-rooms/{id}, spawn PO --bg (existing pickup)
       executionSlots--

  return { discoveriesStarted, missionsStarted, queuedDiscovery, queuedExecution, errors }
```

---

## Discovery lifecycle (checkpoint phases)

| Phase | Meaning |
|-------|---------|
| `exploring` | Team clarifying scope, questioning |
| `drafting` | Writing mission package(s) under `artifacts/missions/` |
| `presenting` | Packages ready; guild master may review |
| `awaiting_approval` | Outbox asked guild master to join; `awaiting_guild_master: true` |
| `closed` | Approved; board entry gone; artifacts copied to parking |

**Approve (`POST /discoveries/:id/approve`):**

1. Validate at least one folder under `artifacts/missions/`
2. Copy each `artifacts/missions/{missionFolder}/` → `mission-board/parking/{missionFolder}/`
3. Close discovery session (optional: stop bg job or leave for audit)
4. Remove `discovering/{ideaId}` from board (keep `discovery-rooms/{ideaId}/`)

---

## Folder layout

```
data/
  mission-board/
    ideas/
      {ideaId}/           ← scratch.md (+ optional meta)
    discovering/
      {ideaId}/
    parking/
      {missionSlug}-{date}-{hex}/
        mission.md
    queued/
    working/
    done/
    archive/                ← not shown in UI

  discovery-rooms/
    {ideaId}/
      scratch.md
      checkpoint.yaml
      outbox.jsonl
      inbox.md
      artifacts/missions/{slug}-{date}-{hex}/...
      members/...
      .guild/handoff-prompt.md

  mission-rooms/            ← unchanged execution rooms
    {missionId}/
```

**Idea id:** mint `idea-{YYYYMMDD}-{6hex}` on submission (or slug if provided and unique).

---

## Phase 0 — Spec + board migration design (~0.5 day)

**Tasks**

- [x] Write `ideas/mission-discovery-plan.md` (this doc)
- [x] Locked decisions table (board columns, slots, approve gate, 1→N missions)
- [x] Board rename map 0.1.0 → Plan 3
- [x] 0.1.0 product baseline + changelogs
- [x] Discovery room folder layout finalized in `templates/discovery-room/`
- [x] Discovery checkpoint schema (`phase`, `awaiting_guild_master`) documented
- [x] API route list merged into `guild-house/docs/api.md` (stub section)
- [x] Breaking-change note for root `CLAUDE.md` locked semantics (items 5–7 will change at Phase 6)

**Acceptance**

- [x] Plan readable standalone; phases 1–8 have checkbox tasks
- [x] Guild master sign-off on column names: Ideas · Discovering · Parking · Queued · Working · Done

---

## Phase 1 — Board stages + tick refactor (~2–3 days)

**Tasks**

- [x] Extend `BOARD_STAGES`: `ideas`, `discovering`, `parking`, `queued`, `working`, `done`, `archive`
- [x] `ensureDataLayout()` creates new board folders
- [x] Rename code paths: `ready` → `queued`, `active` → `working` (keep parser tolerance for legacy folder names during migration)
- [x] Refactor `ringBell()` → `orchestratorTick()` — execution half reads `queued/` not `ready/`
- [x] `GET /board` returns six UI-visible stages (+ `archive` optional, documented as hidden)
- [x] `GET /queue` — split or extend: discovery queue + execution queue + slot meters
- [x] Config: `MAX_DISCOVERY_SESSIONS` (default 2), keep `MAX_ACTIVE_MISSIONS` (4) for working
- [x] `countWorkingMissions()` — only `working/` where `phase !== done`
- [x] Migration script or doc steps for dev `data/mission-board/` rename
- [x] Bump `GET /health` version

**Acceptance**

- [x] Empty six-column board lists correctly from disk
- [x] `POST /bell` still picks up missions from `queued/` (execution path only until Phase 2)
- [x] Slot meter shows execution used/max; discovery slot fields present (may be 0 until Phase 2)

**Code:** `src/paths.ts` · `src/orchestrator/board.ts` · `src/orchestrator/pickup.ts` · `src/types/mission.ts` · `web/src/types/mission.ts`

---

## Phase 2 — Idea submission + discovering spawn (~3–4 days)

**Tasks**

- [x] `POST /ideas` — body `{ text, slug? }` → mint `idea-{date}-{hex}` → `ideas/{id}/scratch.md`
- [x] `GET /ideas`, `GET /ideas/:id` — list + detail (board stage, scratch preview)
- [x] `templates/discovery-room/` — intake-lead agent, handoff prompt, outbox/inbox stubs
- [x] `discovery-rooms/{id}/` scaffold on discovering pickup
- [x] `orchestratorTick()` discovery half: `ideas/` → `discovering/`, spawn discovery lead `--bg`
- [x] Discovery session naming: `discovery-{id}-lead` (or equivalent)
- [x] Discovery checkpoint writer (orchestrator-only)
- [x] `countDiscoveringSessions()` for slot limit
- [x] Initial discovery spawn prompt (read scratch, explore, do not execute mission)
- [x] Bump `GET /health` version

**Acceptance**

- [x] `POST /ideas` with paragraph of text → folder on **Ideas** column
- [x] `POST /bell` → idea moves to **Discovering**; discovery bg session live
- [x] `GET /ideas/:id` shows checkpoint + session liveness

**Code:** `src/orchestrator/discovery/` (new) · `src/routes/api.ts` · `templates/discovery-room/`

---

## Phase 3 — Discovery lifecycle + approve (~3–4 days)

**Tasks**

- [x] Discovery signals API — `POST /discoveries/:id/signals` (phase transitions, `awaiting_guild_master`)
- [x] Discovery outbox — reuse or mirror mission outbox pattern (`GET /discoveries/:id/outbox`)
- [x] Team tools: escalate, log (discovery-scoped paths under discovery room)
- [x] Orchestrator watches `artifacts/missions/` for draft packages (optional helper for UI)
- [x] `GET /ideas/:id/drafts` — list/preview `artifacts/missions/*` (mission.md per folder)
- [x] `POST /discoveries/:id/approve`:
  - [x] Validate ≥1 mission folder under `artifacts/missions/`
  - [x] Copy each → `mission-board/parking/{folder}/`
  - [x] Set discovery checkpoint `phase: closed`
  - [x] Remove `discovering/{id}` from board (retain `discovery-rooms/{id}/`)
- [x] Discovery handoff playbook: presentation → request guild master → Approve gate
- [x] Bump `GET /health` version

**Acceptance**

- [x] Manually place test mission folder under `artifacts/missions/` → Approve → appears in **Parking**
- [x] Idea no longer on board after Approve
- [x] Two mission folders under one idea → two parking entries

**Code:** `src/orchestrator/discovery/lifecycle.ts` · `approve.ts` · discovery `tools/`

---

## Phase 4 — Web: board + submission + Ideas page (~3–4 days)

**Tasks**

- [x] Board page: six columns (hide archive)
- [x] Theme CSS for new columns (`ideas`, `discovering`, `queued`, `working`, `done`)
- [x] **Submit idea** form (modal or `/ideas/new`) → `POST /ideas`
- [x] Idea card component — scratch snippet, link to `/ideas/:id`
- [x] Discovering card — discovery phase badge, `awaitingGuildMaster` banner
- [x] `/ideas/:id` page shell — routing, layout (separate from `/missions/:id`)
- [x] Tabs: **Scratch** · **Draft missions** · **Outbox** (read-only v1 ok)
- [x] **Approve** button — visible when phase `presenting` or `awaiting_approval` → `POST /discoveries/:id/approve`
- [x] Bell toast — extend for `discoveriesStarted` / `queuedDiscovery` (when API returns)
- [x] Poll/refetch board after submit, bell, approve

**Acceptance**

- [x] Submit idea from browser → card on **Ideas**
- [x] Open `/ideas/:id` — see scratch + drafts list when present
- [x] Approve from UI → parking cards appear; discovering card gone

**Code:** `web/src/pages/BoardPage.tsx` · `web/src/pages/IdeaPage.tsx` · `web/src/lib/board.ts` · `web/src/lib/api.ts` · `web/src/types/discovery.ts` · `web/src/components/IdeaCard.tsx` · `web/src/components/SubmitIdeaModal.tsx`

---

## PO mission terminal — as-built (prerequisite for Phase 5)

Plan 2 Phase 5 shipped Bun PTY attach; **2026-06-29 polish** made browser terminal match VS Code for `claude attach` + bash scrollback. **Discovery terminal must copy these contracts** — do not re-invent scroll/attach UX.

| Topic | As-built |
|-------|----------|
| **Renderer** | `@xterm/xterm` 6 + `@xterm/addon-webgl` (fallback: DOM if WebGL unavailable) |
| **Attach path** | WS → bash PTY → auto `claude attach {shortId}` (not foreground spawn) |
| **Alt screen** | `claude attach` fullscreen — hide xterm scrollbar; wheel → Claude history (SGR mouse to PTY) |
| **Exit attach (←)** | Return to bash scrollback — **no** `backdrop-filter` on terminal pane (causes GPU ghost frames) |
| **Classic bash** | Normal buffer scrollback + visible scrollbar (override xterm fade-out in CSS) |
| **Layout** | Opaque `#1e1e1e` pane; hide legacy `.xterm-viewport` (empty black overlay) |
| **Lifecycle** | Tab-lazy mount; WS close = detach attach PTY only |

Full detail: [guild-house/docs/wsl-handoff-phase5-terminal.md](../guild-house/docs/wsl-handoff-phase5-terminal.md) · code: `web/src/components/MissionTerminal.tsx` · `web/src/index.css` (`.mission-terminal-host`)

---

## Phase 5 — Discovery terminal attach (~2–3 days)

**Prerequisites**

- [x] PO `MissionTerminal` stable (see above)

**Tasks**

- [x] `GET /discoveries/:id/session` — mirror mission session (attachCmd, ensureLive)
- [x] `POST /discoveries/:id/restore` — restore ladder for discovery lead
- [x] `WS /ws/discoveries/:id/attach` — Bun PTY, cwd = discovery room, attach discovery lead
- [x] Reuse `attach-pty.ts` patterns: fit-before-connect, `?cols=&rows=`, detach-only on WS close
- [x] `AttachTerminalPane` + `DiscoveryTerminal.tsx` — shared WebGL/CSS stack; lazy tab on `/ideas/:id`
- [x] `ensureDiscoverySessionLive` on WS connect (restore ladder if needed)
- [x] Extend `docs/api.md` + terminal doc for discovery WS route
- [x] Bump `GET /health` version → **0.14.0**

**Acceptance**

- [x] Attach to live discovery session from Idea page **Terminal** tab
- [x] WS close does not kill discovery bg job
- [ ] Typing + copy/paste smoke; alt-screen exit shows clean bash (no ghost UI) — manual QA
- [x] Scrollbar behavior matches mission terminal (shared `AttachTerminalPane` + CSS)

**Code:** `src/orchestrator/discovery/session-lifecycle.ts` · `src/websocket/discovery-attach-pty.ts` · `web/src/components/AttachTerminalPane.tsx` · `DiscoveryTerminal.tsx`

---

## Phase 6 — Execution semantics + done column (~2–3 days)

**Tasks**

- [x] `mission_complete` → move board folder `working/` → `done/` (not stay on working)
- [x] `POST /board/parking/:folder/promote` — move one folder → `queued/`
- [x] Update `POST /missions/:id/archive` — archive from `done/` board
- [x] Web: **Promote** on parking cards → `queued/`
- [x] Web: **Working** hall — filter `working/` missions (rename from active hall semantics)
- [x] Web: **Done** column on board — `phase: done` missions
- [x] Update PO / evaluator playbooks — requirements escalation chain (evaluator → PO → guild master)
- [x] Update mission handoff — clarify frozen brief vs clarify via escalate
- [x] Bump `GET /health` version → **0.15.0**

**Acceptance**

- [x] Promote parking → queued → bell → working (full execution path still works)
- [x] `mission_complete` → card moves to **Done**; execution slot freed
- [x] Evaluator playbook documents no silent brief rewrite

**Code:** `src/orchestrator/lifecycle.ts` · `src/orchestrator/promote.ts` · `src/orchestrator/pickup.ts` · `web/src/pages/BoardPage.tsx` · `templates/mission-room/members/evaluator/agent.md`

---

## Phase 7 — Periodic tick + guild-desk client (~1–2 days)

**Tasks**

- [x] `GUILD_TICK_INTERVAL_MINUTES` env (0 = disabled)
- [x] Server interval calls `orchestratorTick()` (same as `POST /bell`)
- [x] Log tick results (discoveries started, missions started, errors)
- [x] **guild-master** skill — `POST /ideas`, `POST /discoveries/:id/approve`, `POST /board/parking/:folder/promote`
- [x] Update `guild-desk/README.md` + skill workflows
- [x] Web: optional indicator “auto-tick every N min” on board header
- [x] Bump `GET /health` version → **0.16.0**

**Acceptance**

- [x] With interval set, ideas auto-move to discovering when slots free (no manual bell)
- [x] guild-desk: “submit idea …” / “approve discovery {id}” via skill

**Code:** `src/orchestrator/tick-scheduler.ts` · `src/server.ts` · `src/config.ts` · `guild-desk/.claude/skills/guild-master/SKILL.md` · `web/src/pages/BoardPage.tsx`

---

## Phase 8 — Docs + migration + release 0.2.0 (~1–2 days)

**Tasks**

- [x] Complete `guild-house/docs/api.md` — all Plan 3 routes
- [x] `guild-house/docs/e2e-discovery-path.md` — full Plan 3 happy path
- [x] Root `CLAUDE.md` — intake workflow, locked semantics updates
- [x] `guild-house/README.md` — submission + discovery overview
- [x] Dev migration guide: 0.1.0 board folders → Plan 3 layout (`docs/migrate-0.1-to-0.2.md`)
- [x] `ideas/idea-v2.md` — as-built index for 0.2.0
- [x] **prepare for release 0.2.0** — `guild-house/version.md`, `changelog.md`
- [x] **prepare for release 0.2.0** — `guild-desk/version.md`, `changelog.md` (skill/API parity notes)

**Acceptance (Plan 3 E2E)**

Manual QA checklist documented in [e2e-discovery-path.md](../guild-house/docs/e2e-discovery-path.md):

- [ ] Web: submit idea → **Ideas**
- [ ] Bell → **Discovering**; discovery session live
- [ ] Discovery produces ≥1 mission under `artifacts/missions/`
- [ ] Presentation → attach → **Approve** (or UI Approve button)
- [ ] Mission folder(s) on **Parking**; idea gone from board
- [ ] Promote one → **Queued** → bell → **Working** → PO handoff
- [ ] `mission_complete` → **Done**; slot freed

**Code:** `docs/` · `ideas/idea-v2.md` · `version.md` · `changelog.md`

---

## Discovery room vs mission room (Web)

| | Discovery `/ideas/:id` | Mission `/missions/:id` |
|--|------------------------|-------------------------|
| Purpose | Explore + produce packages | Execute approved mission |
| Tabs | Scratch · Draft missions · Outbox · Terminal · **Approve** | Brief · Checkpoint · Events · Outbox · Terminal |
| Attach | Discovery team lead | PO |

Separate pages — do not reuse mission room layout with a `kind` flag only.

---

## Execution PO — requirements escalation (playbook)

When mission team evaluator finds unclear requirements:

1. Report to **PO team lead** (Task return / team coordination)
2. PO decides: clarify within team **or** escalate to guild master via outbox
3. **Do not** unilaterally edit frozen `mission-brief.md` or redefine scope in `memory.md` without guild master when brief is ambiguous

Clarifying requirements is **encouraged**; silent assumptions are not.

---

## API draft (Plan 3)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/ideas` | `{ text, slug? }` → create `ideas/{ideaId}/scratch.md` |
| `GET` | `/ideas` | List ideas on board |
| `GET` | `/ideas/:id` | Idea summary + discovery checkpoint |
| `GET` | `/ideas/:id/drafts` | List/preview `artifacts/missions/*` |
| `POST` | `/discoveries/:id/approve` | Copy to parking; close discovery; remove from board |
| `POST` | `/discoveries/:id/signals` | Discovery phase transitions |
| `POST` | `/bell` | **`orchestratorTick()`** (discovery + execution) |
| `GET` | `/board` | Six stages (+ archive optional in JSON, UI ignores) |
| `POST` | `/board/parking/:folder/promote` | Move one folder → `queued/` |
| `GET` | `/discoveries/:id/session` | Attach info for discovery lead |
| `WS` | `/ws/discoveries/:id/attach` | PTY attach to discovery lead |

Existing mission routes remain under `/missions/:id/*` for **working** missions.

---

## Suggested Cursor workflow

One session **per phase**; open this plan + `idea-v2.md` as context.

After each phase: run **Acceptance** checklist before next phase; tick `[ ]` → `[x]` in this doc.

---

## References

- [idea-v2.md](./idea-v2.md) — design spec (update as-built after Plan 3)
- [backlog.md](./backlog.md) — deferred items
- [guild-house/docs/mission-schema.md](../guild-house/docs/mission-schema.md) — mission.md format for discovery output
- [guild-house/docs/wsl-handoff-phase5-terminal.md](../guild-house/docs/wsl-handoff-phase5-terminal.md) — PO + discovery terminal attach UX
- Plan 1 · Plan 2 — baseline 0.1.0

**Next after Plan 3:** long-term backlog (inbox nudge, timeout, SSE, archive browser, batch promote).

**Immediate next (historical — plans complete):**

1. ~~Plan 3 Phase 6~~ — done (`working`/`done` column semantics + promote parking → queued)
2. ~~Plan 3 Phase 7~~ — done (periodic tick + guild-desk parity)
3. ~~Plan 2 Phase 6~~ — done; optional extras in [backlog](../backlog.md)

**Current:** see [guild-house/specs/product.md](../../guild-house/specs/product.md) and [backlog.md](../backlog.md).
