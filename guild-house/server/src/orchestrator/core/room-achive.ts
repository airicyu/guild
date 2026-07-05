/**
 * Room archive — move terminal missions under mission-rooms/archive/ (legacy achive/ read compat).
 */
import { readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import {
  ROOM_ACHIVE_DIR,
  ROOM_ARCHIVE_DIR,
  missionRoomAchivePath,
  missionRoomArchivePath,
  missionRoomPath,
} from "../../paths";
import { listBoard } from "./board";
import { readCheckpoint } from "../mission/checkpoint";
import { isTerminalPhase } from "../../types/mission";

/** Resolve mission room root — active, then archive/, then legacy achive/. */
export async function resolveMissionRoomPath(
  config: Config,
  missionId: string,
): Promise<string | null> {
  for (const p of [
    missionRoomPath(config, missionId),
    missionRoomArchivePath(config, missionId),
    missionRoomAchivePath(config, missionId),
    join(config.guildHome, "discovery-rooms", missionId),
    join(config.guildHome, "discovery-rooms", ROOM_ACHIVE_DIR, missionId),
  ]) {
    try {
      await stat(p);
      return p;
    } catch {
      // continue
    }
  }
  return null;
}

/** Move mission-rooms/{id} → mission-rooms/archive/{id}; no-op if already archived. */
export async function archiveMissionRoom(config: Config, missionId: string): Promise<boolean> {
  const active = missionRoomPath(config, missionId);
  try {
    await stat(active);
  } catch {
    return false;
  }

  const dest = missionRoomArchivePath(config, missionId);
  try {
    await stat(dest);
    return false;
  } catch {
    // ok to move
  }

  await rename(active, dest);
  return true;
}

async function listActiveRoomIds(config: Config): Promise<string[]> {
  const roomsRoot = join(config.guildHome, "mission-rooms");
  let entries: string[];
  try {
    entries = await readdir(roomsRoot);
  } catch {
    return [];
  }
  return entries.filter((name) => name !== ROOM_ARCHIVE_DIR && name !== ROOM_ACHIVE_DIR);
}

/** Boot: archive rooms for terminal board notes and completed intake missions. */
export async function reconcileArchivedMissionRooms(config: Config): Promise<string[]> {
  const board = await listBoard(config);
  const terminalIds = new Set([...board.done, ...board.aborted, ...board.archive]);
  const moved: string[] = [];

  for (const missionId of terminalIds) {
    try {
      if (await archiveMissionRoom(config, missionId)) {
        moved.push(missionId);
      }
    } catch {
      // Best-effort.
    }
  }

  for (const missionId of await listActiveRoomIds(config)) {
    const checkpoint = await readCheckpoint(config, missionId);
    if (!checkpoint) continue;
    if (checkpoint.mode === "intake" && checkpoint.phase === "mission_plan_complete") {
      try {
        if (await archiveMissionRoom(config, missionId)) moved.push(missionId);
      } catch {
        // Best-effort
      }
    }
  }

  return moved;
}

export async function missionRoomExists(config: Config, missionId: string): Promise<boolean> {
  return (await resolveMissionRoomPath(config, missionId)) !== null;
}

/** True when checkpoint phase is terminal for the mission mode. */
export function isCheckpointTerminal(phase: import("../../types/mission").MissionPhase): boolean {
  return isTerminalPhase(phase) || phase === "mission_plan_complete";
}
