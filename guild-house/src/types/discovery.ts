/**
 * TypeScript contracts for Plan 3 discovery pipeline (ideas → discovering → parking).
 *
 * Reuses ClaudeSession/JobState from mission types. DiscoverySignalType is separate
 * from mission SignalType. Phases end at closed after guild master Approve.
 */
import type { ClaudeSession, JobState } from "./mission";

export type DiscoveryPhase =
  | "exploring"
  | "drafting"
  | "presenting"
  | "awaiting_approval"
  | "closed";

export interface DiscoveryLastSignal {
  at: string;
  by: string;
  type: string;
  summary?: string;
}

export interface DiscoveryCheckpoint {
  idea_id: string;
  claude_session: ClaudeSession;
  phase: DiscoveryPhase;
  awaiting_guild_master: boolean;
  inbox_pending: boolean;
  picked_up_at: string;
  last_signal?: DiscoveryLastSignal | null;
}

export interface CreateIdeaRequest {
  text: string;
  slug?: string;
}

export interface IdeaListItem {
  id: string;
  board: "ideas" | "discovering";
  scratchPreview: string;
  phase?: DiscoveryPhase;
  sessionLive?: boolean;
}

export interface IdeaDetail extends IdeaListItem {
  scratch: string;
  checkpoint?: DiscoveryCheckpoint | null;
  roomPath?: string | null;
  jobState?: JobState;
  restoreRequired?: boolean;
}

export type DiscoverySignalType =
  | "start_drafting"
  | "packages_ready"
  | "request_approval"
  | "awaiting_input";

export interface DiscoverySignalRequest {
  type: DiscoverySignalType;
  by?: string;
  summary?: string;
}

export type DiscoveryEventType = "note" | "milestone" | "status";

export interface DiscoveryEventEntry {
  ts: string;
  from: string;
  type: DiscoveryEventType;
  body: string;
}

export interface DiscoveryEventLogRequest {
  from: string;
  body: string;
  type: string;
}

export interface MissionDraftSummary {
  folder: string;
  title: string | null;
  preview: string;
  hasMissionMd: boolean;
}

export interface IdeaDraftsSummary {
  ideaId: string;
  drafts: MissionDraftSummary[];
  count: number;
}
