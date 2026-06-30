/**
 * Periodic orchestrator tick — same as POST /bell when GUILD_TICK_INTERVAL_MINUTES > 0.
 */
import type { Config } from "../config";
import type { TickResult } from "../types/mission";
import { orchestratorTick } from "./tick";

function summarizeTick(result: TickResult): string {
  const chunks: string[] = [];
  if (result.discoveriesStarted.length) {
    chunks.push(`discoveries started: ${result.discoveriesStarted.join(", ")}`);
  }
  if (result.missionsStarted.length) {
    chunks.push(`missions started: ${result.missionsStarted.join(", ")}`);
  }
  if (result.queuedDiscovery.length) {
    chunks.push(`discovery queued: ${result.queuedDiscovery.join(", ")}`);
  }
  if (result.queuedExecution.length) {
    chunks.push(`execution queued: ${result.queuedExecution.join(", ")}`);
  }
  if (result.errors.length) {
    chunks.push(
      `errors: ${result.errors.map((e) => `${e.id}: ${e.error}`).join("; ")}`,
    );
  }
  return chunks.length ? chunks.join(" · ") : "no work";
}

/** Start interval tick when config.tickIntervalMinutes > 0. Skips overlapping runs. */
export function startPeriodicTick(config: Config): void {
  const minutes = config.tickIntervalMinutes;
  if (minutes <= 0) return;

  const ms = minutes * 60_000;
  console.log(
    `Periodic orchestrator tick every ${minutes} min (GUILD_TICK_INTERVAL_MINUTES)`,
  );

  let running = false;

  const run = async () => {
    if (running) {
      console.log("[tick] Skipping — previous tick still running");
      return;
    }
    running = true;
    try {
      const result = await orchestratorTick(config);
      console.log(`[tick] ${summarizeTick(result)}`);
    } catch (err) {
      console.error("[tick] Error:", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };

  setInterval(() => void run(), ms);
}
