/**
 * Guild master Approve — copy valid draft packages to parking, close discovery.
 *
 * Valid package = artifacts/missions/{folder}/mission.md. Stops lead session,
 * sets phase closed, removes discovering/{id} board folder (room retained).
 */
import { cp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { ideaBoardEntryPath, missionBoardEntryPath } from "../../paths";
import type { DiscoveryCheckpoint } from "../../types/discovery";
import { assertIdeaId } from "../core/idea-id";
import { stopSession } from "../core/session";
import { listBoard } from "../core/board";
import { readDiscoveryCheckpoint, writeDiscoveryCheckpoint } from "./checkpoint";
import { listValidMissionDraftFolders } from "./drafts";

async function stopSessionSafe(config: Config, sessionId: string): Promise<void> {
  try {
    await stopSession(config, sessionId);
  } catch {
    // Session may already be stopped.
  }
}

/** Approve discovery packages → parking board; stops lead session, closes checkpoint. */
export async function approveDiscovery(
  config: Config,
  ideaId: string,
): Promise<{ ideaId: string; checkpoint: DiscoveryCheckpoint; parkingFolders: string[] }> {
  assertIdeaId(ideaId);

  const board = await listBoard(config);
  if (!board.discovering.includes(ideaId)) {
    throw new Error(`Idea ${ideaId} is not on the discovering board`);
  }

  const checkpoint = await readDiscoveryCheckpoint(config, ideaId);
  if (!checkpoint) {
    throw new Error(`Missing discovery checkpoint for ${ideaId}`);
  }
  if (checkpoint.phase === "closed") {
    throw new Error(`Discovery ${ideaId} is already closed`);
  }

  const draftFolders = await listValidMissionDraftFolders(config, ideaId);
  if (draftFolders.length === 0) {
    throw new Error(`No mission packages under artifacts/missions/ for ${ideaId}`);
  }

  // Copy each valid package folder to parking; idea leaves board, room stays for audit.
  const parkingFolders: string[] = [];
  for (const folder of draftFolders) {
    const dest = missionBoardEntryPath(config, "parking", folder);
    try {
      await stat(dest);
      throw new Error(`Parking entry already exists: ${folder}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Parking entry already exists")) {
        throw err;
      }
      // dest missing — ok to copy
    }

    const src = join(config.guildHome, "discovery-rooms", ideaId, "artifacts", "missions", folder);
    await cp(src, dest, { recursive: true });
    parkingFolders.push(folder);
  }

  await stopSessionSafe(config, checkpoint.claude_session.id);

  const closed: DiscoveryCheckpoint = {
    ...checkpoint,
    phase: "closed",
    awaiting_guild_master: false,
    claude_session: {
      ...checkpoint.claude_session,
      status: "stopped",
      job_state: "done",
      synced_at: new Date().toISOString(),
    },
  };
  await writeDiscoveryCheckpoint(config, ideaId, closed);

  await rm(ideaBoardEntryPath(config, "discovering", ideaId), { recursive: true, force: true });

  return { ideaId, checkpoint: closed, parkingFolders };
}
