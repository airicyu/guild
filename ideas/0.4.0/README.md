# Guild 0.4.0 — Unified mission model

Fuse discovery and execution into one **Mission** runtime (`mission-rooms/`), while keeping **mission board notes** on the Kanban (`mission-board/`) as the moving column layer — same 0.3.0 rename pattern, clearer domain language.

| Doc | Purpose |
|-----|---------|
| [design.md](./design.md) | **Aligned design** — mission board note vs mission, approve handoff, invariants |

**Domain language (short):**

| Term | Where | Moves with column? |
|------|-------|-------------------|
| **Mission board note** | `mission-board/{stage}/{id}/` | Yes |
| **Mission** | `mission-rooms/{id}/` (Claude cwd) | No (stable by id) |

Unqualified **mission** means the **room runtime**, not a board card.

**Baseline:** product **0.3.0** · API **0.22.0** ([guild-house/specs/product.md](../../guild-house/specs/product.md)).

**Status:** Implementation complete (2026-07-05). See [implementation-plan.md](./implementation-plan.md).

**API (short):** **`POST /ideas`** stays for submit-to-backlog; list/detail → **`/mission-board-notes`**; room → **`/missions/:id`**. Legacy **`GET /ideas*`** and **`/discoveries/*`** removed in implementation **final phase** (see [design.md §10](./design.md#10-api-direction-design-level)).

**Out of scope for this folder:** runtime code, `guild-house/specs/` updates (ship with implementation).
