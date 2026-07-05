/**
 * Execution pipeline pickup — queued → working, plus mission GET helpers.
 *
 * tickExecution: FIFO from queued; may rename folder to minted id before pickup.
 * Pickup sequence: working board → ensure brief → scaffold room → spawn PO → checkpoint.
 * listMissions covers working board only. getMissionSession(ensureLive) may restore PO.
 */
import { rename } from "node:fs/promises";
import type { Config } from "../../config";
import {
  missionBoardEntryPath,
  missionRoomPath,
  poSessionName,
} from "../../paths";
import type { BoardListing, SlotMeter, TickResult } from "../../types/mission";
import {
  countDiscoveringSessions,
  countWorkingMissions,
  isOnDiscoveringBoard,
  isOnWorkingBoard,
  listBoard,
  resolveQueuedEntryPath,
} from "../core/board";
import { resolveMissionRoomPath } from "../core/room-achive";
import {
  assertNoteId,
  queuedEntryExists,
  resolveMissionIdAtKickstart,
} from "../core/note-id";
import { readBoardNoteMeta } from "../core/board-note-meta";
import { buildCheckpoint, readCheckpoint, writeCheckpoint } from "./checkpoint";
import { ensureMissionBrief, initialSpawnPrompt, scaffoldMissionRoom } from "./scaffold";
import {
  buildMissionSessionInfo,
  ensureMissionSessionLive,
  syncActiveMission,
  syncActiveMissionsList,
} from "./session-lifecycle";
import { getDiscoverySession } from "../discovery/session-lifecycle";
import { spawnPoSession } from "../core/spawn";

export interface ExecutionTickInput {
  board: BoardListing;
  slotsLeft: number;
  executionUsed: number;
}

export interface ExecutionTickResult {
  missionsStarted: string[];
  queuedExecution: string[];
  errors: TickResult["errors"];
  executionSlots: SlotMeter;
}

/** FIFO queued → working pickup; mints id, scaffolds room, spawns PO when slots allow. */
export async function tickExecution(
  config: Config,
  input?: ExecutionTickInput,
): Promise<ExecutionTickResult> {
  const board = input?.board ?? (await listBoard(config));
  const used = input?.executionUsed ?? (await countWorkingMissions(config));
  let slotsLeft = input?.slotsLeft ?? Math.max(0, config.maxActiveMissions - used);

  const result: ExecutionTickResult = {
    missionsStarted: [],
    queuedExecution: [],
    errors: [],
    executionSlots: {
      used,
      max: config.maxActiveMissions,
      available: slotsLeft,
    },
  };

  for (const queuedFolder of board.queued) {
    if (slotsLeft <= 0) {
      result.queuedExecution.push(queuedFolder);
      continue;
    }

    try {
      const missionId = await ensureQueuedMissionId(config, queuedFolder);
      await pickupMission(config, missionId);
      result.missionsStarted.push(missionId);
      slotsLeft -= 1;
      result.executionSlots.used += 1;
      result.executionSlots.available = slotsLeft;
    } catch (err) {
      result.errors.push({
        id: queuedFolder,
        pipeline: "execution",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function ensureQueuedMissionId(config: Config, queuedFolder: string): Promise<string> {
  const missionId = await resolveMissionIdAtKickstart(config, queuedFolder);
  if (missionId !== queuedFolder) {
    const src = await resolveQueuedEntryPath(config, queuedFolder);
    if (!src) {
      throw new Error(`Queued entry missing: ${queuedFolder}`);
    }
    await rename(src, missionBoardEntryPath(config, "queued", missionId));
  }
  if (!(await queuedEntryExists(config, missionId))) {
    throw new Error(`Queued entry missing after kickstart: ${missionId}`);
  }
  return missionId;
}

async function pickupMission(config: Config, missionId: string): Promise<void> {
  assertNoteId(missionId);

  const src = await resolveQueuedEntryPath(config, missionId);
  if (!src) {
    throw new Error(`Queued entry missing: ${missionId}`);
  }

  await rename(src, missionBoardEntryPath(config, "working", missionId));
  await ensureMissionBrief(config, missionId);

  const meta = await readBoardNoteMeta(config, "working", missionId);
  const roomPath = await scaffoldMissionRoom(config, missionId);
  const session = await spawnPoSession(config, missionId, initialSpawnPrompt(missionId));

  await writeCheckpoint(
    config,
    missionId,
    buildCheckpoint({
      missionId,
      session: {
        ...session,
        name: poSessionName(missionId),
        cwd: roomPath,
        job_state: "running",
      },
      mode: "execution",
      noteStage: "working",
      parentId: meta?.parent_id ?? null,
      phase: "evaluating",
    }),
  );
}

/** List queued missions with slot meter (for GET /queue). */
export async function getQueue(config: Config) {
  const board = await listBoard(config);
  const discoveryUsed = await countDiscoveringSessions(config);
  const discoveryAvailable = Math.max(0, config.maxDiscoverySessions - discoveryUsed);
  const executionUsed = await countWorkingMissions(config);
  const executionAvailable = Math.max(0, config.maxActiveMissions - executionUsed);

  return {
    discovery: {
      slots: {
        used: discoveryUsed,
        max: config.maxDiscoverySessions,
        available: discoveryAvailable,
      },
      ideas: board.ideas,
      discovering: board.discovering,
      wouldStartOnTick: board.ideas.slice(0, discoveryAvailable),
      wouldQueueOnTick: board.ideas.slice(discoveryAvailable),
    },
    execution: {
      slots: {
        used: executionUsed,
        max: config.maxActiveMissions,
        available: executionAvailable,
      },
      queued: board.queued,
      wouldPickupOnTick: board.queued.slice(0, executionAvailable),
      wouldQueueOnTick: board.queued.slice(executionAvailable),
    },
  };
}

/** List working-board missions with checkpoint phase and session status. */
export async function listMissions(config: Config) {
  const board = await listBoard(config);
  const syncStates = await syncActiveMissionsList(config, board.working);
  const syncById = new Map(syncStates.map((s) => [s.id, s]));

  const working = await Promise.all(
    board.working.map(async (id) => {
      const checkpoint = await readCheckpoint(config, id);
      const sync = syncById.get(id);
      return {
        id,
        board: "working" as const,
        phase: checkpoint?.phase ?? "unknown",
        sessionId: checkpoint?.claude_session.id ?? null,
        sessionLive: sync?.live ?? false,
        jobState: sync?.jobState ?? "missing",
        restoreRequired: sync?.restoreRequired ?? false,
        awaitingGuildMaster: checkpoint?.awaiting_guild_master ?? false,
        archiveReady: false,
      };
    }),
  );

  const done = await Promise.all(
    board.done.map(async (id) => {
      const checkpoint = await readCheckpoint(config, id);
      return {
        id,
        board: "done" as const,
        phase: checkpoint?.phase ?? "done",
        sessionId: checkpoint?.claude_session.id ?? null,
        sessionLive: false,
        jobState: checkpoint?.claude_session.job_state ?? "done",
        restoreRequired: false,
        awaitingGuildMaster: checkpoint?.awaiting_guild_master ?? false,
        archiveReady: checkpoint?.phase === "done",
      };
    }),
  );

  const aborted = await Promise.all(
    board.aborted.map(async (id) => {
      const checkpoint = await readCheckpoint(config, id);
      return {
        id,
        board: "aborted" as const,
        phase: checkpoint?.phase ?? "aborted",
        sessionId: checkpoint?.claude_session.id ?? null,
        sessionLive: false,
        jobState: checkpoint?.claude_session.job_state ?? "done",
        restoreRequired: false,
        awaitingGuildMaster: false,
        archiveReady: checkpoint?.phase === "aborted",
      };
    }),
  );

  const missions = [...working, ...done, ...aborted];
  return { missions, count: missions.length };
}

const BOARD_LOOKUP_STAGES = [
  "ideas",
  "discovering",
  "parking",
  "queued",
  "working",
  "done",
  "aborted",
  "archive",
] as const;

/** Mission detail for any board stage; syncs session if on working board. */
export async function getMission(config: Config, missionId: string) {
  assertNoteId(missionId);
  const board = await listBoard(config);
  const stage =
    BOARD_LOOKUP_STAGES.find((s) => board[s].includes(missionId)) ?? null;

  if (!stage) return null;

  if (stage === "working") {
    const synced = await syncActiveMission(config, missionId);

    return {
      id: missionId,
      board: stage,
      roomPath: missionRoomPath(config, missionId),
      checkpoint: synced?.checkpoint ?? (await readCheckpoint(config, missionId)),
      sessionLive: synced?.live ?? false,
      jobState: synced?.jobState ?? "missing",
      restoreRequired: synced?.restoreRequired ?? false,
    };
  }

  if (stage === "done" || stage === "aborted") {
    const checkpoint = await readCheckpoint(config, missionId);
    return {
      id: missionId,
      board: stage,
      roomPath: await resolveMissionRoomPath(config, missionId),
      checkpoint,
    };
  }

  const checkpoint =
    stage === "archive" ? await readCheckpoint(config, missionId) : null;
  return {
    id: missionId,
    board: stage,
    roomPath: stage === "archive" ? await resolveMissionRoomPath(config, missionId) : null,
    checkpoint,
  };
}

/** Session info for attach; ensureLive runs restore ladder before respond. */
export async function getMissionSession(
  config: Config,
  missionId: string,
  options?: { ensureLive?: boolean },
) {
  const board = await listBoard(config);
  if (isOnDiscoveringBoard(board, missionId)) {
    return getDiscoverySession(config, missionId, options);
  }

  if (options?.ensureLive) {
    try {
      const ensured = await ensureMissionSessionLive(config, missionId);
      return ensured.session;
    } catch {
      return null;
    }
  }

  const synced = await syncActiveMission(config, missionId);
  if (!synced) return null;

  return buildMissionSessionInfo(config, missionId, synced.checkpoint, {
    processLive: synced.live,
    jobState: synced.jobState,
  });
}

export { isOnWorkingBoard };
