# Terminal attach — specification

As-built UX and server behavior for mission + discovery browser terminals (WSL/Linux dev).

**Manual QA:** [docs/tests/terminal-attach.md](../docs/tests/terminal-attach.md)  
**Code:** `src/websocket/attach-pty.ts` · `web/src/components/AttachTerminalPane.tsx`

## Environment

| Item | Value |
|------|--------|
| **Dev attach** | WSL/Linux only (Bun native PTY) |
| **Windows PTY stdin** | Dropped — use WSL for browser terminal attach |
| **API** | `:3847` · **Web UI** | `:3848` (proxies WS) |

## Server

| Behavior | Detail |
|----------|--------|
| **Spawn** | `Bun.spawn` + `terminal: true` — bash in room cwd |
| **Auto attach** | PTY receives `claude attach {shortId}\n` (not foreground spawn) |
| **Fit before connect** | `?cols=&rows=` from xterm; resize PTY before attach |
| **WS close** | Kills attach PTY only — `--bg` job keeps running |
| **Restore** | `ensureMissionSessionLive` / `ensureDiscoverySessionLive` when `?ensureLive=true` |

Routes: `WS /ws/missions/:id/attach` · `WS /ws/discoveries/:id/attach`

## Client stack

| Package | Role |
|---------|------|
| `@xterm/xterm` 6 | Terminal emulator |
| `@xterm/addon-fit` | Resize to container |
| `@xterm/addon-webgl` | WebGL renderer (DOM fallback on context loss) |

## Locked lifecycle

- **Tab-lazy mount** — xterm + WS when Terminal tab opens; tear down on leave
- **Do not** always-mount like Freeflow
- **Do not** `term.clear()` on WS reconnect

## Alt screen vs classic buffer

| Mode | When | Scrollbar | Wheel |
|------|------|-----------|-------|
| **Alt screen** | `claude attach` fullscreen | Hidden | SGR mouse → PTY (Claude history) |
| **Classic** | Bash / post-exit attach | Visible (CSS override) | xterm scrollback |

`trackAltScreen()` toggles `mission-terminal--alt-screen` when `term.buffer.active.type === "alternate"`.

## Compositing

No `backdrop-filter` / `guild-glass` on the terminal pane — causes ghost frames after exiting attach (←). Opaque `#1e1e1e` host; `isolation: isolate`.

Hide legacy empty `.xterm-viewport` overlay; scrollback uses `.xterm-scrollable-element`.

## Related

- [session-lifecycle.md](./session-lifecycle.md) — restore ladder
- [product.md](./product.md) — attach semantics (items 1–3)
- [docs/api.md](../docs/api.md) — session + WS routes
