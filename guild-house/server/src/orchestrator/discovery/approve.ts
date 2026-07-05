/**
 * Approve discovering — Option B: parent → done; spawn children → parking.
 */
import { cp, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { intakeArtifactsMissionsPath, missionBoardEntryPath } from "../../paths";
import type { Checkpoint } from "../../types/mission";
import { buildBoardNoteMeta, markBoardNoteCompleted, writeBoardNoteMeta } from "../core/board-note-meta";
import { listBoard } from "../core/board";
import { assertNoteId, mintUniqueNoteId, slugFromFolderName } from "../core/note-id";
import { archiveMissionRoom } from "../core/room-achive";
import { stopSession } from "../core/session";
import { readCheckpoint, writeCheckpoint } from "../mission/checkpoint";
import { listValidMissionDraftFolders } from "./drafts";

async function stopSessionSafe(config: Config, sessionId: string): Promise<void> {
  try {
    await stopSession(config, sessionId);
  } catch {
    // Session may already be stopped.
  }
}

/** POST /missions/:id/approve-discovery */
export async function approveDiscovery(
  config: Config,
  noteId: string,
): Promise<{ noteId: string; checkpoint: Checkpoint; parkingFolders: string[] }> {
  assertNoteId(noteId);

  const board = await listBoard(config);
  if (!board.discovering.includes(noteId)) {
    throw new Error(`Board note ${noteId} is not on the discovering stage`);
  }

  const checkpoint = await readCheckpoint(config, noteId);
  if (!checkpoint) {
    throw new Error(`Missing mission checkpoint for ${noteId}`);
  }
  if (checkpoint.phase === "mission_plan_complete") {
    throw new Error(`Intake for ${noteId} is already complete`);
  }

  const draftFolders = await listValidMissionDraftFolders(config, noteId);
  if (draftFolders.length === 0) {
    throw new Error(`No mission packages under artifacts/missions/ for ${noteId}`);
  }

  const parkingFolders: string[] = [];
  for (const folder of draftFolders) {
    const slug = slugFromFolderName(folder);
    const childId = await mintUniqueNoteId(config, slug);
    const dest = missionBoardEntryPath(config, "parking", childId);
    await mkdir(dest, { recursive: true });

    const srcMission = join(intakeArtifactsMissionsPath(config, noteId), folder, "mission.md");
    await cp(srcMission, join(dest, "mission.md"));

    const meta = buildBoardNoteMeta({
      noteId: childId,
      type: "work_execution",
      slug,
      origin: "spawned",
      parentId: noteId,
      spawnedFromDraft: folder,
    });
    await writeBoardNoteMeta(config, "parking", meta);
    parkingFolders.push(childId);
  }

  await stopSessionSafe(config, checkpoint.claude_session.id);

  const closed: Checkpoint = {
    ...checkpoint,
    phase: "mission_plan_complete",
    awaiting_guild_master: false,
    claude_session: {
      ...checkpoint.claude_session,
      status: "stopped",
      job_state: "done",
      synced_at: new Date().toISOString(),
    },
  };
  await writeCheckpoint(config, noteId, closed);

  // Parent board note → done (Option B)
  const discoveringPath = missionBoardEntryPath(config, "discovering", noteId);
  const donePath = missionBoardEntryPath(config, "done", noteId);
  await rename(discoveringPath, donePath);
  await markBoardNoteCompleted(config, "done", noteId);

  await archiveMissionRoom(config, noteId);

  return { noteId, checkpoint: closed, parkingFolders };
}
