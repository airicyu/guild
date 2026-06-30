# mission.md schema

The **guild master** drops `mission.md` under `data/mission-board/{parking|ready}/{folder}/`.  
Use a friendly **slug** folder name (e.g. `hello-world`). At **bell pickup**, orchestrator mints a unique mission id if needed:

```text
{slug}-{YYYYMMDD}-{6hex}
```

Example: `hello-world` → `hello-world-20260627-a3f9c2`

If you pre-mint the folder name with that pattern and the id is unused, bell keeps it as-is.

On bell pickup, orchestrator copies brief → `mission-rooms/{id}/memories/common/mission-brief.md` (frozen snapshot).

**Guild master** in playbooks is the human supervisor role — not a substituted name. See [product.md](./product.md) § Guild master. `GUILD_MASTER_NAME` is display-only (`GET /health`, Web UI).

---

## Format

Markdown with **YAML frontmatter** + body.

```yaml
---
title: Human-readable mission title
intent: One-line goal
autonomy: high | medium | low   # optional, default medium
priority: normal                  # optional: low | normal | high
constraints:                      # optional list
  - No new dependencies
  - Python 3.11+ only
---
```

### Frontmatter fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Short name shown in board/outbox context |
| `intent` | yes | One sentence — what success looks like |
| `autonomy` | no | How much PO may decide without the guild master (`medium` default) |
| `priority` | no | Guild-master-facing priority hint |
| `constraints` | no | Hard limits (stack, time, deps, scope boundaries) |

---

## Body sections (recommended)

```markdown
# {title}

## Background
Why this mission exists (2–5 sentences).

## Deliverables
- Concrete outputs (paths under `artifacts/` when known)

## Acceptance criteria
- [ ] Testable criterion 1
- [ ] Testable criterion 2

## Out of scope
- Explicit non-goals

## Notes
- Links, references, open questions for evaluator
```

PO and evaluator treat **Acceptance criteria** as the contract for QA and `mission_complete`.

---

## Autonomy levels

| Level | PO may decide | Escalate when |
|-------|----------------|---------------|
| `high` | Stack, squad, implementation plan | Product direction, security, external access |
| `medium` | Squad and plan within constraints | Ambiguous acceptance, constraint conflicts |
| `low` | Task breakdown only | Structural choices, scope changes |

---

## Example

See `templates/mission-board/mission.md.example` in the guild-house repo.

---

## Board vs mission room

| Location | Role | Who writes |
|----------|------|------------|
| `mission-board/.../mission.md` | Guild master intake; editable reference | Guild master |
| `mission-rooms/.../memories/common/mission-brief.md` | Frozen snapshot at bell pickup | **Orchestrator only** (copy from board `mission.md`); PO **read-only** |
| `mission-rooms/.../memories/common/memory.md` | Living team truth | PO (team lead) |
| `mission-rooms/.../memories/common/events.jsonl` | Append-only audit / milestone log (guild master UI) | PO + squad via `tools/log` (not a chat channel) |
| `mission-rooms/.../memories/members/{role}/memory.md` | Per-member scratch | That member |

If the guild master edits the board brief after pickup, PO should compare and sync important changes into `common/memory.md`.

Orchestrator **ensures** `mission-brief.md` exists on active sync (copies from board if missing — legacy rooms).

### events.jsonl (not chatroom)

Agent coordination uses **Claude Code agent team / Task** (live). `events.jsonl` is for milestones and evidence — guild master visibility, not member-to-member messaging.

| Writer | Allowed `type` values |
|--------|----------------------|
| `project-owner` | `milestone`, `directive`, `evaluator_done`, `round_note` |
| Squad members | `status`, `evidence`, `qa_pass`, `qa_fail` |

API: `GET/POST /missions/:id/events` (v0.9.0+).
