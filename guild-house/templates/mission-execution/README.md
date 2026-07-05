# Mission room template

Scaffolded on bell pickup from `templates/mission-room/`.

## Phase 5 contents

| Path | Purpose |
|------|---------|
| `members/*/agent.md` | Role playbooks (PO, evaluator, senior-dev, developer, qa) |
| `squad.md` | PO fills after evaluator — YAML frontmatter + charter body |
| `memories/common/mission-brief.md` | Frozen copy of board brief (orchestrator writes on pickup) |
| `memories/common/memory.md` | Living team truth (PO writes) |
| `artifact-release.md` | PO release plan |
| `retrospective/` | Member feedback, `workflow-report.md`, `skills-reports/` |
| `.guild/handoff-prompt.md` | First-run checklist (orchestrator writes on pickup) |
| `.guild/mission-schema.md` | Copy of intake schema for PO reference |
| `tools/*.cmd` / `*.sh` | API wrappers (signal, escalate, say) |
| `.claude/settings.json` | Mission-scoped CC allow/deny (no user `~/.claude` edits) |
| `.claude/skills/wire-skills-from-bank/` | Bundled meta-skill — copy bank skills at Round 0 (see [docs/skills-bank.md](../../docs/skills-bank.md)) |

See [specs/mission-schema.md](../../specs/mission-schema.md) for writing `mission.md` on the board.
