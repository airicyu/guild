---
name: wire-skills-from-bank
description: >-
  Copy named skills from guild-house data/skills-bank into this room's
  .agents/skills/. Use during Round 0 before evaluator (mission) or explore
  (discovery).
disable-model-invocation: true
---

# Wire skills from bank

Deterministic bootstrap — **do not** ad-hoc `cp` bank folders. Always use the bundled script.

## When to use

- **Mission PO:** Round 0 intake, after reading the brief, **before** spawning evaluator
- **Discovery intake lead:** Round 0 intake, after reading scratch, **before** explore/draft

## Steps

1. Read `../../skills-bank/built-in/catalog.md` and `../../skills-bank/custom/catalog.md` — browse available skills
2. Follow `mission-management/skills-bank.md` for wiring procedure
3. Run the wire script with explicit skill names (CLI args — no manifest file):

```bash
.agents/skills/wire-skills-from-bank/wire.sh skill-a skill-b
```

4. During charter, write `members/{role}/skills.md` listing which wired skills each agent should use

## Path resolution (locked)

| From | To |
|------|-----|
| Room cwd | `data/mission-rooms/{id}/` or `data/discovery-rooms/{id}/` |
| Built-in bank | `../../skills-bank/built-in/skills/{name}/` |
| Custom bank | `../../skills-bank/custom/skills/{name}/` |
| Destination | `.agents/skills/{skill-name}/` |

Built-in skills take priority over custom skills with the same name.

## Errors

Script exits non-zero if a skill is missing from both bank layers or lacks `SKILL.md`. Fix the bank (guild master) or pick different skills.

## Notes

- This meta-skill is **pre-shipped** in the room template — not copied from the bank
- Retrospective `skills-reports/` are proposals only; guild master promotes to bank manually