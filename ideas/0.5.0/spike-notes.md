# Session poke — Phase 0 spike notes

**Started:** 2026-07-06  
**Policy:** Option A — `probeSession` only; no `ensureLive` on poke path.

## Script

```bash
cd guild/guild-house/server

# Dry-run (no PTY)
bun --env-file=../.env scripts/poc-session-poke.ts --mission-id <id> --dry-run

# Dead session — expect exit 0, reason: session not live
bun --env-file=../.env scripts/poc-session-poke.ts --mission-id longbridge-validation-20260704-bc317a

# Self-contained: scaffold room + spawn idle PO + poke
bun --env-file=../.env scripts/poc-session-poke.ts --spawn

# Existing mission with live --bg PO at prompt
bun --env-file=../.env scripts/poc-session-poke.ts --mission-id <id>
```

## Detach behaviour (design §12 Q1)

**Approach:** kill poke PTY only — same contract as WS attach close (`handleAttachClose` kills server terminal, bg job keeps running).

| Step | Action |
|------|--------|
| Open | `bash` PTY in mission room cwd |
| Attach | `claude attach {shortId}` after 500ms delay |
| Inject | canonical `[guild-house]` message + `\r` |
| Close | `proc.kill()` on poke PTY only — no `Ctrl+D` / attach exit first |

**Validation:** script checks `probeSession` before and after poke; `bgLiveAfter` must stay `true`.

### Spike results

| Run | idle PO | dead session | mid-tool | bg survives teardown |
|-----|---------|--------------|----------|----------------------|
| 2026-07-06 `--spawn` poke-poc-mr7zs67s / 388e6d2c | **PASS** — PO saw `[guild-house]` message, replied re checkpoint + inbox | (prior run) PASS | — | **PASS** — bg `388e6d2c` still in `claude agents` after inject |

**Teardown note:** first run hung on `await proc.exited` while `claude attach` child lingered; fixed with 2s exit wait cap (kill poke PTY only).

_Fill after manual runs._

## Ready heuristic

After `claude attach` write, inject when:

- elapsed ≥ 500ms + 1200ms, **or**
- PTY output matches: `attached`, `esc to exit/detach`, `Connected to`, `❯`

Hard timeout: `GUILD_SESSION_POKE_TIMEOUT_MS` (default 8000).

## Exit criteria (Phase 0)

- [ ] Idle PO at prompt receives inject; mentions inbox/checkpoint/phase within one turn
- [ ] Dead session → `session not live`, exit 0, no throw
- [ ] Mid-tool PO — record best-effort (may fail)
- [ ] `--bg` job still live after poke PTY kill
