# Guild 0.4.0 — Design specification

Living design for **0.4.0**: fuse discovery and execution under one **Mission** runtime, while **mission board notes** move across the Kanban (`mission-board/`). When implementation diverges, update this file and `guild-house/specs/product.md` in the same change.

**Alignment date:** 2026-07-05 (updated: domain language + two-layer model)

---

## 1. Goals

### 1.1 Problem (0.3.0 as-built)

Guild expresses one pipeline through **parallel structures and vocabulary**:

| Layer | Discovery (“idea”) | Execution |
|-------|-------------------|-----------|
| Board | `scratch.md` on ideas-backlog / ideas / discovering | `mission.md` on parking / queued / working / … |
| Room | `discovery-rooms/{id}/` | `mission-rooms/{id}/` |
| Checkpoint | `DiscoveryPhase` | `MissionPhase` |
| Session | intake-lead | PO + squad |
| API | `/ideas`, `/discoveries/:id/*` | `/missions/:id/*` |
| Product language | “idea”, “discovery” | “mission” |

The **mission-board** column pipeline is already unified; runtime duplicates types, paths, checkpoint parsers, scaffolds, and tick pipelines. Domain language mixes “idea”, “discovery”, and “mission” for the same journey.

### 1.2 Target (0.4.0)

1. **Two layers, stable names** — **mission board notes** on the board (move with columns); **missions** in `mission-rooms/` (agent workspace; path stable by id).
2. **Fuse discovery + execution** — one Mission runtime (one room root, one checkpoint schema, one API); intake and PO are **modes**, not separate entity types.
3. **Keep 0.3.0 board behaviour** — mission board notes **rename** across `mission-board/{stage}/` on promote/pickup/complete; Claude **never** uses board path as cwd.
4. **One brief file on notes** — `mission.md` on mission board notes (replaces `scratch.md` for early stages); frozen copy in mission room at execution pickup.
5. **Discovery approve (Option B)** — spawn child mission board notes to parking; parent (`type: idea_exploring`) → **done**; parent mission archived — parent never enters **working**.
6. **Preserve locked semantics** from 0.3.0 (attach, slots, frozen brief, WS detach, close-out, archive).

### 1.3 Release strategy

- **Product 0.4.0** ships when unified model is implemented and reviewed (see §14 legacy data).
- **Implementation plan** is a separate doc (written after design drill-down).
- API version bumps per dev phase; product `version.md` → **0.4.0** only at final ship.

---

## 2. Domain language (locked)

Use these terms consistently in specs, API docs, UI, playbooks, and guild-desk skill.

### 2.1 Two layers

| Term | What it is | Filesystem | Moves when stage changes? | Claude session cwd? |
|------|------------|------------|---------------------------|---------------------|
| **Mission board note** | Kanban card — intake brief, lineage metadata, board position | `mission-board/{stage}/{id}/` | **Yes** — folder renames across stage columns | **Never** |
| **Mission** | Live agent workspace — checkpoint, squad, artifacts, memory | `mission-rooms/{id}/` | **No** — path stable by id while active | **Yes** |

**Rule:** A **mission board note** is what you see on the Kanban. A **mission** is where agents work. Same `{id}` links them when a room exists.

**Locked:** Unqualified **mission** in API/docs/playbooks means **mission room runtime**, not a board card. Use **mission board note** (or **board note** in UI when context is clear) for the Kanban entry.

### 2.2 Glossary

| Term | Meaning |
|------|---------|
| **Mission board note** | Folder under `mission-board/{stage}/{noteId}/`. Contains `mission.md` + `meta.yaml` (with `type`). Orchestrator **renames** the folder when the board note changes stage. |
| **Mission** | Folder under `mission-rooms/{noteId}/` (or `mission-rooms/archive/{noteId}/` when terminal). Holds `checkpoint.yaml`, agents, artifacts. Session `cwd` points here only. |
| **Board note ID** | Minted `{slug}-{YYYYMMDD}-{6hex}` (legacy `idea-…` accepted). Shared with linked mission when a room exists. |
| **Stage** | Board column for a mission board note: `ideas-backlog` … `archive`. |
| **Phase** | Fine-grained state in `mission-rooms/{id}/checkpoint.yaml` (while room exists). |
| **`meta.type`** | Board note pipeline: `idea_exploring` \| `work_execution` — set at mint, immutable (§4.3). |
| **Mode** | Room agent context while session runs: intake vs execution — aligns with `meta.type` when room exists. |
| **Parent board note** | `idea_exploring` note that finished discovering; lands on **done**. |
| **Child board note** | Mission board note spawned at approve under **parking**; `meta.yaml` → `parent_id`. |
| **Mission plan complete** | Parent board note on **done** with phase `mission_plan_complete` — **not** PO `mission_complete`. |

### 2.3 Retired product terms

| Retired | Use instead |
|---------|-------------|
| idea | mission board note (early stage) or submit a **board note** |
| discovery room | **mission** in `intake` mode |
| discovery entity / idea id | **board note id** (same id format as mission) |
| mission-board “reference only” | **mission board note** (full Kanban entity, not a pointer) |

API path `/missions/:id` refers to the **mission** (room runtime). List/filter endpoints expose **mission board notes** by `stage`. Detail may combine board note + mission when room exists.

### 2.4 What we are **not** doing

- **Not** collapsing mission board notes into mission-rooms (board path ≠ cwd).
- **Not** Option A handoff (parent board note continues as execution; extras spawn).
- **Not** keeping `discovery-rooms/` as a separate root (intake uses `mission-rooms/`).
- **Not** breaking filesystem-first, orchestrator-writer checkpoint, or GET-never-spawns.

---

## 3. Two-layer architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  mission-board/{stage}/{id}/     MISSION NOTE (moves)       │
│    mission.md  meta.yaml                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ same id when room active
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  mission-rooms/{id}/             MISSION (stable path)      │
│    checkpoint.yaml  members/  memories/  artifacts/ …     │
│    ← Claude --bg cwd                                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Workspace stability (locked invariant)

1. Claude session `cwd` is **always** `mission-rooms/{id}/`, never `mission-board/…/`.
2. Stage changes only **rename** the mission board note folder under `mission-board/`.
3. `mission-rooms/{id}/` is not renamed when the note moves `working` → `done`; only **archive** moves `mission-rooms/{id}/` → `mission-rooms/archive/{id}/` **after** session stop.
4. `checkpoint.claude_session.cwd` is informational; spawn/restore resolves `missionRoomPath(id)`.
5. No migration or archive of a mission folder while it has a live session.

### 3.2 Lifecycle — one pipeline, two layers

```text
mission board note:  ideas-backlog → ideas → discovering → [approve] → parking → queued → working → done → archive
         (abort)     ↑_______________ any of these stages _______________↑  → aborted
                                    ↓
                         parent board note → done (mission_plan_complete)
                         child board notes → parking (spawned)

mission:       [none] … [none] … intake room … archive   [none] … [none] … execution room … archive
```

**Abort:** guild master may move a board note to **`aborted/`** from any of `ideas-backlog`, `ideas`, `discovering`, `parking`, `queued`, or `working` (not from `done` or `archive`). Stop live session and archive room when a mission exists.

**Web UI:** show columns through **`done`** only; **`aborted`** and **`archive`** exist on disk and in API but are **not** Kanban columns in 0.4.0 UI.

**Mode** derived from note stage:

| Note stage | Mission room? | Mode | Session |
|------------|---------------|------|---------|
| ideas-backlog, ideas | No | — | — |
| discovering | Yes | intake | intake-lead `--bg` |
| parking, queued | No | — | — |
| working | Yes | execution | PO `--bg` |
| done (`idea_exploring`) | Archived | — | — |
| done (`work_execution`) / aborted | Archived | — | — |

---

## 4. Mission board notes

### 4.1 Pipeline (unchanged columns)

Same Kanban as 0.3.0. Each folder is a **mission board note**.

```text
data/mission-board/
  ideas-backlog/{noteId}/
  ideas/{noteId}/
  discovering/{noteId}/
  parking/{noteId}/
  queued/{noteId}/
  working/{noteId}/
  done/{noteId}/
  aborted/{noteId}/
  archive/{noteId}/
```

Stage transitions use **`rename`** of the note folder (promote, tick pickup, complete, archive, abort) — same as 0.3.0.

**Happy path:** `ideas-backlog` → `ideas` → `discovering` → `parking` → `queued` → `working` → `done` → `archive`.

**Abort:** from `ideas-backlog` | `ideas` | `discovering` | `parking` | `queued` | `working` → `aborted` → `archive` (manual).

**Approve (Option B):** parent `discovering` → `done`; children → `parking` (skip parent `parking`/`queued`/`working`).

**Filesystem:** `aborted/` and `archive/` under `mission-board/` are real stages. **Web UI 0.4.0:** Kanban shows through **`done`** only; aborted/archive via API or guild-desk, not board columns.

### 4.2 Note folder shape

```text
mission-board/{stage}/{noteId}/
  mission.md          # brief on the note — see §5
  meta.yaml           # board-note metadata — see §4.3
```

### 4.3 `meta.yaml` (board note metadata)

**Purpose:** Data that belongs to the **Kanban card**, not the mission room. Survives after the mission room is archived; lets list/detail APIs classify a note **without** opening `mission-rooms/archive/…/checkpoint.yaml`.

**Who writes:** orchestrator only (submit, spawn, promote, approve, complete, abort, archive). Guild master edits **`mission.md`** only.

**When required:**

| Situation | `meta.yaml` |
|-----------|-------------|
| Guild master `POST /ideas` submit | **Required** — orchestrator writes `type: idea_exploring`, `note_id`, `origin: submitted`, `created_at`, `slug` |
| Child spawned at approve | **Required** — `type: work_execution`, `parent_id`, `origin: spawned`, `spawned_from_draft` |
| Legacy queued drop (skip discovery) | **Required** — `type: work_execution`, `origin: submitted` |
| Note enters `done` or `aborted` | Set `completed_at` (type unchanged) |

**Schema (locked):**

```yaml
note_id: "my-feature-20260705-a1b2c3"   # same as folder id
type: idea_exploring                    # idea_exploring | work_execution — immutable after mint
slug: "my-feature"
origin: submitted                       # submitted | spawned
parent_id: null
spawned_from_draft: null
created_at: "2026-07-05T09:00:00.000Z"
completed_at: null                      # ISO when note → done/ or aborted/
```

**`type` — what and why (first principle)**

The system has two **pipelines**, not two **completion kinds**:

| `type` | Pipeline | Typical stages | Mission room mode (when room exists) |
|--------|----------|----------------|--------------------------------------|
| `idea_exploring` | Intake / discovery | `ideas-backlog` → `ideas` → `discovering` → (`done` after approve) | intake |
| `work_execution` | Execution | `parking` → `queued` → `working` → `done` (or legacy `queued` drop) | execution |

Set **once at board note creation**; **never changes** when the note moves columns. Parent approve does **not** convert parent to `work_execution` — parent stays `idea_exploring` on `done`. Children are minted as `work_execution` on `parking`.

**Replaces `completion_kind`:** terminal UI labels are **derived** from `type` + `stage` (+ `checkpoint.phase` while room is live):

| `type` | `stage` | Card / list label |
|--------|---------|-------------------|
| `idea_exploring` | `discovering` | Intake phase pill from checkpoint |
| `idea_exploring` | `done` | Mission plan complete |
| `work_execution` | `working` | Execution phase pill from checkpoint |
| `work_execution` | `done` | Mission complete |
| either | `aborted` | Aborted |

`GET /mission-board-notes` and Web UI **Done** column read **`meta.type`** (not archived checkpoint) to pick the label. `completed_at` is audit only.

**Naming:** product/docs may say *idea exploring* / *work execution*; YAML uses **`idea_exploring`** / **`work_execution`** (snake_case).

**Lineage:** `parent_id` on spawned `work_execution` notes; mirrored in child mission `checkpoint.yaml` at execution pickup (D2).

ID minting: `{slug}-{YYYYMMDD}-{6hex}` for all notes. Default slug `idea` for rough submit is fine; legacy `idea-…` ids accepted when reading old folders.

---

## 5. Brief (`mission.md` on mission board notes)

**Locked:** Single filename `mission.md` on mission board notes (replaces `scratch.md`).

| Note stage | `mission.md` | Who writes |
|------------|--------------|------------|
| ideas-backlog, ideas | Free text; frontmatter optional | Guild master |
| discovering | Same; frozen into mission at intake pickup | Guild master; lead via outbox |
| parking, queued | Full [mission-schema.md](../../guild-house/specs/mission-schema.md) | Spawned from draft or guild master |
| working+ | Note copy may remain | Orchestrator freezes into mission at pickup |

### 5.1 Frozen brief (`mission-brief.md` in mission room)

**Locked:** Intake **and** execution use the same frozen filename at **mission room root**: `mission-brief.md` (orchestrator write; agents read-only).

**Intake** — on note `ideas` → `discovering` pickup (bell):

- Scaffold intake **mission** at `mission-rooms/{id}/`
- Copy board note `mission.md` → `mission-rooms/{id}/mission-brief.md`

**Execution** — on note `queued` → `working` pickup:

- Rename note folder → `mission-board/working/{id}/`
- Scaffold execution **mission** at `mission-rooms/{id}/`
- Copy board note `mission.md` → `mission-rooms/{id}/mission-brief.md`

Living execution truth remains `memories/common/memory.md`. Board note `mission.md` may stay on the card as a snapshot.

### 5.2 Validation gates

| Transition | Validate |
|------------|----------|
| Submit note | Non-empty `mission.md` body |
| Promote backlog → ideas | Non-empty body |
| Approve discovering | ≥1 `artifacts/missions/*/mission.md` in parent **mission** |
| Promote parking → queued | Full `mission.md` frontmatter on child board note |
| Pickup queued → working | `mission.md` on queued note |

---

## 6. Missions (`mission-rooms/`)

### 6.1 Room layout (0.4.0 — locked)

**Locked:** Remove `discovery-rooms/` and **retire `.guild/`**. Use `mission-management/` and `comm/` instead.

Intake and execution both use `mission-rooms/{id}/`. Terminal missions → `mission-rooms/archive/{id}/`.

**Execution mission** (full layout):

```text
mission-rooms/{noteId}/
├── CLAUDE.md                     # room agent index — cwd, layout, who reads what
├── checkpoint.yaml               # orchestrator only
├── squad.md                      # PO charter
├── mission-brief.md              # frozen copy from note; orchestrator write
│
├── mission-management/           # lead guidance (orchestrator scaffold)
│   ├── handoff-prompt.md
│   ├── mission-schema.md
│   ├── skills-bank.md            # how to wire from catalog (template)
│   └── artifact-release.md       # execution only
│
├── comm/                         # guild master ↔ team + channel
│   ├── inbox.md
│   ├── outbox.jsonl
│   └── channel-endpoint.json     # execution only
│
├── memories/common/memory.md
├── memories/common/events.jsonl
├── memories/members/{role}/memory.md
├── members/{role}/agent.md
├── artifacts/
├── retrospective/
├── tools/
└── .claude/
```

**Intake mission** — same skeleton except: no `squad.md`, `artifact-release.md`, `retrospective/`, or `channel-endpoint.json`; `artifacts/missions/` for draft packages; `members/intake-lead/` only.

### 6.1.1 Folder placement rules

| Location | Rule |
|----------|------|
| **Root** | `checkpoint.yaml`, `squad.md`, `mission-brief.md`, `CLAUDE.md` |
| **`mission-management/`** | Orchestrator-scaffolded lead guidance; handoff, schema, release plan |
| **`comm/`** | inbox, outbox, channel-endpoint |
| **`memories/`** | Agent-written runtime truth (not frozen brief) |
| **`.claude/`** | Claude Code harness only |

**Why no `.guild/`:** Too ambiguous. `mission-management/` + `comm/` name purpose explicitly.

### 6.1.2 Who reads what

| File | Primary reader | Squad members? |
|------|----------------|----------------|
| `CLAUDE.md` | Any agent | **Yes** — room entry map |
| `mission-brief.md` | PO, evaluator, QA | Dev: usually via `memory.md` + PO task; may read for criteria |
| `squad.md` | PO | **Yes** — all members |
| `mission-management/handoff-prompt.md` | **Lead only** (PO / intake-lead) | **No** |
| `mission-management/mission-schema.md` | Lead (+ intake for packages) | **No** unless PO assigns |
| `mission-management/artifact-release.md` | **PO** | Optional (e.g. senior-dev on deploy) |
| `comm/inbox.md` | **Lead** | **No** — PO relays via Task |
| `comm/outbox.jsonl` | Lead; guild master UI | Members don't read |
| `comm/channel-endpoint.json` | Orchestrator | Agents ignore |
| `memories/common/memory.md` | PO | **Yes** — all members |

**Summary:** `mission-management/*` is **lead-first**. Members: `CLAUDE.md` → `squad.md` → `memory.md` → role playbook; evaluator/QA also read `mission-brief.md`.

### 6.1.3 `CLAUDE.md` (room root)

Orchestrator writes on scaffold. Entry doc: mode, layout pointers, lead vs member read order. Spawn prompts: “Read `CLAUDE.md` first” (replaces “Read `.guild/handoff-prompt.md`”).

### 6.2 When missions exist

| Event | Mission board note | Mission (room) |
|-------|--------------|----------------|
| ideas → discovering | rename → `discovering/` | scaffold **intake**; spawn lead |
| approve discovering | parent → `done/`; children → `parking/` | archive parent mission |
| parking → queued | rename | none |
| queued → working | rename → `working/` | scaffold **execution**; spawn PO |
| execution complete / abort | rename → `done/` or `aborted/` | stop session; archive mission |
| archive note | rename → `archive/` | idempotent archive if not already |

**Locked:** Intake mission is **not** upgraded in place to execution. Approve archives intake mission; execution scaffolds fresh at working pickup (new mission folder, same id as child board note).

### 6.3 Templates

| Mode | Template (interim name) |
|------|-------------------------|
| intake | `templates/discovery-room` → `templates/mission-intake` |
| execution | `templates/mission-room` → `templates/mission-execution` |

Both scaffold under `mission-rooms/{id}/`.

### 6.4 Intake vs execution mission (locked)

Discovery and execution are **two separate mission modes** — same room root and checkpoint schema, but different templates, sessions, phases, and deliverables. They do **not** share one long-lived room (intake archives before execution scaffolds on a child board note id).

| Dimension | Intake mission (note on **discovering**) | Execution mission (note on **working**) |
|-----------|------------------------------------------|----------------------------------------|
| **Team** | **Lightweight** — intake-lead bg session; optional `Task` subagents; no `squad.md` | **Full squad** — PO bg session + evaluator + dev/qa per `squad.md` (0.3.0) |
| **Bg session** | intake-lead `--bg` | PO `--bg` |
| **Primary deliverable** | Draft packages under `artifacts/missions/*/mission.md` | Artifacts in room + close-out per brief |
| **Release phase** | **None** — no `artifact-release.md`, no `releasing` phase | **Yes** — 0.3.0 path: approve artifacts → `releasing` → … |
| **Spawn** | On approve → child **mission board notes** on parking (Option B) | N/A (is the spawned execution) |
| **Retrospective** | **None in 0.4.0** — ends at `mission_plan_complete` | **Yes** — `retrospective/` + `mission_complete` (0.3.0) |
| **End** | Approve → archive intake mission; parent board note → done | `mission_complete` → archive execution mission; board note → done |

**Retrospective (deferred):** Discovery *could* gain a lightweight retrospective later (e.g. intake summary before approve). **Not in 0.4.0 scope** — keep intake simple; revisit in a follow-up if guild master wants discovery learnings captured formally.

### 6.5 Skills bank (singleton — locked)

**Source of truth:** `guild-house/data/skills-bank/` only — committed in repo (`data/*` gitignore except `skills-bank/`).

- **No** `templates/skills-bank/` — removed; boot only `mkdir` if missing.
- PO / intake-lead Round 0: read `data/skills-bank/catalog.md` (pick skills), then `mission-management/skills-bank.md` (wire procedure), then `wire-skills-from-bank/wire.sh`.
- Guild master curates bank manually (from retro `skills-reports/` proposals); `GET /skills-bank` read-only.

---

## 7. Checkpoint & phases

### 7.1 Unified checkpoint (in mission only)

Orchestrator-only writer at `mission-rooms/{id}/checkpoint.yaml`:

```yaml
mission_id: "..."               # same as note id
note_stage: discovering         # mirrored from mission board note on sync
phase: mission_planning
parent_id: null                 # mirror meta.yaml when spawned child
claude_session: { ... }
round: 0
awaiting_guild_master: false
inbox_pending: false
picked_up_at: "..."
last_signal: { ... }
```

**`phase` values:** lowercase **snake_case** only (see §7.2). No `SCREAMING_SNAKE` in YAML.

Mission board notes do **not** have `checkpoint.yaml` — only missions do.

### 7.2 Phase enum (locked — 0.4.0)

Phases live in `checkpoint.yaml` only (when a mission room exists). Parking/queued board notes have **no** phase.

#### Intake segment (board note on **discovering**)

| `phase` | Meaning | Typical trigger |
|---------|---------|-----------------|
| `idea_exploring` | Clarify scope; questions to guild master | Bell pickup → intake scaffold |
| `mission_planning` | Write draft packages under `artifacts/missions/` | Signal `start_drafting` |
| `mission_plan_presenting` | Packages ready for guild master preview | Signal `packages_ready` |
| `mission_plan_awaiting_approval` | Waiting on guild master approve | Signal `request_approval`; `awaiting_guild_master: true` |
| `mission_plan_complete` | Intake finished; parent on **done** after approve | `POST …/approve-discovery`; archive intake room |

Flow: `idea_exploring` → `mission_planning` → `mission_plan_presenting` → (`mission_plan_awaiting_approval`) → `mission_plan_complete`.

Intake has **no** `releasing` or `retrospective` phases.

#### Execution segment (board note on **working**)

| `phase` | Meaning | PO session | Boot auto-restore? |
|---------|---------|------------|-------------------|
| `evaluating` | Post-pickup planning; read brief, squad, handoff | live | yes |
| `working` | Active development rounds | live | yes |
| `blocked` | Stuck; awaiting guild master (escalation, reject, etc.) | live (idle) | yes |
| `paused` | Guild master intentional pause (`POST …/pause`) | **stopped** | **no** |
| `awaiting_artifact_review` | Deliverables ready for guild master review | live | yes |
| `releasing` | Guild master approved artifacts; PO runs `artifact-release.md` | live | yes |
| `retrospective` | Close-out retrospective aggregation | live | yes |
| `done` | `mission_complete`; success terminal | stopped | no |
| `aborted` | Guild master abort; failure terminal | stopped | no |

Typical happy path:

```text
evaluating → working ⇄ blocked
  → awaiting_artifact_review
  → releasing → retrospective → done
```

`paused` is **separate from** `blocked` — do not merge (boot restore and session stop differ).

**Retired 0.3.0 phase names** (migration maps): `exploring`→`idea_exploring`, `drafting`→`mission_planning`, `presenting`→`mission_plan_presenting`, `awaiting_approval`→`mission_plan_awaiting_approval`, `discovery_complete`/`closed`→`mission_plan_complete`, `running`→`working`. Drop unused `artifacts_approved`.

Child board notes on parking/queued have **no mission** and no checkpoint until working pickup (execution starts at `evaluating`).

### 7.3 Signals

`POST /missions/:id/signals` — allowlist by mode:

| Mode | Types |
|------|-------|
| intake | `start_drafting`, `packages_ready`, `request_approval`, `awaiting_input` |
| execution | `round_complete`, `artifacts_ready_for_review`, …, `mission_complete` |

Signal **names** stay as in 0.3.0; orchestrator maps them to §7.2 phases (e.g. `start_drafting` → `mission_planning`; `round_complete` → `working`).

---

## 8. Approve discovering — Option B (locked)

When guild master approves a note on **discovering**:

```text
1. Validate ≥1 artifacts/missions/{draft}/mission.md in parent mission
2. For EACH valid draft:
     - mint child board note id
     - copy draft → mission-board/parking/{child_id}/mission.md + meta.yaml (`type: work_execution`, `parent_id`, `origin: spawned`, …)
3. Parent mission board note: discovering → done (`type` stays `idea_exploring`; set `completed_at`)
4. Parent mission: stop intake-lead; archive mission-rooms/{parent_id}/
5. Parent does NOT enter working; does NOT consume execution slot
```

**Locked:** Always spawn child **mission board notes** to parking — even for a single draft.

| Board note on `done` | `meta.type` | UI label |
|----------------|-------------|----------|
| `idea_exploring` | Mission plan complete |
| `work_execution` | Mission complete |

---

## 9. Slots & tick

Unchanged slot rules. Wording: count **missions** (rooms), not board notes.

| Pool | Counts |
|------|--------|
| `MAX_DISCOVERY_SESSIONS` | Board notes on **discovering** with live intake mission |
| `MAX_ACTIVE_MISSIONS` | Board notes on **working** with non-terminal execution mission |

Tick: `ideas` → `discovering` (board note rename + intake mission), then `queued` → `working` (board note rename + execution mission).

---

## 10. API direction (design level)

### 10.1 Two route families (locked)

| Family | Vocabulary | Examples |
|--------|------------|----------|
| **Board note** | Mission board note — position, brief, promote, abort | `POST /ideas`, `GET /mission-board-notes`, `POST /mission-board-notes/:id/abort` |
| **Mission (room)** | Runtime — session, checkpoint, signals, attach | `GET /missions/:id`, `POST /missions/:id/signals` |

**Naming principle:** board position / brief → mission board note docs; session / checkpoint / attach → mission docs.

### 10.2 Canonical routes (0.4.0 target)

| Operation | Canonical route | Notes |
|-----------|-----------------|-------|
| **Submit rough prompt** | **`POST /ideas`** | **Retained permanently.** Creates a mission board note on **`ideas-backlog`** (default) or **`ideas`**. Guild master / Web UI “submit idea” keeps this path; response/docs use **board note** vocabulary. |
| List / filter board notes | `GET /mission-board-notes?stage=…` | Replaces `GET /ideas` list semantics |
| Board note detail | `GET /mission-board-notes/:id` | Replaces `GET /ideas/:id` |
| Mission runtime | `GET /missions/:id` | Unchanged; include linked board note `stage` + **`meta.type`** |
| Approve discovery | `POST /missions/:id/approve-discovery` | Board note must be on **discovering** |
| **Abort board note** | **`POST /mission-board-notes/:id/abort`** | From `ideas-backlog` … `working` (§4.1); see below |
| Board promote | `POST /board/…/promote` | Unchanged paths; docs say “mission board note” |
| Intake / execution session | `/missions/:id/session`, `/ws/missions/:id/attach`, … | Absorb former `/discoveries/:id/*` room operations |

There is **no** `POST /mission-board-notes` requirement for submit — **`POST /ideas` is the dedicated intake entry** for backlog / ideas columns.

**`POST /mission-board-notes/:id/abort` (locked):**

- **Single abort entry** for all pre-terminal board stages (`ideas-backlog` … `working`).
- Optional body: `{ "reason": "…" }`.
- **No mission room:** rename note → `mission-board/aborted/{id}/`; set `meta.completed_at`; set `checkpoint` N/A.
- **Live intake or execution room:** stop session; `checkpoint.phase: aborted`; write `abort-note.md` when execution room has `retrospective/`; archive `mission-rooms/{id}/`; rename board note → `aborted/`; set `meta.completed_at`.
- Frees execution/discovery slot per §9.
- **Supersedes** 0.3.0 `POST /missions/:id/abort` (working-only) — alias during implementation, remove in final API phase (§10.3).

### 10.3 Legacy routes — transitional, then remove

During 0.4.0 implementation, keep **compatibility aliases** so Web UI and guild-desk skill can migrate incrementally:

| Legacy (0.3.0) | Transitional behavior | Remove when |
|----------------|----------------------|-------------|
| `GET /ideas` | Alias → `GET /mission-board-notes` (or equivalent handler) | **Final implementation phase** |
| `GET /ideas/:id`, `GET /ideas/:id/drafts` | Alias to board-note + mission handlers | **Final implementation phase** |
| `/discoveries/:id/*` | Alias to `/missions/:id/*` (intake mode) | **Final implementation phase** |

**Not in removal scope:** **`POST /ideas`** — stays as the submit-rough-prompt API.

**Implementation plan must include a final phase:** update all callers (web, guild-desk skill, docs, E2E scripts) to canonical routes, then **delete** legacy handlers and `/discoveries` router. Bump `GET /health` / changelog when aliases are removed.

### 10.4 Route map (summary)

| 0.3.0 | 0.4.0 canonical | Alias until final phase? |
|-------|-----------------|---------------------------|
| `POST /ideas` | **`POST /ideas`** (keep) | — |
| `GET /ideas` | `GET /mission-board-notes?stage=…` | yes → remove |
| `GET /ideas/:id` | `GET /mission-board-notes/:id` | yes → remove |
| `POST /discoveries/:id/approve` | `POST /missions/:id/approve-discovery` | yes → remove |
| `/discoveries/:id/*` | `/missions/:id/*` | yes → remove |
| `GET /missions/:id` | `GET /missions/:id` | — |
| `POST /missions/:id/abort` | `POST /mission-board-notes/:id/abort` | yes → remove |
| Board promote | unchanged | — |

---

## 11. Guild master workflow

```text
1. Submit mission board note → ideas-backlog | ideas
2. Promote board note → ideas
3. Bell → board note to discovering; intake mission spawned
4. Approve → child board notes to parking; parent board note to done
5. Promote child board note parking → queued
6. Bell → board note to working; execution mission spawned
7. Close-out → mission_complete → board note to done
8. Archive board note (and mission if not already archived)
```

Legacy: drop `mission.md` on **queued** board note → bell (skip discovery).

---

## 12. Design decisions (locked)

| # | Decision |
|---|----------|
| D1 | `events.jsonl` at `memories/common/events.jsonl`; types validated by mode |
| D2 | Lineage in note `meta.yaml`; `parent_id` mirrored in mission checkpoint |
| D3 | Unified id mint `{slug}-{date}-{hex}`; keep `idea` as default slug |
| D4 | Fix room archive path to `mission-rooms/archive/` (was `achive`); resolver reads both during transition |
| D5 | Discovering hall = filter notes where `stage=discovering` |
| D6 | Parent discovery board note on done: manual archive only |
| D7 | Child board note card title from draft `mission.md` frontmatter `title` |
| D8 | Defer REST pagination |
| D9 | Update guild-desk skill same release; **legacy GET /ideas + /discoveries/* aliases** during migration |
| D10 | **No legacy data migration** — 0.4.0 does not backfill or rewrite existing `data/`; dev may start fresh; runtime may **read** legacy paths during transition (D4) but no migration script required |
| D11 | **Two mission modes** — intake (lightweight) and execution (full squad); separate scaffolds/sessions; no in-place upgrade |
| D12 | **Release** — intake spawns child board notes only; execution has 0.3.0 release phase |
| D13 | **Retrospective** — execution only in 0.4.0; discovery retro deferred |
| D14 | **Room layout** — `mission-brief.md` + `checkpoint.yaml` + `squad.md` at root; retire `.guild/` |
| D15 | **`mission-management/`** — handoff, mission-schema, artifact-release (execution) |
| D16 | **`comm/`** — inbox, outbox, channel-endpoint |
| D17 | **`CLAUDE.md`** at room root — agent entry index |
| D18 | **Skills bank** — singleton `data/skills-bank/` only; no `templates/skills-bank` seed |
| D19 | **Mission board note** — Kanban card term; unqualified **mission** = room runtime only |
| D20 | **`POST /ideas` retained** — submit rough prompt → board note on `ideas-backlog` \| `ideas`; not deprecated |
| D21 | **Legacy route removal** — `GET /ideas*`, `/discoveries/*` aliases only during implementation; **final phase removes** them after callers migrate |
| D22 | **Phase enum (0.4.0)** — intake: `idea_exploring` … `mission_plan_complete`; execution: `evaluating` … `done` \| `aborted`; **`paused` separate from `blocked`**; lowercase snake in `checkpoint.yaml` |
| D23 | **Board abort** — from `ideas-backlog` through `working` → `aborted`; UI Kanban hides `aborted` and `archive` columns |
| D24 | **No semantic backfill** — pre-0.4.0 data is **not** reconstructed (no synthetic `done/{parentId}`). **Cutover:** move legacy board notes and rooms into **`archive/`** as-is (optional one-shot housekeeping); new flows only use 0.4.0 layout |
| D25 | **`mission-brief.md`** at mission room root for **both** intake and execution pickup |
| D26 | **`meta.type`** — `idea_exploring` \| `work_execution` on board note at mint; immutable; terminal labels = `type` + `stage` (no `completion_kind`) |
| D27 | **Abort** — `POST /mission-board-notes/:id/abort` for all pre-terminal stages; supersedes `POST /missions/:id/abort` |

---

## 13. Locked semantics (0.3.0 carry-forward)

1. Attach → live `--bg` job at `mission-rooms/{id}/`.
2. `ensureLive` / WS restore before attach.
3. WS close = detach only.
4. `checkpoint.yaml` orchestrator-only.
5. Frozen `mission-brief.md` (room root) PO read-only.
6. `mission_complete` only from `retrospective` phase.
7. `paused` — no boot auto-restore; distinct from `blocked`.
8. Archive board note from done/aborted; mission → `mission-rooms/archive/`.
9. GET never spawns.
10. Filesystem-first.

---

## 14. Legacy data (outline)

**Locked (D10, D24):** No migration script that rewrites semantics (phases, parent on `done`, `scratch`→`mission.md`, `discovery-rooms` merge, etc.).

**Cutover policy for existing `data/`:**

- **Optional one-shot:** move all pre-0.4.0 board folders → `mission-board/archive/{id}/`, stale rooms → `mission-rooms/archive/{id}/` (resolver may still read `achive/` during transition per D4).
- **No backfill** — do not synthesize missing parents or fix old approve shapes.
- **Forward only** — new submits and bell flows use 0.4.0 paths, `meta.yaml`, phases, and Option B.

**Implementation still ships:**

1. New scaffolds and orchestrator logic for **new** notes/missions.
2. **Read compatibility** where cheap (legacy ids, `achive` path) — not a data rewrite job.
3. Update `guild-house/specs/product.md`, `docs/api.md`, E2E for 0.4.0 forward paths.
4. **API:** migrate **callers** off `GET /ideas*`, `/discoveries/*`; remove legacy handlers (§10.3). **`POST /ideas` stays.**

---

## 15. Success criteria

- [ ] Docs and UI consistently use **mission board note** vs **mission**.
- [ ] No `discovery-rooms/` root; intake uses `mission-rooms/`.
- [ ] Note stage renames never change mission `cwd` while session is live.
- [ ] Unified checkpoint + signals; no `types/discovery.ts` entity split.
- [ ] Approve spawns N child board notes (`work_execution`); parent (`idea_exploring`) on `done`.
- [ ] E2E discovery + execution-only queued paths pass.
- [ ] No `GET /ideas` or `/discoveries/*` handlers remain after final API cleanup phase (`POST /ideas` excepted).

---

## 16. References

- [guild-house/specs/product.md](../../guild-house/specs/product.md) — 0.3.0 as-built
- [guild-house/specs/mission-schema.md](../../guild-house/specs/mission-schema.md)
- [guild-house/specs/session-lifecycle.md](../../guild-house/specs/session-lifecycle.md) — cwd / worktree
- [guild-house/docs/e2e-discovery-path.md](../../guild-house/docs/e2e-discovery-path.md)
- [ideas/0.3.0/design.md](../0.3.0/design.md)
