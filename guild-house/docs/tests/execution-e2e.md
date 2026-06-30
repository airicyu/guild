# Manual test — execution E2E (queued → archive)

Execution-only path without discovery. For full Plan 3 pipeline see [e2e-discovery-path.md](../e2e-discovery-path.md).

**Product:** 0.2.0 · **API:** check `GET /health` → `version`

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

## 4. mission_complete → done

```bash
# In mission room
./tools/signal.sh mission_complete "QA pass"
```

Mission moves to **done/** board; execution slot frees (`GET /queue` → `executionSlots`).

## 5. Archive

```bash
curl -X POST -H "$AUTH" http://127.0.0.1:3847/missions/{id}/archive
```

Requires **done** board. Room stays under `mission-rooms/{id}/`.

## 6. Boot restore (optional)

Restart daemon with a **working**, non-done mission. Expect boot recovery log or `POST /recover`.

## Automated smoke (partial)

```cmd
scripts\e2e-smoke.cmd
```

Does not replace PO attach or handoff steps.

## Checklist

- [ ] `queued/{slug}/mission.md` → bell → minted id on **working**
- [ ] `session?ensureLive=true` → `live: true`, `attachCmd` set
- [ ] `mission_complete` → **done** column; slot freed
- [ ] `POST .../archive` → **archive** column
