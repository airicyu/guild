/**
 * Mission room scaffold from templates/mission-room — copy, personalize, handoff prompts.
 *
 * Brief copied from working board entry → memories/common/mission-brief.md.
 * Playbooks use role term guild master; handoff substitutes {{missionId}} and {{briefPath}} only.
 */
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import type { Checkpoint } from "../../types/mission";
import {
  missionExecutionTemplatePath,
  missionBriefInRoomPath,
  eventsPath,
  missionRoomPath,
  resolveBoardEntryPaths,
  BOARD_STAGES,
} from "../../paths";
import { listBoard, resolveWorkingEntryPath } from "../core/board";
import { applyTemplateVars } from "../core/template-vars";

const MEMBER_ROLES = ["project-owner", "evaluator", "senior-developer", "developer", "qa"] as const;

/** Copy templates/mission-room, personalize, freeze brief, write handoff prompt. */
export async function scaffoldMissionRoom(config: Config, missionId: string): Promise<string> {
  const roomPath = missionRoomPath(config, missionId);
  const templatePath = missionExecutionTemplatePath(config);

  await mkdir(roomPath, { recursive: true });
  await cp(templatePath, roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });

  await copyMissionBrief(config, missionId, roomPath);
  await ensureEventsFile(config, missionId);
  await writeHandoffPrompt(config, missionId, roomPath);
  return roomPath;
}

async function resolveMissionBriefPath(config: Config, missionId: string): Promise<string> {
  const entry = await resolveWorkingEntryPath(config, missionId);
  if (!entry) {
    throw new Error(`Missing mission board entry for brief: ${missionId}`);
  }
  return join(entry, "mission.md");
}

async function copyMissionBrief(config: Config, missionId: string, roomPath: string): Promise<void> {
  const briefPath = await resolveMissionBriefPath(config, missionId);
  await cp(briefPath, join(roomPath, "mission-brief.md"));
}

/** Ensure memories/common/mission-brief.md exists from board brief copy. */
export async function ensureMissionBriefInRoom(config: Config, missionId: string): Promise<void> {
  const target = missionBriefInRoomPath(config, missionId);
  const legacy = join(missionRoomPath(config, missionId), "memories", "common", "mission-brief.md");

  try {
    await stat(target);
    return;
  } catch {
    try {
      await stat(legacy);
      await cp(legacy, target);
      return;
    } catch {
      // fall through to board copy
    }
  }

  const board = await listBoard(config);
  const stage = BOARD_STAGES.find((s) => board[s].includes(missionId));
  if (!stage) return;

  for (const entryPath of resolveBoardEntryPaths(config, stage, missionId)) {
    const source = join(entryPath, "mission.md");
    try {
      await stat(source);
    } catch {
      continue;
    }

    const commonDir = join(missionRoomPath(config, missionId), "memories", "common");
    await mkdir(commonDir, { recursive: true });
    await cp(source, target);
    return;
  }
}

/** Create empty memories/common/events.jsonl if missing. */
export async function ensureEventsFile(config: Config, missionId: string): Promise<void> {
  const path = eventsPath(config, missionId);
  try {
    await stat(path);
  } catch {
    await mkdir(join(missionRoomPath(config, missionId), "memories", "common"), { recursive: true });
    await writeFile(path, "", "utf8");
  }
}

/** Scaffold per-member memory files from templates if missing. */
export async function ensureMemberMemories(config: Config, missionId: string): Promise<void> {
  const roomPath = missionRoomPath(config, missionId);
  for (const role of MEMBER_ROLES) {
    const memPath = join(roomPath, "memories", "members", role, "memory.md");
    try {
      await stat(memPath);
    } catch {
      await mkdir(join(roomPath, "memories", "members", role), { recursive: true });
      const label = role.replace(/-/g, " ");
      await writeFile(memPath, `# ${label} — personal notes\n\n`, "utf8");
    }
  }
}

/** Ensure brief, events, and member memories exist (restore path). */
export async function ensureRoomArtifacts(config: Config, missionId: string): Promise<void> {
  await ensureMissionBriefInRoom(config, missionId);
  await ensureEventsFile(config, missionId);
  await ensureMemberMemories(config, missionId);
}

async function writeHandoffPrompt(config: Config, missionId: string, roomPath: string): Promise<void> {
  const mgmtDir = join(roomPath, "mission-management");
  await mkdir(mgmtDir, { recursive: true });

  const briefPath = await resolveMissionBriefPath(config, missionId);
  const templatePath = join(config.projectRoot, "templates", "handoff-prompt.md");
  const schemaPath = join(config.projectRoot, "specs", "mission-schema.md");
  const vars = { missionId, briefPath };

  let template: string;
  try {
    template = await readFile(templatePath, "utf8");
  } catch {
    template = `# Mission handoff — {{missionId}}\n\nRead memories/common/mission-brief.md and members/project-owner/agent.md\n`;
  }

  await writeFile(join(mgmtDir, "handoff-prompt.md"), applyTemplateVars(template, vars), "utf8");

  try {
    const schema = await readFile(schemaPath, "utf8");
    await writeFile(join(mgmtDir, "mission-schema.md"), applyTemplateVars(schema, vars), "utf8");
  } catch {
    // Schema doc optional if missing from repo layout.
  }
}

/** Copy board mission.md → room brief before pickup completes. */
export async function ensureMissionBrief(config: Config, missionId: string): Promise<void> {
  const briefPath = await resolveMissionBriefPath(config, missionId);
  try {
    await stat(briefPath);
  } catch {
    throw new Error(`Missing mission brief: ${briefPath}`);
  }
}

/** First-run PO prompt passed to `claude --bg` on bell pickup. */
export function initialSpawnPrompt(missionId: string): string {
  return [
    `You are mission ${missionId} Project Owner (team lead).`,
    "Your cwd is this mission room.",
    "Read CLAUDE.md first, then mission-management/handoff-prompt.md and execute the full handoff checklist.",
    "Start by reading mission-brief.md and members/project-owner/agent.md.",
    "Spawn evaluator first (Task); do not write code until squad.md and common/memory.md exist.",
  ].join(" ");
}

/** Resume PO prompt when restore ladder spawns a fresh session. */
export function resumeSpawnPrompt(missionId: string, checkpoint: Checkpoint): string {
  const lines = [
    `You are mission ${missionId} Project Owner (team lead).`,
    "Your cwd is this mission room.",
    "The orchestrator restored you after your background session ended.",
    `Current state: phase=${checkpoint.phase}, round=${checkpoint.round}.`,
  ];

  if (checkpoint.awaiting_guild_master) {
    lines.push(
      "You were awaiting the guild master — read inbox.md and recent outbox entries before continuing.",
    );
  }

  lines.push(
    "Read memories/common/memory.md, squad.md, and recent events (memories/common/events.jsonl).",
    "Continue from where the team left off; do not rerun full handoff unless memory is empty.",
    "Use signal tools for lifecycle; do not edit checkpoint.yaml.",
  );

  return lines.join(" ");
}
