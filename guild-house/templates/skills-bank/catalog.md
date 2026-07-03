# Guild skills bank catalog

Central catalog of Claude Code skills copied into mission and discovery rooms at charter time via **`wire-skills-from-bank`**.

## How skills enter the bank

1. Mission retrospectives may produce `retrospective/skills-reports/*.md` (feedback + proposals).
2. **Guild master** reads proposals and manually creates or updates entries here — no API write in 0.3.0.
3. Update this catalog when adding or retiring skills.

## Available skills

| Skill | Purpose |
|-------|---------|
| `example-skill` | Template example — safe to delete after first real skill is added |

## Wiring into a room

From a mission or discovery room cwd (`data/mission-rooms/{id}/` or `data/discovery-rooms/{id}/`):

```bash
.claude/skills/wire-skills-from-bank/wire.sh example-skill
```

Bank path is fixed relative: `../skills-bank/{skill-name}/` → room `.claude/skills/{skill-name}/`.

PO (mission) or intake lead (discovery) runs wire during **Round 0** before evaluator / explore.

## Adding a skill

```text
skills-bank/
  catalog.md          ← update this file
  {skill-name}/
    SKILL.md          ← required
    …                 ← optional scripts, references
```

Skill folder names: lowercase letters, digits, hyphens (e.g. `deploy-artifacts`).
