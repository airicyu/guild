# Manual test — terminal attach

QA checklist for mission and discovery **Terminal** tabs. Spec: [specs/terminal-attach.md](../../specs/terminal-attach.md).

## PO mission

1. Start API + web UI (`bun run dev`, `bun run dev:ui`)
2. Open a **working** mission with live PO → **Terminal** tab
3. Confirm auto `claude attach` connects
4. In attach: wheel scrolls Claude history; no misleading scrollbar
5. Press **←** to exit attach → clean bash (no ghost UI)
6. In bash: scrollbar visible; wheel scrolls buffer
7. Close tab → WS closes; PO `--bg` still alive (`GET /missions/:id/session`)

## Discovery lead

Same checks on `/ideas/:id` → **Terminal** tab (`WS /ws/discoveries/:id/attach`). WS close must not kill discovery bg job.

## Automated WS smoke

```bash
bun scripts/test-ws-attach.ts <missionId>
bun scripts/test-ws-input.ts <missionId>
```

Requires running API and a mission on **working** with live session.
