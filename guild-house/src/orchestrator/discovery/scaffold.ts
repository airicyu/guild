/**
 * Discovery room scaffold from templates/discovery-room.
 *
 * Copies scratch from discovering board entry; substitutes {{ideaId}} only (role: guild master, not display name).
 * Creates artifacts/missions/ and empty outbox.jsonl.
 */
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { discoveryRoomPath, discoveryRoomTemplatePath, ideaBoardEntryPath } from "../../paths";
import type { DiscoveryCheckpoint } from "../../types/discovery";
import { applyTemplateVars } from "../core/template-vars";

/** Resume prompt when discovery lead session is respawned. */
export function resumeDiscoverySpawnPrompt(ideaId: string, checkpoint: DiscoveryCheckpoint): string {
  const lines = [
    `You are discovery intake lead for idea ${ideaId}.`,
    "Your cwd is this discovery room.",
    "The orchestrator restored you after your background session ended.",
    `Current state: phase=${checkpoint.phase}.`,
  ];

  if (checkpoint.awaiting_guild_master) {
    lines.push(
      "You were awaiting the guild master — read inbox.md and recent outbox entries before continuing.",
    );
  }

  lines.push(
    "Read scratch.md, members/intake-lead/agent.md, and recent events (events.jsonl).",
    "Continue discovery from where you left off; draft mission package(s) under artifacts/missions/.",
    "Do not execute missions or spawn PO sessions. Use discovery signals API; do not edit checkpoint.yaml.",
  );

  return lines.join(" ");
}

/** First-run intake lead prompt on ideas → discovering pickup. */
export function initialDiscoverySpawnPrompt(ideaId: string): string {
  return [
    `You are discovery intake lead for idea ${ideaId}.`,
    "Your cwd is this discovery room.",
    "Read .guild/handoff-prompt.md and execute the full handoff checklist now.",
    "Start by reading scratch.md and members/intake-lead/agent.md.",
    "Explore the idea and draft executable mission package(s) under artifacts/missions/.",
    "Do not execute missions, scaffold mission-rooms, or spawn PO sessions.",
    "When the guild master approves in attach or inbox, run ./tools/approve.sh — do not copy folders or log approval before it succeeds.",
  ].join(" ");
}

/** Copy templates/discovery-room and personalize for idea id. */
export async function scaffoldDiscoveryRoom(config: Config, ideaId: string): Promise<string> {
  const roomPath = discoveryRoomPath(config, ideaId);
  const templatePath = discoveryRoomTemplatePath(config);

  await mkdir(roomPath, { recursive: true });
  await cp(templatePath, roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });

  await personalizeDiscoveryRoom(roomPath, ideaId);
  await copyScratchFromBoard(config, ideaId, roomPath);
  await mkdir(join(roomPath, "artifacts", "missions"), { recursive: true });
  await ensureDiscoveryOutbox(roomPath);
  await writeDiscoveryHandoff(config, ideaId, roomPath);
  return roomPath;
}

async function personalizeDiscoveryRoom(roomPath: string, ideaId: string): Promise<void> {
  const vars = { ideaId };
  const files = [
    join(roomPath, "members", "intake-lead", "agent.md"),
    join(roomPath, ".guild", "handoff-prompt.md"),
  ];

  for (const file of files) {
    try {
      const raw = await readFile(file, "utf8");
      if (!raw.includes("{{")) continue;
      await writeFile(file, applyTemplateVars(raw, vars), "utf8");
    } catch {
      // Optional template file.
    }
  }
}

async function copyScratchFromBoard(
  config: Config,
  ideaId: string,
  roomPath: string,
): Promise<void> {
  const scratchSrc = join(ideaBoardEntryPath(config, "discovering", ideaId), "scratch.md");
  try {
    await stat(scratchSrc);
  } catch {
    throw new Error(`Missing scratch.md on discovering board: ${ideaId}`);
  }
  await cp(scratchSrc, join(roomPath, "scratch.md"));
}

async function ensureDiscoveryOutbox(roomPath: string): Promise<void> {
  const path = join(roomPath, "outbox.jsonl");
  try {
    await stat(path);
  } catch {
    await writeFile(path, "", "utf8");
  }
}

async function writeDiscoveryHandoff(
  config: Config,
  ideaId: string,
  roomPath: string,
): Promise<void> {
  const guildDir = join(roomPath, ".guild");
  await mkdir(guildDir, { recursive: true });

  const templatePath = join(discoveryRoomTemplatePath(config), ".guild", "handoff-prompt.md");
  const schemaPath = join(config.projectRoot, "specs", "mission-schema.md");
  const vars = { ideaId };

  let template: string;
  try {
    template = await readFile(templatePath, "utf8");
  } catch {
    template = `# Discovery handoff — {{ideaId}}\n\nRead scratch.md and members/intake-lead/agent.md\n`;
  }

  await writeFile(join(guildDir, "handoff-prompt.md"), applyTemplateVars(template, vars), "utf8");

  try {
    const schema = await readFile(schemaPath, "utf8");
    await writeFile(join(guildDir, "mission-schema.md"), schema, "utf8");
  } catch {
    // Schema doc optional if missing from repo layout.
  }
}
