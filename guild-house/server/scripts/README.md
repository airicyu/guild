# Server scripts — QA & smoke

Run from **`guild-house/server/`** with API up (`bun run dev` from house root). Env: `../.env` (or `bun --env-file=../.env`).

From house root: `bun server/scripts/<name>.ts`

## Primary E2E

| Script | Purpose |
|--------|---------|
| [`e2e-040.ts`](./e2e-040.ts) | **Main** — discovery approve → parking → execution → close-out → board abort. No live Claude. |
| [`e2e-phase1-closeout.ts`](./e2e-phase1-closeout.ts) | Close-out only — approve / reject-artifacts / mission abort / phase gates |
| [`e2e-050-session-poke.ts`](./e2e-050-session-poke.ts) | Session poke API (0.5.0); `--live` optional |

```bash
bun run test:e2e          # e2e-040
bun run test:closeout     # e2e-phase1-closeout
bun run test:poke         # e2e-050-session-poke
```

## WS / terminal smoke

| Script | Purpose |
|--------|---------|
| [`test-ws-attach.ts`](./test-ws-attach.ts) | WS attach connects + PTY output |
| [`test-ws-input.ts`](./test-ws-input.ts) | WS stdin round-trip |
| [`test-ws-key.ts`](./test-ws-key.ts) | Arrow-key input (debug) |

Requires a **working** mission with live or restorable PO:  
`bun scripts/test-ws-attach.ts <missionId>`

## Manual spikes

| Script | Purpose |
|--------|---------|
| [`poc-session-poke.ts`](./poc-session-poke.ts) | Manual session poke (`--spawn` / `--mission-id`) |

## Windows quick smoke

[`e2e-smoke.cmd`](./e2e-smoke.cmd) — curl health → board → bell → missions → outbox

## Archived (experimental)

Guild-channel PoC scripts (`GUILD_CHANNEL_PUSH=0` by default): [`archive/channel/`](./archive/channel/README.md)

Removed one-off migrations (0.1→0.2 board rename, chatroom→events) — boot reconcile handles legacy done on working.
