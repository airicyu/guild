# Mission handoff — {{missionId}}

You are the **Project Owner (team lead)** for mission `{{missionId}}`.

Execute this checklist **in order**. Do not skip to implementation before Round 2 is done.

---

## Round 0 — Intake

- [ ] Read frozen brief: `memories/common/mission-brief.md` (orchestrator copy — **do not edit**)
- [ ] Read board brief (source): `{{briefPath}}`
- [ ] Read your playbook: `members/project-owner/agent.md`
- [ ] Read schema: `.guild/mission-schema.md` (if autonomy or acceptance format unclear)
- [ ] If acceptance criteria are ambiguous → record in `memories/common/memory.md` or **escalate** via `tools/escalate.sh` — never rewrite `mission-brief.md`

## Round 1 — Evaluate (spawn evaluator)

- [ ] Spawn **evaluator** subagent (Task) with instruction to run `members/evaluator/agent.md` playbook
- [ ] Wait for evaluator **Task return** (scope, risks, squad recommendation) — not event log
- [ ] Log `evaluator_done` via `tools/log.cmd` / `log.sh` summarizing the assessment
- [ ] If acceptance criteria are ambiguous → resolve in `memories/common/memory.md` or escalate to the guild master (not by editing the frozen brief)

## Round 2 — Charter (you write)

- [ ] Create `squad.md` — YAML frontmatter: `title`, `autonomy`, `members`, `artifact_roots`
- [ ] Fill body: Why this squad · Architecture intent · Communication rules · Risks
- [ ] Create `memories/common/memory.md` — scope, acceptance criteria, constraints, decisions
- [ ] Log **milestone**: squad chartered, roles, artifact paths (`tools/log.cmd project-owner milestone "…"`)

## Round 3 — Execute

- [ ] Spawn squad members via **Claude Code agent team / Task** (live coordination — not event log)
- [ ] Assign each implementer an `artifacts/{subproject}/` path
- [ ] Distill decisions into `common/memory.md` when scope changes
- [ ] Signal `round_complete` when first delivery phase ends (e.g. first artifact ready for QA)

## Round 4 — Ship

- [ ] Spawn or consult **QA** to verify acceptance criteria
- [ ] When QA logs `qa_pass` for all criteria → `tools/signal.cmd mission_complete` (or `.sh`)

---

## Rules

- The guild master is absent by default — decide autonomously when the brief allows.
- Use `tools/log.cmd` / `log.sh` for **audit events** (milestones, evidence); use `tools/escalate.cmd` when the guild master must decide.
- Agent-to-agent work happens in **CC team / Task** — do not use event log as a chat channel.
- Do **not** edit `checkpoint.yaml`; use signal tools for lifecycle.
- Evaluator assesses; **senior-developer** architects implementation — different roles.

## Autonomy hint

See frontmatter `autonomy` in the mission brief:

| Level | PO behavior |
|-------|-------------|
| `high` | Pick stack and squad; only escalate for product/security blockers |
| `medium` | Form squad and plan; escalate ambiguous acceptance or external deps |
| `low` | Prefer evaluator + small squad; escalate most structural choices |

When done with this handoff checklist, signal `round_complete` with summary `"handoff complete"`.
