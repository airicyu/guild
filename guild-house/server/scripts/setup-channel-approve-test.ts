#!/usr/bin/env bun
/**
 * Manual E2E: guild-channel wake on Approve artifacts.
 *
 * Scaffolds a working mission at awaiting_artifact_review with a live --bg PO,
 * pre-seeded deliverable, and guild-channel endpoint. Open Web UI → Approve artifacts
 * → watch API logs ([channel-notify], [approve-artifacts]) and PO release.
 *
 * Prerequisites:
 *   - CLAUDE_DEV_CHANNELS=1 in guild-house/.env
 *   - claude 2.1.80+ on PATH
 *   - guild-channel MCP pre-approved (template settings.local.json)
 *
 * Usage:
 *   bun scripts/setup-channel-approve-test.ts
 *   bun scripts/setup-channel-approve-test.ts --keep-existing   # skip rm if mission id exists
 *
 * Cleanup:
 *   claude stop <sessionId>
 *   rm -rf data/mission-board/working/<id> data/mission-rooms/<id>
 */
import { cp, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";
import { buildCheckpoint, writeCheckpoint } from "../src/orchestrator/mission/checkpoint";
import { spawnPoSession } from "../src/orchestrator/core/spawn";
import {
  missionBoardEntryPath,
  missionRoomPath,
  missionExecutionTemplatePath,
  poSessionName,
} from "../src/paths";

const KEEP_EXISTING = process.argv.includes("--keep-existing");
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const MISSION_ID = `channel-approve-test-${DATE}-${Date.now().toString(36).slice(-6)}`;
const ENDPOINT_PATH = join(missionRoomPath(config, MISSION_ID), ".guild", "channel-endpoint.json");
const POLL_MS = 500;
const ENDPOINT_TIMEOUT_MS = 90_000;

function approveTestSpawnPrompt(missionId: string): string {
  return [
    `You are mission ${missionId} Project Owner — guild-channel approve E2E test.`,
    "Your cwd is this mission room.",
    "State is PRE-SEEDED: artifacts/demo/hello.txt exists with exact content 'Guild Phase 4 OK'.",
    "artifact-release.md mode stay, status confirmed. Phase: awaiting_artifact_review.",
    "Do NOT redo delivery or spawn squad. WAIT for guild master approve.",
    "On <channel source=\"guild-house\" event=\"artifacts_approved\"> OR inbox.md approval:",
    "1. Log milestone to memories/common/events.jsonl that you received artifacts_approved.",
    "2. Set artifact-release.md status released, signal artifact_release_complete.",
    "3. Write minimal retrospective/workflow-report.md, signal retrospective_complete, then mission_complete.",
    "Act promptly when channel or inbox shows approval.",
  ].join(" ");
}

async function clearChannelEndpoint(roomPath: string): Promise<void> {
  try {
    await unlink(join(roomPath, ".guild", "channel-endpoint.json"));
  } catch {
    // no stale file
  }
}

async function waitForEndpoint(): Promise<{ host: string; port: number }> {
  const deadline = Date.now() + ENDPOINT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const raw = await readFile(ENDPOINT_PATH, "utf8");
      const parsed = JSON.parse(raw) as { host?: string; port?: number };
      if (parsed.port) {
        const url = `http://${parsed.host ?? "127.0.0.1"}:${parsed.port}/`;
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: "",
        });
        if (res.status === 403 || res.status === 400 || res.ok) {
          return { host: parsed.host ?? "127.0.0.1", port: parsed.port };
        }
      }
    } catch {
      // not ready
    }
    await Bun.sleep(POLL_MS);
  }
  throw new Error(`Timed out waiting for ${ENDPOINT_PATH}`);
}

async function main(): Promise<void> {
  if (!config.claudeDevChannels) {
    console.warn("WARNING: CLAUDE_DEV_CHANNELS is not 1 — PO may not load guild-channel.");
  }

  const boardDir = missionBoardEntryPath(config, "working", MISSION_ID);
  const roomPath = missionRoomPath(config, MISSION_ID);
  const templatePath = missionExecutionTemplatePath(config);

  if (!KEEP_EXISTING) {
    const { rm } = await import("node:fs/promises");
    await rm(boardDir, { recursive: true, force: true });
    await rm(roomPath, { recursive: true, force: true });
  }

  await mkdir(boardDir, { recursive: true });
  const exampleBrief = join(config.projectRoot, "templates", "mission-board", "mission.md.example");
  await cp(exampleBrief, join(boardDir, "mission.md"));

  await mkdir(roomPath, { recursive: true });
  await cp(templatePath, roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });
  await cp(join(boardDir, "mission.md"), join(roomPath, "memories", "common", "mission-brief.md"));

  await mkdir(join(roomPath, "artifacts", "demo"), { recursive: true });
  await writeFile(join(roomPath, "artifacts", "demo", "hello.txt"), "Guild Phase 4 OK", "utf8");

  const releasePath = join(roomPath, "artifact-release.md");
  let release = await readFile(releasePath, "utf8");
  release = release.replace(/^status: draft/m, "status: confirmed");
  if (!release.includes("status: confirmed")) {
    release = release.replace(/^status:.*$/m, "status: confirmed");
  }
  await writeFile(releasePath, release, "utf8");

  await writeFile(
    join(roomPath, "squad.md"),
    "# Squad\n\n- evaluator (done)\n- developer\n- qa\n",
    "utf8",
  );
  await writeFile(
    join(roomPath, "memories", "common", "memory.md"),
    "# Memory\n\nChannel approve E2E — deliverable pre-seeded; awaiting guild master approve.\n",
    "utf8",
  );
  await writeFile(
    join(roomPath, "memories", "common", "events.jsonl"),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      from: "project-owner",
      type: "milestone",
      body: "E2E setup — artifacts_ready_for_review (synthetic); awaiting guild master approve.",
    })}\n`,
    "utf8",
  );

  await clearChannelEndpoint(roomPath);

  console.log(`Spawning PO for ${MISSION_ID}…`);
  const session = await spawnPoSession(config, MISSION_ID, approveTestSpawnPrompt(MISSION_ID));
  console.log(`PO session id: ${session.id}`);

  console.log("Waiting for guild-channel endpoint…");
  const endpoint = await waitForEndpoint();
  console.log(`Channel: http://${endpoint.host}:${endpoint.port}/`);

  const now = new Date().toISOString();
  const checkpoint = buildCheckpoint({
    missionId: MISSION_ID,
    phase: "awaiting_artifact_review",
    pickedUpAt: now,
    session: {
      ...session,
      name: poSessionName(MISSION_ID),
      cwd: roomPath,
      job_state: "running",
    },
  });
  checkpoint.last_signal = {
    at: now,
    by: "project-owner",
    type: "artifacts_ready_for_review",
    summary: "E2E synthetic — hello.txt ready for guild master approve",
  };
  await writeCheckpoint(config, MISSION_ID, checkpoint);

  const uiBase = process.env.GUILD_UI_ORIGIN?.split(",")[0] ?? "http://127.0.0.1:3848";
  console.log(`
✓ Channel approve test mission ready

  Mission id:   ${MISSION_ID}
  PO session:   ${session.id}
  Channel port: ${endpoint.port}
  Web UI:       ${uiBase}/missions/${MISSION_ID}

Next steps:
  1. API terminal — watch for [channel-notify] / [approve-artifacts] / [guild-master-notify]
  2. Web UI — open mission → Approve artifacts
  3. Optional attach: claude attach ${session.id}
  4. Check release: artifact-release.md status → released; phase → done

Guild-channel MCP logs (notification sent/failed) go to MCP stderr — also try:
  claude logs ${session.id} | grep -i channel

Cleanup:
  claude stop ${session.id}
  rm -rf data/mission-board/working/${MISSION_ID} data/mission-rooms/${MISSION_ID}
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
