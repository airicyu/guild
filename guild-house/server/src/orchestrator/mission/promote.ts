/**
 * Parking → queued promotion — one mission folder at a time (Plan 3 Phase 6).
 */
import { rename, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { legacyMissionBoardPath, missionBoardEntryPath } from "../../paths";
import { listBoard, resolveParkingEntryPath } from "../core/board";

/** Move parking/{folder} → queued/{folder} after guild master promotes. */
export async function promoteParkingToQueued(
  config: Config,
  folderName: string,
): Promise<{ folder: string; stage: "queued" }> {
  const trimmed = folderName.trim();
  if (!trimmed) {
    throw new Error("Missing parking folder name");
  }

  const board = await listBoard(config);
  if (!board.parking.includes(trimmed)) {
    throw new Error(`Parking entry not found: ${trimmed}`);
  }

  const src = await resolveParkingEntryPath(config, trimmed);
  if (!src) {
    throw new Error(`Parking folder missing on disk: ${trimmed}`);
  }

  const dest = missionBoardEntryPath(config, "queued", trimmed);
  try {
    await stat(dest);
    throw new Error(`Queued entry already exists: ${trimmed}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Queued entry already exists")) {
      throw err;
    }
    // dest missing — ok
  }

  const legacyReadyDir = legacyMissionBoardPath(config, "queued");
  if (legacyReadyDir) {
    const legacyReady = join(legacyReadyDir, trimmed);
    try {
      if ((await stat(legacyReady)).isDirectory()) {
        throw new Error(`Legacy ready entry already exists: ${trimmed}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        throw err;
      }
    }
  }

  await rename(src, dest);
  return { folder: trimmed, stage: "queued" };
}
