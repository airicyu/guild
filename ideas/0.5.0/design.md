# Guild 0.5.0 — Session poke design (proposal)

**Status:** Proposal · **not implemented**  
**Alignment date:** 2026-07-05  
**Baseline:** product 0.4.0 · API 0.30.0

When implementation ships, update `guild-house/specs/product.md` and `guild-house/docs/api.md` in the same change.

---

## 1. Problem

### 1.1 What works today (0.4.0)

Guild-master directives (`approve-artifacts`, `reject-artifacts`, `abort` on execution) go through `deliverGuildMasterDirective`:

1. **Ledger (always):** write `comm/inbox.md` (or room inbox) + orchestrator updates `checkpoint.yaml`
2. **Wake bus (optional):** HTTP POST → per-room `guild-channel` MCP → Claude Code channel XML

`GUILD_CHANNEL_PUSH=0` (default) skips step 2. The API still returns 200 and phase transitions are correct, but an **idle** PO never learns the guild master acted unless someone **attaches manually**.

### 1.2 Why channel is not the 0.5.0 fix

Phase 0 PoC proved channel delivery on a **live, attentive** PO session. Production pain is specifically:

- `--bg` PO sitting at idle prompt
- Channel event accepted by MCP but **not surfaced** to the agent turn loop reliably
- Guild master cannot depend on Web UI / guild-desk API approve as an end-to-end action

Patching channel alone is upstream-dependent. We need a **Guild-owned** wake path that reuses infrastructure we already trust: **`claude attach`** to the same short session id.

### 1.3 User story

> As guild master, when I approve artifacts (or reject / abort with directive), the PO should resume work **without** me opening a separate terminal — as long as the background session is still alive.

---

## 2. Proposal: session poke

### 2.1 Name

**Session poke** (working name) — orchestrator-initiated, **ephemeral** attach that injects one user message and exits without stopping the `--bg` job.

Not a new Claude API. Not a second PO spawn. Not a replacement for filesystem ledger.

### 2.2 Flow

```text
Guild master: POST /missions/:id/approve-artifacts
        │
        ▼
Orchestrator (unchanged ledger first)
  1. Validate phase + board
  2. Write inbox directive
  3. Update checkpoint.yaml (e.g. phase → releasing)
        │
        ▼
Session poke (new, best-effort)
  4. sync session — require live --bg job (or restore? — see §5.2)
  5. Spawn server PTY in mission-rooms/{id}/ (reuse attach-pty patterns)
  6. Write: claude attach {shortId}
  7. Wait until attach ready (heuristic / timeout)
  8. Write user message + Enter (see §3.2)
  9. Detach / close poke PTY only — bg job keeps running
        │
        ▼
PO reads message → reads checkpoint + inbox → continues playbook
```

### 2.3 Canonical poke message

Short, **filesystem-first** — the message is a doorbell, not the directive body (directive stays in inbox + checkpoint).

```text
[guild-house] Guild master updated mission state (event: artifacts_approved, phase: releasing). Read checkpoint.yaml and comm/inbox.md for the latest directive, then continue per your playbook.
```

Variants by event:

| Event | Phase after | Recipient role |
|-------|-------------|----------------|
| `artifacts_approved` | `releasing` | project-owner |
| `artifacts_rejected` | `blocked` | project-owner |
| `mission_aborted` | `aborted` | project-owner |
| `awaiting_input` (escalate) | unchanged | project-owner / intake-lead |

Intake **`approve-discovery`** does **not** need poke — orchestrator-only filesystem moves; no agent wake required.

### 2.4 Relationship to channel

| Path | When | Role in 0.5.0 |
|------|------|----------------|
| inbox + checkpoint | Always | **Source of truth** |
| Session poke | Default wake when `GUILD_SESSION_POKE=1` | **Primary Guild wake bus** |
| guild-channel HTTP | Optional `GUILD_CHANNEL_PUSH=1` | Secondary / experimental; may run **after** poke or stay off |

Poke and channel are **orthogonal**. Recommended default after 0.5.0: `GUILD_SESSION_POKE=1`, `GUILD_CHANNEL_PUSH=0`.

---

## 3. Feasibility

### 3.1 Verdict: **feasible with caveats**

**Why it should work**

- We already spawn `bash` + Bun native PTY and run `claude attach {shortId}` in [`attach-pty.ts`](../../guild-house/server/src/websocket/attach-pty.ts) for Web UI terminal attach.
- Injecting stdin into that PTY is the same mechanism as the browser `chat_input` WS path (`proc.terminal.write`).
- Attach connects to the **existing** `--bg` job — satisfies locked semantics (no second PO).
- Message instructs agent to read **checkpoint + inbox** — aligned with filesystem-first product principle.
- Idle-at-prompt sessions are the common case; attach injects a **user turn**, which is closer to how CC expects input than passive channel XML.

**Caveats (must be designed around)**

| Risk | Mitigation |
|------|------------|
| **Session not live** | Poke returns `delivered: false, reason: "session not live"`; ledger already written. Optionally chain `restore` before poke (policy flag). Same degraded semantics as channel. |
| **Ready detection** | No official “attach ready” API. Use bounded wait: delay after attach command (today 500ms for UI) + optional output heuristic (“attached”, prompt chars) + hard timeout (e.g. 8s). |
| **Race with human attach** | One poke at a time per `missionId`; if Web UI WS attach active, **queue or skip** poke with `reason: "attach_in_use"`. Never share long-lived PTY with WS client. |
| **Detach without killing bg job** | Poke uses **dedicated short-lived PTY**; closing poke PTY must not send SIGHUP to bg job. Today WS close kills server attach PTY only — same contract. Verify `claude attach` exit behaviour on poke teardown. |
| **Alt-screen / tool UI** | If PO is mid-tool, injected text may garble. Best-effort only; ledger still correct. Log and surface `poke.delivered: false`. |
| **WSL/Linux only** | Match Phase 5 terminal attach scope (same as channel PoC). |
| **Permission / trust prompts** | Rooms must be pre-trusted (templates already carry `settings.local.json`). Poke fails closed like attach. |

### 3.2 What we are not claiming

- Poke does **not** work if the bg process is dead (same as channel).
- Poke is **not** a substitute for guild master attach when PO needs a long conversation.
- Poke text is **not** the authoritative directive — inbox + checkpoint remain canonical.

---

## 4. Architecture

### 4.1 New module (sketch)

```
guild-house/server/src/orchestrator/mission/session-poke.ts
  pokeMissionSession(config, missionId, input: { event, phase, summary? })
    → { delivered, reason?, durationMs? }

guild-house/server/src/orchestrator/mission/guild-master-notify.ts
  deliverGuildMasterDirective(...)
    1. inbox (unchanged)
    2. channel if GUILD_CHANNEL_PUSH (unchanged)
    3. poke if GUILD_SESSION_POKE (new)
```

Extract shared **ephemeral PTY attach** helpers from `attach-pty.ts` into e.g. `server/src/orchestrator/core/attach-pty-core.ts` so WS browser attach and orchestrator poke do not fork logic.

### 4.2 Concurrency model

```text
mission:{id}:poke     mutex / in-flight flag (orchestrator)
mission:{id}:ws       existing activeAttachByKey (browser)

Rule: poke never reuses serverTerminals Map entry used by WS.
      poke spawns → attach → write → kill poke PTY within TTL.
```

### 4.3 Observability

Log prefix `[session-poke]` mirroring `[channel-notify]`:

```text
[session-poke] mission=demo-001 event=artifacts_approved delivered=true durationMs=2400
[session-poke] skip mission=demo-001 reason=session not live
```

`GET /health` → `sessionPokeEnabled: boolean` (like `channelPushEnabled`).

API response on approve/reject/abort extends notify block:

```json
{
  "notify": {
    "channel": { "delivered": false, "reason": "GUILD_CHANNEL_PUSH disabled" },
    "poke": { "delivered": true }
  }
}
```

---

## 5. Policy decisions (to lock in implementation)

### 5.1 Restore before poke?

| Option | Pros | Cons |
|--------|------|------|
| **A — poke only if live** (recommended v1) | Simple; matches “don’t spawn from notify path” | Dead session → guild master still restores manually |
| **B — ensureLive then poke** | Better automation | Notify path may spawn/restore PO — heavier, surprise side effects |

**Recommendation:** **A** for 0.5.0 v1. Document that `restore` + poke can be a 0.5.1 enhancement.

### 5.2 Which routes get poke?

| Route | Poke? |
|-------|-------|
| `POST /missions/:id/approve-artifacts` | Yes |
| `POST /missions/:id/reject-artifacts` | Yes |
| `POST /missions/:id/abort` | Yes (execution) |
| `POST /missions/:id/escalate` | Optional (intake uses `awaiting_input`) |
| `POST /missions/:id/approve-discovery` | No |
| `POST /mission-board-notes/:id/abort` | Only if room + live session on discovering/working |

### 5.3 Intake lead vs PO

Both use `GET /missions/:id/session` + same room root. Poke targets `checkpoint.claude_session.id` regardless of mode (`intake` vs execution). Message wording may say “intake lead” vs “project owner” based on `checkpoint.mode`.

---

## 6. Configuration

| Env | Default (proposed) | Meaning |
|-----|-------------------|---------|
| `GUILD_SESSION_POKE` | `1` when shipped | Enable orchestrator attach poke on guild-master directives |
| `GUILD_CHANNEL_PUSH` | `0` | Keep channel off unless explicitly testing |
| `GUILD_SESSION_POKE_TIMEOUT_MS` | `8000` | Max wait for attach + inject |
| `GUILD_SESSION_POKE_MESSAGE` | unset | Optional override template |

Feature interaction:

- `GUILD_SESSION_POKE=0` → degraded mode (inbox only), same as today with channel off.
- Web UI may re-show approve buttons when `sessionPokeEnabled: true` **or** when poke delivered in response (product choice in implementation plan).

---

## 7. Alternatives considered

| Approach | Outcome |
|----------|---------|
| Fix guild-channel idle delivery | Upstream / research-preview; no Guild timeline |
| Manual attach only (0.4.0 interim) | Works but poor UX; guild-desk cannot close-out via API alone |
| Spawn fresh PO on approve | **Rejected** — breaks attach-to-bg locked semantics |
| Claude Agent SDK / headless message API | No stable path to existing `--bg` session id today |
| Poll `inbox.md` from PO sidecar | Requires PO loop change; not orchestrator-driven |
| **Session poke (this proposal)** | Reuses attach PTY; filesystem-first; Guild-controlled |

---

## 8. Product / UX impact

### 8.1 Web UI

- Re-enable **Approve artifacts** / **Reject** when `sessionPokeEnabled` (not only `channelPushEnabled`).
- Toast: “Approved — PO poked” vs “Approved — inbox only; restore session” on `poke.delivered: false`.

### 8.2 guild-desk

- Close-out workflow: API approve becomes **viable** again when poke enabled.
- Skill text: replace “attach-first required” with “API approve pokes PO; attach if poke failed”.

### 8.3 Templates / playbooks

- PO agent.md: add one line — on `[guild-house]` poke prefix, **read checkpoint.yaml and comm/inbox.md** before acting.
- No change to signal API for PO-initiated flows.

---

## 9. Testing strategy

| Layer | Test |
|-------|------|
| Unit | Message template; mutex; timeout handling (mock PTY) |
| Integration | Script `server/scripts/poc-session-poke.ts` — live `--bg` PO, idle at prompt, POST approve, assert PO output mentions inbox / phase |
| E2E | Extend `e2e-040.ts` close-out with optional `--poke` flag when Claude available |
| Manual | Approve with Web UI while PO idle; without human attach |

**Success criteria**

1. Approve-artifacts with live idle PO → PO begins release flow within one turn **without** guild master terminal.
2. Poke failure does not roll back checkpoint / inbox.
3. WS browser attach and poke do not corrupt each other in quick succession.
4. Dead session → `poke.delivered: false`; guild master sees clear reason.

---

## 10. Implementation phases (sketch)

| Phase | API bump | Deliverable |
|-------|----------|-------------|
| **0 — Spike** | — | `poc-session-poke.ts`; prove idle PO receives inject |
| **1 — Core** | `0.31.0` | `session-poke.ts`; wire `deliverGuildMasterDirective`; health flag |
| **2 — Product** | — | Web UI + guild-desk skill; docs; re-enable approve buttons |
| **3 — Hardening** | `0.32.0` | Mutex with WS attach; metrics; optional restore-before-poke |

Product `version.md` → **0.5.0** when Phase 1–2 complete and manual sign-off recorded.

---

## 11. Non-goals (0.5.0)

- Removing guild-channel MCP (may remain dormant)
- Bidirectional chat from orchestrator
- Poke into **guild master’s** attach session
- Windows native PTY for poke (WSL/Linux dev first, same as 0.3.0 terminal)
- Automatic poke on bell / tick

---

## 12. Open questions

1. **Detach sequence** — Does `Ctrl+]` / `claude attach` exit leave bg job clean? Spike must confirm.
2. **Message length** — Keep under ~240 chars to avoid paste issues in PTY?
3. **Rate limit** — Debounce repeated approve clicks?
4. **Security** — Poke runs server-side with guild API key trust; no new HTTP surface on mission room.

---

## 13. References

- [0.3.0 channel PoC notes](../0.3.0/channel-poc-notes.md)
- [guild-house/docs/guild-channel.md](../../guild-house/docs/guild-channel.md)
- [guild-house/specs/terminal-attach.md](../../guild-house/specs/terminal-attach.md)
- [0.4.0 design](../0.4.0/design.md) — filesystem-first, attach semantics
- `server/src/websocket/attach-pty.ts` — existing PTY + attach launch

---

## 14. Summary

**Yes, the approach is feasible:** after approve updates mission state on disk, the server can open an **ephemeral** `claude attach` via the same PTY machinery as Web terminal attach, inject a **short user message** telling the lead to read **checkpoint + inbox**, then tear down the poke PTY without stopping the `--bg` job.

It is **best-effort** (like channel), but targets the **idle prompt** case channel misses, stays **filesystem-first**, and respects **attach-to-bg** locked semantics. Recommend shipping as **0.5.0 session poke** with `GUILD_SESSION_POKE` default on and channel push remaining off.
