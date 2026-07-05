export type MissionPhase =
  | "evaluating"
  | "running"
  | "blocked"
  | "paused"
  | "awaiting_artifact_review"
  | "artifacts_approved"
  | "releasing"
  | "retrospective"
  | "done"
  | "aborted";

export type BoardStage =
  | "ideas-backlog"
  | "ideas"
  | "discovering"
  | "parking"
  | "queued"
  | "working"
  | "done"
  | "aborted"
  | "archive";

export interface SlotMeterData {
  used: number;
  max: number;
  available: number;
}

export interface MissionCardData {
  id: string;
  stage: BoardStage;
  phase?: MissionPhase;
  sessionLive?: boolean;
  restoreRequired?: boolean;
  awaitingGuildMaster?: boolean;
  archiveReady?: boolean;
}

export interface MissionListItem {
  id: string;
  board: "working" | "done" | "aborted";
  phase: MissionPhase | "unknown";
  sessionId: string | null;
  sessionLive: boolean;
  jobState: string;
  restoreRequired: boolean;
  awaitingGuildMaster: boolean;
  archiveReady: boolean;
}

export interface MissionsResponse {
  missions: MissionListItem[];
  count: number;
}

export interface QueueDiscoveryPreview {
  slots: SlotMeterData;
  ideas: string[];
  discovering: string[];
  wouldStartOnTick: string[];
  wouldQueueOnTick: string[];
}

export interface QueueExecutionPreview {
  slots: SlotMeterData;
  queued: string[];
  wouldPickupOnTick: string[];
  wouldQueueOnTick: string[];
}

export interface QueueResponse {
  discovery: QueueDiscoveryPreview;
  execution: QueueExecutionPreview;
}

export interface TickResult {
  intakeStarted: string[];
  missionsStarted: string[];
  queuedIntake: string[];
  queuedExecution: string[];
  errors: Array<{ id: string; error: string; pipeline?: "intake" | "execution" }>;
  intakeSlots: SlotMeterData;
  executionSlots: SlotMeterData;
}

export interface BoardResponse {
  "ideas-backlog": string[];
  ideas: string[];
  discovering: string[];
  parking: string[];
  queued: string[];
  working: string[];
  done: string[];
  aborted: string[];
  archive: string[];
}

export interface OutboxItem {
  missionId?: string;
  ideaId?: string;
  id: string;
  ts: string;
  from: string;
  question: string;
  urgency: "low" | "normal" | "high";
  context?: string;
  read: boolean;
}

export interface OutboxResponse {
  items: OutboxItem[];
  count: number;
}

export interface Checkpoint {
  mission_id: string;
  phase: MissionPhase;
  round: number;
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
  last_signal?: {
    at: string;
    by: string;
    type: string;
    summary?: string;
  } | null;
}

export interface MissionSummaryResponse {
  id: string;
  board: BoardStage;
  roomPath: string | null;
  checkpoint: Checkpoint | null;
  briefTitle: string | null;
  squadMembers: string[];
  outboxUnreadCount: number;
  sessionLive?: boolean;
  jobState?: string;
  restoreRequired?: boolean;
  archiveReady: boolean;
  awaitingGuildMaster: boolean;
}

export interface MissionBriefResponse {
  missionId: string;
  board: BoardStage;
  content: string;
}

export interface MissionSessionResponse {
  id: string;
  name: string;
  cwd: string;
  attachCmd: string | null;
  resumeCmd: string;
  stopCmd: string;
  respawnCmd: string;
  logsCmd: string;
  live: boolean;
  jobState: string;
  restoreRequired: boolean;
  restorePath: string;
}

export type EventType =
  | "milestone"
  | "directive"
  | "evaluator_done"
  | "round_note"
  | "status"
  | "evidence"
  | "qa_pass"
  | "qa_fail";

export interface EventEntry {
  ts: string;
  from: string;
  type: EventType | string;
  body: string;
}

export interface EventsResponse {
  missionId: string;
  board: BoardStage;
  entries: EventEntry[];
  count: number;
}

export interface MissionOutboxEntry {
  id: string;
  ts: string;
  from: string;
  question: string;
  urgency: "low" | "normal" | "high";
  context?: string;
  read: boolean;
}

export interface MissionOutboxResponse {
  missionId: string;
  board: BoardStage;
  entries: MissionOutboxEntry[];
  unreadCount: number;
}

export interface MissionRoomFileResponse {
  path: string;
  content: string;
}

export type GuildMasterNotify = {
  channel?: { delivered: boolean; reason?: string };
  poke?: { delivered: boolean; reason?: string; durationMs?: number };
};

export interface MissionArtifactActionResponse {
  ok: true;
  missionId: string;
  checkpoint: Checkpoint;
  notify?: GuildMasterNotify;
}
