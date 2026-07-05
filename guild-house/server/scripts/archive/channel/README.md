# Guild-channel PoC (archived)

Experimental wake path when `GUILD_CHANNEL_PUSH=1` and `CLAUDE_DEV_CHANNELS=1`. Production default uses **session poke** instead — see [session-poke.md](../../../../docs/session-poke.md).

| Script | Purpose |
|--------|---------|
| [`poc-guild-channel.ts`](./poc-guild-channel.ts) | Channel HTTP → live PO (`--http-only` needs no Claude) |
| [`setup-channel-approve-test.ts`](./setup-channel-approve-test.ts) | Scaffold working mission for manual approve-artifacts channel wake |

```bash
cd guild-house/server
bun --env-file=../.env scripts/archive/channel/poc-guild-channel.ts --http-only
```

Full design: [guild-channel.md](../../../../docs/guild-channel.md)
