# Discovery room template

Scaffolded by the orchestrator when an idea moves **Ideas → Discovering** (Plan 3).

**Purpose:** explore a rough idea, clarify scope with the guild master, and produce **executable mission package(s)** under `artifacts/missions/`. This room does **not** run mission execution — approved packages copy to `mission-board/parking/`.

## Layout (runtime)

```
discovery-rooms/{ideaId}/
  scratch.md              ← copy from mission-board/ideas/{ideaId}/ at pickup
  checkpoint.yaml         ← orchestrator-only (see specs/discovery-checkpoint-schema.md)
  outbox.jsonl
  inbox.md
  artifacts/
    missions/
      {slug}-{date}-{hex}/
        mission.md        ← one package per folder; approve copies each to parking/
  members/
    intake-lead/
      agent.md
  .guild/
    handoff-prompt.md
  .claude/
    settings.json
```

## Session naming

Background lead session: `discovery-{ideaId}-lead` (spawned in Plan 3 Phase 2).

## Lifecycle phases

`exploring` → `drafting` → `presenting` → `awaiting_approval` → `closed`

Guild master **Approve** — either Web UI / `POST /missions/:id/approve-discovery`, or intake lead runs `tools/approve.sh` when guild master approves in attach or inbox. Copies `artifacts/missions/*` to parking and closes intake.

See [mission-discovery-plan.md](../../../ideas/mission-discovery-plan.md).
