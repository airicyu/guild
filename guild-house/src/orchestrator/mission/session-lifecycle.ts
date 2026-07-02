/**
 * PO session probe, sync, and restore ladder — ensureLive entry point for attach.
 *
 * Restore order: probe → respawn same short id → else spawn new PO with resumeSpawnPrompt.
 * attachCmd exposed only when process is live. syncActiveMission writes checkpoint on change.
 */
import type { Config } from "../../config";
import { missionRoomPath, poSessionName } from "../../paths";
import type {
  Checkpoint,
  JobState,
  MissionPhase,
  MissionSessionInfo,
  SessionRestoreAction,
} from "../../types/mission";
import { isOnWorkingBoard, listBoard } from "../core/board";
import { readCheckpoint, requireCheckpoint, writeCheckpoint } from "./checkpoint";
import { ensureRoomArtifacts, resumeSpawnPrompt } from "./scaffold";
import { readJobState } from "../core/job-state";
import { spawnPoSession, sessionCommands } from "../core/spawn";
import { findBackgroundAgent, isSessionRunning, tryRespawnSession } from "../core/session";

const PO_PHASES = new Set<MissionPhase>([
  "evaluating",
  "running",
  "blocked",
  "awaiting_artifact_review",
  "artifacts_approved",
  "releasing",
  "retrospective",
]);

export interface SessionProbe {
  processLive: boolean;
  jobState: JobState;
  sessionUuid?: string;
}

export interface SyncedMission {
  checkpoint: Checkpoint;
  live: boolean;
  jobState: JobState;
  restoreRequired: boolean;
}

/** True when mission phase requires a live PO session. */
export function missionNeedsPo(phase: MissionPhase): boolean {
  return PO_PHASES.has(phase);
}

/** True when checkpoint expects PO but agents list shows session dead. */
export function computeRestoreRequired(checkpoint: Checkpoint, live: boolean): boolean {
  return missionNeedsPo(checkpoint.phase) && !live;
}

/** Load checkpoint; throw if missing or mission not on working board. */
export async function requireActiveCheckpoint(config: Config, missionId: string): Promise<Checkpoint> {
  const board = await listBoard(config);
  if (!isOnWorkingBoard(board, missionId)) {
    throw new Error(`Mission ${missionId} is not on the working board`);
  }
  return requireCheckpoint(config, missionId);
}

/** Probe agents list + job state for a short session id. */
export async function probeSession(config: Config, shortId: string): Promise<SessionProbe> {
  const [processLive, job] = await Promise.all([
    isSessionRunning(config, shortId),
    readJobState(shortId),
  ]);

  let sessionUuid = job.sessionId;
  if (processLive) {
    const agent = await findBackgroundAgent(config, shortId);
    sessionUuid = agent?.sessionId ?? sessionUuid;
  }

  return {
    processLive,
    jobState: job.jobState,
    sessionUuid,
  };
}

function applySessionProbe(checkpoint: Checkpoint, probe: SessionProbe): Checkpoint {
  return {
    ...checkpoint,
    claude_session: {
      ...checkpoint.claude_session,
      status: probe.processLive ? "running" : "stopped",
      job_state: probe.jobState,
      session_id: probe.sessionUuid ?? checkpoint.claude_session.session_id,
      synced_at: new Date().toISOString(),
    },
  };
}

function sessionFieldsChanged(before: Checkpoint, after: Checkpoint): boolean {
  const a = before.claude_session;
  const b = after.claude_session;
  return (
    a.status !== b.status ||
    a.job_state !== b.job_state ||
    a.session_id !== b.session_id ||
    a.synced_at !== b.synced_at
  );
}

/** Build MissionSessionInfo for API; attachCmd only when process is live. */
export function buildMissionSessionInfo(
  config: Config,
  missionId: string,
  checkpoint: Checkpoint,
  probe: SessionProbe,
): MissionSessionInfo {
  const commands = sessionCommands(checkpoint.claude_session, config.claudeCommand);
  const live = probe.processLive;
  const restoreRequired = computeRestoreRequired(checkpoint, live);

  return {
    ...commands,
    live,
    jobState: probe.jobState,
    restoreRequired,
    restorePath: `/missions/${missionId}/restore`,
    attachCmd: live ? commands.attachCmd : null,
  };
}

/** Sync checkpoint session fields from agents probe; writes on change. */
export async function syncActiveMission(config: Config, missionId: string): Promise<SyncedMission | null> {
  const board = await listBoard(config);
  if (!isOnWorkingBoard(board, missionId)) return null;

  await ensureRoomArtifacts(config, missionId);

  const checkpoint = await requireCheckpoint(config, missionId);
  const probe = await probeSession(config, checkpoint.claude_session.id);
  const synced = applySessionProbe(checkpoint, probe);

  if (sessionFieldsChanged(checkpoint, synced)) {
    await writeCheckpoint(config, missionId, synced);
  }

  return {
    checkpoint: synced,
    live: probe.processLive,
    jobState: probe.jobState,
    restoreRequired: computeRestoreRequired(synced, probe.processLive),
  };
}

function shouldTryRespawn(probe: SessionProbe): boolean {
  return probe.jobState === "running" || probe.jobState === "unknown";
}

function shouldSpawnNew(probe: SessionProbe, respawnAttempted: boolean, respawnOk: boolean): boolean {
  if (probe.processLive) return false;
  if (probe.jobState === "done" || probe.jobState === "missing") return true;
  if (respawnAttempted && !respawnOk) return true;
  return !shouldTryRespawn(probe);
}

/** Restore ladder: probe → respawn → spawn new PO with resume prompt. */
export async function restoreMissionSession(
  config: Config,
  missionId: string,
): Promise<{ checkpoint: Checkpoint; action: SessionRestoreAction; previousSessionId?: string }> {
  let checkpoint = await requireActiveCheckpoint(config, missionId);

  if (checkpoint.phase === "done") {
    throw new Error(`Mission ${missionId} is already done`);
  }

  let probe = await probeSession(config, checkpoint.claude_session.id);
  if (probe.processLive) {
    checkpoint = applySessionProbe(checkpoint, probe);
    await writeCheckpoint(config, missionId, checkpoint);
    return { checkpoint, action: "already_running" };
  }

  const previousSessionId = checkpoint.claude_session.id;
  let respawnAttempted = false;
  let respawnOk = false;

  // Restore ladder: respawn same short id → else spawn new PO with resumeSpawnPrompt.
  if (shouldTryRespawn(probe)) {
    respawnAttempted = true;
    respawnOk = await tryRespawnSession(config, previousSessionId);
    if (respawnOk) {
      probe = await probeSession(config, previousSessionId);
      checkpoint = applySessionProbe(checkpoint, probe);
      if (checkpoint.phase === "paused") {
        checkpoint = { ...checkpoint, phase: "running", awaiting_guild_master: false };
      }
      await writeCheckpoint(config, missionId, checkpoint);
      return { checkpoint, action: "respawned", previousSessionId };
    }
  }

  if (!shouldSpawnNew(probe, respawnAttempted, respawnOk)) {
    throw new Error(`Mission ${missionId} session is not live and could not be restored`);
  }

  const roomPath = missionRoomPath(config, missionId);
  const session = await spawnPoSession(config, missionId, resumeSpawnPrompt(missionId, checkpoint));
  probe = {
    processLive: true,
    jobState: "running",
    sessionUuid: (await readJobState(session.id)).sessionId,
  };

  checkpoint = {
    ...checkpoint,
    claude_session: {
      ...session,
      name: poSessionName(missionId),
      cwd: roomPath,
      status: "running",
      job_state: "running",
      session_id: probe.sessionUuid,
      synced_at: new Date().toISOString(),
    },
  };

  if (checkpoint.phase === "paused") {
    checkpoint = { ...checkpoint, phase: "running", awaiting_guild_master: false };
  }

  await writeCheckpoint(config, missionId, checkpoint);
  return { checkpoint, action: "respawned_new", previousSessionId };
}

/** Ensure PO is live before attach; runs restore when needed. */
export async function ensureMissionSessionLive(
  config: Config,
  missionId: string,
): Promise<{ checkpoint: Checkpoint; action?: SessionRestoreAction; session: MissionSessionInfo }> {
  const synced = await syncActiveMission(config, missionId);
  if (!synced) {
    throw new Error(`Mission ${missionId} is not on the working board`);
  }

  if (!synced.restoreRequired) {
    const probe = await probeSession(config, synced.checkpoint.claude_session.id);
    return {
      checkpoint: synced.checkpoint,
      session: buildMissionSessionInfo(config, missionId, synced.checkpoint, probe),
    };
  }

  const restored = await restoreMissionSession(config, missionId);
  const probe = await probeSession(config, restored.checkpoint.claude_session.id);
  return {
    checkpoint: restored.checkpoint,
    action: restored.action,
    session: buildMissionSessionInfo(config, missionId, restored.checkpoint, probe),
  };
}

/** Batch sync for all working-board mission ids. */
export async function syncActiveMissionsList(config: Config, missionIds: string[]) {
  return Promise.all(
    missionIds.map(async (id) => {
      const synced = await syncActiveMission(config, id);
      if (!synced) {
        return {
          id,
          live: false,
          jobState: "missing" as JobState,
          restoreRequired: false,
        };
      }
      return {
        id,
        live: synced.live,
        jobState: synced.jobState,
        restoreRequired: synced.restoreRequired,
      };
    }),
  );
}
