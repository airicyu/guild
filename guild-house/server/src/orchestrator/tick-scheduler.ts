/**
 * Periodic orchestrator tick — same as POST /bell when GUILD_TICK_INTERVAL_MINUTES > 0.
 * Uses Bun.cron (UTC wall-clock); overlapping runs are skipped by Bun until the handler settles.
 */
import type { Config } from "../config";
import type { TickResult } from "../types/mission";
import { orchestratorTick } from "./tick";

function summarizeTick(result: TickResult): string {
  const chunks: string[] = [];
  if (result.intakeStarted.length) {
    chunks.push(`discoveries started: ${result.intakeStarted.join(", ")}`);
  }
  if (result.missionsStarted.length) {
    chunks.push(`missions started: ${result.missionsStarted.join(", ")}`);
  }
  if (result.queuedIntake.length) {
    chunks.push(`discovery queued: ${result.queuedIntake.join(", ")}`);
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

/** Map minutes to a cron expression (e.g. 5 → every 5 min, 60 → hourly). */
function cronEveryMinutes(minutes: number): string {
  if (minutes === 1) return "* * * * *";
  if (minutes < 60) return `*/${minutes} * * * *`;
  if (minutes === 60) return "@hourly";
  if (minutes % 60 === 0) return `0 */${minutes / 60} * * *`;
  throw new Error(
    `GUILD_TICK_INTERVAL_MINUTES=${minutes}: use 1–59 or a multiple of 60`,
  );
}

/** Start cron tick when config.tickIntervalMinutes > 0. */
export function startPeriodicTick(config: Config): void {
  const minutes = config.tickIntervalMinutes;
  if (minutes <= 0) return;

  const schedule = cronEveryMinutes(minutes);
  console.log(
    `Periodic orchestrator tick ${schedule} (every ${minutes} min, GUILD_TICK_INTERVAL_MINUTES)`,
  );

  Bun.cron(schedule, async () => {
    try {
      const result = await orchestratorTick(config);
      console.log(`[tick] ${summarizeTick(result)}`);
    } catch (err) {
      console.error("[tick] Error:", err instanceof Error ? err.message : err);
    }
  });
}
