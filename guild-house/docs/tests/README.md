# Tests — Guild House

Manual QA checklists and pointers to automated smoke scripts. Product walkthroughs (non-test) live in [docs/](../).

| Doc / script | Type | Purpose |
|--------------|------|---------|
| [execution-e2e.md](./execution-e2e.md) | Manual | Execution-only: `queued/` → archive (skip discovery) |
| [close-out-e2e.md](./close-out-e2e.md) | Manual | **0.3.0** full close-out: API auto + channel manual |
| [terminal-attach.md](./terminal-attach.md) | Manual | Browser terminal attach UX smoke |
| [../e2e-discovery-path.md](../e2e-discovery-path.md) | Walkthrough | Full Plan 3 path (idea → done) — in `docs/`, not a test checklist |
| [../../scripts/e2e-close-out-03.ts](../../scripts/e2e-close-out-03.ts) | Automated | 0.3.0 close-out API path + channel manual steps |
| [../../scripts/e2e-phase1-closeout.ts](../../scripts/e2e-phase1-closeout.ts) | Automated | Close-out lifecycle only (no channel) |
| [../../scripts/e2e-smoke.cmd](../../scripts/e2e-smoke.cmd) | Automated | API health → board → bell → missions → outbox |
| [../../scripts/test-ws-attach.ts](../../scripts/test-ws-attach.ts) | Automated | WS attach connects + receives output |
| [../../scripts/test-ws-input.ts](../../scripts/test-ws-input.ts) | Automated | WS stdin round-trip |

Run automated scripts with API on `:3847` and `.env` configured.
