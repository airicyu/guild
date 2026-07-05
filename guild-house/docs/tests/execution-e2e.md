# Manual test — execution E2E (queued → archive)

Execution-only path without discovery. For full Plan 3 pipeline see [e2e-discovery-path.md](../e2e-discovery-path.md).

**Product:** 0.3.0 (close-out) · **API:** check `GET /health` → `version`

## Prerequisites

```bash
# Terminal 1
cd guild/guild-house && bun run dev

# Terminal 2
export GUILD_API_KEY=change-me-in-production
export AUTH="Authorization: Bearer $GUILD_API_KEY"
```

## 1. Intake on queued

```bash
mkdir -p data/mission-board/queued/hello-world
cp templates/mission-board/mission.md.example data/mission-board/queued/hello-world/mission.md
# edit mission.md
curl -H "$AUTH" http://127.0.0.1:3847/board
curl -H "$AUTH" http://127.0.0.1:3847/queue
```

## 2. Bell → working

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/bell
```

Expect `missionsStarted` with minted id. Board: folder leaves `queued/`, appears on `working/`.

```bash
curl -H "$AUTH" "http://127.0.0.1:3847/missions/{id}/session?ensureLive=true"
```

## 3. PO handoff (manual)

Attach in mission room cwd or Web UI **Terminal** tab. PO completes handoff checklist; produces squad + artifacts per brief.

## 4. Close-out (0.3.0)

After PO handoff and implementation, the squad signals readiness for guild-master review:

```bash
# In mission room
./tools/signal.sh artifacts_ready_for_review "QA pass — ready for guild master"
```

**Web UI:** open mission room → **Approve artifacts** when phase is `awaiting_artifact_review`. PO stays on **working**; channel/inbox notifies PO to begin release.

Alternatively:

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/missions/{id}/approve-artifacts
```

PO executes `artifact-release.md`, sets `status: released`, signals `artifact_release_complete`, writes retrospective files, then `retrospective_complete` and `mission_complete`.

**Web UI close-out tab:** read `artifact-release.md` and `retrospective/workflow-report.md` without attach.

### Automated close-out (API)

```bash
bun server/scripts/e2e-close-out-03.ts
```

Covers approve → release → retro → `mission_complete`; reject; abort. No live PO — channel degraded. See [close-out-e2e.md](./close-out-e2e.md).

## 5. mission_complete → done

```bash
# In mission room — only after retrospective_complete
./tools/signal.sh mission_complete "retro done — dismiss team"
```

Mission moves to **done/** board; execution slot frees (`GET /queue` → `executionSlots`).

## 6. Archive

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/missions/{id}/archive
```

Requires **done** or **aborted** board. Room stays under `mission-rooms/{id}/`.

**Web UI:** mission room → **Archive** when `archiveReady`.

## 7. Boot restore (optional)

Restart daemon with a **working**, non-done mission. Expect boot recovery log or `POST /recover`.

## Automated smoke (partial)

```cmd
scripts\e2e-smoke.cmd
```

Does not replace PO attach or handoff steps.

### Legacy 0.2.0 shortcut (deprecated)

Direct `mission_complete` without approve/release/retro is rejected on API 0.17.0+.

## Checklist

- [ ] `queued/{slug}/mission.md` → bell → minted id on **working**
- [ ] `session?ensureLive=true` → `live: true`, `attachCmd` set
- [ ] `artifacts_ready_for_review` → Web **Approve artifacts** → phase `releasing`
- [ ] Close-out tab shows `artifact-release.md` and retrospective files
- [ ] `mission_complete` (after retro) → **done** column; slot freed
- [ ] `POST .../archive` → **archive** column
