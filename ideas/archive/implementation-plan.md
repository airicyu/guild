# Guild House — Prototype Implementation Plan

> Spec: [idea-v2.md](./idea-v2.md)  
> Code: `airwave/guild-house/` · Control: `airwave/guild-desk/` (`guild-master` skill)  
> Dev agent: **Cursor IDE** · Runtime: **`claudew`** + CC `--bg`

---

## Goals

Ship a working prototype:

1. Bun API daemon manages missions (deterministic orchestrator, **not** an agent)
2. `POST /bell` picks up `data/mission-board/ready/{slug}/` (mints `{slug}-{date}-{hex}` if needed), spawns PO via `claudew --bg`
3. Guild master operates via **guild-master** skill (curl + API doc)
4. Guild master intervenes via **terminal attach** only
5. **outbox** + **chatroom** + lifecycle **signals API**

---

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — `claudew --bg` spike | **Done** | 2026-06-27 · 見 [spike-phase0.md](./spike-phase0.md) |
| 1 — Repo skeleton + health | **Done** | `bun run dev` · `GET /health` · Bearer middleware |
| 2 — Bell + spawn + checkpoint | **Done** | demo-001 驗收通過 · API v0.2.0 |
| 3 — Signals + lifecycle | **Done** | signals / pause / resume / boot recovery · API v0.3.0 |
| 4 — Outbox + chatroom | **Done** | escalate / say tools · API v0.4.1 |
| 5 — PO handoff content | **Done** | agent.md · handoff · schema · demo-003 E2E · acceptEdits spawn |
| 6 — guild-desk + guild-master | **Done** | `airwave/guild-desk/` · skill + `guild-api.cmd` |
| 6b — Session lifecycle | **Done** | v0.6 · sync + restore ladder · `awaiting_guild_master` rename |
| 6c — Archive + mission id mint | **Done** | v0.7 · manual archive · done frees slot · bell mint `{slug}-{date}-{hex}` |
| 7 — E2E + docs | **Done** | `docs/tests/execution-e2e.md` · full `docs/api.md` · README polish |

**Current:** Phase 7 complete — prototype v0.7.0

**Next:** [Mission Discovery Plan (Plan 3)](./mission-discovery-plan.md) · [Web UI Plan 2](./web-ui-implementation-plan.md) (0.1.0 baseline)

---

## Locked decisions

| Item | Choice |
|------|--------|
| Data root | `guild-house/data/` (gitignore) |
| Mission id | Slug folder in `ready/`; bell mints `{slug}-{YYYYMMDD}-{6hex}` if needed |
| CC spawn | `claudew --bg -n "mission-{id}-po"` + **initial prompt** |
| checkpoint.yaml | **Orchestrator only**; PO uses `POST /signals` |
| Concurrent missions | Max 4 PO bg sessions; **`phase: done` does not count** toward limit |
| Archive | `mission_complete` → `phase: done`, stay on **active** board; **`POST /missions/:id/archive`** moves to archive (requires done) |
| Mission room after archive | Stays at `mission-rooms/{id}/` (no separate rooms archive in prototype) |
| Session lifecycle (v0.6) | GET sync only (`claude agents` + job `state.json`); restore on boot / explicit `POST /restore`, `/resume`, `?ensureLive=true` |
| API | `127.0.0.1:3847`, Bearer API key · **v0.7.0** |
| awaiting_guild_master | Idle (no timeout in prototype) |
| Git (missions) | commit OK, **no push**; cwd = mission room |
| events.jsonl | Skip in prototype |

---

## Phase 0 — Spike: `claudew` + `--bg` (manual, ~0.5 day)

**Before writing spawn code.**

Checklist (Windows, your OpenRouter wrapper):

- [x] `claudew --bg -n test-po` in a test cwd
- [x] Record session id / name — stdout `backgrounded · {id} · {name}`；備用 `claude agents --json`
- [x] `claudew attach <id>` or `claudew -r test-po` — 語法已確認
- [ ] Spawn one subagent (Task) from bg session — **DEFER**（需 interactive attach；PO 職責）
- [x] Close attach terminal; bg session still runs — CC 文件行為
- [x] `claude respawn <id>` after simulated restart
- [x] Confirm env (OpenRouter) applies to **background workers** — **PARTIAL**（經 `claudew` spawn 繼承 wrapper env；首次 bg service 可能需 warmup）

**Pass** → Phase 1. **Fail** → fix `claudew` / env before continuing. ✅ **Passed 2026-06-27**

---

## Phase 1 — Repo skeleton + health (Cursor, ~1 day)

**Repo:** `airwave/guild-house/`

```
guild-house/
  package.json
  src/
    server.ts           # Bun.serve entry
    config.ts           # GUILD_HOME, port, API key, claudeCommand
    routes/             # api.ts (Phase 2+)
  data/                 # gitignore
    mission-board/
      parking/
      ready/
      active/
      archive/
    mission-rooms/
  docs/
    api.md              # grows each phase
  templates/
    mission-room/       # scaffold on pickup
  .env.example
```

**Tasks**

- [x] Bun + TypeScript scaffold, `bun run dev`
- [x] `GET /health`
- [x] Load config: `GUILD_HOME=data`, `PORT=3847`, `GUILD_API_KEY`, `CLAUDE_COMMAND=claudew`
- [x] API key middleware (Bearer) — `/health` 除外

**Acceptance:** `curl http://127.0.0.1:3847/health` → OK ✅

---

## Phase 2 — Bell pickup + spawn + checkpoint (~2–3 days)

**Tasks**

- [x] `GET /board` — list folders under parking/ready/active/archive
- [x] `POST /bell` — for each `ready/{slug}/`:
  - [x] **Kickstart (v0.7):** mint id `{slug}-{YYYYMMDD}-{6hex}` if folder name not valid/unused; rename ready folder
  - [x] Respect 4 active slot limit (**excludes `phase: done`**); else queue (document in response)
  - [x] Copy/scaffold `templates/mission-room/` → `data/mission-rooms/{id}/`
  - [x] Move/link `ready/{id}` → `active/{id}`
  - [x] Run `claudew --bg -n "mission-{id}-po"` with cwd = mission room
  - [x] Send **initial prompt** — `.guild/handoff-prompt.md` + spawn 時 positional prompt
  - [x] Parse session id/name — stdout regex + fallback `claude agents --json`
  - [x] Write `checkpoint.yaml` (orchestrator only)
- [x] `GET /missions`, `GET /missions/:id`
- [x] `GET /missions/:id/session` → `{ id, name, attachCmd, resumeCmd, cwd }`
  - `attachCmd`: `claudew attach {id}` ✅
  - `resumeCmd`: `claudew -r mission-{id}-po` ✅
- [x] `GET /queue` — ready missions when slots full

**Templates on pickup**

- [x] `members/project-owner/agent.md`
- [x] `members/evaluator/agent.md`
- [x] `members/senior-developer/agent.md`
- [x] `members/developer/agent.md`
- [x] `members/qa/agent.md`
- [x] `inbox.md`, empty `outbox.jsonl`, `memories/common/chatroom.jsonl`（對齊 idea-v2 路徑）
- [x] `squad.md` stub, `checkpoint.yaml` (orchestrator-written)

**Acceptance**

- [x] Drop `data/mission-board/ready/demo-001/mission.md`
- [x] `POST /bell` → active + mission room + checkpoint with session
- [x] `GET /missions/demo-001/session` returns attach command

**Code:** `guild-house/src/orchestrator/{pickup,spawn,checkpoint,scaffold,board}.ts` · `src/routes/api.ts`

---

## Phase 3 — Signals API + lifecycle (~2 days)

**Tasks**

- [x] `POST /missions/:id/signals` body `{ type, summary? }`
  - Types: `round_complete`, `mission_complete`, `blocked`, `request_session_restart`
  - Orchestrator **only writer** of `checkpoint.yaml`
  - `mission_complete` → stop session, `phase: done`, **stay on active board** (see Phase 6c for archive)
  - `blocked` → `phase: blocked`, `awaiting_guild_master: true`
- [x] `POST /missions/:id/pause`, `POST /missions/:id/resume`
- [x] Boot hook: scan active missions, restore ladder (skip paused/done) — refined in Phase 6b
- [x] Mission room `tools/signal.sh` + `tools/signal.cmd` — curl API with `GUILD_API_KEY`
- [x] PO `agent.md`: when to call each signal type

**Acceptance**

- [x] PO (manual test) runs `tools/signal.sh blocked` → checkpoint updated
- [x] `mission_complete` → `phase: done`, PO stopped (**board archive deferred to Phase 6c**)

**Code:** `src/orchestrator/{lifecycle,session}.ts` · boot recovery in `server.ts`

---

## Phase 4 — Outbox + chatroom (~2 days)

**Outbox**

- [x] `tools/escalate.sh` + `tools/escalate.cmd` — `POST /escalate` (atomic outbox + blocked)
- [x] `GET /outbox`, `GET /missions/:id/outbox`
- [x] `POST /missions/:id/outbox/read`

**Chatroom**

- [x] `tools/say.sh` + `tools/say.cmd` — `POST /chatroom/say`
- [x] PO rules: team uses say for async coord; PO distills to `common/memory.md`

**Acceptance**

- [x] Escalate appears in `GET /outbox`
- [x] say.sh appends to chatroom.jsonl

**Code:** `src/orchestrator/{outbox,chatroom,jsonl}.ts`

---

## Phase 5 — PO handoff content (~1–2 days)

**Tasks**

- [x] Flesh out 5× `agent.md` roles (evaluator ≠ senior-dev)
- [x] Initial prompt template for bell (handoff checklist) — `templates/handoff-prompt.md` + spawn prompt
- [x] `mission.md` schema doc (frontmatter: title, intent, autonomy?) — `docs/mission-schema.md`
- [x] Demo mission brief — `ready/demo-003/` (hello-world artifact + full acceptance)
- [x] Spawn `--permission-mode acceptEdits` + mission room `.agents/settings.json`

**Acceptance**

- [x] One real demo mission runs past squad + first artifact — demo-003 E2E 2026-06-27

**Code:** `templates/mission-room/members/*/agent.md` · `templates/handoff-prompt.md` · `scaffold.ts` · `CLAUDE_PERMISSION_MODE`

---

## Phase 6 — guild-desk + guild-master (~1–2 days)

**Tasks**

- [x] `airwave/guild-desk/` — `CLAUDE.md`, `.env.example`, `README.md`
- [x] `.agents/skills/guild-master/SKILL.md` — curl workflows, attach output rules
- [x] `scripts/guild-api.cmd` — cmd helper for guild master

**Acceptance**

- [x] In guild-desk CC: "ring the bell" / "show attach for {id}" via skill (guild master runs attach separately)

**Code:** `guild-desk/.agents/skills/guild-master/SKILL.md` · references `guild-house/docs/api.md`

---

## Phase 6b — Session lifecycle (v0.6)

**Problem:** checkpoint could say PO `running` while bg job was dead → stale attach commands.

**Tasks**

- [x] Sync on GET: read `claude agents --json` + `~/.agents/jobs/{id}/state.json` → update checkpoint session fields; **never spawn on GET**
- [x] Explicit restore: boot, `POST /missions/:id/restore`, `POST /missions/:id/resume`, `GET .../session?ensureLive=true`
- [x] Restore ladder: `respawn` short id → if fail, new `--bg` with resume prompt
- [x] `POST /recover` — manual boot-style recovery
- [x] Checkpoint fields: `session_id`, `job_state`, `synced_at` under `claude_session`
- [x] `GET /missions` adds `sessionLive`, `restoreRequired`, `jobState`
- [x] Rename `awaiting_eric` → **`awaiting_guild_master`** (parser still reads legacy checkpoints)
- [x] Escalate/signals when session dead: **no auto-restore** on POST (guild master uses ensureLive)

**Acceptance**

- [x] Kill bg job → `GET /missions/:id/session` shows `live: false`, `attachCmd: null`
- [x] `?ensureLive=true` or boot → PO restored; new session id if job was `done`

**Code:** `session-lifecycle.ts` · `job-state.ts` · `docs/session-lifecycle.md`

---

## Phase 6c — Manual archive + mission id mint (v0.7)

**Tasks**

- [x] `mission_complete` — stop PO, `phase: done`, **do not** auto-move board to archive
- [x] `POST /missions/:id/archive` — guild master closes mission after acceptance; requires `phase: done`
- [x] Slot counting — only `phase !== done` on active board counts toward `MAX_ACTIVE_MISSIONS`
- [x] Bell kickstart — `resolveMissionIdAtKickstart`: slug folder → mint `{slug}-{YYYYMMDD}-{6hex}`; rename ready folder; collision check vs rooms + all board stages
- [x] `GET /missions` — `archiveReady: true` when `phase === done`

**Acceptance**

- [x] After `mission_complete`, mission stays on active; bell can pick up new ready if slots available
- [x] `POST /archive` moves `active/` → `archive/`; mission room unchanged on disk
- [x] Re-run same slug (e.g. `hello-world`) → new minted id, no room collision

**Code:** `mission-id.ts` · `lifecycle.ts` (`archiveMission`) · `board.ts` (`countActiveMissions`)

---

## Phase 7 — E2E + docs (~1 day)

**Happy path** (v0.7)

1. Drop `ready/{slug}/mission.md` (friendly slug; bell mints id)
2. guild-master → `POST /bell` → note minted id in `pickedUp`
3. PO produces squad, memory, artifact; QA pass → `mission_complete`
4. Escalate (optional) → `GET /outbox` → attach via `GET .../session?ensureLive=true`
5. Guild master reviews → `POST /missions/{id}/archive`
6. Restart daemon → active non-done missions restore via boot recovery

- [x] `guild-house/docs/e2e-happy-path.md` — hello-world slug, v0.7 mint/archive/boot restore
- [x] Complete `guild-house/docs/api.md` — full route reference v0.7.0
- [x] README in both repos + `scripts/e2e-smoke.cmd`

---

## Not in prototype

- Web UI, inbox nudge, desktop notify, events.jsonl
- Reporter / html viz, guild mailbox
- awaiting_guild_master timeout / slot release
- File watcher auto-pickup

---

## Suggested Cursor workflow

One Cursor session **per phase**; open `implementation-plan.md` + `idea-v2.md` as context.

After each phase: run acceptance checklist before next phase.

---

## Open during build (non-blocking)

- ~~Exact parse of session id from `claudew --bg` stdout~~ — **Resolved**（Phase 0/2：`spike-phase0.md` + spawn fallback）
- Demo mission type (Phase 5) — demo-001 已用於 Phase 2 驗收（hello-world artifact brief）
- brief-version sync for mission-board edits (post-prototype)
