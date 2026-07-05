# E2E discovery path (Plan 3 — product 0.2.0)

Full walkthrough: rough idea → discovery → parking → execution → done.

**API version:** `0.16.0` (see `GET /health` → `version`)  
**Product release:** `0.2.0`

Related: [api.md](./api.md) · [tests/execution-e2e.md](./tests/execution-e2e.md) (execution-only via `queued/`)

---

## Pipeline overview

```
POST /ideas → ideas-backlog → [promote] → ideas → [bell/tick] → discovering → [approve] → parking
→ [promote] → queued → [bell/tick] → working → mission_complete → done → [archive]
```

| Stage | Who moves it | How |
|-------|----------------|-----|
| submit → ideas-backlog | Guild master | `POST /ideas` (default `board: "backlog"`) or Web submit → **Add to backlog** |
| ideas-backlog → ideas | Guild master | `POST /board/ideas-backlog/:id/promote` or Web **Promote to Ideas** |
| ideas → discovering | Orchestrator | `POST /bell` or auto-tick |
| discovering → parking | Guild master | `POST /discoveries/:id/approve` or Web UI / `tools/approve.sh` |
| parking → queued | Guild master | `POST /board/parking/:folder/promote` or Web UI **Promote** |
| queued → working | Orchestrator | `POST /bell` or auto-tick |
| working → done | PO | `mission_complete` after 0.3.0 close-out (see [tests/execution-e2e.md](./tests/execution-e2e.md)) |
| done / aborted → archive | Guild master | `POST /missions/:id/archive` or Web UI **Archive** |

---

## Prerequisites

**Terminal 1 — guild-house daemon:**

```bash
cd guild/guild-house
cp .env.example .env   # GUILD_API_KEY, GUILD_MASTER_NAME
bun install
bun run dev
```

**Terminal 2 — API / guild master (or Web UI on :3848):**

```bash
export GUILD_API_KEY=change-me-in-production
export AUTH="Authorization: Bearer $GUILD_API_KEY"
```

Optional: `GUILD_TICK_INTERVAL_MINUTES=5` in `.env` to auto-pickup without manual bell.

**Terminal 3 — attach** (separate from guild-desk): for discovery lead or PO intervention.

---

## 0. Health and board

```bash
curl http://127.0.0.1:3847/health
curl -H "$AUTH" http://127.0.0.1:3847/board
curl -H "$AUTH" http://127.0.0.1:3847/queue
```

Expect eight visible stages in Web UI: Backlog, Ideas, Discovering, Parking, Queued, Working, Done, Aborted.

---

## 1. Submit idea → **Backlog** or **Ideas**

**Web:** Board → **Submit idea** — choose **Add to backlog** (default) or **Add to ideas**.

**API (direct to Ideas column, skip backlog):**

```bash
curl -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"text":"Add guild-master skill workflows for discovery approve and parking promote","slug":"discovery-docs","board":"ideas"}' \
  http://127.0.0.1:3847/ideas
```

Default submit lands on **Backlog**:

```bash
curl -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"text":"Incubate this idea before discovery","slug":"discovery-docs"}' \
  http://127.0.0.1:3847/ideas
```

Note `ideaId` in response. Verify:

```bash
curl -H "$AUTH" http://127.0.0.1:3847/board
# "ideas-backlog": ["discovery-docs-YYYYMMDD-…"]  OR  ideas: […]
```

**Acceptance:** Web or API submit → card on **Backlog** (default) or **Ideas**. Promote backlog → Ideas before ringing the bell.

---

## 1b. Promote backlog → **Ideas** (optional)

Skip if you submitted directly to **Ideas** (`board: "ideas"`).

**Web:** Backlog column → **Promote to Ideas** on card (or open idea detail → **Promote to Ideas**)

**API:**

```bash
curl -X POST -H "$AUTH" \
  http://127.0.0.1:3847/board/ideas-backlog/IDEA_ID/promote
```

**Acceptance:** Idea moves from **Backlog** to **Ideas**; bell will pick it up.

---

## 2. Bell → **Discovering**

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/bell
```

Expect `discoveriesStarted` includes your idea id. Board: idea leaves **ideas**, appears on **discovering**.

**Session:**

```bash
curl -H "$AUTH" "http://127.0.0.1:3847/discoveries/{ideaId}/session?ensureLive=true"
```

When `live: true`, attach in discovery room cwd (or Web UI Idea page → **Terminal** tab).

**Acceptance:** Discovery session live; intake lead runs `templates/discovery-room/` handoff.

---

## 3. Discovery produces mission package(s)

Intake lead writes at least one valid package:

```
discovery-rooms/{ideaId}/artifacts/missions/{folder}/mission.md
```

Check drafts:

```bash
curl -H "$AUTH" http://127.0.0.1:3847/ideas/{ideaId}/drafts
```

Lead signals presentation (`phase: presenting` / `awaiting_approval`) when ready.

**Acceptance:** ≥1 folder under `artifacts/missions/` with `mission.md`.

---

## 4. Approve → **Parking**

**Web:** `/ideas/{id}` → **Approve** when phase allows.

**API (guild master or lead after guild master decides in attach):**

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/discoveries/{ideaId}/approve
```

Expect `parkingFolders` in response (orchestrator-minted ids, not draft folder names). Idea leaves **discovering**; folders appear on **parking**.

**Acceptance:** Mission folder(s) on parking; idea gone from board columns.

---

## 5. Promote → **Queued**

Open the parking package from the board (**click the card** → mission detail), read the **Brief**, then **Promote to queued** (confirm dialog).

**API** (one folder at a time):

```bash
curl -X POST -H "$AUTH" \
  "http://127.0.0.1:3847/board/parking/{parkingFolder}/promote"
```

**Acceptance:** Folder on **Queued**; detail view shows “ring the bell” hint. Promote is **not** on the kanban card (design §13.2).

---

## 6. Bell → **Working** (PO handoff)

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/bell
```

Expect `missionsStarted` with minted mission id. PO session:

```bash
curl -H "$AUTH" "http://127.0.0.1:3847/missions/{missionId}/session?ensureLive=true"
```

PO executes `.guild/handoff-prompt.md` in mission room.

**Acceptance:** Mission on **Working**; PO handoff running.

---

## 7. Complete → **Done**

PO signals when acceptance criteria met:

```bash
# In mission room cwd
./tools/signal.sh mission_complete "QA pass — all criteria met"
```

Or `POST /missions/{id}/signals` with `{ "type": "mission_complete", "summary": "…" }`.

Board folder moves **working/** → **done/**. Execution slot frees (check `GET /queue` → `executionSlots`).

**Acceptance:** Card on **Done** column; slot available for next queued mission.

---

## 8. Archive (optional close)

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/missions/{missionId}/archive
```

Requires mission on **done** board with `phase: done`. Room stays at `mission-rooms/{id}/`.

---

## Plan 3 E2E checklist

| Step | Expected |
|------|----------|
| Submit idea | Card on **Ideas** |
| Bell | **Discovering**; discovery session live |
| Discovery work | ≥1 `artifacts/missions/*/mission.md` |
| Approve | **Parking**; idea off board |
| Promote | **Queued** |
| Bell | **Working**; PO handoff |
| `mission_complete` | **Done**; execution slot freed |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Idea stuck on Ideas | Discovery slots full — `GET /queue` → `queuedDiscovery` |
| Approve 400 | No valid `artifacts/missions/*/mission.md` |
| Promote 404 | Folder name must match `parking` entry exactly |
| Mission stuck on Queued | Execution slots full — `queuedExecution` |
| Archive 404 | Mission must be on **done** board (not working) |
| Legacy `ready/` / `active/` on disk | API merges into `queued` / `working` in responses; rename folders manually (`ready/` → `queued/`, `active/` → `working/`) |
