# Phase 1 migration — 0.3.0 close-out lifecycle

When upgrading from API **0.16.0** (product 0.2.0) to **0.17.0+**.

## Automatic (boot)

On API start, `recoverActiveMissions()` runs:

1. **`reconcileLegacyDoneMissions`** — `phase: done` still on **working/** → **done/**
2. **`reconcileAbortedOnWorking`** — `phase: aborted` still on **working/** → **aborted/**

The **aborted/** board folder is created by `ensureDataLayout()` on boot.

## Breaking change: `mission_complete`

**0.2.0:** `mission_complete` from any active phase → stop PO, **working → done**.

**0.3.0 (Phase 1+):** `mission_complete` only from **`retrospective`** phase.

### In-flight missions on **working**

| Situation | Action |
|-----------|--------|
| Mission still executing (`running`, `evaluating`, `blocked`) | Continue; use new close-out signals when QA passes |
| Mission was about to call `mission_complete` under old model | PO must walk new path: `artifacts_ready_for_review` → guild master approve → `artifact_release_complete` → `retrospective_complete` → `mission_complete` |
| Mission should end early | Guild master `POST /missions/:id/abort` |

There is **no** auto-migration of `running` → `retrospective`. Playbook updates land in Phases 2–3.

### Manual test path (before Phase 2–3 playbooks)

```bash
# PO signals QA ready
tools/signal.sh artifacts_ready_for_review "QA pass"

# Guild master (Web or tool)
tools/approve-artifacts.sh

# PO simulates release + retro (Phase 2–3 will formalize)
tools/signal.sh artifact_release_complete "release done"
tools/signal.sh retrospective_complete "retro done"
tools/signal.sh mission_complete "team dismiss"
```

## New board stage

**aborted/** — terminal like **done/**; does **not** count toward `MAX_ACTIVE_MISSIONS`. Archive via `POST /missions/:id/archive` when `phase: aborted`.

## Channel

Approve / reject / abort write `inbox.md` and POST to `guild-channel` when endpoint is live (Phase 0). Degraded mode: inbox + checkpoint only.
