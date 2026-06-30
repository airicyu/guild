/**
 * Discovery tick — FIFO pickup from ideas/ while discovery slots allow.
 *
 * Sequence: rename to discovering → scaffold room → spawn lead --bg → write checkpoint.
 */
import { rename, stat } from "node:fs/promises";
import type { Config } from "../../config";
import { discoverySessionName, ideaBoardEntryPath } from "../../paths";
import type { BoardListing, SlotMeter, TickResult } from "../../types/mission";
import { listBoard } from "../core/board";
import { buildDiscoveryCheckpoint, writeDiscoveryCheckpoint } from "./checkpoint";
import { initialDiscoverySpawnPrompt, scaffoldDiscoveryRoom } from "./scaffold";
import { spawnDiscoveryLead } from "../core/spawn";

export interface DiscoveryTickInput {
  board: BoardListing;
  slotsLeft: number;
  discoveryUsed: number;
}

export interface DiscoveryTickResult {
  discoveriesStarted: string[];
  queuedDiscovery: string[];
  errors: TickResult["errors"];
  discoverySlots: SlotMeter;
}

async function resolveIdeasEntryPath(config: Config, ideaId: string): Promise<string | null> {
  const path = ideaBoardEntryPath(config, "ideas", ideaId);
  try {
    if ((await stat(path)).isDirectory()) return path;
  } catch {
    // missing
  }
  return null;
}

async function pickupDiscovery(config: Config, ideaId: string): Promise<void> {
  const src = await resolveIdeasEntryPath(config, ideaId);
  if (!src) {
    throw new Error(`Ideas entry missing: ${ideaId}`);
  }

  // Discovery pickup: board move → room scaffold → lead --bg → checkpoint (phase exploring).
  await rename(src, ideaBoardEntryPath(config, "discovering", ideaId));
  const roomPath = await scaffoldDiscoveryRoom(config, ideaId);
  const session = await spawnDiscoveryLead(config, ideaId, initialDiscoverySpawnPrompt(ideaId));

  await writeDiscoveryCheckpoint(
    config,
    ideaId,
    buildDiscoveryCheckpoint({
      ideaId,
      session: {
        ...session,
        name: discoverySessionName(ideaId),
        cwd: roomPath,
        job_state: "running",
      },
    }),
  );
}

/** FIFO ideas → discovering pickup; scaffolds room and spawns intake lead. */
export async function tickDiscovery(
  config: Config,
  input?: DiscoveryTickInput,
): Promise<DiscoveryTickResult> {
  const board = input?.board ?? (await listBoard(config));
  const used = input?.discoveryUsed ?? 0;
  let slotsLeft = input?.slotsLeft ?? 0;

  const result: DiscoveryTickResult = {
    discoveriesStarted: [],
    queuedDiscovery: [],
    errors: [],
    discoverySlots: {
      used,
      max: config.maxDiscoverySessions,
      available: slotsLeft,
    },
  };

  for (const ideaId of board.ideas) {
    if (slotsLeft <= 0) {
      result.queuedDiscovery.push(ideaId);
      continue;
    }

    try {
      await pickupDiscovery(config, ideaId);
      result.discoveriesStarted.push(ideaId);
      slotsLeft -= 1;
      result.discoverySlots.used += 1;
      result.discoverySlots.available = slotsLeft;
    } catch (err) {
      result.errors.push({
        id: ideaId,
        pipeline: "discovery",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
