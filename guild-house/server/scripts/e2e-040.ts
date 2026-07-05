#!/usr/bin/env bun
/**
 * Guild 0.4.0 E2E — discovery Option B + execution-only queued + close-out API.
 *
 * Does not require live Claude sessions; bootstraps filesystem where spawn may fail.
 *
 * Usage:
 *   bun run dev   # separate terminal
 *   bun scripts/e2e-040.ts
 *   bun scripts/e2e-040.ts --keep
 */
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";
import { buildCheckpoint, writeCheckpoint } from "../src/orchestrator/mission/checkpoint";
import { listBoard } from "../src/orchestrator/core/board";
import {
  buildBoardNoteMeta,
  serializeBoardNoteMeta,
  writeBoardNoteMeta,
} from "../src/orchestrator/core/board-note-meta";
import { scaffoldIntakeMission } from "../src/orchestrator/mission/intake-scaffold";
import {
  missionBoardEntryPath,
  missionExecutionTemplatePath,
  missionRoomPath,
} from "../src/paths";

const KEEP = process.argv.includes("--keep");
const BASE = process.env.GUILD_HOUSE_URL ?? "http://127.0.0.1:3847";
const AUTH = `Bearer ${config.apiKey}`;
const TS = Date.now().toString(36);

const EXEC_ONLY_ID = `e2e-040-exec-${TS}`;
const CLOSEOUT_ID = `e2e-040-close-${TS}`;

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
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = { raw: await res.text() };
  }
  return { status: res.status, json };
}

async function assertHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) fail("GET /health", `status ${res.status}`);
  const json = (await res.json()) as { version?: string };
  if (!json.version?.startsWith("0.3")) {
    fail("API version", `expected 0.30.x, got ${json.version ?? "?"}`);
  }
  pass("GET /health", `version ${json.version}`);
}

async function testDiscoveryOptionB(): Promise<{ execMissionId: string; parentId: string }> {
  console.log("\n=== 0.4.0 discovery path (Option B) ===");

  const submit = await api("POST", "/ideas", {
    text: "E2E 0.4.0 discovery — validate Option B approve spawns child to parking",
    slug: "e2e-040",
    board: "ideas",
  });
  if (submit.status !== 201) fail("POST /ideas", `${submit.status} ${JSON.stringify(submit.json)}`);
  const noteId = String(submit.json.noteId ?? submit.json.ideaId);
  pass("POST /ideas", noteId);

  const bell1 = await api("POST", "/bell");
  if (bell1.status !== 200) fail("bell (intake)", `${bell1.status}`);
  const started = (bell1.json.intakeStarted ?? bell1.json.discoveriesStarted) as string[] | undefined;
  const boardAfterBell = await listBoard(config);

  if (!boardAfterBell.discovering.includes(noteId)) {
    // Bell may fail spawn — bootstrap intake manually
    if (boardAfterBell.ideas.includes(noteId)) {
      const src = missionBoardEntryPath(config, "ideas", noteId);
      const dest = missionBoardEntryPath(config, "discovering", noteId);
      const { rename } = await import("node:fs/promises");
      await rename(src, dest);
      await scaffoldIntakeMission(config, noteId);
      await writeCheckpoint(
        config,
        noteId,
        buildCheckpoint({
          missionId: noteId,
          mode: "intake",
          noteStage: "discovering",
          phase: "mission_plan_presenting",
          session: {
            id: `e2e-lead-${TS}`,
            name: `mission-${noteId}-lead`,
            cwd: missionRoomPath(config, noteId),
            status: "stopped",
            job_state: "missing",
          },
        }),
      );
      pass("intake bootstrap (bell spawn skipped)", "manual scaffold");
    } else {
      fail("bell intake", `note not on discovering: ${JSON.stringify(bell1.json)}`);
    }
  } else {
    pass("bell → discovering", started?.includes(noteId) ? "via tick" : "already moved");
  }

  const draftDir = join(missionRoomPath(config, noteId), "artifacts", "missions", "draft-alpha");
  await mkdir(draftDir, { recursive: true });
  const example = join(config.projectRoot, "templates", "mission-board", "mission.md.example");
  await cp(example, join(draftDir, "mission.md"));
  pass("draft package", "artifacts/missions/draft-alpha/mission.md");

  const approve = await api("POST", `/missions/${noteId}/approve-discovery`);
  if (approve.status !== 200) {
    fail("approve-discovery", `${approve.status} ${JSON.stringify(approve.json)}`);
  }
  const parkingFolders = approve.json.parkingFolders as string[] | undefined;
  if (!parkingFolders?.length) fail("approve-discovery", "no parkingFolders");
  const childId = parkingFolders[0]!;
  pass("approve-discovery", `child ${childId}`);

  const board = await listBoard(config);
  if (!board.done.includes(noteId)) fail("parent on done", `done=${board.done.join(",")}`);
  pass("parent board note → done");

  const parentMeta = await readFile(
    join(missionBoardEntryPath(config, "done", noteId), "meta.yaml"),
    "utf8",
  );
  if (!parentMeta.includes("type: idea_exploring")) fail("parent meta.type", parentMeta);
  if (!parentMeta.includes("completed_at:")) fail("parent completed_at", parentMeta);
  pass("parent meta.yaml", "idea_exploring + completed_at");

  if (!board.parking.includes(childId)) fail("child on parking", board.parking.join(","));
  const childMeta = await readFile(
    join(missionBoardEntryPath(config, "parking", childId), "meta.yaml"),
    "utf8",
  );
  if (!childMeta.includes("type: work_execution")) fail("child meta.type", childMeta);
  if (!childMeta.includes(`parent_id: "${noteId}"`)) fail("child parent_id", childMeta);
  pass("child on parking", "work_execution + parent_id");

  const promote = await api("POST", `/board/parking/${childId}/promote`);
  if (promote.status !== 200) fail("promote parking→queued", `${promote.status} ${JSON.stringify(promote.json)}`);
  pass("promote → queued");

  const bell2 = await api("POST", "/bell");
  if (bell2.status !== 200) fail("bell (execution)", `${bell2.status}`);
  const startedExec = bell2.json.missionsStarted as string[] | undefined;
  const board2 = await listBoard(config);
  const workingId =
    (startedExec?.includes(childId) ? childId : startedExec?.[0]) ??
    (board2.working.includes(childId) ? childId : null);
  if (!workingId || !board2.working.includes(workingId)) {
    // Manual execution pickup if PO spawn failed
    const { rename } = await import("node:fs/promises");
    const { resolveQueuedEntryPath } = await import("../src/orchestrator/core/board.ts");
    const qsrc = await resolveQueuedEntryPath(config, childId);
    if (!qsrc) fail("queued entry for execution", childId);
    await rename(qsrc, missionBoardEntryPath(config, "working", childId));
    const room = missionRoomPath(config, childId);
    await mkdir(room, { recursive: true });
    await cp(missionExecutionTemplatePath(config), room, {
      recursive: true,
      force: true,
      filter: (s) => !s.endsWith("README.md"),
    });
    await cp(
      join(missionBoardEntryPath(config, "working", childId), "mission.md"),
      join(room, "mission-brief.md"),
    );
    await writeCheckpoint(
      config,
      childId,
      buildCheckpoint({
        missionId: childId,
        mode: "execution",
        noteStage: "working",
        phase: "working",
        parentId: noteId,
        session: {
          id: `e2e-po-${TS}`,
          name: `mission-${childId}-po`,
          cwd: room,
          status: "stopped",
          job_state: "missing",
        },
      }),
    );
    pass("execution bootstrap (bell spawn skipped)", "manual scaffold");
  } else {
    pass("bell → working", workingId);
  }

  const execMissionId = board2.working.includes(workingId) ? workingId : childId;

  const briefPath = join(missionRoomPath(config, execMissionId), "mission-brief.md");
  try {
    await stat(briefPath);
    pass("mission-brief.md at room root");
  } catch {
    fail("mission-brief.md", "missing at room root");
  }

  return { execMissionId, parentId: noteId };
}

async function testExecutionOnlyQueued(): Promise<string> {
  console.log("\n=== Execution-only (queued drop) ===");

  const entry = missionBoardEntryPath(config, "queued", EXEC_ONLY_ID);
  await mkdir(entry, { recursive: true });
  const example = join(config.projectRoot, "templates", "mission-board", "mission.md.example");
  await cp(example, join(entry, "mission.md"));
  const meta = buildBoardNoteMeta({
    noteId: EXEC_ONLY_ID,
    type: "work_execution",
    slug: "e2e-040-exec",
    origin: "submitted",
  });
  await writeBoardNoteMeta(config, "queued", meta);
  pass("queued drop", `${EXEC_ONLY_ID} + meta.yaml`);

  const bell = await api("POST", "/bell");
  if (bell.status !== 200) fail("bell exec-only", `${bell.status}`);
  const board = await listBoard(config);
  let missionId = EXEC_ONLY_ID;

  if (board.working.includes(EXEC_ONLY_ID)) {
    pass("bell → working", EXEC_ONLY_ID);
  } else {
    const minted = (bell.json.missionsStarted as string[] | undefined)?.[0];
    if (minted && board.working.includes(minted)) {
      missionId = minted;
      pass("bell → working", minted);
    } else {
      const { rename } = await import("node:fs/promises");
      await rename(entry, missionBoardEntryPath(config, "working", EXEC_ONLY_ID));
      const room = missionRoomPath(config, EXEC_ONLY_ID);
      await mkdir(room, { recursive: true });
      await cp(missionExecutionTemplatePath(config), room, { recursive: true, force: true });
      await cp(join(missionBoardEntryPath(config, "working", EXEC_ONLY_ID), "mission.md"), join(room, "mission-brief.md"));
      await writeCheckpoint(
        config,
        EXEC_ONLY_ID,
        buildCheckpoint({
          missionId: EXEC_ONLY_ID,
          mode: "execution",
          noteStage: "working",
          phase: "working",
          session: {
            id: `e2e-exec-${TS}`,
            name: `mission-${EXEC_ONLY_ID}-po`,
            cwd: room,
            status: "stopped",
            job_state: "missing",
          },
        }),
      );
      pass("exec-only bootstrap", "manual");
    }
  }

  const detail = await api("GET", `/mission-board-notes/${missionId}`);
  if (detail.status !== 200) fail("GET mission-board-notes", `${detail.status}`);
  pass("GET /mission-board-notes/:id");

  return missionId;
}

async function testCloseOut(missionId: string) {
  console.log(`\n=== Close-out API (${missionId}) ===`);

  // Ensure working phase
  const checkpointRaw = await readFile(join(missionRoomPath(config, missionId), "checkpoint.yaml"), "utf8");
  if (!checkpointRaw.includes("phase: working") && !checkpointRaw.includes("phase: evaluating")) {
    await writeCheckpoint(
      config,
      missionId,
      buildCheckpoint({
        missionId,
        mode: "execution",
        noteStage: "working",
        phase: "working",
        session: {
          id: `e2e-po-${TS}`,
          name: `mission-${missionId}-po`,
          cwd: missionRoomPath(config, missionId),
          status: "stopped",
          job_state: "missing",
        },
      }),
    );
  }

  const ready = await api("POST", `/missions/${missionId}/signals`, {
    type: "artifacts_ready_for_review",
    by: "project-owner",
  });
  const readyCp = ready.json.checkpoint as { phase?: string } | undefined;
  if (ready.status !== 200 || readyCp?.phase !== "awaiting_artifact_review") {
    fail("artifacts_ready_for_review", `${ready.status} ${JSON.stringify(ready.json)}`);
  }
  pass("artifacts_ready_for_review");

  const approve = await api("POST", `/missions/${missionId}/approve-artifacts`);
  const approveCp = approve.json.checkpoint as { phase?: string } | undefined;
  if (approve.status !== 200 || approveCp?.phase !== "releasing") {
    fail("approve-artifacts", `${approve.status} ${JSON.stringify(approve.json)}`);
  }
  pass("approve-artifacts → releasing");

  const releasePath = join(missionRoomPath(config, missionId), "mission-management", "artifact-release.md");
  let releaseFile = join(missionRoomPath(config, missionId), "artifact-release.md");
  try {
    await stat(releasePath);
    releaseFile = releasePath;
  } catch {
    // legacy root
  }
  let raw = await readFile(releaseFile, "utf8");
  raw = raw.replace(/^status:\s*\w+/m, "status: released");
  await writeFile(releaseFile, raw, "utf8");

  const release = await api("POST", `/missions/${missionId}/signals`, {
    type: "artifact_release_complete",
    by: "project-owner",
  });
  const relCp = release.json.checkpoint as { phase?: string } | undefined;
  if (release.status !== 200 || relCp?.phase !== "retrospective") {
    fail("artifact_release_complete", `${release.status} ${JSON.stringify(release.json)}`);
  }
  pass("artifact_release_complete → retrospective");

  const reportPath = join(missionRoomPath(config, missionId), "retrospective", "workflow-report.md");
  await mkdir(join(missionRoomPath(config, missionId), "retrospective"), { recursive: true });
  await cp(
    join(missionExecutionTemplatePath(config), "retrospective", "workflow-report.md"),
    reportPath,
  );

  const retro = await api("POST", `/missions/${missionId}/signals`, {
    type: "retrospective_complete",
    by: "project-owner",
  });
  if (retro.status !== 200) fail("retrospective_complete", `${retro.status}`);
  pass("retrospective_complete");

  const complete = await api("POST", `/missions/${missionId}/signals`, {
    type: "mission_complete",
    by: "project-owner",
  });
  const doneCp = complete.json.checkpoint as { phase?: string } | undefined;
  if (complete.status !== 200 || doneCp?.phase !== "done") {
    fail("mission_complete", `${complete.status} ${JSON.stringify(complete.json)}`);
  }
  pass("mission_complete → done");

  const board = await listBoard(config);
  if (!board.done.includes(missionId)) fail("board done", board.done.join(","));
  pass("board note → done");

  const archive = await api("POST", `/missions/${missionId}/archive`);
  if (archive.status !== 200) fail("archive", `${archive.status} ${JSON.stringify(archive.json)}`);
  if (!board.archive.includes(missionId)) {
    const boardAfter = await listBoard(config);
    if (!boardAfter.archive.includes(missionId)) fail("archive board", "not on archive");
  }
  pass("archive");
}

async function testBoardNoteAbort(abortId: string, parentId: string) {
  console.log("\n=== Board note abort (parking) ===");
  const id = abortId;
  const entry = missionBoardEntryPath(config, "parking", id);
  await mkdir(entry, { recursive: true });
  await writeFile(join(entry, "mission.md"), "# Abort test\n", "utf8");
  const meta = buildBoardNoteMeta({
    noteId: id,
    type: "work_execution",
    slug: "e2e-abort",
    origin: "spawned",
    parentId,
  });
  await writeFile(join(entry, "meta.yaml"), serializeBoardNoteMeta(meta), "utf8");

  const abort = await api("POST", `/mission-board-notes/${id}/abort`, { reason: "E2E abort test" });
  if (abort.status !== 200) fail("abort board note", `${abort.status} ${JSON.stringify(abort.json)}`);
  const board = await listBoard(config);
  if (!board.aborted.includes(id)) fail("aborted stage", board.aborted.join(","));
  pass("POST /mission-board-notes/:id/abort → aborted");
}

async function cleanup(ids: string[]) {
  if (KEEP) {
    console.log("\n--keep: left on disk:", ids.join(", "));
    return;
  }
  const board = await listBoard(config);
  for (const id of ids) {
    for (const stage of ["ideas-backlog", "ideas", "discovering", "parking", "queued", "working", "done", "aborted", "archive"] as const) {
      if (board[stage].includes(id)) {
        await rm(missionBoardEntryPath(config, stage, id), { recursive: true, force: true });
      }
    }
    for (const sub of ["", "archive", "achive"]) {
      const p = sub
        ? join(config.guildHome, "mission-rooms", sub, id)
        : missionRoomPath(config, id);
      try {
        await rm(p, { recursive: true, force: true });
      } catch {
        // missing
      }
    }
  }
}

/** Remove stale e2e-040-* board notes and rooms from prior runs. */
async function cleanupStaleE2e040(): Promise<void> {
  const board = await listBoard(config);
  const stale = new Set<string>();
  for (const stage of Object.keys(board) as (keyof typeof board)[]) {
    for (const id of board[stage]) {
      if (id.startsWith("e2e-040-") || id.startsWith("draft-alpha-20260705-")) {
        stale.add(id);
      }
    }
  }
  if (stale.size) await cleanup([...stale]);
}

async function main() {
  console.log("Guild 0.4.0 E2E");
  console.log(`API: ${BASE}`);

  await assertHealth();
  await cleanupStaleE2e040();

  const { execMissionId: childId, parentId } = await testDiscoveryOptionB();
  const execId = await testExecutionOnlyQueued();
  await testCloseOut(childId);
  const abortId = `e2e-040-abort-${TS}`;
  await testBoardNoteAbort(abortId, parentId);

  const allIds = [parentId, childId, execId, abortId];
  await cleanup(allIds);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"=".repeat(50)}`);
  if (failed.length) {
    console.error(`FAILED: ${failed.length}`);
    process.exit(1);
  }
  console.log(`PASSED: ${results.length} steps`);
}

main().catch((err) => {
  console.error("\nE2E aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
