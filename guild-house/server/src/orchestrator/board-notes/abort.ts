/**
 * Abort mission board note from any pre-terminal stage.
 */
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionBoardEntryPath, type BoardStage } from "../../paths";
import { listBoard, resolveBoardNoteStage } from "../core/board";
import { markBoardNoteCompleted, readBoardNoteMeta, writeBoardNoteMeta } from "../core/board-note-meta";
import { assertNoteId } from "../core/note-id";
import { archiveMissionRoom } from "../core/room-achive";
import { readCheckpoint, writeCheckpoint } from "../mission/checkpoint";
import { stopSession } from "../core/session";
import { resolveBoardEntryPaths } from "../../paths";

const ABORTABLE: BoardStage[] = [
  "ideas-backlog",
  "ideas",
  "discovering",
  "parking",
  "queued",
  "working",
];

async function stopSessionSafe(config: Config, sessionId: string): Promise<void> {
  try {
    await stopSession(config, sessionId);
  } catch {
    // already stopped
  }
}

async function resolveNoteEntryPath(
  config: Config,
  stage: BoardStage,
  noteId: string,
): Promise<string | null> {
  for (const p of resolveBoardEntryPaths(config, stage, noteId)) {
    try {
      const { stat } = await import("node:fs/promises");
      if ((await stat(p)).isDirectory()) return p;
    } catch {
      // continue
    }
  }
  return null;
}

export async function abortBoardNoteWithRoom(
  config: Config,
  noteId: string,
  reason?: string,
): Promise<{ noteId: string; stage: BoardStage }> {
  assertNoteId(noteId);
  const board = await listBoard(config);
  const stage = resolveBoardNoteStage(board, noteId);
  if (!stage) throw new Error(`Board note not found: ${noteId}`);
  if (!ABORTABLE.includes(stage)) {
    throw new Error(`Cannot abort board note on stage ${stage}`);
  }

  const checkpoint = await readCheckpoint(config, noteId);
  if (checkpoint) {
    await stopSessionSafe(config, checkpoint.claude_session.id);
    const roomPath = join(config.guildHome, "mission-rooms", noteId);
    const retroDir = join(roomPath, "retrospective");
    try {
      const { stat } = await import("node:fs/promises");
      await stat(retroDir);
      const note = reason?.trim() || "Aborted by guild master";
      await writeFile(join(retroDir, "abort-note.md"), `# Abort\n\n${note}\n`, "utf8");
    } catch {
      // no retrospective dir — intake or early abort
    }

    await writeCheckpoint(config, noteId, {
      ...checkpoint,
      phase: "aborted",
      awaiting_guild_master: false,
      claude_session: {
        ...checkpoint.claude_session,
        status: "stopped",
        job_state: "done",
      },
    });
    await archiveMissionRoom(config, noteId);
  }

  const src = await resolveNoteEntryPath(config, stage, noteId);
  if (!src) throw new Error(`Board entry missing: ${noteId}`);

  const dest = missionBoardEntryPath(config, "aborted", noteId);
  await rename(src, dest);

  const meta = await readBoardNoteMeta(config, "aborted", noteId);
  if (meta) {
    await markBoardNoteCompleted(config, "aborted", noteId);
  } else {
    const fallback = {
      note_id: noteId,
      type: "work_execution" as const,
      slug: noteId,
      origin: "submitted" as const,
      parent_id: null,
      spawned_from_draft: null,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    await writeBoardNoteMeta(config, "aborted", fallback);
  }

  return { noteId, stage: "aborted" };
}
