/**
 * Safe read-only access to mission room files for API (brief, summary, room file GET).
 *
 * Path allowlist blocks traversal; squad, inbox, outbox, artifact-release, memories/**, mission-reports/**.
 * Brief fallback: room copy then board mission.md across stages.
 */
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import type { Config } from "../../config";
import {
  BOARD_STAGES,
  missionRoomPath,
  resolveBoardEntryPaths,
  type BoardStage,
} from "../../paths";
import { assertMissionId } from "../core/board";
import { getMissionOutboxSummary } from "./outbox";
import { getMission } from "./pickup";

const MISSION_BRIEF_REL = "memories/common/mission-brief.md";

function parseFrontmatterTitle(content: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = content.slice(3, end);
  for (const line of block.split("\n")) {
    const match = line.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))\s*$/);
    if (match) return (match[1] ?? match[2] ?? match[3]).trim();
  }
  return null;
}

function parseFrontmatterMembers(content: string): string[] {
  if (!content.startsWith("---")) return [];
  const end = content.indexOf("\n---", 3);
  if (end === -1) return [];
  const block = content.slice(3, end);
  const members: string[] = [];
  let inMembers = false;

  for (const line of block.split("\n")) {
    if (/^members:\s*$/.test(line)) {
      inMembers = true;
      continue;
    }
    if (inMembers) {
      const item = line.match(/^\s*-\s+(.+)\s*$/);
      if (item) {
        members.push(item[1].replace(/^["']|["']$/g, "").trim());
        continue;
      }
      if (/^\S/.test(line)) inMembers = false;
    }
  }

  return members;
}

async function readRoomText(config: Config, missionId: string, relPath: string): Promise<string | null> {
  try {
    return await readFile(join(missionRoomPath(config, missionId), relPath), "utf8");
  } catch {
    return null;
  }
}

async function readBoardMissionBrief(
  config: Config,
  missionId: string,
  board: BoardStage,
): Promise<string | null> {
  const stages = [board, ...BOARD_STAGES.filter((s) => s !== board)];
  for (const stage of stages) {
    for (const entryPath of resolveBoardEntryPaths(config, stage, missionId)) {
      try {
        return await readFile(join(entryPath, "mission.md"), "utf8");
      } catch {
        // Try next path.
      }
    }
  }
  return null;
}

async function readMissionBriefContent(
  config: Config,
  missionId: string,
  board: BoardStage,
): Promise<string | null> {
  const roomBrief = await readRoomText(config, missionId, MISSION_BRIEF_REL);
  if (roomBrief) return roomBrief;
  return readBoardMissionBrief(config, missionId, board);
}

/** Normalize and reject path traversal in room file GET param. */
export function normalizeRoomRelPath(pathParam: string): string | null {
  const decoded = decodeURIComponent(pathParam).replace(/\\/g, "/");
  const segments = decoded.split("/").filter((s) => s && s !== ".");
  if (segments.some((s) => s === "..")) return null;
  return segments.join("/");
}

/** Allowlist check for squad, inbox, outbox, artifact-release, memories/**, mission-reports/**. */
export function isAllowedRoomPath(relPath: string): boolean {
  if (
    relPath === "squad.md" ||
    relPath === "inbox.md" ||
    relPath === "outbox.jsonl" ||
    relPath === "artifact-release.md"
  ) {
    return true;
  }
  if (relPath.startsWith("retrospective/")) return true;
  if (relPath.startsWith("memories/")) return true;
  if (relPath.startsWith("mission-reports/")) return true;
  return false;
}

/** Read a single file from mission room with path allowlist enforcement. */
export async function readMissionRoomFile(
  config: Config,
  missionId: string,
  pathParam: string,
): Promise<{ path: string; content: string } | null> {
  assertMissionId(missionId);
  const mission = await getMission(config, missionId);
  if (!mission) return null;

  const relPath = normalizeRoomRelPath(pathParam);
  if (!relPath || !isAllowedRoomPath(relPath)) {
    throw new Error("Path not allowed");
  }

  const roomRoot = missionRoomPath(config, missionId);
  const absPath = normalize(join(roomRoot, relPath.replace(/\//g, sep)));
  if (!absPath.startsWith(normalize(roomRoot))) {
    throw new Error("Path not allowed");
  }

  try {
    const content = await readFile(absPath, "utf8");
    return { path: relPath, content };
  } catch {
    if (relPath === MISSION_BRIEF_REL) {
      const fallback = await readBoardMissionBrief(config, missionId, mission.board);
      if (fallback) return { path: relPath, content: fallback };
    }
    return null;
  }
}

/** Frozen brief from room copy, falling back to board mission.md. */
export async function getMissionBrief(config: Config, missionId: string) {
  assertMissionId(missionId);
  const mission = await getMission(config, missionId);
  if (!mission) return null;

  const content = await readMissionBriefContent(config, missionId, mission.board);
  if (!content) return null;

  return {
    missionId,
    board: mission.board,
    content,
  };
}

/** Mission hall summary: title, phase, outbox, checkpoint fields. */
export async function getMissionSummary(config: Config, missionId: string) {
  assertMissionId(missionId);
  const mission = await getMission(config, missionId);
  if (!mission) return null;

  const briefRaw = await readMissionBriefContent(config, missionId, mission.board);
  const squadRaw = await readRoomText(config, missionId, "squad.md");

  const briefTitle = briefRaw ? parseFrontmatterTitle(briefRaw) : null;
  const squadMembers = squadRaw ? parseFrontmatterMembers(squadRaw) : [];

  const outbox = await getMissionOutboxSummary(config, missionId);
  const checkpoint = mission.checkpoint;

  return {
    id: mission.id,
    board: mission.board,
    roomPath: mission.roomPath,
    checkpoint,
    briefTitle,
    squadMembers,
    outboxUnreadCount: outbox?.unreadCount ?? 0,
    sessionLive: "sessionLive" in mission ? mission.sessionLive : undefined,
    jobState: "jobState" in mission ? mission.jobState : undefined,
    restoreRequired: "restoreRequired" in mission ? mission.restoreRequired : undefined,
    archiveReady: mission.board === "done" && checkpoint?.phase === "done",
    awaitingGuildMaster: checkpoint?.awaiting_guild_master ?? false,
  };
}
