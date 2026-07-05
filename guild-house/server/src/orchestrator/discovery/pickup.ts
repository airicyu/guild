/**
 * Intake tick — FIFO pickup from ideas/ while intake slots allow.
 */
import { rename, stat } from "node:fs/promises";
import type { Config } from "../../config";
import { intakeLeadSessionName, missionBoardEntryPath } from "../../paths";
import type { BoardListing, SlotMeter, TickResult } from "../../types/mission";
import { listBoard } from "../core/board";
import { buildCheckpoint, writeCheckpoint } from "../mission/checkpoint";
import { initialIntakeSpawnPrompt, scaffoldIntakeMission } from "../mission/intake-scaffold";
import { spawnDiscoveryLead } from "../core/spawn";

export interface IntakeTickInput {
  board: BoardListing;
  slotsLeft: number;
  intakeUsed: number;
}

export interface IntakeTickResult {
  intakeStarted: string[];
  queuedIntake: string[];
  errors: TickResult["errors"];
  intakeSlots: SlotMeter;
}

async function resolveIdeasEntryPath(config: Config, noteId: string): Promise<string | null> {
  const path = missionBoardEntryPath(config, "ideas", noteId);
  try {
    if ((await stat(path)).isDirectory()) return path;
  } catch {
    // missing
  }
  return null;
}

async function pickupIntake(config: Config, noteId: string): Promise<void> {
  const src = await resolveIdeasEntryPath(config, noteId);
  if (!src) throw new Error(`Ideas entry missing: ${noteId}`);

  await rename(src, missionBoardEntryPath(config, "discovering", noteId));
  const roomPath = await scaffoldIntakeMission(config, noteId);
  const session = await spawnDiscoveryLead(config, noteId, initialIntakeSpawnPrompt(noteId));

  await writeCheckpoint(
    config,
    noteId,
    buildCheckpoint({
      missionId: noteId,
      session: {
        ...session,
        name: intakeLeadSessionName(noteId),
        cwd: roomPath,
        job_state: "running",
      },
      mode: "intake",
      noteStage: "discovering",
      phase: "idea_exploring",
    }),
  );
}

export async function tickDiscovery(
  config: Config,
  input?: IntakeTickInput & { discoveryUsed?: number; slotsLeft?: number },
): Promise<IntakeTickResult> {
  const board = input?.board ?? (await listBoard(config));
  const used = input?.intakeUsed ?? input?.discoveryUsed ?? 0;
  let slotsLeft = input?.slotsLeft ?? 0;

  const result: IntakeTickResult = {
    intakeStarted: [],
    queuedIntake: [],
    errors: [],
    intakeSlots: {
      used,
      max: config.maxDiscoverySessions,
      available: slotsLeft,
    },
  };

  for (const noteId of board.ideas) {
    if (slotsLeft <= 0) {
      result.queuedIntake.push(noteId);
      continue;
    }

    try {
      await pickupIntake(config, noteId);
      result.intakeStarted.push(noteId);
      slotsLeft -= 1;
      result.intakeSlots.used += 1;
      result.intakeSlots.available = slotsLeft;
    } catch (err) {
      result.errors.push({
        id: noteId,
        pipeline: "intake",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
