/**
 * Mission board note metadata — lives on Kanban cards only (meta.yaml).
 * Orchestrator-only writer; survives after mission room archive.
 */
import type { BoardStage } from "./mission";

export type BoardNoteType = "idea_exploring" | "work_execution";
export type BoardNoteOrigin = "submitted" | "spawned";

export interface BoardNoteMeta {
  note_id: string;
  type: BoardNoteType;
  slug: string;
  origin: BoardNoteOrigin;
  parent_id: string | null;
  spawned_from_draft: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateBoardNoteMetaInput {
  noteId: string;
  type: BoardNoteType;
  slug: string;
  origin: BoardNoteOrigin;
  parentId?: string | null;
  spawnedFromDraft?: string | null;
}

export interface BoardNoteListItem {
  id: string;
  stage: BoardStage;
  type: BoardNoteType;
  origin: BoardNoteOrigin;
  parentId: string | null;
  briefPreview: string;
  completedAt: string | null;
  /** Live mission phase when room exists */
  phase?: string;
  sessionLive?: boolean;
}

export interface BoardNoteDetail extends BoardNoteListItem {
  brief: string;
  meta: BoardNoteMeta;
  checkpoint?: import("./mission").Checkpoint | null;
  roomPath?: string | null;
  jobState?: import("./mission").JobState;
  restoreRequired?: boolean;
}

/** Submit rough prompt — POST /ideas body (retained route name). */
export interface SubmitBoardNoteRequest {
  text: string;
  slug?: string;
  /** Submit destination — default `backlog` (ideas-backlog/); `ideas` skips incubation. */
  board?: "backlog" | "ideas";
}
