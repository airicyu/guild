/**
 * Unified orchestrator tick — POST /bell and (Phase 7) periodic job call this.
 *
 * Order: discovery half (ideas→discovering) then execution half (queued→working).
 * Each half receives precomputed slot meters and decrements as it starts items.
 */
import type { Config } from "../config";
import type { TickResult } from "../types/mission";
import { countDiscoveringSessions, countWorkingMissions, listBoard } from "./core/board";
import { tickDiscovery } from "./discovery/pickup";
import { tickExecution } from "./mission/pickup";

/** Unified bell / periodic tick — discovery then execution. */
export async function orchestratorTick(config: Config): Promise<TickResult> {
  const board = await listBoard(config);
  const discoveryUsed = await countDiscoveringSessions(config);
  const discoverySlotsLeft = Math.max(0, config.maxDiscoverySessions - discoveryUsed);

  const executionUsed = await countWorkingMissions(config);
  const executionSlotsLeft = Math.max(0, config.maxActiveMissions - executionUsed);

  const discovery = await tickDiscovery(config, {
    board,
    slotsLeft: discoverySlotsLeft,
    discoveryUsed,
  });

  const execution = await tickExecution(config, {
    board,
    slotsLeft: executionSlotsLeft,
    executionUsed,
  });

  return {
    discoveriesStarted: discovery.discoveriesStarted,
    missionsStarted: execution.missionsStarted,
    queuedDiscovery: discovery.queuedDiscovery,
    queuedExecution: execution.queuedExecution,
    errors: [...discovery.errors, ...execution.errors],
    discoverySlots: discovery.discoverySlots,
    executionSlots: execution.executionSlots,
  };
}

/** @deprecated Use orchestratorTick */
export const ringBell = orchestratorTick;
