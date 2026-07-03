# Manual test — 0.3.0 close-out (approve → release → retro → dismiss)

Full mission close-out QA for product **0.3.0**. Covers API-only (channel degraded) and optional live guild-channel wake.

**API version:** `GET /health` → **0.22.0** (minimum **0.17.0** for close-out semantics)

## Prerequisites

```bash
# Terminal 1
cd guild/guild-house && bun run dev

# Terminal 2
export GUILD_API_KEY=change-me-in-production
export AUTH="Authorization: Bearer $GUILD_API_KEY"
```

Optional Web UI: `bun run dev:ui` → http://127.0.0.1:3848

---

## Part A — Automated API path (no live PO)

Channel **degraded** — approve writes `inbox.md` + checkpoint only; no HTTP POST to guild-channel.

```bash
cd guild/guild-house
bun scripts/e2e-close-out-03.ts
# or directly:
bun scripts/e2e-phase1-closeout.ts
```

**Covers:**

| Step | Assertion |
|------|-----------|
| `artifacts_ready_for_review` | → `awaiting_artifact_review` |
| `POST .../approve-artifacts` | → `releasing`; stays on **working** |
| `artifact_release_complete` | requires `artifact-release.md` `status: released` |
| `retrospective_complete` | requires `workflow-report.md` |
| `mission_complete` | requires prior `retrospective_complete`; → **done** |
| `POST .../reject-artifacts` | → `blocked` on working |
| `POST .../abort` | → **aborted**; `abort-note.md` |
| Archive | from **done** and **aborted** |

---

## Part B — Manual with live PO (channel optional)

### B1. Execution intake

Follow [execution-e2e.md](./execution-e2e.md) §1–3: drop brief on **queued**, bell → **working**, PO handoff.

### B2. Close-out signals (attach or Web UI)

1. PO signals `artifacts_ready_for_review`
2. **Web UI:** mission room → **Approve artifacts** (phase pill `awaiting_artifact_review`)
3. **API:** `POST /missions/{id}/approve-artifacts`
4. PO executes `artifact-release.md` → `status: released` → `artifact_release_complete`
5. PO writes `retrospective/workflow-report.md` → `retrospective_complete` → `mission_complete`
6. **Web UI:** Close-out tab — view `artifact-release.md` + retrospective tree
7. **Archive** from **done**

### B3. Guild-channel wake (requires dev flag)

**Prerequisites:** `CLAUDE_DEV_CHANNELS=1`, Claude Code 2.1.80+, WSL/Linux. See [guild-channel.md](../guild-channel.md).

```bash
bun scripts/setup-channel-approve-test.ts
```

Then approve via Web UI or API and verify:

- [ ] API log: `[channel-notify]` / `delivered: true` (or degraded if PO stopped)
- [ ] Live PO receives `<channel source="guild-house" event="artifacts_approved">`
- [ ] PO reads `inbox.md` and continues release per playbook

**Reject / abort channel:** same pattern for `reject_artifacts` / `abort_mission` events when guild master uses API.

---

## Part C — Discovery + backlog (smoke)

Quick manual checks after close-out QA:

| Check | How |
|-------|-----|
| Backlog submit | Web **Submit idea** → default **Add to backlog** |
| Promote backlog | **Promote to Ideas** on card → bell picks up |
| Parking detail | Click parking card → read brief → promote from detail |
| Skills bank | `GET /skills-bank`; new room has `wire-skills-from-bank` |

See [e2e-discovery-path.md](../e2e-discovery-path.md).

---

## Checklist (sign-off)

- [ ] Part A automated script passes
- [ ] Part B2 Web approve + close-out tabs (no attach required for approve)
- [ ] Part B3 channel wake (or document degraded skip with reason)
- [ ] Reject and abort paths exercised once (API or Web)
- [ ] Archive from **done** and **aborted**

---

## Related

| Resource | Purpose |
|----------|---------|
| [execution-e2e.md](./execution-e2e.md) | Queued → archive execution path |
| [e2e-discovery-path.md](../e2e-discovery-path.md) | Full discovery pipeline |
| [guild-channel.md](../guild-channel.md) | Channel PoC + dev setup |
| `scripts/e2e-close-out-03.ts` | Runner: Part A auto + Part B instructions |
