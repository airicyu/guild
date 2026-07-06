# Using the skills bank

**Catalog:** `../../skills-bank/built-in/catalog.md` — built-in skills (short summaries).  
**Custom catalog:** `../../skills-bank/custom/catalog.md` — user-defined skills.  
**Bank path:** `../../skills-bank/{built-in,custom}/skills/{name}/` — full `SKILL.md` per entry.

Dual-layer skills bank lives in `guild-house/data/skills-bank/` with `built-in/` (product, committed) and `custom/` (user-defined, gitignored except skeleton). This room copies selected skills at charter — not symlink. Built-in skills take priority over custom skills with the same name.

---

## When to wire

| Mode | Who | When |
|------|-----|------|
| Execution | PO | **Round 0** — after reading `mission-brief.md`, **before** spawning evaluator |
| Intake | Intake lead | **Round 0** — before explore / draft packages |

---

## How to wire

1. Read `../../skills-bank/built-in/catalog.md` and `../../skills-bank/custom/catalog.md` — choose skills for this mission.
2. Optionally read `../../skills-bank/{built-in,custom}/skills/{name}/SKILL.md` for any skill you are unsure about.
3. Copy into this room (deterministic — do not hand-copy folders):

```bash
.claude/skills/wire-skills-from-bank/wire.sh skill-a skill-b
```

| Source | Destination |
|--------|-------------|
| `../../skills-bank/built-in/skills/{name}/` or `../../skills-bank/custom/skills/{name}/` | `.claude/skills/{name}/` |

4. **Execution only:** during charter (Round 2), write `members/{role}/skills.md` — which wired skills each agent should use.

Squad members do not run `wire.sh`; they follow PO assignments.

---

## Guild master: add or retire a skill

Edit `data/skills-bank/` directly (no write API):

```text
data/skills-bank/
  built-in/             ← product skills (committed, guild master maintains)
    catalog.md
    skills/{name}/
      SKILL.md
  custom/               ← user-defined skills (gitignored content)
    catalog.md
    skills/{name}/
      SKILL.md
```

Promote from mission `retrospective/skills-reports/*.md` when appropriate. Add built-in skills under `built-in/`; users add custom skills under `custom/`. Retiring a skill removes the folder and catalog row; already-wired rooms keep their copies.

---

## API (read-only)

| Method | Path |
|--------|------|
| GET | `/skills-bank` |
| GET | `/skills-bank/:name` |