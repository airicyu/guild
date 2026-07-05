# Phase reviews — Guild 0.5.0 session poke

## Phase 1 review (API 0.31.0 → 0.32.0)

**Automated:** `bun test src/orchestrator/mission/session-poke.test.ts` — 10 pass

| Check | Result |
|-------|--------|
| `pokeMissionSession` never throws | ✓ |
| Option A — no ensureLive | ✓ |
| `notify.poke` on approve/reject/abort | ✓ |
| Mutex `poke in flight` | ✓ |
| `attach_in_use` when WS attach active | ✓ |

## Phase 2 review (product 0.5.0)

**Automated:** `bun test src/lib/guildMasterNotify.test.ts` — 4 pass · `bun run build` (web) — pass

| Check | Result |
|-------|--------|
| Health `sessionPokeEnabled` in client | ✓ |
| Approve/reject when poke OR channel | ✓ |
| Toast uses `notify.poke` | ✓ |
| Docs + templates + guild-desk | ✓ |
| version.md 0.5.0 | ✓ |

## Phase 3 review (hardening)

**Automated:** `bun scripts/e2e-050-session-poke.ts` — 4/4 pass

| Check | Result |
|-------|--------|
| API 0.32.0 health | ✓ |
| Dead session → `poke.delivered: false`, checkpoint `releasing` | ✓ |
| WS attach skip (`attach_in_use`) | unit test ✓ |
| `docs/session-poke.md` + close-out-e2e update | ✓ |

**Manual / optional:** `e2e-050 --live`, PO mid-tool poke, WS+poke rapid interaction

## Success checklist (design §9)

- [x] Poke failure does not roll back checkpoint / inbox (e2e-050 dead session)
- [x] Dead session → clear `session not live` reason
- [x] `GUILD_SESSION_POKE=0` → disabled reason (unit test)
- [x] No second PO spawn (attach-to-bg; poke uses ephemeral PTY only)
- [x] Idle PO poke — manual spike PASS (`poke-poc-mr7zs67s`)
- [~] WS + poke rapid succession — skip path only; no integration script yet
- [~] Live approve E2E without terminal — `--live` flag on e2e-050 optional
