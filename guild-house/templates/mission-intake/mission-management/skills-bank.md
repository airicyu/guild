# Using the skills bank

**Catalog:** `../../skills-bank/catalog.md` — what exists (short summaries).  
**Bank path:** `../../skills-bank/{skill-name}/` — full `SKILL.md` per entry.

Singleton source of truth lives in `guild-house/data/skills-bank/` (committed). This room copies selected skills at charter — not symlink.

---

## When to wire (intake)

**Intake lead** — **Round 0**, before explore / draft packages under `artifacts/missions/`.

---

## How to wire

1. Read `../../skills-bank/catalog.md` — choose skills for this discovery mission.
2. Optionally read `../../skills-bank/{name}/SKILL.md` for detail.
3. Copy into this room:

```bash
.claude/skills/wire-skills-from-bank/wire.sh skill-a skill-b
```

| Source | Destination |
|--------|-------------|
| `../../skills-bank/{name}/` | `.claude/skills/{name}/` |

---

## Guild master curation

See `templates/mission-room/mission-management/skills-bank.md` in the guild-house repo for bank layout and promotion from retrospective reports.

---

## API (read-only)

| Method | Path |
|--------|------|
| GET | `/skills-bank` |
| GET | `/skills-bank/:name` |
