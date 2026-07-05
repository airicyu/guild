#!/usr/bin/env bun
/**
 * Phase 0 PoC: session poke — ephemeral `claude attach` injects a user message into a live --bg PO.
 *
 * Production path: orchestrator `session-poke.ts` (Phase 1+). This script remains for manual spike/QA.
 *
 * Usage:
 *   bun --env-file=../.env scripts/poc-session-poke.ts --mission-id <id>
 *   bun --env-file=../.env scripts/poc-session-poke.ts --spawn
 */
import { cp, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";
import { runEphemeralAttachPoke } from "../src/orchestrator/core/attach-pty-core";
import { probeSession } from "../src/orchestrator/mission/session-lifecycle";
import { readCheckpoint } from "../src/orchestrator/mission/checkpoint";
import { buildPokeMessage, type SessionPokeEvent } from "../src/orchestrator/mission/session-poke";
import { spawnBackgroundSession } from "../src/orchestrator/core/spawn";
import { missionExecutionTemplatePath, missionRoomPath, poSessionName } from "../src/paths";
import type { MissionPhase } from "../src/types/mission";

function parseArgs(): {
  missionId: string;
  message?: string;
  dryRun: boolean;
  spawn: boolean;
  event: SessionPokeEvent;
  phase: MissionPhase;
  timeoutMs: number;
} {
  const argv = process.argv.slice(2);
  let missionId = process.env.POC_MISSION_ID ?? "";
  let message: string | undefined;
  let dryRun = false;
  let spawn = false;
  let event: SessionPokeEvent = "artifacts_approved";
  let phase: MissionPhase = "releasing";
  let timeoutMs = config.sessionPokeTimeoutMs;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--spawn") spawn = true;
    else if (arg === "--mission-id") missionId = argv[++i] ?? "";
    else if (arg === "--message") message = argv[++i];
    else if (arg === "--event") event = argv[++i] as SessionPokeEvent;
    else if (arg === "--phase") phase = argv[++i] as MissionPhase;
    else if (arg === "--timeout-ms") timeoutMs = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bun scripts/poc-session-poke.ts --mission-id <id> [--dry-run] [--spawn]`);
      process.exit(0);
    }
  }

  if (spawn && !missionId) {
    missionId = `poke-poc-${Date.now().toString(36)}`;
  }
  if (!missionId) {
    console.error("Missing --mission-id (or use --spawn)");
    process.exit(1);
  }

  return { missionId, message, dryRun, spawn, event, phase, timeoutMs };
}

async function scaffoldPocRoom(missionId: string): Promise<string> {
  const roomPath = missionRoomPath(config, missionId);
  try {
    await readFile(join(roomPath, "mission-brief.md"), "utf8");
    console.log(`Reusing PoC room: ${roomPath}`);
    return roomPath;
  } catch {
    // scaffold
  }

  await mkdir(roomPath, { recursive: true });
  await cp(missionExecutionTemplatePath(config), roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });
  console.log(`Scaffolded PoC room: ${roomPath}`);
  return roomPath;
}

async function spawnIdlePo(missionId: string, roomPath: string): Promise<string> {
  const prompt = [
    `You are mission ${missionId} Project Owner in a session-poke PoC.`,
    "Stay idle at the prompt — do not start mission work.",
    "When you receive a [guild-house] poke message, read checkpoint.yaml and comm/inbox.md if present, then reply briefly that you received the poke.",
  ].join(" ");

  const session = await spawnBackgroundSession(config, {
    sessionName: poSessionName(missionId),
    cwd: roomPath,
    prompt,
  });
  console.log(`Spawned idle PO session: ${session.id}`);
  return session.id;
}

async function waitForLiveSession(sessionId: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await probeSession(config, sessionId);
    if (probe.processLive) return true;
    await Bun.sleep(500);
  }
  return false;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const { missionId, dryRun, spawn, event, phase, timeoutMs } = args;

  let sessionId: string;
  let cwd: string;

  if (spawn) {
    cwd = await scaffoldPocRoom(missionId);
    sessionId = await spawnIdlePo(missionId, cwd);
    if (!(await waitForLiveSession(sessionId))) {
      console.log(JSON.stringify({ delivered: false, reason: "session not live after spawn", sessionId }, null, 2));
      process.exit(1);
    }
  } else {
    const checkpoint = await readCheckpoint(config, missionId);
    if (!checkpoint) {
      console.error(`No checkpoint for mission ${missionId}`);
      process.exit(1);
    }
    sessionId = checkpoint.claude_session.id;
    cwd = checkpoint.claude_session.cwd || missionRoomPath(config, missionId);
  }

  const probeBefore = await probeSession(config, sessionId);
  const message = args.message ?? buildPokeMessage(event, phase);

  console.log(`[session-poke] mission=${missionId} session=${sessionId} dryRun=${dryRun} live=${probeBefore.processLive}`);

  if (dryRun) {
    console.log(`Would poke cwd=${cwd}\nMessage: ${message}`);
    console.log(
      JSON.stringify(
        {
          delivered: false,
          reason: probeBefore.processLive ? "dry-run" : "session not live",
          sessionId,
          bgLiveBefore: probeBefore.processLive,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (!probeBefore.processLive) {
    console.log(JSON.stringify({ delivered: false, reason: "session not live", sessionId }, null, 2));
    process.exit(0);
  }

  const poke = await runEphemeralAttachPoke({
    claudeCommand: config.claudeCommand,
    sessionId,
    cwd,
    message,
    timeoutMs,
  });

  const probeAfter = await probeSession(config, sessionId);
  const result = {
    ...poke,
    sessionId,
    bgLiveBefore: probeBefore.processLive,
    bgLiveAfter: probeAfter.processLive,
  };

  if (poke.delivered && !probeAfter.processLive) {
    result.delivered = false;
    result.reason = "bg job not live after poke teardown";
  }

  console.log(JSON.stringify(result, null, 2));
  if (result.outputTail) {
    console.log("--- PTY output tail ---\n" + result.outputTail);
  }

  if (spawn) {
    console.log(`\nCleanup: ${config.claudeCommand} stop ${sessionId}`);
    console.log(`Room: ${cwd}`);
  }

  process.exit(result.delivered ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
