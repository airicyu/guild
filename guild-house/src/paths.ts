/**
 * Canonical filesystem paths under GUILD_HOME. Filesystem = source of truth.
 *
 * Plan 3 board stage folder names match UI columns. LEGACY_BOARD_FOLDERS merges
 * ready→queued and active→working until dev data is migrated.
 * Mission events: memories/common/events.jsonl; discovery events: room-root events.jsonl.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config";

/** Plan 3 board folders — names match UI columns. */
export const BOARD_STAGES = [
  "ideas",
  "discovering",
  "parking",
  "queued",
  "working",
  "done",
  "aborted",
  "archive",
] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];

/** 0.1.0 folder names merged into Plan 3 stages until dev data is migrated. */
export const LEGACY_BOARD_FOLDERS: Partial<Record<BoardStage, string>> = {
  queued: "ready",
  working: "active",
};

/** Create mission-board stage dirs, mission-rooms, and discovery-rooms on boot. */
export async function ensureDataLayout(config: Config): Promise<void> {
  const dirs = [
    config.guildHome,
    join(config.guildHome, "mission-rooms"),
    join(config.guildHome, "discovery-rooms"),
    ...BOARD_STAGES.map((s) => join(config.guildHome, "mission-board", s)),
  ];

  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
}

/** Absolute path to a Plan 3 board stage folder under mission-board/. */
export function missionBoardPath(config: Config, stage: BoardStage): string {
  return join(config.guildHome, "mission-board", stage);
}

/** Legacy 0.1.0 folder path (ready/active) for a stage, or null if none. */
export function legacyMissionBoardPath(config: Config, stage: BoardStage): string | null {
  const legacy = LEGACY_BOARD_FOLDERS[stage];
  if (!legacy) return null;
  return join(config.guildHome, "mission-board", legacy);
}

/** Path to a mission folder on a board stage (mission-board/{stage}/{id}). */
export function missionBoardEntryPath(config: Config, stage: BoardStage, missionId: string): string {
  return join(missionBoardPath(config, stage), missionId);
}

/** Path to mission-rooms/{missionId}. */
export function missionRoomPath(config: Config, missionId: string): string {
  return join(config.guildHome, "mission-rooms", missionId);
}

/** Path to templates/mission-room scaffold source. */
export function missionRoomTemplatePath(config: Config): string {
  return join(config.projectRoot, "templates", "mission-room");
}

/** Path to frozen brief on working board entry (mission.md). */
export function missionBriefPath(config: Config, missionId: string): string {
  return join(missionBoardEntryPath(config, "working", missionId), "mission.md");
}

/** Path to mission-rooms/{id}/checkpoint.yaml — orchestrator-only writer. */
export function checkpointPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "checkpoint.yaml");
}

/** Path to mission-rooms/{id}/outbox.jsonl. */
export function outboxPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "outbox.jsonl");
}

/** Path to memories/common/events.jsonl inside a mission room. */
export function eventsPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "memories", "common", "events.jsonl");
}

/** Plan 3 + legacy candidate paths for a board entry lookup. */
export function resolveBoardEntryPaths(config: Config, stage: BoardStage, id: string): string[] {
  const paths = [missionBoardEntryPath(config, stage, id)];
  const legacy = LEGACY_BOARD_FOLDERS[stage];
  if (legacy) {
    paths.push(join(config.guildHome, "mission-board", legacy, id));
  }
  return paths;
}

/** Claude --bg session name for a mission PO. */
export function poSessionName(missionId: string): string {
  return `mission-${missionId}-po`;
}

/** Path to discovery-rooms/{ideaId}. */
export function discoveryRoomPath(config: Config, ideaId: string): string {
  return join(config.guildHome, "discovery-rooms", ideaId);
}

/** Path to templates/discovery-room scaffold source. */
export function discoveryRoomTemplatePath(config: Config): string {
  return join(config.projectRoot, "templates", "discovery-room");
}

/** Path to discovery-rooms/{id}/checkpoint.yaml — orchestrator-only writer. */
export function discoveryCheckpointPath(config: Config, ideaId: string): string {
  return join(discoveryRoomPath(config, ideaId), "checkpoint.yaml");
}

/** Claude --bg session name for discovery intake lead. */
export function discoverySessionName(ideaId: string): string {
  return `discovery-${ideaId}-lead`;
}

/** Path to ideas/ or discovering/ board entry folder. */
export function ideaBoardEntryPath(config: Config, stage: "ideas" | "discovering", ideaId: string): string {
  return join(missionBoardPath(config, stage), ideaId);
}

/** Path to discovery-rooms/{id}/outbox.jsonl. */
export function discoveryOutboxPath(config: Config, ideaId: string): string {
  return join(discoveryRoomPath(config, ideaId), "outbox.jsonl");
}

/** Path to discovery-rooms/{id}/events.jsonl (room root). */
export function discoveryEventsPath(config: Config, ideaId: string): string {
  return join(discoveryRoomPath(config, ideaId), "events.jsonl");
}

/** Path to artifacts/missions/ where intake lead drafts mission packages. */
export function discoveryArtifactsMissionsPath(config: Config, ideaId: string): string {
  return join(discoveryRoomPath(config, ideaId), "artifacts", "missions");
}
