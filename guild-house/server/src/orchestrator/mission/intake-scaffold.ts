/**
 * Intake mission scaffold — templates/mission-intake → mission-rooms/{id}/.
 */
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import {
  intakeArtifactsMissionsPath,
  missionBoardEntryPath,
  missionIntakeTemplatePath,
  missionRoomPath,
} from "../../paths";
import type { Checkpoint } from "../../types/mission";
import { applyTemplateVars } from "../core/template-vars";

export function initialIntakeSpawnPrompt(missionId: string): string {
  return [
    `You are intake lead for mission board note ${missionId}.`,
    "Your cwd is this mission room.",
    "Read CLAUDE.md first, then mission-management/handoff-prompt.md and execute the handoff checklist.",
    "Start by reading mission-brief.md and members/intake-lead/agent.md.",
    "Explore scope and draft executable mission package(s) under artifacts/missions/.",
    "Do not execute missions or spawn PO sessions.",
    "When the guild master approves, run ./tools/approve.sh — do not narrate approval before API success.",
  ].join(" ");
}

export function resumeIntakeSpawnPrompt(missionId: string, checkpoint: Checkpoint): string {
  const lines = [
    `You are intake lead for mission board note ${missionId}.`,
    "Your cwd is this mission room.",
    "The orchestrator restored you after your background session ended.",
    `Current state: phase=${checkpoint.phase}.`,
  ];
  if (checkpoint.awaiting_guild_master) {
    lines.push("You were awaiting the guild master — read comm/inbox.md and recent outbox before continuing.");
  }
  lines.push(
    "Read mission-brief.md, members/intake-lead/agent.md, and memories/common/events.jsonl.",
    "Continue from where you left off; use signals API; do not edit checkpoint.yaml.",
  );
  return lines.join(" ");
}

export async function scaffoldIntakeMission(config: Config, missionId: string): Promise<string> {
  const roomPath = missionRoomPath(config, missionId);
  const templatePath = missionIntakeTemplatePath(config);

  await mkdir(roomPath, { recursive: true });
  await cp(templatePath, roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });

  await personalizeIntakeRoom(roomPath, missionId);
  await copyBriefFromBoard(config, missionId, roomPath);
  await mkdir(intakeArtifactsMissionsPath(config, missionId), { recursive: true });
  await ensureCommOutbox(roomPath);
  await writeIntakeHandoff(config, missionId, roomPath);
  return roomPath;
}

async function personalizeIntakeRoom(roomPath: string, missionId: string): Promise<void> {
  const vars = { missionId, ideaId: missionId };
  const files = [
    join(roomPath, "CLAUDE.md"),
    join(roomPath, "members", "intake-lead", "agent.md"),
    join(roomPath, "mission-management", "handoff-prompt.md"),
  ];
  for (const file of files) {
    try {
      const raw = await readFile(file, "utf8");
      if (!raw.includes("{{")) continue;
      await writeFile(file, applyTemplateVars(raw, vars), "utf8");
    } catch {
      // optional
    }
  }
}

async function copyBriefFromBoard(config: Config, missionId: string, roomPath: string): Promise<void> {
  const entry = missionBoardEntryPath(config, "discovering", missionId);
  for (const name of ["mission.md", "scratch.md"]) {
    const src = join(entry, name);
    try {
      await stat(src);
      await cp(src, join(roomPath, "mission-brief.md"));
      return;
    } catch {
      // try next
    }
  }
  throw new Error(`Missing mission.md on discovering board: ${missionId}`);
}

async function ensureCommOutbox(roomPath: string): Promise<void> {
  const path = join(roomPath, "comm", "outbox.jsonl");
  try {
    await stat(path);
  } catch {
    await mkdir(join(roomPath, "comm"), { recursive: true });
    await writeFile(path, "", "utf8");
  }
}

async function writeIntakeHandoff(config: Config, missionId: string, roomPath: string): Promise<void> {
  const mgmtDir = join(roomPath, "mission-management");
  await mkdir(mgmtDir, { recursive: true });

  const templatePath = join(missionIntakeTemplatePath(config), "mission-management", "handoff-prompt.md");
  const schemaPath = join(config.projectRoot, "specs", "mission-schema.md");
  const vars = { missionId, ideaId: missionId };

  let template: string;
  try {
    template = await readFile(templatePath, "utf8");
  } catch {
    template = `# Intake handoff — {{missionId}}\n\nRead mission-brief.md and members/intake-lead/agent.md\n`;
  }
  await writeFile(join(mgmtDir, "handoff-prompt.md"), applyTemplateVars(template, vars), "utf8");

  try {
    const schema = await readFile(schemaPath, "utf8");
    await writeFile(join(mgmtDir, "mission-schema.md"), schema, "utf8");
  } catch {
    // optional
  }
}
