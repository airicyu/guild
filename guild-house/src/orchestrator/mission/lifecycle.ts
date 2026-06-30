/**
 * Mission lifecycle — signals, pause/resume, archive, boot recovery.
 *
 * mission_complete → phase done + move working/ → done/ (frees execution slot).
 * archiveMission requires mission on done board, then done/ → archive/.
 */
import { rename } from "node:fs/promises";
import type { Config } from "../../config";
import { missionBoardEntryPath } from "../../paths";
import type { Checkpoint, SignalRequest, SignalType } from "../../types/mission";
import {
  assertMissionId,
  isOnDoneBoard,
  listBoard,
  resolveDoneEntryPath,
  resolveWorkingEntryPath,
} from "../core/board";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import {
  requireActiveCheckpoint,
  restoreMissionSession,
} from "./session-lifecycle";
import { stopSession } from "../core/session";

const SIGNAL_TYPES = new Set<SignalType>([
  "round_complete",
  "mission_complete",
  "blocked",
  "request_session_restart",
]);

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

/** Move legacy phase:done entries still on working/ after Plan 3 Phase 6 upgrade. */
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

/** Move done/{id} → archive/{id}; requires phase=done on done board. */
export async function archiveMission(config: Config, missionId: string): Promise<Checkpoint> {
  assertMissionId(missionId);

  const board = await listBoard(config);
  if (!isOnDoneBoard(board, missionId)) {
    throw new Error(`Mission ${missionId} is not on the done board`);
  }

  const checkpoint = await readCheckpoint(config, missionId);
  if (!checkpoint) {
    throw new Error(`Missing checkpoint for ${missionId}`);
  }
  if (checkpoint.phase !== "done") {
    throw new Error(`Mission ${missionId} must be phase done before archive (current: ${checkpoint.phase})`);
  }

  await moveDoneToArchive(config, missionId);
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

/** Apply PO lifecycle signal; mission_complete moves working/ → done/. */
export async function handleSignal(
  config: Config,
  missionId: string,
  request: SignalRequest,
): Promise<Checkpoint> {
  assertMissionId(missionId);

  if (!SIGNAL_TYPES.has(request.type)) {
    throw new Error(`Invalid signal type: ${request.type}`);
  }

  let checkpoint = recordSignal(await requireActiveCheckpoint(config, missionId), request);

  switch (request.type) {
    case "round_complete":
      checkpoint = {
        ...checkpoint,
        round: checkpoint.round + 1,
        phase:
          checkpoint.phase === "evaluating" || checkpoint.phase === "blocked"
            ? "running"
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

    case "request_session_restart":
      checkpoint = await restartSession(config, checkpoint);
      checkpoint = { ...checkpoint, phase: checkpoint.phase === "paused" ? "running" : checkpoint.phase };
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
      return checkpoint;
  }

  await writeCheckpoint(config, missionId, checkpoint);
  return checkpoint;
}

/** Stop PO session and set phase=paused on working board. */
export async function pauseMission(config: Config, missionId: string): Promise<Checkpoint> {
  assertMissionId(missionId);
  let checkpoint = await requireActiveCheckpoint(config, missionId);

  if (checkpoint.phase === "done") {
    throw new Error(`Mission ${missionId} is already done`);
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

/** Boot recovery: reconcile legacy done, sync all working-board sessions. */
export async function recoverActiveMissions(config: Config) {
  const reconciled = await reconcileLegacyDoneMissions(config);
  if (reconciled.length > 0) {
    console.log("Reconciled legacy done missions → done board:", reconciled);
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

      if (checkpoint.phase === "done") {
        recovered.push({ missionId, action: "skipped", error: "done — reconcile failed?" });
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
