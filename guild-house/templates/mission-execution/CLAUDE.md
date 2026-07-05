# Mission room — execution mode

Your cwd is this mission room (`mission-rooms/{{missionId}}/`).

## Read order (all members)
1. This file
2. `squad.md`
3. `memories/common/memory.md`

## Read order (PO / lead)
- `mission-management/handoff-prompt.md`
- `mission-brief.md`

## Layout
- `checkpoint.yaml` — orchestrator only; use signals API
- `mission-brief.md` — frozen brief (read-only)
- `mission-management/` — handoff, schema, artifact-release
- `comm/` — inbox, outbox, channel-endpoint (or room root during transition)
- `memories/` — runtime truth
