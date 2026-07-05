# Guild skills bank

**Singleton:** `guild-house/data/skills-bank/` — committed in repo.

| File | Role |
|------|------|
| `data/skills-bank/catalog.md` | **Catalog only** — skill names + one-line summaries for PO browsing |
| `data/skills-bank/{name}/SKILL.md` | Full skill definition |
| `templates/mission-room/mission-management/skills-bank.md` | **How to wire** — copied into execution missions at scaffold |
| `templates/discovery-room/mission-management/skills-bank.md` | Same for intake missions |

Boot ensures `data/skills-bank/` exists; no template seed.

## Wiring (summary)

PO / intake lead Round 0: read **catalog** → follow **mission-management/skills-bank.md** → `wire.sh`.

See [ideas/0.3.0/design.md](../../ideas/0.3.0/design.md) §10 · [ideas/0.4.0/design.md](../../ideas/0.4.0/design.md) §6.5.

## API (read-only)

`GET /skills-bank` · `GET /skills-bank/:name`

## Guild master curation

Promote `retrospective/skills-reports/` → new folder under `data/skills-bank/` + row in `catalog.md`. Details in `mission-management/skills-bank.md`.
