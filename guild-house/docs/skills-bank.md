# Guild skills bank

**Singleton:** `guild-house/data/skills-bank/` — committed in repo.

Dual-layer structure: `built-in/` (product skills, committed, guild master maintains) and `custom/` (user-defined, gitignored except skeleton).

## Layout

```text
data/skills-bank/
  built-in/                    ← product skills (committed, guild master maintains)
    catalog.md                 ← built-in skill names + one-line summaries
    skills/
      modify-git-project/
      modify-guild/
      ad-hoc-create/
  custom/                      ← user-defined skills (gitignored content)
    catalog.md                 ← custom skill names + one-line summaries
    skills/
      .gitkeep                 ← tracked skeleton for git status
```

| File | Role |
|------|------|
| `data/skills-bank/built-in/catalog.md` | **Built-in catalog** — skill names + one-line summaries for PO browsing |
| `data/skills-bank/custom/catalog.md` | **Custom catalog** — user-defined skills |
| `data/skills-bank/{built-in,custom}/skills/{name}/SKILL.md` | Full skill definition |
| `templates/mission-execution/mission-management/skills-bank.md` | **How to wire** — copied into execution missions at scaffold |
| `templates/mission-intake/mission-management/skills-bank.md` | Same for intake missions |

Boot ensures `data/skills-bank/` exists with both `built-in/` and `custom/` skeleton; no template seed.

## Wiring (summary)

PO / intake lead Round 0: read **catalogs** (both built-in and custom) → follow **mission-management/skills-bank.md** → `wire.sh`. Built-in skills take priority over custom skills with the same name.

See [ideas/0.3.0/design.md](../../ideas/0.3.0/design.md) §10 · [ideas/0.4.0/design.md](../../ideas/0.4.0/design.md) §6.5.

## API (read-only)

`GET /skills-bank` · `GET /skills-bank/:name`

API merges built-in and custom catalogs. Response includes `source` field (`"built-in"` or `"custom"`) on each skill item.

## Guild master curation

Promote `retrospective/skills-reports/` → new folder under `data/skills-bank/built-in/skills/` + row in `built-in/catalog.md`. Custom skills are managed by users under `custom/skills/` directly. Details in `mission-management/skills-bank.md`.