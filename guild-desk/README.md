# Guild Desk

Claude Code **control plane** for [Guild House](../guild-house/).

| Repo | Role |
|------|------|
| **guild-house** | Orchestrator API + mission data + PO `--bg` sessions |
| **guild-desk** (here) | CC + **guild-master** skill → curl API, print attach commands |

## Setup

```cmd
rem Terminal 1 — guild-house (you run the daemon)
cd c:\Users\airic\airwave\guild-house
set GUILD_API_KEY=change-me-in-production
set GUILD_MASTER_NAME=Eric
rem Optional: auto orchestrator tick every N minutes (0 = manual bell only)
set GUILD_TICK_INTERVAL_MINUTES=5
bun run dev

rem Terminal 2 — guild-desk
cd c:\Users\airic\airwave\guild-desk
set GUILD_HOUSE_URL=http://127.0.0.1:3847
set GUILD_API_KEY=change-me-in-production
set GUILD_MASTER_NAME=Eric
claudew
```

## Guild master name

**`GUILD_MASTER_NAME`** — display label for `/health` and Web UI (e.g. `Eric`). **Not** baked into mission/discovery playbooks — agents use the role term **guild master**.

- Default: `Guild Master`
- Returned by `GET /health` as `guildMasterName`
- Set in **guild-house** `.env`; match in desk for consistency

Checkpoint/API field `awaiting_guild_master` / `awaitingGuildMaster` = awaiting the guild master (human supervisor).

## Try it (guild-master skill)

Natural language in guild-desk CC:

- "ring the bell"
- "submit idea: …" (default backlog) or "submit idea to ideas column: …"
- "promote backlog idea {id} to ideas"
- "approve artifacts for {mission-id}"
- "reject artifacts for {mission-id}" / "abort mission {id}"
- "approve intake {note-id}" / "approve discovery {note-id}"
- "abort board note {id}"
- "promote parking folder {folder} to queued"
- "show attach for {mission-id}"
- "who is in outbox?"
- "archive mission {id}" (after mission on **done** board)

Run attach in a **separate terminal**, not inside guild-desk.

## curl helper

```cmd
set GUILD_API_KEY=change-me-in-production
scripts\guild-api.cmd /health
scripts\guild-api.cmd /board
scripts\guild-api.cmd /queue
scripts\guild-api.cmd /bell -X POST
scripts\guild-api.cmd /mission-board-notes?stage=discovering
scripts\guild-api.cmd /missions/idea-20260629-a1b2c3/approve-discovery -X POST
scripts\guild-api.cmd /mission-board-notes/idea-20260704-a1b2c3/abort -X POST -d "{\"reason\":\"cancelled\"}"
scripts\guild-api.cmd /board/parking/my-slug-20260629-abc/promote -X POST
scripts\guild-api.cmd /missions/hello-world-20260627-a3f9c2/session?ensureLive=true
scripts\guild-api.cmd /missions/hello-world-20260627-a3f9c2/archive -X POST
```

`/health` is public; other routes need `GUILD_API_KEY`.

## Workflows

| Intent | API |
|--------|-----|
| Submit to backlog (default) | `POST /ideas` `{ "text": "…" }` |
| Submit directly to ideas | `POST /ideas` `{ "text": "…", "board": "ideas" }` |
| List board notes | `GET /mission-board-notes?stage=…` |
| Board note detail | `GET /mission-board-notes/{id}` |
| Promote backlog → ideas | `POST /board/ideas-backlog/{noteId}/promote` |
| Approve intake (Option B) | `POST /missions/{id}/approve-discovery` |
| Abort board note (any pre-terminal) | `POST /mission-board-notes/{id}/abort` |
| Approve mission artifacts | `POST /missions/{id}/approve-artifacts` |
| Reject artifacts | `POST /missions/{id}/reject-artifacts` |
| Promote one parking folder | `POST /board/parking/{folder}/promote` |
| Pick up ideas + queued missions | `POST /bell` (= `orchestratorTick`) |
| Auto tick (daemon) | `GUILD_TICK_INTERVAL_MINUTES` in guild-house `.env` |
| Attach (intake or PO) | `GET /missions/{id}/session?ensureLive=true` when `live: true` |
| Unread escalations | `GET /outbox` |
| Close accepted mission | `POST /missions/{id}/archive` (requires **done** or **aborted** board) |
| After daemon restart | Boot auto-restores working missions; or `POST /recover` |

**Never** paste `attachCmd` from an old message — session ids go stale.

## Discovery pipeline (0.4.0)

```
POST /ideas → ideas-backlog → [promote] → ideas → [bell/tick] → discovering → [approve-discovery] → parking (children)
                                                                              parent → done
→ [promote] → queued → [bell/tick] → working → [close-out] → done → [archive]
```

Intake and execution both use **`mission-rooms/{id}/`**. Board notes carry `mission.md` + `meta.yaml`.

Close-out: PO `artifacts_ready_for_review` → guild master approve → release → retro → `mission_complete`.

Web UI covers the same paths on the board page.

## Docs

- Skill: [.agents/skills/guild-master/SKILL.md](.agents/skills/guild-master/SKILL.md)
- API: [../guild-house/docs/api.md](../guild-house/docs/api.md)
- Close-out QA: [../guild-house/docs/tests/close-out-e2e.md](../guild-house/docs/tests/close-out-e2e.md)
- E2E walkthrough: [../guild-house/docs/e2e-discovery-path.md](../guild-house/docs/e2e-discovery-path.md)
- Execution test: [../guild-house/docs/tests/execution-e2e.md](../guild-house/docs/tests/execution-e2e.md)
- Session lifecycle: [../guild-house/specs/session-lifecycle.md](../guild-house/specs/session-lifecycle.md)

## Intake

**Primary:** `POST /ideas` or Web UI **Submit idea**.

Legacy: drop briefs under `../guild-house/data/mission-board/queued/{slug}/mission.md` (+ `meta.yaml` with `type: work_execution` recommended). See [mission-schema.md](../guild-house/specs/mission-schema.md).
