/**
 * Shared TypeScript contracts for execution pipeline (missions, board, sessions).
 *
 * checkpoint.yaml shape — orchestrator-only writer; PO uses signals API.
 * TickResult replaces deprecated BellResult. BoardStage mirrors paths.BoardStage.
 */
export type SessionStatus = "running" | "stopped" | "stopping" | "respawning";
export type JobState = "running" | "done" | "missing" | "unknown";
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

export type SignalType =
  | "round_complete"
  | "mission_complete"
  | "blocked"
  | "request_session_restart"
  | "artifacts_ready_for_review"
  | "artifact_release_complete"
  | "retrospective_complete";

export interface ClaudeSession {
  id: string;
  name: string;
  cwd: string;
  status: SessionStatus;
  session_id?: string;
  job_state?: JobState;
  synced_at?: string;
}

export interface LastSignal {
  at: string;
  by: string;
  type: SignalType;
  summary?: string;
}

export interface Checkpoint {
  mission_id: string;
  claude_session: ClaudeSession;
  phase: MissionPhase;
  round: number;
  awaiting_guild_master: boolean;
  inbox_pending: boolean;
  picked_up_at: string;
  last_signal?: LastSignal | null;
}

export interface SignalRequest {
  type: SignalType;
  summary?: string;
  by?: string;
}

export interface SessionCommands {
  id: string;
  name: string;
  cwd: string;
  attachCmd: string;
  resumeCmd: string;
  stopCmd: string;
  respawnCmd: string;
  logsCmd: string;
}

export type SessionRestoreAction = "already_running" | "respawned" | "respawned_new";

export interface MissionSessionInfo extends Omit<SessionCommands, "attachCmd"> {
  live: boolean;
  jobState: JobState;
  restoreRequired: boolean;
  restorePath: string;
  attachCmd: string | null;
}

export type BoardStage =
  | "ideas"
  | "discovering"
  | "parking"
  | "queued"
  | "working"
  | "done"
  | "aborted"
  | "archive";

export interface SlotMeter {
  used: number;
  max: number;
  available: number;
}

export interface TickResult {
  discoveriesStarted: string[];
  missionsStarted: string[];
  queuedDiscovery: string[];
  queuedExecution: string[];
  errors: Array<{ id: string; error: string; pipeline?: "discovery" | "execution" }>;
  discoverySlots: SlotMeter;
  executionSlots: SlotMeter;
}

/** @deprecated Use TickResult — kept for transitional imports */
export type BellResult = TickResult;

export interface BoardListing {
  ideas: string[];
  discovering: string[];
  parking: string[];
  queued: string[];
  working: string[];
  done: string[];
  aborted: string[];
  archive: string[];
}

export type OutboxUrgency = "low" | "normal" | "high";

export interface OutboxEntry {
  id: string;
  ts: string;
  from: string;
  question: string;
  urgency: OutboxUrgency;
  context?: string;
  read: boolean;
}

export interface OutboxItem extends OutboxEntry {
  /** Set for execution-pipeline escalations */
  missionId?: string;
  /** Set for discovery-pipeline escalations */
  ideaId?: string;
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
  type: EventType;
  body: string;
}

export interface EventLogRequest {
  from: string;
  body: string;
  type: string;
}

export interface EscalateRequest {
  question: string;
  from?: string;
  urgency?: OutboxUrgency;
  context?: string;
}
