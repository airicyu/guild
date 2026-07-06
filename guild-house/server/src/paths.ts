/**
 * Canonical filesystem paths under GUILD_HOME. Filesystem = source of truth.
 *
 * 0.4.0: mission board notes on mission-board/; missions in mission-rooms/ only.
 * Archive dir: mission-rooms/archive/ (legacy achive/ read compat).
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config";

/** Legacy subfolder name — read compat during transition (D4). */
export const ROOM_ACHIVE_DIR = "achive";

/** Canonical archive subfolder under mission-rooms/. */
export const ROOM_ARCHIVE_DIR = "archive";

export const BOARD_STAGES = [
  "ideas-backlog",
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

export const LEGACY_BOARD_FOLDERS: Partial<Record<BoardStage, string>> = {
  queued: "ready",
  working: "active",
};

/** Create mission-board stages and mission-rooms on boot. */
export async function ensureDataLayout(config: Config): Promise<void> {
  const dirs = [
    config.guildHome,
    join(config.guildHome, "mission-rooms"),
    join(config.guildHome, "mission-rooms", ROOM_ARCHIVE_DIR),
    ...BOARD_STAGES.map((s) => join(config.guildHome, "mission-board", s)),
  ];

  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
}

export function missionBoardPath(config: Config, stage: BoardStage): string {
  return join(config.guildHome, "mission-board", stage);
}

export function legacyMissionBoardPath(config: Config, stage: BoardStage): string | null {
  const legacy = LEGACY_BOARD_FOLDERS[stage];
  if (!legacy) return null;
  return join(config.guildHome, "mission-board", legacy);
}

export function missionBoardEntryPath(config: Config, stage: BoardStage, noteId: string): string {
  return join(missionBoardPath(config, stage), noteId);
}

export function boardNoteMetaPath(config: Config, stage: BoardStage, noteId: string): string {
  return join(missionBoardEntryPath(config, stage, noteId), "meta.yaml");
}

export function boardNoteBriefPath(config: Config, stage: BoardStage, noteId: string): string {
  return join(missionBoardEntryPath(config, stage, noteId), "mission.md");
}

export function skillsBankPath(config: Config): string {
  return join(config.guildHome, "skills-bank");
}

export function builtInSkillsPath(config: Config): string {
  return join(config.guildHome, "skills-bank", "built-in", "skills");
}

export function customSkillsPath(config: Config): string {
  return join(config.guildHome, "skills-bank", "custom", "skills");
}

export function builtInCatalogPath(config: Config): string {
  return join(config.guildHome, "skills-bank", "built-in", "catalog.md");
}

export function customCatalogPath(config: Config): string {
  return join(config.guildHome, "skills-bank", "custom", "catalog.md");
}

export function missionRoomPath(config: Config, missionId: string): string {
  return join(config.guildHome, "mission-rooms", missionId);
}

export function missionRoomArchivePath(config: Config, missionId: string): string {
  return join(config.guildHome, "mission-rooms", ROOM_ARCHIVE_DIR, missionId);
}

/** Legacy achive path — read compat */
export function missionRoomAchivePath(config: Config, missionId: string): string {
  return join(config.guildHome, "mission-rooms", ROOM_ACHIVE_DIR, missionId);
}

export function missionIntakeTemplatePath(config: Config): string {
  return join(config.projectRoot, "templates", "mission-intake");
}

export function missionExecutionTemplatePath(config: Config): string {
  return join(config.projectRoot, "templates", "mission-execution");
}

/** Frozen brief at mission room root (0.4.0). */
export function missionBriefInRoomPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "mission-brief.md");
}

export function missionBriefPath(config: Config, missionId: string): string {
  return join(missionBoardEntryPath(config, "working", missionId), "mission.md");
}

export function checkpointPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "checkpoint.yaml");
}

export function outboxPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "comm", "outbox.jsonl");
}

export function eventsPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "memories", "common", "events.jsonl");
}

export function resolveBoardEntryPaths(config: Config, stage: BoardStage, id: string): string[] {
  const paths = [missionBoardEntryPath(config, stage, id)];
  const legacy = LEGACY_BOARD_FOLDERS[stage];
  if (legacy) {
    paths.push(join(config.guildHome, "mission-board", legacy, id));
  }
  return paths;
}

export function poSessionName(missionId: string): string {
  return `mission-${missionId}-po`;
}

export function intakeLeadSessionName(missionId: string): string {
  return `mission-${missionId}-lead`;
}

export function intakeArtifactsMissionsPath(config: Config, missionId: string): string {
  return join(missionRoomPath(config, missionId), "artifacts", "missions");
}
