export type DiscoveryPhase =
  | "idea_exploring"
  | "idea_drafting"
  | "mission_plan_presenting"
  | "mission_plan_awaiting_approval"
  | "mission_plan_complete"
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
  phase: DiscoveryPhase;
  awaiting_guild_master: boolean;
  inbox_pending: boolean;
  picked_up_at: string;
  claude_session?: {
    id: string;
    name: string;
    cwd: string;
    status: string;
    job_state?: string;
    synced_at?: string;
  };
  last_signal?: DiscoveryLastSignal | null;
}

export type IdeaBoard = "backlog" | "ideas" | "discovering";

export interface IdeaListItem {
  id: string;
  board: IdeaBoard;
  scratchPreview: string;
  phase?: DiscoveryPhase;
  sessionLive?: boolean;
}

export interface IdeaDetail extends IdeaListItem {
  scratch: string;
  checkpoint?: DiscoveryCheckpoint | null;
  roomPath?: string | null;
  jobState?: string;
  restoreRequired?: boolean;
}

export interface IdeasResponse {
  ideas: IdeaListItem[];
  count: number;
}

export interface CreateIdeaResponse {
  ok: true;
  ideaId: string;
  board: "backlog" | "ideas";
  scratchPreview: string;
}

export interface MissionDraftSummary {
  folder: string;
  title: string | null;
  preview: string;
  hasMissionMd: boolean;
}

export interface IdeaDraftsResponse {
  ideaId: string;
  drafts: MissionDraftSummary[];
  count: number;
}

export interface DiscoveryOutboxEntry {
  id: string;
  ts: string;
  from: string;
  question: string;
  urgency: "low" | "normal" | "high";
  context?: string;
  read: boolean;
}

export interface DiscoveryOutboxResponse {
  ideaId: string;
  board: IdeaBoard;
  entries: DiscoveryOutboxEntry[];
  unreadCount: number;
}

export interface ApproveDiscoveryResponse {
  ok: true;
  ideaId: string;
  parkingFolders: string[];
  checkpoint: DiscoveryCheckpoint;
}
