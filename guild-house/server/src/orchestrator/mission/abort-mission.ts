/**
 * Guild master abort mission — early terminal close; frees execution slot.
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionBoardEntryPath, missionRoomPath } from "../../paths";
import type { Checkpoint } from "../../types/mission";
import {
  assertMissionId,
  isOnWorkingBoard,
  listBoard,
  resolveWorkingEntryPath,
} from "../core/board";
import { archiveMissionRoom } from "../core/room-achive";
import { stopSession } from "../core/session";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import { deliverGuildMasterDirective } from "./guild-master-notify";

export interface AbortMissionRequest {
  reason?: string;
}

async function stopSessionSafe(config: Config, sessionId: string): Promise<void> {
  try {
    await stopSession(config, sessionId);
  } catch {
    // Session may already be stopped.
  }
}

async function writeAbortNote(config: Config, missionId: string, reason?: string): Promise<void> {
  const notePath = join(missionRoomPath(config, missionId), "retrospective", "abort-note.md");
  await mkdir(join(missionRoomPath(config, missionId), "retrospective"), { recursive: true });
  const body = reason?.trim() || "No reason provided by guild master.";
  const content = [
    "# Abort note",
    "",
    `Aborted: ${new Date().toISOString()}`,
    "",
    body,
    "",
    "Written by orchestrator on guild-master abort (Web/API path).",
    "Chat path: PO may expand this file before calling tools/abort.sh.",
  ].join("\n");
  await writeFile(notePath, `${content}\n`, "utf8");
}

/** Abort mission from working board; stop PO, move to aborted/, free slot. */
export async function abortMission(
  config: Config,
  missionId: string,
  input: AbortMissionRequest = {},
): Promise<{ missionId: string; checkpoint: Checkpoint; notify: { channel: { delivered: boolean; reason?: string } } }> {
  assertMissionId(missionId);

  const board = await listBoard(config);
  if (!isOnWorkingBoard(board, missionId)) {
    throw new Error(`Mission ${missionId} is not on the working board`);
  }

  const checkpoint = await readCheckpoint(config, missionId);
  if (!checkpoint) {
    throw new Error(`Missing checkpoint for ${missionId}`);
  }
  if (checkpoint.phase === "done" || checkpoint.phase === "aborted") {
    throw new Error(`Mission ${missionId} is already terminal (phase: ${checkpoint.phase})`);
  }

  const reason = input.reason?.trim();
  await writeAbortNote(config, missionId, reason);

  const directive = [
    "Guild master aborted this mission.",
    reason || "No reason provided.",
    "Stop all work. Session will end. Skip artifact release.",
    "Ensure retrospective/abort-note.md reflects what is known.",
  ].join(" ");

  const notify = await deliverGuildMasterDirective(config, missionId, {
    event: "mission_aborted",
    directive,
    appendInbox: true,
  });

  await stopSessionSafe(config, checkpoint.claude_session.id);

  const updated: Checkpoint = {
    ...checkpoint,
    phase: "aborted",
    awaiting_guild_master: false,
    claude_session: {
      ...checkpoint.claude_session,
      status: "stopped",
      job_state: "done",
    },
  };
  await writeCheckpoint(config, missionId, updated);

  const src = await resolveWorkingEntryPath(config, missionId);
  if (!src) {
    throw new Error(`Working board entry missing: ${missionId}`);
  }
  await rename(src, missionBoardEntryPath(config, "aborted", missionId));
  await archiveMissionRoom(config, missionId);

  return { missionId, checkpoint: updated, notify };
}
