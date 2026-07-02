# Guild House — product specification (as-built)

Living product truth for **release 0.2.0** (Phase 1 close-out API landed at **0.17.0** — product version bumps at 0.3.0 ship). When code and prose disagree, trust this file + `GET /health` → `version`, then update specs/docs in the same change.

Historical early design narrative: [ideas/archive/idea-v2.md](../../ideas/archive/idea-v2.md) (archive only — do not extend).

## Release

| Kind | Location | Current |
|------|----------|---------|
| Product | `version.md` + `changelog.md` | **0.2.0** |
| API runtime | `GET /health` → `version` | **0.17.0** (Phase 1 close-out) |

## Board pipeline

**0.2.0 execution close-out:**

```
… → working → mission_complete → done → [archive]
```

**0.3.0 close-out (Phase 1+ API):**

```
… → working
  → [artifacts_ready_for_review]
  → [guild master approve-artifacts] → releasing
  → [artifact_release_complete] → retrospective
  → [mission_complete] → done → [archive]

Reject: awaiting_artifact_review → [reject-artifacts] → blocked (stays on working)
Abort: working → [abort] → aborted → [archive]
```

| Stage | Who moves | Mechanism |
|-------|-----------|-----------|
| ideas → discovering | Orchestrator | `orchestratorTick()` / `POST /bell` |
| discovering → parking | Guild master | `POST /discoveries/:id/approve` |
| parking → queued | Guild master | `POST /board/parking/:folder/promote` |
| queued → working | Orchestrator | tick / bell |
| working → done | PO | `mission_complete` from **`retrospective`** only |
| working → aborted | Guild master | `POST /missions/:id/abort` |
| done / aborted → archive | Guild master | `POST /missions/:id/archive` |

Legacy intake: drop `mission.md` on **queued** (formerly `ready/`) — execution half of tick only.

## Locked semantics

1. **Attach existing PO** — `claude attach {shortId}` to live `--bg` job; not a fresh spawn.
2. **`ensureMissionSessionLive` / `ensureDiscoverySessionLive`** — restore before attach when `?ensureLive=true` or WS connect.
3. **WS close = detach only** — kills attach PTY; does not stop bg job.
4. **Terminal tab lazy mount** — xterm mounts when tab opens.
5. **`mission_complete`** → `phase: done`, move **working/** → **done/**; requires **`retrospective`** phase; no auto-archive.
6. **Approve artifacts** — `POST /missions/:id/approve-artifacts`; does **not** stop session or move board; notifies PO via inbox + guild-channel.
7. **Reject / abort** — `reject-artifacts` → `blocked` on working; `abort` → **aborted/** board, frees slot.
8. **Archive** — from **done** (`phase: done`) or **aborted** (`phase: aborted`); room folder stays on disk.
9. **Slots** — `MAX_ACTIVE_MISSIONS` counts **working** only; **done** and **aborted** do not. `MAX_DISCOVERY_SESSIONS` counts live **discovering** leads.
10. **GET never spawns** — restore only on boot / `POST /restore` / `POST /resume` / `?ensureLive=true`.
11. **`checkpoint.yaml`** — orchestrator-only writer; agents use signals API.
12. **Filesystem-first** — UI does not edit board folders or checkpoint directly.
13. **Frozen brief** — `memories/common/mission-brief.md` is read-only for PO; clarify via `memory.md` or escalate.
14. **Discovery approve** — HTTP 200 from `POST /discoveries/:id/approve` (or `tools/approve.sh`); lead must not narrate approval without API success.
15. **Guild channel** — orchestrator POST to per-room `guild-channel` on approve/reject/abort; degraded = inbox + checkpoint only. See [docs/guild-channel.md](../docs/guild-channel.md).

## Guild master (role)

The **guild master** is the **human supervisor** for Guild — not an agent in mission or discovery rooms.

| Aspect | Detail |
|--------|--------|
| **Who** | The operator at Guild Desk, Web UI, or terminal attach (not PO, intake lead, or squad members) |
| **Does** | Submit ideas, approve discovery, promote parking → queued, archive done missions, answer outbox via `inbox.md`, attach to intervene |
| **Room files** | Writes `inbox.md` (directives); reads `outbox.jsonl` (escalations). Checkpoint field `awaiting_guild_master` means waiting on this role |
| **Playbooks** | Use the role term **guild master** — not a personal name baked into templates |
| **`GUILD_MASTER_NAME`** | Env display label only (`GET /health` → `guildMasterName`, Web UI header). Safe to rename without re-scaffolding rooms |

## Component map

| Topic | Spec / doc |
|-------|------------|
| REST + WS | [docs/api.md](../docs/api.md) |
| PO session rules | [session-lifecycle.md](./session-lifecycle.md) |
| Discovery checkpoint | [discovery-checkpoint-schema.md](./discovery-checkpoint-schema.md) |
| `mission.md` format | [mission-schema.md](./mission-schema.md) |
| Plan 3 walkthrough | [docs/e2e-discovery-path.md](../docs/e2e-discovery-path.md) |
| Terminal attach | [terminal-attach.md](./terminal-attach.md) |
| Execution QA | [docs/tests/execution-e2e.md](../docs/tests/execution-e2e.md) |
