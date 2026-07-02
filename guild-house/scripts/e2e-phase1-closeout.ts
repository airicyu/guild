#!/usr/bin/env bun
/**
 * Phase 1 E2E — close-out lifecycle (approve / reject / abort / mission_complete gate).
 *
 * Bootstraps three synthetic working missions (no PO spawn), exercises REST API.
 * Optional: --keep to leave test missions on disk after run.
 *
 * Usage:
 *   bun scripts/e2e-phase1-closeout.ts
 *   bun scripts/e2e-phase1-closeout.ts --keep
 *
 * Requires API at GUILD_HOUSE_URL (starts none — run `bun run dev` separately or use wrapper).
 */
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";
import { buildCheckpoint, writeCheckpoint } from "../src/orchestrator/mission/checkpoint";
import { listBoard } from "../src/orchestrator/core/board";
import {
  missionBoardEntryPath,
  missionBoardPath,
  missionRoomPath,
  missionRoomTemplatePath,
} from "../src/paths";

const KEEP = process.argv.includes("--keep");
const BASE = process.env.GUILD_HOUSE_URL ?? "http://127.0.0.1:3847";
const AUTH = `Bearer ${config.apiKey}`;
const TS = Date.now().toString(36);

const IDS = {
  success: `e2e-p1-success-${TS}`,
  reject: `e2e-p1-reject-${TS}`,
  abort: `e2e-p1-abort-${TS}`,
} as const;

type StepResult = { name: string; ok: boolean; detail?: string };

const results: StepResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
  throw new Error(detail);
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: AUTH,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = { raw: await res.text() };
  }
  return { status: res.status, json };
}

async function setupMission(missionId: string, phase: "running" | "awaiting_artifact_review"): Promise<void> {
  const boardDir = missionBoardEntryPath(config, "working", missionId);
  await mkdir(boardDir, { recursive: true });

  const exampleBrief = join(config.projectRoot, "templates", "mission-board", "mission.md.example");
  await cp(exampleBrief, join(boardDir, "mission.md"));

  const roomPath = missionRoomPath(config, missionId);
  const templatePath = missionRoomTemplatePath(config);
  await mkdir(roomPath, { recursive: true });
  await cp(templatePath, roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });
  await cp(join(boardDir, "mission.md"), join(roomPath, "memories", "common", "mission-brief.md"));

  const checkpoint = buildCheckpoint({
    missionId,
    phase,
    session: {
      id: `e2e-${missionId.slice(-8)}`,
      name: `mission-${missionId}-po`,
      cwd: roomPath,
      status: "stopped",
      job_state: "missing",
    },
  });
  await writeCheckpoint(config, missionId, checkpoint);
}

async function cleanup(): Promise<void> {
  if (KEEP) {
    console.log("\n--keep: test missions left on disk:", Object.values(IDS).join(", "));
    return;
  }
  const { rm } = await import("node:fs/promises");
  const board = await listBoard(config);
  for (const id of Object.values(IDS)) {
    for (const stage of ["working", "done", "aborted", "archive"] as const) {
      if (board[stage].includes(id)) {
        await rm(missionBoardEntryPath(config, stage, id), { recursive: true, force: true });
      }
    }
    await rm(missionRoomPath(config, id), { recursive: true, force: true });
  }
}

async function assertHealth(): Promise<void> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) fail("GET /health", `status ${res.status}`);
  const json = (await res.json()) as { version?: string };
  if (json.version !== "0.17.0") {
    fail("API version", `expected 0.17.0, got ${json.version ?? "?"}`);
  }
  pass("GET /health", `version ${json.version}`);
}

async function testSuccessPath(): Promise<void> {
  const id = IDS.success;
  console.log(`\n[success path] ${id}`);

  // Gate: mission_complete from running must fail
  {
    const { status, json } = await api("POST", `/missions/${id}/signals`, {
      type: "mission_complete",
      by: "project-owner",
    });
    if (status !== 400) {
      fail("mission_complete gate", `expected 400 from running, got ${status}: ${JSON.stringify(json)}`);
    }
    pass("mission_complete rejected from running");
  }

  // PO signals QA ready
  {
    const { status, json } = await api("POST", `/missions/${id}/signals`, {
      type: "artifacts_ready_for_review",
      summary: "E2E QA pass",
      by: "project-owner",
    });
    const cp = json.checkpoint as { phase?: string } | undefined;
    if (status !== 200 || cp?.phase !== "awaiting_artifact_review") {
      fail("artifacts_ready_for_review", `${status} ${JSON.stringify(json)}`);
    }
    pass("artifacts_ready_for_review", "phase awaiting_artifact_review");
  }

  // Approve must fail before review phase — test on abort mission still running
  // Guild master approve
  {
    const { status, json } = await api("POST", `/missions/${id}/approve-artifacts`);
    const cp = json.checkpoint as { phase?: string } | undefined;
    const notify = json.notify as { channel?: { delivered?: boolean } } | undefined;
    if (status !== 200 || cp?.phase !== "releasing") {
      fail("approve-artifacts", `${status} ${JSON.stringify(json)}`);
    }
    pass("approve-artifacts", `phase releasing, channel delivered=${notify?.channel?.delivered ?? false}`);

    const inbox = await readFile(join(missionRoomPath(config, id), "inbox.md"), "utf8");
    if (!inbox.includes("approved artifacts")) {
      fail("inbox after approve", "missing directive text");
    }
    pass("inbox.md written on approve");
  }

  // PO still on working board
  {
    const board = await listBoard(config);
    if (!board.working.includes(id)) fail("board after approve", "mission left working");
    pass("mission stays on working after approve");
  }

  // Release + retro signals
  for (const [type, expectPhase] of [
    ["artifact_release_complete", "retrospective"],
    ["retrospective_complete", "retrospective"],
  ] as const) {
    const { status, json } = await api("POST", `/missions/${id}/signals`, {
      type,
      by: "project-owner",
    });
    const cp = json.checkpoint as { phase?: string } | undefined;
    if (status !== 200 || cp?.phase !== expectPhase) {
      fail(type, `${status} ${JSON.stringify(json)}`);
    }
    pass(type, `phase ${expectPhase}`);
  }

  // Final dismiss
  {
    const { status, json } = await api("POST", `/missions/${id}/signals`, {
      type: "mission_complete",
      by: "project-owner",
    });
    const cp = json.checkpoint as { phase?: string } | undefined;
    if (status !== 200 || cp?.phase !== "done") {
      fail("mission_complete", `${status} ${JSON.stringify(json)}`);
    }
    pass("mission_complete", "phase done");
  }

  {
    const board = await listBoard(config);
    if (!board.done.includes(id) || board.working.includes(id)) {
      fail("board after complete", `done=${board.done.includes(id)} working=${board.working.includes(id)}`);
    }
    pass("working → done board move");
  }

  {
    const { status } = await api("POST", `/missions/${id}/archive`);
    if (status !== 200) fail("archive from done", `status ${status}`);
    const board = await listBoard(config);
    if (!board.archive.includes(id)) fail("archive board", "not on archive");
    pass("archive from done");
  }
}

async function testRejectPath(): Promise<void> {
  const id = IDS.reject;
  console.log(`\n[reject path] ${id}`);

  {
    const { status, json } = await api("POST", `/missions/${id}/signals`, {
      type: "artifacts_ready_for_review",
      by: "project-owner",
    });
    if (status !== 200) fail("reject setup signal", JSON.stringify(json));
  }

  {
    const { status, json } = await api("POST", `/missions/${id}/reject-artifacts`, {
      reason: "E2E: acceptance criteria not met",
    });
    const cp = json.checkpoint as { phase?: string; awaiting_guild_master?: boolean } | undefined;
    if (status !== 200 || cp?.phase !== "blocked" || !cp?.awaiting_guild_master) {
      fail("reject-artifacts", `${status} ${JSON.stringify(json)}`);
    }
    pass("reject-artifacts", "phase blocked, awaiting_guild_master");

    const board = await listBoard(config);
    if (!board.working.includes(id)) fail("reject board", "left working");
    pass("reject stays on working board");
  }

  // Cleanup reject mission to archive via abort after rework simulation — or just rm in cleanup
  {
    const { status } = await api("POST", `/missions/${id}/abort`, { reason: "E2E cleanup after reject test" });
    if (status !== 200) fail("abort after reject", `status ${status}`);
    pass("abort after reject (cleanup)");
  }
}

async function testAbortPath(): Promise<void> {
  const id = IDS.abort;
  console.log(`\n[abort path] ${id}`);

  {
    const { status, json } = await api("POST", `/missions/${id}/abort`, {
      reason: "E2E: meaningless mission",
    });
    const cp = json.checkpoint as { phase?: string } | undefined;
    if (status !== 200 || cp?.phase !== "aborted") {
      fail("abort", `${status} ${JSON.stringify(json)}`);
    }
    pass("abort", "phase aborted");

    const board = await listBoard(config);
    if (!board.aborted.includes(id) || board.working.includes(id)) {
      fail("abort board", `aborted=${board.aborted.includes(id)}`);
    }
    pass("working → aborted board move");

    const notePath = join(missionRoomPath(config, id), "retrospective", "abort-note.md");
    try {
      await stat(notePath);
      const note = await readFile(notePath, "utf8");
      if (!note.includes("meaningless mission")) fail("abort-note", "missing reason");
      pass("retrospective/abort-note.md written");
    } catch {
      fail("abort-note", "file missing");
    }
  }

  {
    const { status } = await api("POST", `/missions/${id}/archive`);
    if (status !== 200) fail("archive from aborted", `status ${status}`);
    const board = await listBoard(config);
    if (!board.archive.includes(id)) fail("archive aborted", "not on archive");
    pass("archive from aborted");
  }
}

async function testWrongPhaseApprove(): Promise<void> {
  // abort mission already terminal — approve on running mission that's not awaiting review
  const id = IDS.abort;
  const { status } = await api("POST", `/missions/${id}/approve-artifacts`);
  if (status !== 404 && status !== 409) {
    fail("approve wrong phase", `expected 404/409, got ${status}`);
  }
  pass("approve-artifacts rejected when not on working / wrong phase");
}

async function main(): Promise<void> {
  console.log("Phase 1 close-out E2E");
  console.log(`API: ${BASE}`);

  await assertHealth();

  // Ensure aborted board exists
  await mkdir(missionBoardPath(config, "aborted"), { recursive: true });

  console.log("\n[setup] synthetic working missions");
  await setupMission(IDS.success, "running");
  await setupMission(IDS.reject, "running");
  await setupMission(IDS.abort, "running");
  pass("setup 3 missions on working board");

  await testSuccessPath();
  await testRejectPath();
  await testAbortPath();
  await testWrongPhaseApprove();

  await cleanup();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"=".repeat(50)}`);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.length} step(s)`);
    process.exit(1);
  }
  console.log(`PASSED: ${results.length} steps`);
}

main().catch((err) => {
  console.error("\nE2E aborted:", err instanceof Error ? err.message : err);
  cleanup().finally(() => process.exit(1));
});
