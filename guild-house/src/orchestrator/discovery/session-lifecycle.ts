/**
 * Discovery lead session probe, sync, and restore ladder — ensureLive for attach.
 *
 * Mirrors mission session-lifecycle for discovering-board ideas (phase !== closed).
 */
import type { Config } from "../../config";
import { discoveryRoomPath, discoverySessionName } from "../../paths";
import type { DiscoveryCheckpoint, DiscoveryPhase } from "../../types/discovery";
import type { JobState, MissionSessionInfo, SessionRestoreAction } from "../../types/mission";
import { isOnDiscoveringBoard, listBoard } from "../core/board";
import {
  probeSession,
  type SessionProbe,
} from "../mission/session-lifecycle";
import { spawnDiscoveryLead, sessionCommands } from "../core/spawn";
import { tryRespawnSession } from "../core/session";
import { readJobState } from "../core/job-state";
import { readDiscoveryCheckpoint, writeDiscoveryCheckpoint } from "./checkpoint";
import { resumeDiscoverySpawnPrompt } from "./scaffold";

const ACTIVE_DISCOVERY_PHASES = new Set<DiscoveryPhase>([
  "exploring",
  "drafting",
  "presenting",
  "awaiting_approval",
]);

export interface SyncedDiscovery {
  checkpoint: DiscoveryCheckpoint;
  live: boolean;
  jobState: JobState;
  restoreRequired: boolean;
}

/** True when discovery phase requires a live intake lead session. */
export function discoveryNeedsLead(phase: DiscoveryPhase): boolean {
  return ACTIVE_DISCOVERY_PHASES.has(phase);
}

/** True when checkpoint expects lead but agents list shows session dead. */
export function computeDiscoveryRestoreRequired(checkpoint: DiscoveryCheckpoint, live: boolean): boolean {
  return discoveryNeedsLead(checkpoint.phase) && !live;
}

/** Load checkpoint; throw if idea not on discovering board. */
export async function requireDiscoveringCheckpoint(
  config: Config,
  ideaId: string,
): Promise<DiscoveryCheckpoint> {
  const board = await listBoard(config);
  if (!isOnDiscoveringBoard(board, ideaId)) {
    throw new Error(`Idea ${ideaId} is not on the discovering board`);
  }
  const checkpoint = await readDiscoveryCheckpoint(config, ideaId);
  if (!checkpoint) {
    throw new Error(`Missing discovery checkpoint for ${ideaId}`);
  }
  return checkpoint;
}

function applyDiscoverySessionProbe(
  checkpoint: DiscoveryCheckpoint,
  probe: SessionProbe,
): DiscoveryCheckpoint {
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

function discoverySessionFieldsChanged(
  before: DiscoveryCheckpoint,
  after: DiscoveryCheckpoint,
): boolean {
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
  checkpoint: DiscoveryCheckpoint,
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
    restorePath: `/discoveries/${ideaId}/restore`,
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

  const checkpoint = await readDiscoveryCheckpoint(config, ideaId);
  if (!checkpoint) return null;

  const probe = await probeSession(config, checkpoint.claude_session.id);
  const synced = applyDiscoverySessionProbe(checkpoint, probe);

  if (discoverySessionFieldsChanged(checkpoint, synced)) {
    await writeDiscoveryCheckpoint(config, ideaId, synced);
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
): Promise<{ checkpoint: DiscoveryCheckpoint; action: SessionRestoreAction; previousSessionId?: string }> {
  let checkpoint = await requireDiscoveringCheckpoint(config, ideaId);

  if (checkpoint.phase === "closed") {
    throw new Error(`Discovery for ${ideaId} is already closed`);
  }

  let probe = await probeSession(config, checkpoint.claude_session.id);
  if (probe.processLive) {
    checkpoint = applyDiscoverySessionProbe(checkpoint, probe);
    await writeDiscoveryCheckpoint(config, ideaId, checkpoint);
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
      await writeDiscoveryCheckpoint(config, ideaId, checkpoint);
      return { checkpoint, action: "respawned", previousSessionId };
    }
  }

  if (!shouldSpawnNew(probe, respawnAttempted, respawnOk)) {
    throw new Error(`Discovery session for ${ideaId} is not live and could not be restored`);
  }

  const roomPath = discoveryRoomPath(config, ideaId);
  const session = await spawnDiscoveryLead(
    config,
    ideaId,
    resumeDiscoverySpawnPrompt(ideaId, checkpoint),
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
      name: discoverySessionName(ideaId),
      cwd: roomPath,
      status: "running",
      job_state: "running",
      session_id: probe.sessionUuid,
      synced_at: new Date().toISOString(),
    },
  };

  await writeDiscoveryCheckpoint(config, ideaId, checkpoint);
  return { checkpoint, action: "respawned_new", previousSessionId };
}

/** Ensure intake lead is live before WS attach. */
export async function ensureDiscoverySessionLive(
  config: Config,
  ideaId: string,
): Promise<{ checkpoint: DiscoveryCheckpoint; action?: SessionRestoreAction; session: MissionSessionInfo }> {
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
