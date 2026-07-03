/**
 * Mission-board listing and concurrent slot accounting.
 *
 * listBoard merges legacy ready/active folders into queued/working.
 * countWorkingMissions excludes phase=done on working board (frees execution slots).
 * countDiscoveringSessions counts only live lead sessions where phase !== closed.
 */
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import {
  BOARD_STAGES,
  legacyMissionBoardPath,
  missionBoardPath,
  type BoardStage,
} from "../../paths";
import type { BoardListing } from "../../types/mission";
import { readDiscoveryCheckpoint } from "../discovery/checkpoint";
import { readCheckpoint } from "../mission/checkpoint";
import { assertMissionId } from "./mission-id";
import { isSessionRunning } from "./session";

export { assertMissionId } from "./mission-id";

const SKIP = new Set([".gitkeep", ".DS_Store"]);

async function listMissionFolders(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const folders: string[] = [];
  for (const entry of entries) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) folders.push(entry);
  }

  return folders.sort();
}

function mergeFolderLists(...lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort();
}

async function listStageFolders(config: Config, stage: BoardStage): Promise<string[]> {
  const primary = await listMissionFolders(missionBoardPath(config, stage));
  const legacyPath = legacyMissionBoardPath(config, stage);
  if (!legacyPath) return primary;
  const legacy = await listMissionFolders(legacyPath);
  return mergeFolderLists(primary, legacy);
}

/** List all board stage folders; merges legacy ready/active into queued/working. */
export async function listBoard(config: Config): Promise<BoardListing> {
  const [ideasBacklog, ideas, discovering, parking, queued, working, done, aborted, archive] =
    await Promise.all(BOARD_STAGES.map((stage) => listStageFolders(config, stage)));

  return {
    "ideas-backlog": ideasBacklog,
    ideas,
    discovering,
    parking,
    queued,
    working,
    done,
    aborted,
    archive,
  };
}

/** Working missions that consume a concurrent PO slot (`phase` not terminal on working board). */
export async function countWorkingMissions(config: Config): Promise<number> {
  const working = await listStageFolders(config, "working");
  let used = 0;

  for (const missionId of working) {
    const checkpoint = await readCheckpoint(config, missionId);
    if (!checkpoint) {
      used += 1;
      continue;
    }
    if (checkpoint.phase === "done" || checkpoint.phase === "aborted") continue;
    used += 1;
  }

  return used;
}

/** @deprecated Renamed to countWorkingMissions */
export const countActiveMissions = countWorkingMissions;

/** Discovering entries with a live discovery lead session (consumes a slot). */
export async function countDiscoveringSessions(config: Config): Promise<number> {
  const discovering = await listStageFolders(config, "discovering");
  let used = 0;

  for (const ideaId of discovering) {
    const checkpoint = await readDiscoveryCheckpoint(config, ideaId);
    if (!checkpoint || checkpoint.phase === "closed") continue;
    if (await isSessionRunning(config, checkpoint.claude_session.id)) {
      used += 1;
    }
  }

  return used;
}

/** Resolve queued/ or legacy ready/ folder path; null if missing. */
export async function resolveQueuedEntryPath(
  config: Config,
  folderName: string,
): Promise<string | null> {
  const candidates = [
    join(missionBoardPath(config, "queued"), folderName),
    legacyMissionBoardPath(config, "queued")
      ? join(legacyMissionBoardPath(config, "queued")!, folderName)
      : null,
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      if ((await stat(path)).isDirectory()) return path;
    } catch {
      // try next
    }
  }
  return null;
}

/** Resolve working/ or legacy active/ folder path; null if missing. */
export async function resolveWorkingEntryPath(
  config: Config,
  missionId: string,
): Promise<string | null> {
  const candidates = [
    join(missionBoardPath(config, "working"), missionId),
    legacyMissionBoardPath(config, "working")
      ? join(legacyMissionBoardPath(config, "working")!, missionId)
      : null,
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      if ((await stat(path)).isDirectory()) return path;
    } catch {
      // try next
    }
  }
  return null;
}

/** True when missionId appears on the working board listing. */
export function isOnWorkingBoard(board: BoardListing, missionId: string): boolean {
  return board.working.includes(missionId);
}

/** True when ideaId appears on the discovering board listing. */
export function isOnDiscoveringBoard(board: BoardListing, ideaId: string): boolean {
  return board.discovering.includes(ideaId);
}

/** True when missionId appears on the done board listing. */
export function isOnDoneBoard(board: BoardListing, missionId: string): boolean {
  return board.done.includes(missionId);
}

/** True when missionId appears on the aborted board listing. */
export function isOnAbortedBoard(board: BoardListing, missionId: string): boolean {
  return board.aborted.includes(missionId);
}

/** Resolve ideas-backlog/{ideaId} path; null if missing. */
export async function resolveIdeasBacklogEntryPath(
  config: Config,
  ideaId: string,
): Promise<string | null> {
  const path = join(missionBoardPath(config, "ideas-backlog"), ideaId);
  try {
    if ((await stat(path)).isDirectory()) return path;
  } catch {
    // missing
  }
  return null;
}

/** Resolve parking/{folderName} path; null if missing. */
export async function resolveParkingEntryPath(
  config: Config,
  folderName: string,
): Promise<string | null> {
  const path = join(missionBoardPath(config, "parking"), folderName);
  try {
    if ((await stat(path)).isDirectory()) return path;
  } catch {
    // missing
  }
  return null;
}

/** Resolve done/{missionId} path (includes legacy folder); null if missing. */
export async function resolveDoneEntryPath(
  config: Config,
  missionId: string,
): Promise<string | null> {
  const candidates = [
    join(missionBoardPath(config, "done"), missionId),
    legacyMissionBoardPath(config, "done")
      ? join(legacyMissionBoardPath(config, "done")!, missionId)
      : null,
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      if ((await stat(path)).isDirectory()) return path;
    } catch {
      // try next
    }
  }
  return null;
}

/** Resolve aborted/{missionId} path; null if missing. */
export async function resolveAbortedEntryPath(
  config: Config,
  missionId: string,
): Promise<string | null> {
  const path = join(missionBoardPath(config, "aborted"), missionId);
  try {
    if ((await stat(path)).isDirectory()) return path;
  } catch {
    // missing
  }
  return null;
}
