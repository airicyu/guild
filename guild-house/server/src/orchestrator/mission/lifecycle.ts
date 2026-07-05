/**
 * Mission lifecycle — signals, pause/resume, archive, boot recovery.
 *
 * 0.3.0 close-out: mission_complete only from retrospective → done board.
 * Guild-master approve/reject/abort are separate API paths (no auto-stop on approve).
 */
import { rename } from "node:fs/promises";
import type { Config } from "../../config";
import { missionBoardEntryPath } from "../../paths";
import type { Checkpoint, MissionPhase, SignalRequest, SignalType } from "../../types/mission";
import { canArchiveFromDoneBoard, isIntakePhase } from "../../types/mission";
import {
  assertMissionId,
  isOnAbortedBoard,
  isOnDoneBoard,
  listBoard,
  resolveAbortedEntryPath,
  resolveDoneEntryPath,
  resolveWorkingEntryPath,
} from "../core/board";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import { requireArtifactReleaseReleased } from "./artifact-release";
import { appendEventEntry } from "./events";
import { requireWorkflowReport, requireRetrospectiveCompleteSignal } from "./retrospective";
import {
  requireActiveCheckpoint,
  restoreMissionSession,
} from "./session-lifecycle";
import { stopSession } from "../core/session";
import {
  archiveMissionRoom,
  reconcileArchivedMissionRooms,
} from "../core/room-achive";

const EXECUTION_SIGNAL_TYPES = new Set<SignalType>([
  "round_complete",
  "mission_complete",
  "blocked",
  "request_session_restart",
  "artifacts_ready_for_review",
  "artifact_release_complete",
  "retrospective_complete",
]);

const INTAKE_SIGNAL_TYPES = new Set<SignalType>([
  "start_drafting",
  "packages_ready",
  "request_approval",
  "awaiting_input",
]);

const ARTIFACTS_READY_PHASES = new Set<MissionPhase>(["working", "evaluating", "blocked"]);

function recordSignal(checkpoint: Checkpoint, request: SignalRequest): Checkpoint {
  return {
    ...checkpoint,
    last_signal: {
      at: new Date().toISOString(),
      by: request.by ?? "project-owner",
      type: request.type,
      summary: request.summary,
    },
  };
}

async function moveWorkingToDone(config: Config, missionId: string): Promise<void> {
  const src = await resolveWorkingEntryPath(config, missionId);
  if (!src) {
    throw new Error(`Working board entry missing: ${missionId}`);
  }
  await rename(src, missionBoardEntryPath(config, "done", missionId));
}

async function moveDoneToArchive(config: Config, missionId: string): Promise<void> {
  const src = await resolveDoneEntryPath(config, missionId);
  if (!src) {
    throw new Error(`Done board entry missing: ${missionId}`);
  }
  await rename(src, missionBoardEntryPath(config, "archive", missionId));
}

async function moveAbortedToArchive(config: Config, missionId: string): Promise<void> {
  const src = await resolveAbortedEntryPath(config, missionId);
  if (!src) {
    throw new Error(`Aborted board entry missing: ${missionId}`);
  }
  await rename(src, missionBoardEntryPath(config, "archive", missionId));
}

/** Move done-board missions stuck with phase=done on working/ to done/ (boot migration). */
export async function reconcileLegacyDoneMissions(config: Config): Promise<string[]> {
  const board = await listBoard(config);
  const moved: string[] = [];

  for (const missionId of board.working) {
    const checkpoint = await readCheckpoint(config, missionId);
    if (checkpoint?.phase !== "done") continue;
    try {
      await moveWorkingToDone(config, missionId);
      moved.push(missionId);
    } catch {
      // Best-effort — may already be mid-move.
    }
  }

  return moved;
}

/** Move aborted-board missions stuck on working/ after partial upgrade (boot migration). */
export async function reconcileAbortedOnWorking(config: Config): Promise<string[]> {
  const board = await listBoard(config);
  const moved: string[] = [];

  for (const missionId of board.working) {
    const checkpoint = await readCheckpoint(config, missionId);
    if (checkpoint?.phase !== "aborted") continue;
    try {
      const src = await resolveWorkingEntryPath(config, missionId);
      if (!src) continue;
      await rename(src, missionBoardEntryPath(config, "aborted", missionId));
      moved.push(missionId);
    } catch {
      // Best-effort
    }
  }

  return moved;
}

/** Move done/{id} or aborted/{id} → archive/{id}; requires matching terminal phase. */
export async function archiveMission(config: Config, missionId: string): Promise<Checkpoint> {
  assertMissionId(missionId);

  const board = await listBoard(config);
  const onDone = isOnDoneBoard(board, missionId);
  const onAborted = isOnAbortedBoard(board, missionId);

  if (!onDone && !onAborted) {
    throw new Error(`Mission ${missionId} is not on the done or aborted board`);
  }

  const checkpoint = await readCheckpoint(config, missionId);
  if (!checkpoint) {
    throw new Error(`Missing checkpoint for ${missionId}`);
  }

  if (onDone) {
    if (!canArchiveFromDoneBoard(checkpoint.phase)) {
      throw new Error(
        `Mission ${missionId} must be phase done or mission_plan_complete before archive (current: ${checkpoint.phase})`,
      );
    }
    await moveDoneToArchive(config, missionId);
    await archiveMissionRoom(config, missionId);
    return checkpoint;
  }

  if (checkpoint.phase !== "aborted") {
    throw new Error(`Mission ${missionId} must be phase aborted before archive (current: ${checkpoint.phase})`);
  }
  await moveAbortedToArchive(config, missionId);
  await archiveMissionRoom(config, missionId);
  return checkpoint;
}

async function stopSessionSafe(config: Config, sessionId: string): Promise<void> {
  try {
    await stopSession(config, sessionId);
  } catch {
    // Session may already be stopped.
  }
}

async function restartSession(config: Config, checkpoint: Checkpoint): Promise<Checkpoint> {
  await stopSessionSafe(config, checkpoint.claude_session.id);
  const restored = await restoreMissionSession(config, checkpoint.mission_id);
  return restored.checkpoint;
}

/** Apply PO lifecycle signal; mission_complete moves working/ → done/ from retrospective only. */
export async function handleSignal(
  config: Config,
  missionId: string,
  request: SignalRequest,
): Promise<Checkpoint> {
  assertMissionId(missionId);

  if (!EXECUTION_SIGNAL_TYPES.has(request.type) && !INTAKE_SIGNAL_TYPES.has(request.type)) {
    throw new Error(`Invalid signal type: ${request.type}`);
  }

  const priorCheckpoint = await requireActiveCheckpoint(config, missionId);
  const intake = priorCheckpoint.mode === "intake" || isIntakePhase(priorCheckpoint.phase);

  if (intake) {
    if (!INTAKE_SIGNAL_TYPES.has(request.type)) {
      throw new Error(`Signal ${request.type} not allowed in intake mode`);
    }
    return handleIntakeSignal(config, missionId, priorCheckpoint, request);
  }

  if (!EXECUTION_SIGNAL_TYPES.has(request.type)) {
    throw new Error(`Signal ${request.type} not allowed in execution mode`);
  }

  if (request.type === "retrospective_complete") {
    if (priorCheckpoint.phase !== "retrospective") {
      throw new Error(
        `retrospective_complete requires phase retrospective (current: ${priorCheckpoint.phase})`,
      );
    }
    await requireWorkflowReport(config, missionId);
  }

  if (request.type === "mission_complete") {
    if (priorCheckpoint.phase !== "retrospective") {
      throw new Error(
        `mission_complete requires phase retrospective (current: ${priorCheckpoint.phase})`,
      );
    }
    requireRetrospectiveCompleteSignal(priorCheckpoint.last_signal?.type);
    await requireWorkflowReport(config, missionId);
  }

  let checkpoint = recordSignal(priorCheckpoint, request);

  switch (request.type) {
    case "round_complete":
      checkpoint = {
        ...checkpoint,
        round: checkpoint.round + 1,
        phase:
          checkpoint.phase === "evaluating" || checkpoint.phase === "blocked"
            ? "working"
            : checkpoint.phase,
        awaiting_guild_master: false,
      };
      break;

    case "blocked":
      checkpoint = {
        ...checkpoint,
        phase: "blocked",
        awaiting_guild_master: true,
      };
      break;

    case "artifacts_ready_for_review":
      if (!ARTIFACTS_READY_PHASES.has(checkpoint.phase)) {
        throw new Error(
          `artifacts_ready_for_review not allowed from phase ${checkpoint.phase}`,
        );
      }
      checkpoint = {
        ...checkpoint,
        phase: "awaiting_artifact_review",
        awaiting_guild_master: true,
      };
      break;

    case "artifact_release_complete":
      if (checkpoint.phase !== "releasing") {
        throw new Error(
          `artifact_release_complete requires phase releasing (current: ${checkpoint.phase})`,
        );
      }
      await requireArtifactReleaseReleased(config, missionId);
      await appendEventEntry(config, missionId, {
        from: "project-owner",
        type: "milestone",
        body: request.summary?.trim() || "Artifact release complete",
      });
      checkpoint = {
        ...checkpoint,
        phase: "retrospective",
        awaiting_guild_master: false,
      };
      break;

    case "retrospective_complete":
      await appendEventEntry(config, missionId, {
        from: "project-owner",
        type: "milestone",
        body: request.summary?.trim() || "Retrospective aggregation complete",
      });
      break;

    case "request_session_restart":
      checkpoint = await restartSession(config, checkpoint);
      checkpoint = { ...checkpoint, phase: checkpoint.phase === "paused" ? "working" : checkpoint.phase };
      break;

    case "mission_complete":
      await stopSessionSafe(config, checkpoint.claude_session.id);
      checkpoint = {
        ...checkpoint,
        phase: "done",
        awaiting_guild_master: false,
        claude_session: {
          ...checkpoint.claude_session,
          status: "stopped",
          job_state: "done",
        },
      };
      await writeCheckpoint(config, missionId, checkpoint);
      await moveWorkingToDone(config, missionId);
      await archiveMissionRoom(config, missionId);
      return checkpoint;
  }

  await writeCheckpoint(config, missionId, checkpoint);
  return checkpoint;
}

/** Stop PO session and set phase=paused on working board. */
export async function pauseMission(config: Config, missionId: string): Promise<Checkpoint> {
  assertMissionId(missionId);
  let checkpoint = await requireActiveCheckpoint(config, missionId);

  if (checkpoint.phase === "done" || checkpoint.phase === "aborted") {
    throw new Error(`Mission ${missionId} is already terminal`);
  }

  await stopSessionSafe(config, checkpoint.claude_session.id);
  checkpoint = {
    ...checkpoint,
    phase: "paused",
    claude_session: {
      ...checkpoint.claude_session,
      status: "stopped",
    },
  };

  await writeCheckpoint(config, missionId, checkpoint);
  return checkpoint;
}

/** Restore PO session and clear paused phase. */
export async function resumeMission(config: Config, missionId: string) {
  assertMissionId(missionId);
  return restoreMissionSession(config, missionId);
}

/** Boot recovery: reconcile legacy done/aborted, achive terminal rooms, sync working-board sessions. */
export async function recoverActiveMissions(config: Config) {
  const reconciledDone = await reconcileLegacyDoneMissions(config);
  if (reconciledDone.length > 0) {
    console.log("Reconciled legacy done missions → done board:", reconciledDone);
  }

  const reconciledAborted = await reconcileAbortedOnWorking(config);
  if (reconciledAborted.length > 0) {
    console.log("Reconciled aborted missions → aborted board:", reconciledAborted);
  }

  const archivedMissionRooms = await reconcileArchivedMissionRooms(config);
  if (archivedMissionRooms.length > 0) {
    console.log("Moved terminal mission rooms → mission-rooms/archive:", archivedMissionRooms);
  }

  const board = await listBoard(config);
  const recovered: Array<{
    missionId: string;
    action: string;
    previousSessionId?: string;
    error?: string;
  }> = [];

  for (const missionId of board.working) {
    try {
      const checkpoint = await readCheckpoint(config, missionId);
      if (!checkpoint) {
        recovered.push({ missionId, action: "skipped", error: "missing checkpoint" });
        continue;
      }

      if (checkpoint.phase === "done" || checkpoint.phase === "aborted") {
        recovered.push({ missionId, action: "skipped", error: `${checkpoint.phase} — reconcile failed?` });
        continue;
      }

      if (checkpoint.phase === "paused") {
        recovered.push({ missionId, action: "skipped", error: "paused" });
        continue;
      }

      const result = await restoreMissionSession(config, missionId);
      recovered.push({
        missionId,
        action: result.action,
        previousSessionId: result.previousSessionId,
      });
    } catch (err) {
      recovered.push({
        missionId,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return recovered;
}

async function handleIntakeSignal(
  config: Config,
  missionId: string,
  priorCheckpoint: Checkpoint,
  request: SignalRequest,
): Promise<Checkpoint> {
  let checkpoint = recordSignal(priorCheckpoint, request);

  switch (request.type) {
    case "start_drafting":
      checkpoint = { ...checkpoint, phase: "mission_planning", awaiting_guild_master: false };
      break;
    case "packages_ready":
      checkpoint = { ...checkpoint, phase: "mission_plan_presenting", awaiting_guild_master: false };
      break;
    case "request_approval":
      checkpoint = {
        ...checkpoint,
        phase: "mission_plan_awaiting_approval",
        awaiting_guild_master: true,
      };
      break;
    case "awaiting_input":
      checkpoint = { ...checkpoint, awaiting_guild_master: true };
      break;
  }

  await writeCheckpoint(config, missionId, checkpoint);
  return checkpoint;
}
