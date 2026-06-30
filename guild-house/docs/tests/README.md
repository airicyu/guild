# Tests — Guild House

Manual QA checklists and pointers to automated smoke scripts. Product walkthroughs (non-test) live in [docs/](../).

| Doc / script | Type | Purpose |
|--------------|------|---------|
| [execution-e2e.md](./execution-e2e.md) | Manual | Execution-only: `queued/` → archive (skip discovery) |
| [terminal-attach.md](./terminal-attach.md) | Manual | Browser terminal attach UX smoke |
| [../e2e-discovery-path.md](../e2e-discovery-path.md) | Walkthrough | Full Plan 3 path (idea → done) — in `docs/`, not a test checklist |
| [../../scripts/e2e-smoke.cmd](../../scripts/e2e-smoke.cmd) | Automated | API health → board → bell → missions → outbox |
| [../../scripts/test-ws-attach.ts](../../scripts/test-ws-attach.ts) | Automated | WS attach connects + receives output |
| [../../scripts/test-ws-input.ts](../../scripts/test-ws-input.ts) | Automated | WS stdin round-trip |

Run automated scripts with API on `:3847` and `.env` configured.
