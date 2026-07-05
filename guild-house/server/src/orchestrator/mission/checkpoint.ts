/**
 * Mission checkpoint.yaml — orchestrator-only read/write.
 *
 * PO must use POST /missions/:id/signals; never edit checkpoint directly.
 * Read via Bun.YAML.parse; write keeps stable block layout for diffs.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { YAML } from "bun";
import type { Config } from "../../config";
import { resolveMissionRoomPath } from "../core/room-achive";
import type { BoardStage } from "../../paths";
import type { Checkpoint, ClaudeSession, LastSignal, MissionMode, MissionPhase } from "../../types/mission";
import { normalizePhase } from "../../types/mission";

type CheckpointDoc = {
  claude_session?: Partial<ClaudeSession>;
  mission_id?: string;
  idea_id?: string;
  note_stage?: BoardStage;
  parent_id?: string | null;
  mode?: MissionMode;
  phase?: string;
  round?: number;
  awaiting_guild_master?: boolean;
  awaiting_eric?: boolean;
  inbox_pending?: boolean;
  picked_up_at?: string;
  last_signal?: LastSignal | null;
};

function serializeSession(session: ClaudeSession): string {
  const lines = [
    "claude_session:",
    `  id: "${session.id}"`,
    `  name: "${session.name}"`,
    `  cwd: "${session.cwd.replace(/\\/g, "\\\\")}"`,
    `  status: ${session.status}`,
  ];
  if (session.session_id) lines.push(`  session_id: "${session.session_id}"`);
  if (session.job_state) lines.push(`  job_state: ${session.job_state}`);
  if (session.synced_at) lines.push(`  synced_at: "${session.synced_at}"`);
  return lines.join("\n");
}

function serializeLastSignal(signal: LastSignal): string {
  const lines = [
    "last_signal:",
    `  at: "${signal.at}"`,
    `  by: "${signal.by}"`,
    `  type: ${signal.type}`,
  ];
  if (signal.summary) {
    lines.push(`  summary: "${signal.summary.replace(/"/g, '\\"')}"`);
  }
  return lines.join("\n");
}

/** Build initial checkpoint object for a newly picked-up mission. */
export function buildCheckpoint(input: {
  missionId: string;
  session: ClaudeSession;
  phase?: MissionPhase;
  mode?: MissionMode;
  noteStage?: BoardStage;
  parentId?: string | null;
  pickedUpAt?: string;
}): Checkpoint {
  const phase = input.phase ?? (input.mode === "intake" ? "idea_exploring" : "evaluating");
  return {
    mission_id: input.missionId,
    note_stage: input.noteStage,
    parent_id: input.parentId ?? null,
    mode: input.mode ?? (phase.startsWith("mission_plan") || phase === "idea_exploring" ? "intake" : "execution"),
    claude_session: input.session,
    phase,
    round: 0,
    awaiting_guild_master: false,
    inbox_pending: false,
    picked_up_at: input.pickedUpAt ?? new Date().toISOString(),
    last_signal: null,
  };
}

/** Serialize checkpoint to YAML string for disk write. */
export function serializeCheckpoint(checkpoint: Checkpoint): string {
  const lines = [
    serializeSession(checkpoint.claude_session),
    "",
    `mission_id: "${checkpoint.mission_id}"`,
  ];
  if (checkpoint.note_stage) lines.push(`note_stage: ${checkpoint.note_stage}`);
  if (checkpoint.mode) lines.push(`mode: ${checkpoint.mode}`);
  if (checkpoint.parent_id) lines.push(`parent_id: "${checkpoint.parent_id}"`);
  lines.push(
    `phase: ${checkpoint.phase}`,
    `round: ${checkpoint.round}`,
    `awaiting_guild_master: ${checkpoint.awaiting_guild_master}`,
    `inbox_pending: ${checkpoint.inbox_pending}`,
    `picked_up_at: "${checkpoint.picked_up_at}"`,
  );

  if (checkpoint.last_signal) {
    lines.push("", serializeLastSignal(checkpoint.last_signal));
  }

  return `${lines.join("\n")}\n`;
}

/** Write checkpoint.yaml — orchestrator-only; PO must use signals API. */
export async function writeCheckpoint(config: Config, missionId: string, checkpoint: Checkpoint): Promise<void> {
  const roomPath = await resolveMissionRoomPath(config, missionId);
  if (!roomPath) {
    throw new Error(`Missing mission room for ${missionId}`);
  }
  await writeFile(join(roomPath, "checkpoint.yaml"), serializeCheckpoint(checkpoint), "utf8");
}

/** Read checkpoint.yaml; null when file missing or unreadable. */
export async function readCheckpoint(config: Config, missionId: string): Promise<Checkpoint | null> {
  const roomPath = await resolveMissionRoomPath(config, missionId);
  if (!roomPath) return null;
  try {
    return parseCheckpoint(await readFile(join(roomPath, "checkpoint.yaml"), "utf8"), missionId);
  } catch {
    return null;
  }
}

/** Read checkpoint or throw if missing. */
export async function requireCheckpoint(config: Config, missionId: string): Promise<Checkpoint> {
  const checkpoint = await readCheckpoint(config, missionId);
  if (!checkpoint) throw new Error(`Missing checkpoint for ${missionId}`);
  return checkpoint;
}

/** Parse checkpoint YAML; accepts legacy awaiting_eric / idea_id. */
export function parseCheckpoint(raw: string, fallbackMissionId: string): Checkpoint {
  const doc = YAML.parse(raw) as CheckpointDoc;
  const session = doc.claude_session ?? {};

  if (!session.id || !session.name || !session.cwd) {
    throw new Error(`Invalid checkpoint for ${fallbackMissionId}`);
  }

  return {
    mission_id: doc.mission_id ?? doc.idea_id ?? fallbackMissionId,
    note_stage: doc.note_stage,
    parent_id: doc.parent_id ?? undefined,
    mode: doc.mode,
    claude_session: {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      status: session.status ?? "running",
      session_id: session.session_id,
      job_state: session.job_state,
      synced_at: session.synced_at,
    },
    phase: normalizePhase(String(doc.phase ?? "evaluating")),
    round: typeof doc.round === "number" ? doc.round : 0,
    awaiting_guild_master: doc.awaiting_guild_master ?? doc.awaiting_eric ?? false,
    inbox_pending: doc.inbox_pending ?? false,
    picked_up_at: doc.picked_up_at ?? "",
    last_signal: doc.last_signal ?? null,
  };
}
