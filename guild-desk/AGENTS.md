# Guild Desk

**Control plane** for [Guild House](../guild-house/). Operates the orchestrator API via the **guild-master** skill — does not run mission PO sessions.

## Before you start

1. Start Guild House: `cd ../guild-house && bun run dev`
2. Set env (cmd):

```cmd
set GUILD_HOUSE_URL=http://127.0.0.1:3847
set GUILD_API_KEY=change-me-in-production
set GUILD_MASTER_NAME=Eric
```

`GUILD_MASTER_NAME` must match guild-house (default `Guild Master`). Used for `GET /health` display and Web UI header — **not** baked into mission/discovery playbooks (role term: **guild master**).

3. Use **guild-master** for bell, board, missions, outbox, attach commands.

## Rules

- Do not spawn mission PO sessions from here — bell pickup does that.
- The guild master **intervenes** via attach commands in a **separate terminal**.
- Mission intake: edit `../guild-house/data/mission-board/ready/{id}/mission.md` in IDE, then bell.

## API reference

[../guild-house/docs/api.md](../guild-house/docs/api.md) · [../guild-house/specs/mission-schema.md](../guild-house/specs/mission-schema.md)
