/**
 * Shared TypeScript contracts for unified mission runtime (intake + execution).
 *
 * checkpoint.yaml — orchestrator-only writer; agents use signals API.
 */
import type { BoardNoteType } from "./board-note";

export type SessionStatus = "running" | "stopped" | "stopping" | "respawning";
export type JobState = "running" | "done" | "missing" | "unknown";
export type MissionMode = "intake" | "execution";

/** Unified phase enum — intake segment + execution segment (0.4.0). */
export type MissionPhase =
  | "idea_exploring"
  | "mission_planning"
  | "mission_plan_presenting"
  | "mission_plan_awaiting_approval"
  | "mission_plan_complete"
  | "evaluating"
  | "working"
  | "blocked"
  | "paused"
  | "awaiting_artifact_review"
  | "releasing"
  | "retrospective"
  | "done"
  | "aborted";

export const INTAKE_PHASES: MissionPhase[] = [
  "idea_exploring",
  "mission_planning",
  "mission_plan_presenting",
  "mission_plan_awaiting_approval",
  "mission_plan_complete",
];

export const EXECUTION_PHASES: MissionPhase[] = [
  "evaluating",
  "working",
  "blocked",
  "paused",
  "awaiting_artifact_review",
  "releasing",
  "retrospective",
  "done",
  "aborted",
];

export type IntakeSignalType =
  | "start_drafting"
  | "packages_ready"
  | "request_approval"
  | "awaiting_input";

export type ExecutionSignalType =
  | "round_complete"
  | "mission_complete"
  | "blocked"
  | "request_session_restart"
  | "artifacts_ready_for_review"
  | "artifact_release_complete"
  | "retrospective_complete";

export type SignalType = IntakeSignalType | ExecutionSignalType;

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
  type: string;
  summary?: string;
}

export interface Checkpoint {
  mission_id: string;
  note_stage?: BoardStage;
  parent_id?: string | null;
  mode?: MissionMode;
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
  mode?: MissionMode;
}

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

export interface SlotMeter {
  used: number;
  max: number;
  available: number;
}

export interface TickResult {
  intakeStarted: string[];
  missionsStarted: string[];
  queuedIntake: string[];
  queuedExecution: string[];
  errors: Array<{ id: string; error: string; pipeline?: "intake" | "execution" }>;
  intakeSlots: SlotMeter;
  executionSlots: SlotMeter;
}

export interface BoardListing {
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
  missionId?: string;
  /** @deprecated Use missionId */
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
  | "qa_fail"
  | "note";

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

/** Map legacy phase names on read. */
export function normalizePhase(raw: string): MissionPhase {
  const map: Record<string, MissionPhase> = {
    exploring: "idea_exploring",
    drafting: "mission_planning",
    presenting: "mission_plan_presenting",
    awaiting_approval: "mission_plan_awaiting_approval",
    discovery_complete: "mission_plan_complete",
    closed: "mission_plan_complete",
    running: "working",
    artifacts_approved: "releasing",
  };
  return (map[raw] ?? raw) as MissionPhase;
}

export function isIntakePhase(phase: MissionPhase): boolean {
  return INTAKE_PHASES.includes(phase);
}

export function isTerminalPhase(phase: MissionPhase): boolean {
  return phase === "done" || phase === "aborted" || phase === "mission_plan_complete";
}

/** Done-board notes ready for POST /missions/:id/archive. */
export function canArchiveFromDoneBoard(phase: MissionPhase): boolean {
  return phase === "done" || phase === "mission_plan_complete";
}

export function inferModeFromPhase(phase: MissionPhase): MissionMode {
  return isIntakePhase(phase) ? "intake" : "execution";
}
