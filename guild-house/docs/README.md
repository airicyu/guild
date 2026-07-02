# Guild House — docs

**Human-oriented documentation** — guides, API reference. No runtime dependency (guild-desk links to `api.md`).

| File | Purpose |
|------|---------|
| [api.md](./api.md) | REST + WebSocket reference |
| [guild-channel.md](./guild-channel.md) | Per-mission channel PoC (0.3.0 Phase 0) |
| [e2e-discovery-path.md](./e2e-discovery-path.md) | Plan 3 product walkthrough (idea → done) |
| [tests/](./tests/) | Manual QA checklists + smoke script index |

**Specs:** [specs/](../specs/) — product contracts, schemas, lifecycle rules, terminal UX.

When behavior changes: update **specs** first, then **docs** (and **docs/tests** if QA steps change).
