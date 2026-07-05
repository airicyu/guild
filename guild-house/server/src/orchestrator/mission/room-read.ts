/**
 * Safe read-only access to mission room files for API (brief, summary, room file GET).
 *
 * Path allowlist blocks traversal; squad, inbox, outbox, artifact-release, memories/**, mission-reports/**.
 * Brief fallback: room copy then board mission.md across stages.
 */
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import type { Config } from "../../config";
import { parseFrontmatter } from "../../frontmatter";
import {
  BOARD_STAGES,
  resolveBoardEntryPaths,
  type BoardStage,
} from "../../paths";
import { assertMissionId } from "../core/board";
import { resolveMissionRoomPath } from "../core/room-achive";
import { getMissionOutboxSummary } from "./outbox";
import { getMission } from "./pickup";

const MISSION_BRIEF_REL = "mission-brief.md";
const LEGACY_MISSION_BRIEF_REL = "memories/common/mission-brief.md";

function parseFrontmatterTitle(content: string): string | null {
  const title = parseFrontmatter(content).title;
  return title == null ? null : String(title);
}

function parseFrontmatterMembers(content: string): string[] {
  const members = parseFrontmatter(content).members;
  if (!Array.isArray(members)) return [];
  return members.map((m) => String(m));
}

async function readRoomText(config: Config, missionId: string, relPath: string): Promise<string | null> {
  const roomRoot = await resolveMissionRoomPath(config, missionId);
  if (!roomRoot) return null;
  try {
    return await readFile(join(roomRoot, relPath), "utf8");
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
  const legacyBrief = await readRoomText(config, missionId, LEGACY_MISSION_BRIEF_REL);
  if (legacyBrief) return legacyBrief;
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

  const roomRoot = await resolveMissionRoomPath(config, missionId);
  if (!roomRoot) return null;
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
    archiveReady:
      (mission.board === "done" && checkpoint?.phase === "done") ||
      (mission.board === "aborted" && checkpoint?.phase === "aborted"),
    awaitingGuildMaster: checkpoint?.awaiting_guild_master ?? false,
  };
}
