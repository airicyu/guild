# Tests — Guild House

Manual QA checklists and pointers to automated smoke scripts. Product walkthroughs (non-test) live in [docs/](../).

| Doc / script | Type | Purpose |
|--------------|------|---------|
| [execution-e2e.md](./execution-e2e.md) | Manual | Execution-only: `queued/` → archive (skip discovery) |
| [close-out-e2e.md](./close-out-e2e.md) | Manual | **0.3.0** full close-out: API auto + channel manual |
| [terminal-attach.md](./terminal-attach.md) | Manual | Browser terminal attach UX smoke |
| [../e2e-discovery-path.md](../e2e-discovery-path.md) | Walkthrough | Full Plan 3 path (idea → done) — in `docs/`, not a test checklist |
| [../../server/scripts/e2e-close-out-03.ts](../../server/scripts/e2e-close-out-03.ts) | Automated | 0.3.0 close-out API path + channel manual steps |
| [../../server/scripts/e2e-phase1-closeout.ts](../../server/scripts/e2e-phase1-closeout.ts) | Automated | Close-out lifecycle only (no channel) |
| [../../server/scripts/e2e-smoke.cmd](../../server/scripts/e2e-smoke.cmd) | Automated | API health → board → bell → missions → outbox |
| [../../server/scripts/test-ws-attach.ts](../../server/scripts/test-ws-attach.ts) | Automated | WS attach connects + receives output |
| [../../server/scripts/test-ws-input.ts](../../server/scripts/test-ws-input.ts) | Automated | WS stdin round-trip |

Run from `server/`: `bun scripts/<name>.ts` (or from house root: `bun server/scripts/<name>.ts`). API on `:3847`, `.env` at house root.
