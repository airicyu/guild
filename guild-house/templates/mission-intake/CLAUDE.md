# Mission room — intake mode

Your cwd is this mission room (`mission-rooms/{{missionId}}/`).

## Read order (intake-lead)
1. This file
2. `mission-brief.md` — frozen brief from board note
3. `members/intake-lead/agent.md`
4. `mission-management/handoff-prompt.md` — lead only

## Layout
- `checkpoint.yaml` — orchestrator only; use signals API
- `mission-brief.md` — frozen brief (read-only)
- `mission-management/` — lead guidance
- `comm/` — inbox, outbox (or room root during transition)
- `artifacts/missions/` — draft packages for guild master approve
