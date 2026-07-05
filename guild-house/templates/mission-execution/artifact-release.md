---
mode: stay
target: ""
source_paths:
  - artifacts/
status: draft
---

# Artifact release plan

PO maintains this file from scope eval through release. See design §6 in `ideas/0.3.0/design.md`.

## Mode

| Value | Meaning |
|-------|---------|
| `stay` | Deliverables remain in `artifacts/` (default) |
| `deploy` | Copy/install to **Target** after guild master approves |
| `custom` | Follow **Notes** — manual steps only |

## Target

Destination when `mode: deploy` (e.g. `guild-desk/.claude/skills/guild-master/`). Leave empty for `stay`.

## Source paths

Artifact subtrees to release (YAML `source_paths` above). Adjust per mission scope.

## Notes

Custom steps, guild-master chat decisions, deploy commands. PO updates before setting `status: confirmed`.

## Status lifecycle

| Status | When |
|--------|------|
| `draft` | PO drafts during Round 1–2 (scope eval / charter) |
| `confirmed` | Guild master refined in attach/inbox before review, or PO finalizes before `artifacts_ready_for_review` |
| `released` | PO finished manual release after guild master approve — **required** before `artifact_release_complete` signal |

**PO-alone default** when plan is vague: (1) this file, (2) mission brief deploy hints, (3) else `stay`.

Web/API approve = "yes, ship it" — PO executes per plan without UI negotiation.
