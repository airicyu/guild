#!/usr/bin/env bun
/**
 * Migrate mission-board folders from 0.1.0 layout to Plan 3 stage names.
 *
 *   ready/  → queued/
 *   active/ → working/
 *
 * Creates ideas/, discovering/, done/ if missing. Does not move phase=done
 * missions to done/ — boot reconcileLegacyDoneMissions() handles that (Plan 3 Phase 6).
 *
 * Usage (from guild-house/):
 *   bun scripts/migrate-board-stages.ts
 *   bun scripts/migrate-board-stages.ts --dry-run
 */
import { rename, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";

const boardRoot = join(config.guildHome, "mission-board");
const dryRun = process.argv.includes("--dry-run");

const RENAMES: Array<[string, string]> = [
  ["ready", "queued"],
  ["active", "working"],
];

const NEW_FOLDERS = ["ideas", "discovering", "done"];

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`Board root: ${boardRoot}${dryRun ? " (dry run)" : ""}`);

  for (const folder of NEW_FOLDERS) {
    const path = join(boardRoot, folder);
    if (await exists(path)) {
      console.log(`  ok  ${folder}/`);
      continue;
    }
    console.log(`  +   ${folder}/`);
    if (!dryRun) await mkdir(path, { recursive: true });
  }

  for (const [from, to] of RENAMES) {
    const src = join(boardRoot, from);
    const dest = join(boardRoot, to);

    if (!(await exists(src))) {
      console.log(`  skip ${from}/ (not present)`);
      continue;
    }

    if (await exists(dest)) {
      console.log(`  !   ${from}/ → ${to}/ — target exists; merge manually if needed`);
      continue;
    }

    console.log(`  →   ${from}/ → ${to}/`);
    if (!dryRun) await rename(src, dest);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
