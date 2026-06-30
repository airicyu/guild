# Mission room Claude Code settings

Loaded automatically when PO session `cwd` is this mission room.

- **Spawn flag** (`--permission-mode acceptEdits` from guild-house bell) sets the session baseline.
- **`permissions.allow`** here pre-approves mission-room paths and basic tools without touching `~/.claude/settings.json`.
- **`permissions.deny`** blocks edits to orchestrator-owned files (`checkpoint.yaml`, frozen brief, handoff).

Per-mission overrides: add `.claude/settings.local.json` (gitignored in real missions if needed).
