#!/usr/bin/env bun
/**
 * Guild 0.5.0 E2E — session poke API shape + degraded paths (no live Claude required).
 *
 * Usage:
 *   bun run dev   # separate terminal
 *   bun --env-file=../.env scripts/e2e-050-session-poke.ts
 *   bun --env-file=../.env scripts/e2e-050-session-poke.ts --live   # optional live PO poke (needs Claude)
 */
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";
import { buildCheckpoint, writeCheckpoint } from "../src/orchestrator/mission/checkpoint";
import {
  missionBoardEntryPath,
  missionExecutionTemplatePath,
  missionRoomPath,
} from "../src/paths";

const LIVE = process.argv.includes("--live");
const BASE = process.env.GUILD_HOUSE_URL ?? "http://127.0.0.1:3847";
const AUTH = `Bearer ${config.apiKey}`;
const TS = Date.now().toString(36);
const MISSION_ID = `e2e-050-poke-${TS}`;

type Step = { name: string; ok: boolean; detail?: string };
const results: Step[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
  throw new Error(detail);
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: AUTH,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

async function scaffoldCloseoutMission(): Promise<void> {
  const roomPath = missionRoomPath(config, MISSION_ID);
  await mkdir(roomPath, { recursive: true });
  await cp(missionExecutionTemplatePath(config), roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });

  const boardDir = missionBoardEntryPath(config, "working", MISSION_ID);
  await mkdir(boardDir, { recursive: true });
  await writeFile(join(boardDir, "mission.md"), `# E2E 050 poke\n`, "utf8");

  await writeCheckpoint(
    config,
    MISSION_ID,
    buildCheckpoint({
      missionId: MISSION_ID,
      phase: "awaiting_artifact_review",
      session: {
        id: `e2e-dead-${TS}`,
        name: `mission-${MISSION_ID}-po`,
        cwd: roomPath,
        status: "stopped",
        job_state: "done",
      },
    }),
  );
}

async function assertHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) fail("GET /health", `status ${res.status}`);
  const json = (await res.json()) as {
    version?: string;
    sessionPokeEnabled?: boolean;
    channelPushEnabled?: boolean;
  };
  if (!json.version?.startsWith("0.32")) {
    fail("API version", `expected 0.32.x, got ${json.version ?? "?"}`);
  }
  if (json.sessionPokeEnabled !== true) {
    fail("sessionPokeEnabled", "expected true (unset GUILD_SESSION_POKE or set non-0)");
  }
  pass("GET /health", `v${json.version} sessionPoke=${json.sessionPokeEnabled}`);
}

async function testDeadSessionApprove() {
  console.log("\n=== approve-artifacts + dead session (poke degraded) ===");

  const approve = await api("POST", `/missions/${MISSION_ID}/approve-artifacts`);
  if (approve.status !== 200) {
    fail("POST approve-artifacts", `${approve.status} ${JSON.stringify(approve.json)}`);
  }

  const notify = approve.json.notify as {
    poke?: { delivered: boolean; reason?: string };
    channel?: { delivered: boolean };
  };
  if (notify?.poke?.delivered !== false) {
    fail("notify.poke.delivered", `expected false, got ${JSON.stringify(notify?.poke)}`);
  }
  if (notify?.poke?.reason !== "session not live") {
    fail("notify.poke.reason", `expected "session not live", got ${notify?.poke?.reason}`);
  }

  const checkpoint = approve.json.checkpoint as { phase?: string };
  if (checkpoint?.phase !== "releasing") {
    fail("checkpoint.phase", `expected releasing, got ${checkpoint?.phase}`);
  }

  pass("dead session poke", notify.poke.reason);
  pass("checkpoint still updated", "phase releasing");
}

async function testLivePokeOptional() {
  if (!LIVE) {
    console.log("\n=== live poke (skipped — pass --live to run) ===");
    return;
  }

  console.log("\n=== live poke via poc script ===");
  const proc = Bun.spawn({
    cmd: ["bun", "--env-file=../.env", "scripts/poc-session-poke.ts", "--spawn"],
    cwd: join(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) fail("poc-session-poke --spawn", out.slice(-500));
  if (!out.includes('"delivered": true')) fail("live poke", "expected delivered true in output");
  pass("live idle PO poke", "poc-session-poke --spawn");
}

async function main() {
  console.log("Guild 0.5.0 session poke E2E");
  await assertHealth();
  await scaffoldCloseoutMission();
  pass("scaffold mission", MISSION_ID);
  await testDeadSessionApprove();
  await testLivePokeOptional();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
  console.log("\n✓ e2e-050-session-poke passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
