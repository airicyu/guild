#!/usr/bin/env bun
/**
 * 0.3.0 close-out QA — automated API path (channel degraded) + manual channel checklist.
 *
 * Part 1 (this script): runs e2e-phase1-closeout.ts — full approve → release → retro →
 *   archive without live PO or guild-channel delivery.
 *
 * Part 2 (manual): when CLAUDE_DEV_CHANNELS=1 and CC 2.1.80+, run channel wake test:
 *   bun scripts/setup-channel-approve-test.ts
 *   → Web UI or POST approve-artifacts → verify PO receives channel event.
 *
 * Usage:
 *   bun run dev   # separate terminal
 *   bun scripts/e2e-close-out-03.ts
 *   bun scripts/e2e-close-out-03.ts --skip-auto   # print manual steps only
 *
 * See docs/tests/close-out-e2e.md
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SKIP_AUTO = process.argv.includes("--skip-auto");
const ROOT = join(import.meta.dir, "..");

function main(): void {
  console.log("Guild 0.3.0 — close-out QA\n");

  if (!SKIP_AUTO) {
    console.log("=== Part 1: API close-out (no live PO / channel degraded) ===\n");
    const child = spawnSync("bun", [join(ROOT, "scripts/e2e-phase1-closeout.ts")], {
      stdio: "inherit",
      cwd: ROOT,
    });
    if (child.status !== 0) {
      process.exit(child.status ?? 1);
    }
  } else {
    console.log("(skipped Part 1 — --skip-auto)\n");
  }

  console.log("\n=== Part 2: Manual — guild-channel wake (optional) ===\n");
  console.log("Prerequisites:");
  console.log("  - CLAUDE_DEV_CHANNELS=1 in guild-house/.env");
  console.log("  - claude 2.1.80+ on PATH");
  console.log("  - bun run dev on :3847\n");
  console.log("Steps:");
  console.log("  1. bun scripts/setup-channel-approve-test.ts");
  console.log("  2. Web UI → mission room → Approve artifacts");
  console.log("     OR: curl -X POST -H \"Authorization: Bearer $GUILD_API_KEY\" \\");
  console.log("           http://127.0.0.1:3847/missions/<id>/approve-artifacts");
  console.log("  3. Verify API log: [channel-notify] delivered=true");
  console.log("  4. Attach to PO → confirm channel event / inbox read + release signals");
  console.log("  5. Cleanup: claude stop <sessionId>; rm working board + mission room\n");
  console.log("Full checklist: docs/tests/close-out-e2e.md");
  console.log("Channel PoC: docs/guild-channel.md\n");

  if (!SKIP_AUTO) {
    console.log("Part 1 passed. Complete Part 2 manually before shipping 0.3.0.");
  }
}

main();
