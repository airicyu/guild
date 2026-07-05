/**
 * Discovery lead session probe, sync, and restore ladder — ensureLive for attach.
 */
import type { Config } from "../../config";
import { intakeLeadSessionName, missionRoomPath } from "../../paths";
import type { Checkpoint, JobState, MissionPhase, MissionSessionInfo, SessionRestoreAction } from "../../types/mission";
import { INTAKE_PHASES } from "../../types/mission";
import { isOnDiscoveringBoard, listBoard } from "../core/board";
import { probeSession, type SessionProbe } from "../mission/session-lifecycle";
import { spawnDiscoveryLead, sessionCommands } from "../core/spawn";
import { tryRespawnSession } from "../core/session";
import { readJobState } from "../core/job-state";
import { readCheckpoint, writeCheckpoint } from "../mission/checkpoint";
import { resumeIntakeSpawnPrompt } from "../mission/intake-scaffold";

const ACTIVE_INTAKE_PHASES = new Set<MissionPhase>(
  INTAKE_PHASES.filter((phase) => phase !== "mission_plan_complete"),
);

export interface SyncedDiscovery {
  checkpoint: Checkpoint;
  live: boolean;
  jobState: JobState;
  restoreRequired: boolean;
}

/** True when intake phase requires a live lead session. */
export function discoveryNeedsLead(phase: MissionPhase): boolean {
  return ACTIVE_INTAKE_PHASES.has(phase);
}

/** True when checkpoint expects lead but agents list shows session dead. */
export function computeDiscoveryRestoreRequired(checkpoint: Checkpoint, live: boolean): boolean {
  return discoveryNeedsLead(checkpoint.phase) && !live;
}

/** Load checkpoint; throw if idea not on discovering board. */
export async function requireDiscoveringCheckpoint(
  config: Config,
  ideaId: string,
): Promise<Checkpoint> {
  const board = await listBoard(config);
  if (!isOnDiscoveringBoard(board, ideaId)) {
    throw new Error(`Idea ${ideaId} is not on the discovering board`);
  }
  const checkpoint = await readCheckpoint(config, ideaId);
  if (!checkpoint) {
    throw new Error(`Missing discovery checkpoint for ${ideaId}`);
  }
  return checkpoint;
}

function applyDiscoverySessionProbe(checkpoint: Checkpoint, probe: SessionProbe): Checkpoint {
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

function discoverySessionFieldsChanged(before: Checkpoint, after: Checkpoint): boolean {
  const a = before.claude_session;
  const b = after.claude_session;
  return (
    a.status !== b.status ||
    a.job_state !== b.job_state ||
    a.session_id !== b.session_id ||
    a.synced_at !== b.synced_at
  );
}

/** Build session info for discovery attach API responses. */
export function buildDiscoverySessionInfo(
  config: Config,
  ideaId: string,
  checkpoint: Checkpoint,
  probe: SessionProbe,
): MissionSessionInfo {
  const commands = sessionCommands(checkpoint.claude_session, config.claudeCommand);
  const live = probe.processLive;
  const restoreRequired = computeDiscoveryRestoreRequired(checkpoint, live);

  return {
    ...commands,
    live,
    jobState: probe.jobState,
    restoreRequired,
    restorePath: `/missions/${ideaId}/restore`,
    attachCmd: live ? commands.attachCmd : null,
  };
}

/** Sync discovery checkpoint session fields from agents probe. */
export async function syncActiveDiscovery(
  config: Config,
  ideaId: string,
): Promise<SyncedDiscovery | null> {
  const board = await listBoard(config);
  if (!isOnDiscoveringBoard(board, ideaId)) return null;

  const checkpoint = await readCheckpoint(config, ideaId);
  if (!checkpoint) return null;

  const probe = await probeSession(config, checkpoint.claude_session.id);
  const synced = applyDiscoverySessionProbe(checkpoint, probe);

  if (discoverySessionFieldsChanged(checkpoint, synced)) {
    await writeCheckpoint(config, ideaId, synced);
  }

  return {
    checkpoint: synced,
    live: probe.processLive,
    jobState: probe.jobState,
    restoreRequired: computeDiscoveryRestoreRequired(synced, probe.processLive),
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

/** Restore ladder for discovery lead: probe → respawn → spawn fresh lead. */
export async function restoreDiscoverySession(
  config: Config,
  ideaId: string,
): Promise<{ checkpoint: Checkpoint; action: SessionRestoreAction; previousSessionId?: string }> {
  let checkpoint = await requireDiscoveringCheckpoint(config, ideaId);

  if (checkpoint.phase === "mission_plan_complete") {
    throw new Error(`Discovery for ${ideaId} is already closed`);
  }

  let probe = await probeSession(config, checkpoint.claude_session.id);
  if (probe.processLive) {
    checkpoint = applyDiscoverySessionProbe(checkpoint, probe);
    await writeCheckpoint(config, ideaId, checkpoint);
    return { checkpoint, action: "already_running" };
  }

  const previousSessionId = checkpoint.claude_session.id;
  let respawnAttempted = false;
  let respawnOk = false;

  if (shouldTryRespawn(probe)) {
    respawnAttempted = true;
    respawnOk = await tryRespawnSession(config, previousSessionId);
    if (respawnOk) {
      probe = await probeSession(config, previousSessionId);
      checkpoint = applyDiscoverySessionProbe(checkpoint, probe);
      await writeCheckpoint(config, ideaId, checkpoint);
      return { checkpoint, action: "respawned", previousSessionId };
    }
  }

  if (!shouldSpawnNew(probe, respawnAttempted, respawnOk)) {
    throw new Error(`Discovery session for ${ideaId} is not live and could not be restored`);
  }

  const roomPath = missionRoomPath(config, ideaId);
  const session = await spawnDiscoveryLead(
    config,
    ideaId,
    resumeIntakeSpawnPrompt(ideaId, checkpoint),
  );
  probe = {
    processLive: true,
    jobState: "running",
    sessionUuid: (await readJobState(session.id)).sessionId,
  };

  checkpoint = {
    ...checkpoint,
    claude_session: {
      ...session,
      name: intakeLeadSessionName(ideaId),
      cwd: roomPath,
      status: "running",
      job_state: "running",
      session_id: probe.sessionUuid,
      synced_at: new Date().toISOString(),
    },
  };

  await writeCheckpoint(config, ideaId, checkpoint);
  return { checkpoint, action: "respawned_new", previousSessionId };
}

/** Ensure intake lead is live before WS attach. */
export async function ensureDiscoverySessionLive(
  config: Config,
  ideaId: string,
): Promise<{ checkpoint: Checkpoint; action?: SessionRestoreAction; session: MissionSessionInfo }> {
  const synced = await syncActiveDiscovery(config, ideaId);
  if (!synced) {
    throw new Error(`Idea ${ideaId} is not on the discovering board`);
  }

  if (!synced.restoreRequired) {
    const probe = await probeSession(config, synced.checkpoint.claude_session.id);
    return {
      checkpoint: synced.checkpoint,
      session: buildDiscoverySessionInfo(config, ideaId, synced.checkpoint, probe),
    };
  }

  const restored = await restoreDiscoverySession(config, ideaId);
  const probe = await probeSession(config, restored.checkpoint.claude_session.id);
  return {
    checkpoint: restored.checkpoint,
    action: restored.action,
    session: buildDiscoverySessionInfo(config, ideaId, restored.checkpoint, probe),
  };
}

/** GET /discoveries/:id/session — optional ensureLive restore. */
export async function getDiscoverySession(
  config: Config,
  ideaId: string,
  options?: { ensureLive?: boolean },
): Promise<MissionSessionInfo | null> {
  if (options?.ensureLive) {
    try {
      const ensured = await ensureDiscoverySessionLive(config, ideaId);
      return ensured.session;
    } catch {
      return null;
    }
  }

  const synced = await syncActiveDiscovery(config, ideaId);
  if (!synced) return null;

  return buildDiscoverySessionInfo(config, ideaId, synced.checkpoint, {
    processLive: synced.live,
    jobState: synced.jobState,
  });
}
