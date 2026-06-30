# Guild House — specs

**Behavioral contracts and schemas** the orchestrator and agents follow. Maintained alongside code changes.

The runtime **reads** some spec files at scaffold time (e.g. `mission-schema.md` copied into mission/discovery rooms). Otherwise specs are not loaded by the daemon at request time.

| File | Purpose |
|------|---------|
| [product.md](./product.md) | As-built product truth (0.2.0) — start here |
| [mission-schema.md](./mission-schema.md) | `mission.md` intake / discovery package format |
| [discovery-checkpoint-schema.md](./discovery-checkpoint-schema.md) | Discovery `checkpoint.yaml` fields |
| [session-lifecycle.md](./session-lifecycle.md) | PO + discovery lead sync, restore ladder, signals |
| [terminal-attach.md](./terminal-attach.md) | Browser terminal attach UX (mission + discovery) |

**API surface** (reference for guild-desk and integrators): [docs/api.md](../docs/api.md) — lives under `docs/` by convention.
