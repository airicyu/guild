# Guild skills bank

Central catalog of Claude Code skills copied into mission and discovery rooms at charter time. Design: [ideas/0.3.0/design.md](../../ideas/0.3.0/design.md) §10.

## Layout

```
guild-house/data/skills-bank/          # gitignored runtime (seeded from template on boot)
  catalog.md
  {skill-name}/
    SKILL.md
    …

guild-house/templates/skills-bank/   # committed seed + example
```

On API boot, if `data/skills-bank/catalog.md` is missing, orchestrator copies `templates/skills-bank/` → `data/skills-bank/`.

## Wiring into rooms

Every mission and discovery room template ships **`.claude/skills/wire-skills-from-bank/`** (bootstrap meta-skill — not copied from the bank).

From room cwd (`data/mission-rooms/{id}/` or `data/discovery-rooms/{id}/`):

```bash
.claude/skills/wire-skills-from-bank/wire.sh skill-a skill-b
```

| From | To |
|------|-----|
| Bank | `../skills-bank/{skill-name}/` |
| Destination | `.claude/skills/{skill-name}/` |

**CLI args only** in 0.3.0 — no manifest file. Copy is deterministic bash, not ad-hoc LLM `cp`.

## When agents wire

| Room | Round | Who |
|------|-------|-----|
| Mission | Round 0 — before evaluator | PO |
| Discovery | Round 0 — before explore | Intake lead |

After wiring, PO writes `members/{role}/skills.md` during charter (Round 2) listing which skills each agent should use.

## API (read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/skills-bank` | `catalog.md` text + skill folder list |
| GET | `/skills-bank/:name` | Skill detail (`SKILL.md` + all files in folder) |

No write API in 0.3.0.

## Promoting skills-reports → bank

Retrospective `retrospective/skills-reports/*.md` are **proposals only**.

**Guild master manual workflow:**

1. Read PO's `skills-reports/*.md` after mission close-out
2. Create or update `data/skills-bank/{skill-name}/SKILL.md` (+ optional scripts)
3. Update `data/skills-bank/catalog.md`
4. Future missions can wire the new skill via `wire-skills-from-bank`

No orchestrator automation — bank curation is a guild master responsibility.

## References

- Wire skill: `templates/mission-room/.claude/skills/wire-skills-from-bank/`
- Implementation: `src/orchestrator/skills-bank/`
- PO playbook: `templates/mission-room/members/project-owner/agent.md`
- Discovery playbook: `templates/discovery-room/members/intake-lead/agent.md`
