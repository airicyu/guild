# Guild 0.5.0 — Session poke implementation plan

Phased delivery for [design.md](./design.md). **Session poke** replaces guild-channel as the primary wake bus for guild-master directives on idle `--bg` PO sessions.

**Baseline:** product **0.4.0** · API **0.30.0**  
**Target:** product **0.5.0** · API **0.31.0** (core) · **0.32.0** (hardening, if shipped separately)

**Status (2026-07-06):** **Complete** — Phases 0–3 shipped · product **0.5.0** · API **0.32.0**

Legend: `[x]` done · `[ ]` not done · `[~]` partial

---

## Policy locks (from design §5)

- [x] **Restore before poke:** Option **A** · locked 2026-07-06
- [x] **Routes with poke:** approve / reject / abort; no approve-discovery
- [x] **Escalate poke:** deferred (0.5.1)
- [x] **Default env:** `GUILD_SESSION_POKE=1`, `GUILD_CHANNEL_PUSH=0`
- [x] **Platform:** WSL/Linux only

---

## Phase 0 — Spike (proof of concept)

**API:** no bump · **Goal:** prove idle `--bg` PO receives injected user message via ephemeral attach

### 0.1 Spike script

- [x] Add `guild-house/server/scripts/poc-session-poke.ts`
- [x] Script accepts `--mission-id`, optional `--message`, `--dry-run` (plus `--spawn` for self-contained PoC)
- [x] Script reads `checkpoint.claude_session.id` from mission room
- [x] Script probes session live via existing `probeSession` (no restore)
- [x] Script spawns Bun PTY in `mission-rooms/{id}/` cwd (mirror `attach-pty.ts` bash launch)
- [x] Script writes `claude attach {shortId}` + waits (500ms baseline + bounded timeout)
- [x] Script injects canonical poke message + Enter via `proc.terminal.write`
- [x] Script tears down poke PTY; verify `--bg` job still live after teardown
- [x] Document detach behaviour in spike notes (design §12 Q1: Ctrl+D / exit / close PTY) → [spike-notes.md](./spike-notes.md)

### 0.2 Spike validation

- [x] Manual run: idle PO at prompt → inject → PO mentions inbox / checkpoint / phase within one turn (`poke-poc-mr7zs67s` / `388e6d2c`)
- [x] Manual run: dead session → script exits with clear `session not live` (no throw)
- [ ] Manual run: PO mid-tool → record best-effort behaviour (may fail; log only)
- [x] Spike notes appended to [spike-notes.md](./spike-notes.md)

**Exit criteria:** spike demonstrates inject works on idle prompt; bg job survives poke PTY close.

---

## Phase 1 — Core orchestrator

**API:** `0.31.0` · **Goal:** production `session-poke` module wired into guild-master notify path

### 1.1 Config & health

- [x] `server/src/config.ts` — add `sessionPokeEnabled` (`GUILD_SESSION_POKE`, default `1` when shipped)
- [x] `server/src/config.ts` — add `sessionPokeTimeoutMs` (`GUILD_SESSION_POKE_TIMEOUT_MS`, default `8000`)
- [x] `server/src/config.ts` — add optional `sessionPokeMessageTemplate` (`GUILD_SESSION_POKE_MESSAGE`, unset = built-in)
- [x] `guild-house/.env.example` — document new env vars
- [x] `server/src/routes.ts` — `GET /health` returns `sessionPokeEnabled` (alongside `channelPushEnabled`)
- [x] Bump `GET /health` version → **0.31.0** in `server/src/routes.ts`

### 1.2 Shared PTY attach core

- [x] Extract ephemeral attach helpers → `server/src/orchestrator/core/attach-pty-core.ts`
- [x] Shared: bash spawn in room cwd, `claude attach {shortId}`, launch delay, terminal write, kill poke PTY
- [x] WS attach refactored to use shared core (no behaviour regression)
- [x] Poke uses **dedicated** short-lived PTY — never `serverTerminals` Map entry used by WS

### 1.3 Session poke module

- [x] Add `server/src/orchestrator/mission/session-poke.ts`
- [x] Export `pokeMissionSession` → `{ delivered, reason?, durationMs? }`
- [x] Skip when `!config.sessionPokeEnabled`
- [x] Sync checkpoint; require live session via `probeSession` (Option A — no restore)
- [x] Dead session → `{ delivered: false, reason: "session not live" }`
- [x] Build message from event template (design §2.3)
- [x] Message prefix `[guild-house]`; instruct read `checkpoint.yaml` + `comm/inbox.md`
- [x] Bounded wait: attach delay + optional output heuristic + hard timeout
- [x] Log prefix `[session-poke]` mirroring `[channel-notify]`
- [x] Never throw — poke failure must not roll back inbox/checkpoint

### 1.4 Wire guild-master notify

- [x] Extend `GuildMasterNotifyResult` with `poke` block
- [x] `deliverGuildMasterDirective` order: inbox → channel → poke
- [x] Pass `event` + post-transition `pokePhase` into poke
- [x] Update log line in `guild-master-notify` to include `poke.delivered`

### 1.5 Route handlers (response shape)

- [x] `approve-artifacts.ts` — extended `notify` block + `pokePhase: releasing`
- [x] `reject-artifacts.ts` — extended `notify` block + `pokePhase: blocked`
- [x] `abort-mission.ts` — extended `notify` block + `pokePhase: aborted` (before stopSession)
- [x] Confirm `approve-discovery` does **not** call poke (no `deliverGuildMasterDirective` usage)
- [x] Confirm `escalate` does **not** call poke in Phase 1

### 1.6 Unit tests

- [x] Message template per event + mode (intake vs execution)
- [x] Disabled flag returns correct reason
- [x] Timeout / mock PTY path (no live Claude required in CI)
- [x] Mutex stub — concurrent poke → `poke in flight`

**Exit criteria:** `POST /missions/:id/approve-artifacts` with live idle PO returns `notify.poke.delivered: true` and PO resumes without human attach.

---

## Phase 2 — Product surfaces & docs

**Status:** [x] complete · product **0.5.0**

### 2.1 API documentation

- [x] `guild-house/docs/api.md` — document `sessionPokeEnabled` on `/health`
- [x] `guild-house/docs/api.md` — extend `notify` response on approve/reject/abort with `poke` block
- [x] `guild-house/docs/api.md` — env table: `GUILD_SESSION_POKE`, `GUILD_SESSION_POKE_TIMEOUT_MS`, `GUILD_SESSION_POKE_MESSAGE`
- [x] `guild-house/specs/product.md` — locked semantics: poke = ephemeral attach, no second PO, best-effort
- [x] `guild-house/specs/session-lifecycle.md` — poke vs channel vs manual attach
- [x] `guild-house/docs/session-poke.md`

### 2.2 Web UI

- [x] `web/src/lib/api/client.ts` — `HealthResponse.sessionPokeEnabled?: boolean`
- [x] `web/src/types/mission.ts` — `notify.poke` on approve/reject/abort responses
- [x] `web/src/pages/MissionPage.tsx` — show **Approve artifacts** when `sessionPokeEnabled` OR `channelPushEnabled`
- [x] `web/src/pages/MissionPage.tsx` — update `approveNeedsAttach` copy
- [x] `web/src/features/missions/MissionActions.tsx` — same gating for reject
- [x] Toast on approve/reject based on `notify.poke.delivered` (`guildMasterNotify.ts`)
- [x] Mission close-out tab helper text reflects poke-first workflow

### 2.3 Templates & playbooks

- [x] `templates/mission-execution/members/project-owner/agent.md` — `[guild-house]` poke prefix
- [x] `templates/mission-intake/members/intake-lead/agent.md` — same line
- [x] guild-desk workflows — attach-first softened to poke-first

### 2.4 guild-desk skill

- [x] `guild-desk/.agents/skills/guild-master/workflows.md`
- [x] `guild-desk/.agents/skills/guild-master/api-reference.md`
- [x] `guild-desk/.agents/skills/guild-master/SKILL.md`
- [x] `guild-desk/version.md` → **0.5.0**

### 2.5 Version & changelog

- [x] `guild-house/version.md` → **0.5.0**
- [x] `guild-house/changelog.md` — 0.5.0 entry (session poke)
- [x] Root `CLAUDE.md` — current state bullet for 0.5.0 / session poke

**Exit criteria:** Web UI approve works without `GUILD_CHANNEL_PUSH=1`; guild-desk workflow documents poke-first close-out.

---

## Phase 3 — Hardening & E2E

**Status:** [x] complete · API **0.32.0**

### 3.1 Concurrency with WS attach

- [x] Per-mission poke mutex / in-flight flag (`pokeInFlight` Set)
- [x] Browser WS attach active → skip poke with `reason: "attach_in_use"` (documented)
- [~] Integration test or script: rapid WS open + poke → no corrupted PTY state (unit test only)
- [ ] Debounce repeated approve clicks — deferred (0.5.1)

### 3.2 Observability

- [x] Consistent `[session-poke]` logs include `mission`, `event`, `delivered`, `reason`, `durationMs`
- [x] Failed poke surfaces in API response reason strings guild master can act on

### 3.3 E2E & manual QA

- [x] `server/scripts/e2e-050-session-poke.ts`
- [~] E2E live PO path — `e2e-050 --live` optional; spike manual PASS
- [x] `guild-house/docs/tests/close-out-e2e.md` — poke path manual checklist
- [~] Manual: approve via Web UI while PO idle (spike covers inject; Web UI not re-run)
- [x] Manual/automated: dead session → `poke.delivered: false`; checkpoint/inbox correct (e2e-050)
- [ ] Manual: poke + channel both on → orthogonal delivery

### 3.4 Optional enhancements (0.5.1 candidates — not required for 0.5.0 ship)

- [ ] `ensureLive` then poke (design Option B) behind `GUILD_SESSION_POKE_RESTORE=1`
- [ ] Poke on `POST /missions/:id/escalate` (guild master reply wake)
- [ ] Poke on `POST /mission-board-notes/:id/abort` when room + live session on discovering/working
- [ ] Rate limit / debounce policy documented

**Exit criteria:** success checklist (below) all green; manual sign-off recorded in this file.

---

## Success checklist (design §9)

- [x] Approve-artifacts with live idle PO → PO begins release flow (manual spike PASS)
- [x] Poke failure does **not** roll back checkpoint / inbox (e2e-050)
- [~] WS browser attach and poke do not corrupt each other (skip `attach_in_use` only; no rapid integration script)
- [x] Dead session → `poke.delivered: false` with clear reason
- [x] `GUILD_SESSION_POKE=0` → degraded inbox-only mode (unit test)
- [x] No second PO spawn from poke path

---

## Dependency graph

```text
Phase 0 Spike          [x]
  → Phase 1 Core       [x]  API 0.31.0 → 0.32.0
  → Phase 2 Product    [x]  product 0.5.0
  → Phase 3 Hardening  [x]  attach_in_use + e2e-050
```

Phase 1 blocks Phase 2 (UI needs health flag + notify shape). Phase 3 can overlap Phase 2 doc work but should not block 0.5.0 ship if mutex + manual QA pass in Phase 1–2.

---

## File touch map (expected)

| Area | Files |
|------|--------|
| Config / health | `server/src/config.ts`, `server/src/routes.ts`, `server/src/server.ts`, `.env.example` |
| PTY core | `server/src/orchestrator/core/attach-pty-core.ts`, `server/src/websocket/attach-pty.ts` |
| Poke | `server/src/orchestrator/mission/session-poke.ts` |
| Notify | `server/src/orchestrator/mission/guild-master-notify.ts` |
| Handlers | `approve-artifacts.ts`, `reject-artifacts.ts`, `abort-mission.ts` |
| Web | `web/src/lib/api/client.ts`, `missions.ts`, `MissionPage.tsx`, `MissionActions.tsx` |
| Desk | `guild-desk/.agents/skills/guild-master/*.md` |
| Docs | `specs/product.md`, `docs/api.md`, `docs/tests/close-out-e2e.md` |
| Tests | `server/scripts/poc-session-poke.ts`, `e2e-050-session-poke.ts` or `e2e-040.ts --poke` |

---

## Sign-off

| Milestone | Date | Notes |
|-----------|------|-------|
| Phase 0 spike | 2026-07-06 | idle PO inject PASS; teardown hang fixed |
| Phase 1 core merged | 2026-07-06 | API 0.32.0; 10 unit tests pass |
| Phase 2 product shipped (0.5.0) | 2026-07-06 | Web UI, desk, docs |
| Phase 3 hardening | 2026-07-06 | attach_in_use, e2e-050, API 0.32.0 |
