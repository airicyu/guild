# Mission room Claude Code settings

Loaded automatically when PO session `cwd` is this mission room.

- **Spawn flag** (`--permission-mode acceptEdits` from guild-house bell) sets the session baseline.
- **`worktree.bgIsolation: "none"`** — PO `--bg` writes `squad.md`, `memories/`, etc. directly here without `EnterWorktree` → copy dance. Requires Claude Code **2.1.143+**. Guild repo is git-backed; mission room files live under gitignored `data/` but default bg isolation still applies without this setting.
- **`permissions.allow`** here pre-approves mission-room paths and basic tools without touching `~/.agents/settings.json`.
- **`permissions.deny`** blocks edits to orchestrator-owned files (`checkpoint.yaml`, frozen brief, handoff).

Per-mission overrides: add `.agents/settings.local.json` (gitignored in real missions if needed).

**Existing rooms:** copy `worktree` block from this template into `mission-rooms/{id}/.agents/settings.json`, or re-scaffold on next pickup.
