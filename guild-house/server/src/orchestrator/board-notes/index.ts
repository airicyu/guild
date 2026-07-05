/**
 * Board note operations — submit, list, detail, abort (0.4.0).
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionBoardEntryPath, type BoardStage } from "../../paths";
import type {
  BoardNoteDetail,
  BoardNoteListItem,
  SubmitBoardNoteRequest,
} from "../../types/board-note";
import {
  buildBoardNoteMeta,
  markBoardNoteCompleted,
  readBoardNoteBrief,
  readBoardNoteMeta,
  writeBoardNoteMeta,
} from "../core/board-note-meta";
import { listBoard, resolveBoardNoteStage } from "../core/board";
import { assertNoteId, mintUniqueNoteId, slugFromFolderName } from "../core/note-id";
import { readCheckpoint } from "../mission/checkpoint";
import { syncActiveMission } from "../mission/session-lifecycle";
import { resolveMissionRoomPath } from "../core/room-achive";
import { abortBoardNoteWithRoom } from "./abort";

const BRIEF_PREVIEW_LEN = 200;

function briefPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= BRIEF_PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, BRIEF_PREVIEW_LEN)}…`;
}

function submitStage(board?: SubmitBoardNoteRequest["board"]): "ideas-backlog" | "ideas" {
  return board === "ideas" ? "ideas" : "ideas-backlog";
}

/** POST /ideas — mint board note with mission.md + meta.yaml. */
export async function submitBoardNote(config: Config, body: SubmitBoardNoteRequest) {
  const text = body.text?.trim();
  if (!text) throw new Error("Missing text");

  const stage = submitStage(body.board);
  const slug = body.slug?.trim() || "idea";
  const noteId = await mintUniqueNoteId(config, slug === "idea" ? undefined : slug);
  const entryPath = missionBoardEntryPath(config, stage, noteId);

  await mkdir(entryPath, { recursive: true });
  await writeFile(join(entryPath, "mission.md"), text, "utf8");
  const meta = buildBoardNoteMeta({
    noteId,
    type: "idea_exploring",
    slug: slugFromFolderName(noteId),
    origin: "submitted",
  });
  await writeBoardNoteMeta(config, stage, meta);

  return {
    ok: true as const,
    noteId,
    ideaId: noteId,
    board: stage === "ideas-backlog" ? ("backlog" as const) : ("ideas" as const),
    briefPreview: briefPreview(text),
    scratchPreview: briefPreview(text),
  };
}

async function buildListItem(
  config: Config,
  noteId: string,
  stage: BoardStage,
): Promise<BoardNoteListItem> {
  const brief = await readBoardNoteBrief(config, stage, noteId);
  const meta =
    (await readBoardNoteMeta(config, stage, noteId)) ??
    ({
      note_id: noteId,
      type: stage === "discovering" || stage === "ideas-backlog" || stage === "ideas" ? "idea_exploring" : "work_execution",
      slug: slugFromFolderName(noteId),
      origin: "submitted",
      parent_id: null,
      spawned_from_draft: null,
      created_at: "",
      completed_at: null,
    } as const);

  const item: BoardNoteListItem = {
    id: noteId,
    stage,
    type: meta.type,
    origin: meta.origin,
    parentId: meta.parent_id,
    briefPreview: briefPreview(brief),
    completedAt: meta.completed_at,
  };

  if (stage === "discovering" || stage === "working") {
    const synced = await syncActiveMission(config, noteId);
    const checkpoint = synced?.checkpoint ?? (await readCheckpoint(config, noteId));
    item.phase = checkpoint?.phase;
    item.sessionLive = synced?.live ?? false;
  }

  return item;
}

/** GET /mission-board-notes */
export async function listBoardNotes(config: Config, stageFilter?: BoardStage) {
  const board = await listBoard(config);
  const stages: BoardStage[] = stageFilter
    ? [stageFilter]
    : [
        "ideas-backlog",
        "ideas",
        "discovering",
        "parking",
        "queued",
        "working",
        "done",
        "aborted",
        "archive",
      ];

  const items: BoardNoteListItem[] = [];
  for (const stage of stages) {
    for (const id of board[stage]) {
      items.push(await buildListItem(config, id, stage));
    }
  }

  return { notes: items, count: items.length };
}

/** GET /mission-board-notes/:id */
export async function getBoardNote(config: Config, noteId: string): Promise<BoardNoteDetail | null> {
  assertNoteId(noteId);
  const board = await listBoard(config);
  const stage = resolveBoardNoteStage(board, noteId);
  if (!stage) return null;

  const brief = await readBoardNoteBrief(config, stage, noteId);
  const meta = await readBoardNoteMeta(config, stage, noteId);
  if (!meta) return null;

  const detail: BoardNoteDetail = {
    id: noteId,
    stage,
    type: meta.type,
    origin: meta.origin,
    parentId: meta.parent_id,
    brief,
    briefPreview: briefPreview(brief),
    completedAt: meta.completed_at,
    meta,
  };

  const roomPath = await resolveMissionRoomPath(config, noteId);
  if (roomPath && (stage === "discovering" || stage === "working")) {
    const synced = await syncActiveMission(config, noteId);
    const checkpoint = synced?.checkpoint ?? (await readCheckpoint(config, noteId));
    detail.checkpoint = checkpoint;
    detail.sessionLive = synced?.live ?? false;
    detail.jobState = synced?.jobState ?? checkpoint?.claude_session.job_state ?? "missing";
    detail.restoreRequired = synced?.restoreRequired ?? false;
    detail.roomPath = roomPath;
    detail.phase = checkpoint?.phase;
  }

  return detail;
}

/** POST /mission-board-notes/:id/abort */
export async function abortBoardNote(
  config: Config,
  noteId: string,
  reason?: string,
): Promise<{ noteId: string; stage: BoardStage }> {
  return abortBoardNoteWithRoom(config, noteId, reason);
}
