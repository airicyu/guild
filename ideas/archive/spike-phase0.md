# Phase 0 — `claudew --bg` spike (Windows)

> **Archive** — historical Plan 1 spike (2026-06-27). Spawn/parse behavior is in `src/orchestrator/session.ts`.

Date: 2026-06-27  
Environment: `claudew` wrapper → OpenRouter via `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`

## Checklist

| Item | Result |
|------|--------|
| `claudew --bg -n test-po` in test cwd | **PASS** — session `cf7f893b`, name `test-po` |
| Record session id / name | **PASS** — see parse rules below |
| `claude attach <id>` | **PASS** — syntax confirmed (not run interactively in spike) |
| `claude -r test-po` | **PASS** — `-r` accepts session name (CLI reference) |
| Spawn subagent (Task) from bg session | **DEFER** — requires interactive attach; PO agent responsibility |
| Close attach; bg session continues | **PASS** — documented CC behavior (detach via empty prompt ←) |
| `claude respawn <id>` | **PASS** — `respawned cf7f893b` |
| OpenRouter env on bg workers | **PARTIAL** — spawn via `claudew` inherits wrapper env; first bg service start may show auth UI until warmed |

## Spawn stdout (orchestrator parse target)

```
backgrounded · cf7f893b · test-po
  claude agents             list sessions
  claude attach cf7f893b    open in this terminal
  ...
```

**Regex:** `/backgrounded · ([a-f0-9]+)(?: · (.+))?/`

Prefer **`claude agents --json`** for structured fields:

```json
{
  "id": "cf7f893b",
  "sessionId": "cf7f893b-480f-4d4c-869c-cf542c8b42bc",
  "name": "test-po",
  "cwd": "C:\\Users\\airic\\airwave\\guild-house\\spike-test-cwd",
  "kind": "background"
}
```

## Session commands (for `GET /missions/:id/session`)

| Field | Value |
|-------|-------|
| `attachCmd` | `claudew attach {id}` |
| `resumeCmd` | `claudew -r mission-{id}-po` |
| `stopCmd` | `claude stop {id}` |
| `respawnCmd` | `claude respawn {id}` |
| `logsCmd` | `claude logs {id}` |

Mission spawn (Phase 2+):

```bash
cd "{missionRoomCwd}" && claudew --bg -n "mission-{id}-po" --permission-mode acceptEdits "{initialPrompt}"
```

Guild-house reads `CLAUDE_PERMISSION_MODE` (default `acceptEdits`). Mission room `.agents/settings.json` adds path-scoped `permissions.allow` / `deny` without touching user settings.

## Notes

- `--bg --help` accidentally spawns idle sessions; avoid passing `--help` after `--bg`.
- Background supervisor prints `Starting background service…` on first launch (stderr).
- **Phase 0 → Phase 1: GO**
