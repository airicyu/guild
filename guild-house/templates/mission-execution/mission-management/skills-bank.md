# Using the skills bank

**Catalog:** `../../skills-bank/catalog.md` — what exists (short summaries).  
**Bank path:** `../../skills-bank/{skill-name}/` — full `SKILL.md` per entry.

Singleton source of truth lives in `guild-house/data/skills-bank/` (committed). This room copies selected skills at charter — not symlink.

---

## When to wire

| Mode | Who | When |
|------|-----|------|
| Execution | PO | **Round 0** — after reading `mission-brief.md`, **before** spawning evaluator |
| Intake | Intake lead | **Round 0** — before explore / draft packages |

---

## How to wire

1. Read `../../skills-bank/catalog.md` — choose skills for this mission.
2. Optionally read `../../skills-bank/{name}/SKILL.md` for any skill you are unsure about.
3. Copy into this room (deterministic — do not hand-copy folders):

```bash
.claude/skills/wire-skills-from-bank/wire.sh skill-a skill-b
```

| Source | Destination |
|--------|-------------|
| `../../skills-bank/{name}/` | `.claude/skills/{name}/` |

4. **Execution only:** during charter (Round 2), write `members/{role}/skills.md` — which wired skills each agent should use.

Squad members do not run `wire.sh`; they follow PO assignments.

---

## Guild master: add or retire a skill

Edit `data/skills-bank/` directly (no write API):

```text
data/skills-bank/
  catalog.md           ← one-line summary per skill (for PO browsing)
  {skill-name}/
    SKILL.md           ← required
    …
```

Promote from mission `retrospective/skills-reports/*.md` when appropriate. Retiring a skill removes the folder and catalog row; already-wired rooms keep their copies.

---

## API (read-only)

| Method | Path |
|--------|------|
| GET | `/skills-bank` |
| GET | `/skills-bank/:name` |
