# Guild 0.5.0 — Session poke (attach notify)

Replace unreliable **guild-channel HTTP push** for guild-master directives with an orchestrator **session poke**: after updating mission state on disk, briefly `claude attach` into the live `--bg` session and inject a short user message telling the lead to re-read checkpoint + inbox.

| Doc | Purpose |
|-----|---------|
| [design.md](./design.md) | **Proposal** — problem, approach, feasibility, risks, API, phases |

**Baseline:** product **0.4.0** · API **0.30.0** · channel push **off by default** (`GUILD_CHANNEL_PUSH=0`).

**Status:** Proposal only — **no implementation** in this folder.

**Motivation:** Channel PoC delivers when PO is active; **idle** `--bg` sessions often miss channel events ([channel-poc-notes.md](../0.3.0/channel-poc-notes.md)). Web UI and guild-desk close-out currently require **manual attach** when channel is disabled.
