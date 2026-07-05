# Tests — Guild House

Manual QA checklists and pointers to automated smoke scripts. Product walkthroughs (non-test) live in [docs/](../).

**Script index:** [../server/scripts/README.md](../server/scripts/README.md)

| Doc / script | Type | Purpose |
|--------------|------|---------|
| [execution-e2e.md](./execution-e2e.md) | Manual | Execution-only: `queued/` → archive (skip discovery) |
| [close-out-e2e.md](./close-out-e2e.md) | Manual | **0.3.0** full close-out: API auto + channel manual |
| [terminal-attach.md](./terminal-attach.md) | Manual | Browser terminal attach UX smoke |
| [../e2e-discovery-path.md](../e2e-discovery-path.md) | Walkthrough | Full Plan 3 path (idea → done) — in `docs/`, not a test checklist |
| [../../server/scripts/e2e-040.ts](../../server/scripts/e2e-040.ts) | Automated | **Primary** — discovery + execution + close-out + board abort |
| [../../server/scripts/e2e-phase1-closeout.ts](../../server/scripts/e2e-phase1-closeout.ts) | Automated | Close-out lifecycle only (reject / abort paths) |
| [../../server/scripts/e2e-050-session-poke.ts](../../server/scripts/e2e-050-session-poke.ts) | Automated | Session poke API (0.5.0) |
| [../../server/scripts/e2e-smoke.cmd](../../server/scripts/e2e-smoke.cmd) | Automated | API health → board → bell → missions → outbox |
| [../../server/scripts/test-ws-attach.ts](../../server/scripts/test-ws-attach.ts) | Automated | WS attach connects + receives output |
| [../../server/scripts/test-ws-input.ts](../../server/scripts/test-ws-input.ts) | Automated | WS stdin round-trip |

Run from `server/`: `bun run test:e2e` or `bun scripts/<name>.ts`. API on `:3847`, `.env` at house root.
