# Guild 0.4.0 — Implementation checklist

Phased delivery for [design.md](./design.md). **No legacy data migration** — archive pre-0.4.0 `data/` and use forward-only flows.

**Baseline:** product 0.3.0 · API 0.23.0  
**Target:** product 0.4.0 · API 0.30.0 (final)

**Status (2026-07-05):** **Shipped** — product **0.4.0** / API **0.30.0**. Phases **0–11** complete except optional manual cutover housekeeping.

Legend: `[x]` done · `[ ]` not done · `[~]` partial

---

## Cutover (before dev testing)

Optional one-shot housekeeping (manual or script):

```bash
# From guild-house/data/ — move stale board notes and rooms to archive as-is
# No semantic backfill; do not rewrite scratch→mission.md or phases.
```

- [ ] Manual archive of pre-0.4.0 board notes → `mission-board/archive/`
- [ ] Manual archive of stale rooms → `mission-rooms/archive/`
- [x] New submits, bell, approve, execution use 0.4.0 layout only (forward paths)

**API:** no bump

---

## Phase 1 — Foundation

**API:** `0.24.0` · **Status:** done

- [x] Unified note id — `server/src/orchestrator/core/note-id.ts` (`{slug}-{date}-{hex}`)
- [x] Board note meta — `types/board-note.ts`, `core/board-note-meta.ts` (`meta.yaml`)
- [x] Paths — `server/src/paths.ts` (`meta.yaml`, `mission-brief.md`, `comm/`, `mission-rooms/archive/` + `achive/` read)
- [x] Unified phases — `types/mission.ts` (`MissionPhase`, `Checkpoint` + `note_stage`, `parent_id`, `mode`)
- [x] Boot layout — `ensureDataLayout` mkdirs `mission-board/*`, `mission-rooms/archive/` (no `discovery-rooms/` boot)

---

## Phase 2 — Templates

**API:** `0.25.0` · **Status:** done (minor layout debt acceptable)

- [x] `templates/mission-intake/` (from discovery-room)
- [x] `templates/mission-execution/` (from mission-room)
- [x] Root `CLAUDE.md` on both templates
- [~] `mission-management/` — present; intake still has legacy `.guild/handoff-prompt.md`
- [~] `comm/` — runtime scaffold writes `comm/outbox.jsonl`; template trees still have root `inbox.md` / `outbox.jsonl`
- [x] Intake template — no `squad.md`, `retrospective/`, `artifact-release.md`
- [~] Execution — `artifact-release.md` at template root (design: under `mission-management/`)
- [x] Both modes — `memories/common/events.jsonl` in templates
- [x] Retire legacy `templates/discovery-room/`, `templates/mission-room/`

---

## Phase 3 — Board notes

**API:** `0.26.0` · **Status:** done

- [x] Brief filename — `mission.md` on new board notes
- [x] Submit — `POST /ideas` writes `mission.md` + `meta.yaml` (`type: idea_exploring`, `origin: submitted`)
- [x] Promote backlog — validates non-empty `mission.md`
- [x] Legacy read — `scratch.md` fallback when `mission.md` missing
- [x] Spawned children — `meta.yaml` on approve (`type: work_execution`, `parent_id`, `spawned_from_draft`)

---

## Phase 4 — Intake in mission-rooms

**API:** `0.27.0` · **Status:** done

- [x] Room root — intake scaffolds `mission-rooms/{id}/` via `mission-intake` template
- [x] Pickup — `ideas` → `discovering`: rename note, scaffold intake, copy brief → `mission-brief.md`, spawn lead
- [x] Session name — `mission-{id}-lead` (`intakeLeadSessionName`)
- [x] No new `discovery-rooms/` writes
- [x] Resolver read compat — `room-achive.ts` still reads legacy `discovery-rooms/` paths

---

## Phase 5 — Unified checkpoint & signals

**API:** `0.28.0` · **Status:** done

- [x] Intake phases — `idea_exploring` … `mission_plan_complete`
- [x] Execution phases — `evaluating`, `working`, … (not `running`)
- [x] Legacy phase aliases on read (`normalizePhase` in `types/mission.ts`)
- [x] Mode-aware signals on `POST /missions/:id/signals`
- [x] Drop `artifacts_approved` as a stored phase (maps to `releasing` on read)

---

## Phase 6 — Approve Option B

**API:** `0.29.0` · **Status:** done

- [x] `POST /missions/:id/approve-discovery` — parent → `done/`; children → `parking/`
- [x] Parent stays `type: idea_exploring`; `completed_at` set; intake room archived
- [x] Children minted per draft; `spawned_from_draft` in meta
- [x] Discovering folder moved to `done/` (not deleted — 0.3.0 bug fixed)

---

## Phase 7 — Execution pickup & brief

**API:** `0.29.0` · **Status:** done

- [x] Frozen brief at room root `mission-brief.md`
- [x] Pickup `queued` → `working` — fresh execution scaffold (`mission-execution` template)
- [x] `parent_id` mirrored into checkpoint at pickup
- [x] Promote parking → queued — validates `mission.md` frontmatter

---

## Phase 8 — API canonical + aliases

**Status:** done (aliases removed Phase 11)

**Canonical**

- [x] `GET /mission-board-notes?stage=`
- [x] `GET /mission-board-notes/:id`
- [x] `GET /missions/:id/drafts`
- [x] `POST /missions/:id/approve-discovery`
- [x] `POST /mission-board-notes/:id/abort`
- [x] `POST /ideas` retained — submit board note

**Removed (Phase 11)**

- [x] Remove `GET /ideas`, `GET /ideas/:id`, `GET /ideas/:id/drafts`
- [x] Remove `/discoveries/:id/*` router
- [x] `POST /missions/:id/abort` — still routed (legacy alias to mission abort)
- [x] WS `/ws/discoveries/:id/attach` — aliases to mission handler (same `ensureMissionSessionLive`)

---

## Phase 9 — Abort & archive path

**Status:** done

- [x] Abort — stop session, `phase: aborted`, `abort-note.md` when execution, archive room, note → `aborted/`
- [x] Archive write — `mission-rooms/archive/{id}/` (read `achive/` per D4)
- [x] Done labels — derive from `meta.type` + `stage`

---

## Phase 10 — Web UI & guild-desk

**Status:** done (UI routes still `/ideas/:id` client-side — intentional)

**Web (`guild-house/web/`)**

- [~] Board note vocabulary — routes `/ideas/:id`; copy gradually shifting to intake/mission
- [x] Canonical API client — `mission-board-notes`, `approve-discovery`, `missions/:id/drafts`, `intakeStarted` on bell
- [x] Done column labels from `meta.type` — partial (card layer)
- [x] Kanban through `done` only — **aborted** column removed from board (`board.ts`)
- [x] Terminal — `DiscoveryTerminal` uses `/ws/missions/:id/attach`
- [x] Web types aligned with `intakeStarted` / unified intake phases

**guild-desk**

- [x] guild-master skill — canonical routes in `api-reference.md`, `workflows.md`, `SKILL.md`
- [x] `guild-desk` product version **0.4.0**

---

## Phase 11 — Legacy removal & ship

**Status:** done

- [x] Delete `GET /ideas` list/detail (keep `POST /ideas`)
- [x] Delete `/discoveries/*` handlers + web/desk callers
- [x] Fold/remove redundant discovery route handlers; keep `discovery/drafts.ts`, `session-lifecycle.ts`, `events.ts`
- [x] `specs/product.md` — 0.4.0 as-built
- [x] `docs/api.md` — route index + bell fields + `server/` paths (legacy appendix may still mention Plan 3 prose)
- [x] `version.md` → **0.4.0**
- [x] `GET /health` → **0.30.0**
- [x] `changelog.md` — 0.4.0 entry
- [x] E2E script — `server/scripts/e2e-040.ts`
- [x] Run E2E green (`bun --env-file=../.env scripts/e2e-040.ts`)

---

## Infra (post-plan, done)

Not in original phases; completed during 0.4.0 hardening:

- [x] `server/` + `web/` layout — API under `server/src/`, house root keeps `templates/`, `specs/`, `data/`, `.env`
- [x] `server/CLAUDE.md` agent guide
- [x] Code cleanup — deprecated path aliases removed; `Bun.cron` tick; `Bun.JSONL.parse`
- [x] `GUILD_CHANNEL_PUSH` feature flag — orchestrator HTTP push off by default

---

## Success checklist (design §15)

- [~] Mission board note vs mission vocabulary in docs/UI (client routes still `/ideas/:id`)
- [x] No new `discovery-rooms/`; intake uses `mission-rooms/`
- [x] Note rename does not change mission cwd (stable `mission-rooms/{id}/`)
- [x] Unified checkpoint; no separate discovery entity in runtime
- [x] Approve spawns N children; parent `idea_exploring` on `done`
- [x] E2E discovery + execution-only paths (`e2e-040.ts` green)
- [x] No `GET /ideas` or `/discoveries/*` after Phase 11 (`POST /ideas` excepted)

---

## Dependency graph

```text
Phase 0 (cutover, optional)
  → 1 Foundation          [x]
  → 2 Templates           [x]
  → 3 Board notes         [x]
  → 4 Intake rooms        [x]
  → 5 Checkpoint          [x]
  → 6 Approve B + 7 Exec  [x]
  → 8 API                 [x]
  → 9 Abort/archive       [x]
  → 10 UI/desk            [x]
  → 11 Ship               [x]
```

Phases 6–7 landed together. Phase 11 removed legacy routes after canonical callers migrated.
