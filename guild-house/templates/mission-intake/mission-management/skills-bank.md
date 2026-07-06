# Using the skills bank

**Catalog:** `../../skills-bank/built-in/catalog.md` — built-in skills (short summaries).  
**Custom catalog:** `../../skills-bank/custom/catalog.md` — user-defined skills.  
**Bank path:** `../../skills-bank/{built-in,custom}/skills/{name}/` — full `SKILL.md` per entry.

Dual-layer skills bank lives in `guild-house/data/skills-bank/` with `built-in/` (product, committed) and `custom/` (user-defined, gitignored except skeleton). This room copies selected skills at charter — not symlink. Built-in skills take priority over custom skills with the same name.

---

## When to wire (intake)

**Intake lead** — **Round 0**, before explore / draft packages under `artifacts/missions/`.

---

## How to wire

1. Read `../../skills-bank/built-in/catalog.md` and `../../skills-bank/custom/catalog.md` — choose skills for this discovery mission.
2. Optionally read `../../skills-bank/{built-in,custom}/skills/{name}/SKILL.md` for detail.
3. Copy into this room:

```bash
.claude/skills/wire-skills-from-bank/wire.sh skill-a skill-b
```

| Source | Destination |
|--------|-------------|
| `../../skills-bank/built-in/skills/{name}/` or `../../skills-bank/custom/skills/{name}/` | `.claude/skills/{name}/` |

---

## Guild master curation

See `templates/mission-room/mission-management/skills-bank.md` in the guild-house repo for bank layout and promotion from retrospective reports.

---

## API (read-only)

| Method | Path |
|--------|------|
| GET | `/skills-bank` |
| GET | `/skills-bank/:name` |