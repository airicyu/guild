#!/usr/bin/env bun
/**
 * Phase 0 PoC: guild-channel delivers orchestrator POST → live --bg PO session.
 *
 * Modes:
 *   --http-only     Scaffold room, run channel server, verify auth + POST (no Claude)
 *   --verify-logs   After POST, poll `claude logs` for <channel> tag (do not attach meanwhile)
 *   (default)       Spawn PO, wait for endpoint, POST → pass (no logs poll; avoids TTY clash with attach)
 *
 * Prerequisites (full mode):
 *   - CLAUDE_DEV_CHANNELS=1 in .env
 *   - claude 2.1.80+
 *   - Approve guild-channel MCP on first spawn if prompted
 *
 * Usage:
 *   bun scripts/poc-guild-channel.ts --http-only
 *   bun scripts/poc-guild-channel.ts
 *   bun scripts/poc-guild-channel.ts --verify-logs   # optional; never attach same session while polling
 */
import { cp, mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config";
import { missionExecutionTemplatePath, missionRoomPath, poSessionName } from "../src/paths";
import { spawnBackgroundSession } from "../src/orchestrator/core/spawn";

const HTTP_ONLY = process.argv.includes("--http-only");
const VERIFY_LOGS = process.argv.includes("--verify-logs");
const FRESH_ROOM = process.argv.includes("--fresh");
/** Reuse room with approved MCP; override: POC_MISSION_ID=channel-poc-mr3mts83 */
const MISSION_ID =
  process.env.POC_MISSION_ID ??
  (FRESH_ROOM ? `channel-poc-${Date.now().toString(36)}` : "channel-poc-mr3mts83");
const ENDPOINT_PATH = join(missionRoomPath(config, MISSION_ID), ".guild", "channel-endpoint.json");
const POLL_MS = 500;
const ENDPOINT_TIMEOUT_MS = 60_000;
const LOGS_POLL_MS = 2000;
const LOGS_TIMEOUT_MS = 120_000;

async function checkClaudeVersion(): Promise<void> {
  const proc = Bun.spawn({
    cmd: [config.claudeCommand, "--version"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const version = (await new Response(proc.stdout).text()).trim();
  await proc.exited;
  console.log(`Claude: ${version}`);
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    console.warn("Could not parse Claude version — continue at your own risk");
    return;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major < 2 || (major === 2 && minor < 1) || (major === 2 && minor === 1 && patch < 80)) {
    throw new Error(`Claude Code 2.1.80+ required for channels (got ${version})`);
  }
}

async function assertMcpReady(roomPath: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: [config.claudeCommand, "mcp", "list"],
    cwd: roomPath,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  if (!output.includes("guild-channel")) {
    console.error("guild-channel MCP not found — check templates/mission-room/.mcp.json");
    process.exit(1);
  }
  if (output.includes("Pending approval")) {
    console.error(`
guild-channel MCP is ⏸ Pending approval in this mission room.
Background (--bg) sessions cannot approve MCP — that is why PoC times out.

Run ONCE in an interactive session (same directory):

  cd ${roomPath}
  claude --dangerously-load-development-channels server:guild-channel

When prompted → choose 2 (all future MCP in this project).
Then Ctrl+C and re-run: bun scripts/poc-guild-channel.ts

Note: trusting guild-house root does NOT approve MCP in data/mission-rooms/* — each new room needs this once.
Reusing room channel-poc-trusted avoids repeating (default; omit --fresh).
`);
    process.exit(1);
  }
}

async function scaffoldPocRoom(): Promise<string> {
  const roomPath = missionRoomPath(config, MISSION_ID);
  const templatePath = missionExecutionTemplatePath(config);
  try {
    await readFile(join(roomPath, ".mcp.json"), "utf8");
    if (!FRESH_ROOM) {
      console.log(`Reusing POC room: ${roomPath}`);
      return roomPath;
    }
  } catch {
    // scaffold below
  }
  await mkdir(roomPath, { recursive: true });
  await cp(templatePath, roomPath, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith("README.md"),
  });
  console.log(`Scaffolded POC room: ${roomPath}`);
  return roomPath;
}

async function clearChannelEndpoint(): Promise<void> {
  try {
    await unlink(ENDPOINT_PATH);
  } catch {
    // no stale file
  }
}

async function readEndpointFromDisk(): Promise<{ host: string; port: number } | null> {
  try {
    const raw = await readFile(ENDPOINT_PATH, "utf8");
    const parsed = JSON.parse(raw) as { host?: string; port?: number };
    if (parsed.port) {
      return { host: parsed.host ?? "127.0.0.1", port: parsed.port };
    }
  } catch {
    // not written yet
  }
  return null;
}

/** Stale channel-endpoint.json from a prior session refuses connections — probe before use. */
async function channelPortLive(endpoint: { host: string; port: number }): Promise<boolean> {
  const url = `http://${endpoint.host}:${endpoint.port}/`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: "",
    });
    return res.status === 403 || res.status === 400 || res.ok;
  } catch {
    return false;
  }
}

async function waitForEndpoint(sessionId?: string): Promise<{ host: string; port: number }> {
  const deadline = Date.now() + ENDPOINT_TIMEOUT_MS;
  let hinted = false;
  while (Date.now() < deadline) {
    const endpoint = await readEndpointFromDisk();
    if (endpoint && (await channelPortLive(endpoint))) {
      return endpoint;
    }
    if (endpoint && !hinted) {
      console.log("Found channel-endpoint.json but port not live yet (waiting for new MCP bind)…");
    }
    if (!endpoint && !hinted && sessionId) {
      hinted = true;
      console.log("");
      console.log("Still waiting for channel-endpoint.json …");
      console.log("If this times out, guild-channel MCP is likely Pending approval.");
      console.log(`  cd ${missionRoomPath(config, MISSION_ID)}`);
      console.log("  claude --dangerously-load-development-channels server:guild-channel");
      console.log("  → choose 2, Ctrl+C, re-run PoC");
      console.log("");
    }
    await Bun.sleep(POLL_MS);
  }
  throw new Error(
    `Timed out waiting for ${ENDPOINT_PATH}. Approve guild-channel MCP in the PO session and retry.`,
  );
}

async function postTestEvent(endpoint: { host: string; port: number }): Promise<void> {
  const body = {
    event: "poc_test",
    content:
      "Guild channel PoC test event. Read inbox.md if present and acknowledge you received this orchestrator directive.",
  };

  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const live = (await readEndpointFromDisk()) ?? endpoint;
    const url = `http://${live.host}:${live.port}/`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
      }
      console.log(`POST ${url} → ok`);
      return;
    } catch (err) {
      lastError = err;
      await Bun.sleep(POLL_MS);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
}

async function pollSessionLogs(sessionId: string): Promise<boolean> {
  console.log("(Do not claude attach this session while logs are polling — causes terminal garble.)");
  const deadline = Date.now() + LOGS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const proc = Bun.spawn({
      cmd: [config.claudeCommand, "logs", sessionId],
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = stripAnsi(await new Response(proc.stdout).text());
    await proc.exited;
    if (output.includes('source="guild-house"') || output.includes("<channel")) {
      console.log("Channel delivery detected in session logs.");
      console.log("--- logs excerpt ---");
      const lines = output.split(/\r?\n/).filter((l) => l.includes("channel") || l.includes("guild-house"));
      for (const line of lines.slice(-10)) console.log(line);
      return true;
    }
    await Bun.sleep(LOGS_POLL_MS);
  }
  return false;
}

async function runHttpOnlyPoc(roomPath: string): Promise<void> {
  const bunBin = process.env.BUN_BIN ?? `${process.env.HOME}/.bun/bin/bun`;
  const serverScript = join(config.projectRoot, "guild-channel", "server.ts");

  const proc = Bun.spawn({
    cmd: [bunBin, serverScript],
    cwd: roomPath,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GUILD_API_KEY: config.apiKey },
  });

  try {
    const endpoint = await waitForEndpoint();
    console.log(`Channel listening on ${endpoint.host}:${endpoint.port}`);

    const url = `http://${endpoint.host}:${endpoint.port}/`;
    const unauth = await fetch(url, { method: "POST", body: "test" });
    if (unauth.status !== 403) {
      throw new Error(`Expected 403 without auth, got ${unauth.status}`);
    }
    console.log("Unauthenticated POST → 403 (sender gate ok)");

    await postTestEvent(endpoint);
    console.log("\n✓ --http-only PoC passed (channel server + auth + POST).");
    console.log("For full E2E, run without --http-only and approve guild-channel MCP in PO session.");
  } finally {
    proc.kill();
    await proc.exited;
  }
}

async function main(): Promise<void> {
  if (HTTP_ONLY) {
    await scaffoldPocRoom();
    await runHttpOnlyPoc(missionRoomPath(config, MISSION_ID));
    return;
  }

  const pocConfig = {
    ...config,
    claudeDevChannels: config.claudeDevChannels || true,
  };
  if (!config.claudeDevChannels) {
    console.warn("CLAUDE_DEV_CHANNELS is not set — enabling for this PoC run only.");
  }

  await checkClaudeVersion();
  const roomPath = await scaffoldPocRoom();
  await assertMcpReady(roomPath);

  const prompt = [
    `You are mission ${MISSION_ID} Project Owner in a guild-channel PoC.`,
    "Your cwd is this mission room.",
    "Wait for <channel source=\"guild-house\"> events from the orchestrator.",
    "When you receive a poc_test event, reply briefly that you received it and read inbox.md if needed.",
    "Do not run the full mission handoff — this is a channel smoke test only.",
  ].join(" ");

  const sessionName = poSessionName(MISSION_ID);
  console.log(`Spawning PO session ${sessionName}…`);
  console.log("If prompted, approve the guild-channel MCP server in the PO session.");

  await clearChannelEndpoint();

  const session = await spawnBackgroundSession(pocConfig, {
    sessionName,
    cwd: roomPath,
    prompt,
  });
  console.log(`PO session id: ${session.id}`);

  console.log("Waiting for .guild/channel-endpoint.json …");
  const endpoint = await waitForEndpoint(session.id);
  console.log(`Channel listening on ${endpoint.host}:${endpoint.port}`);

  await postTestEvent(endpoint);

  if (!VERIFY_LOGS) {
    console.log("\n✓ Phase 0 PoC passed — channel accepted authenticated POST.");
    console.log("  (Channel forwarded event to PO session; confirm in attach if desired.)");
    console.log(`Cleanup: claude stop ${session.id}`);
    console.log(`Attach:  claude attach ${session.id}  (after PoC exits)`);
    console.log(`Room: ${missionRoomPath(config, MISSION_ID)}`);
    return;
  }

  console.log("Polling claude logs for channel tag …");
  const delivered = await pollSessionLogs(session.id);

  if (delivered) {
    console.log("\n✓ Phase 0 PoC passed — channel event reached PO session.");
    console.log(`Cleanup: claude stop ${session.id}`);
    console.log(`Room: ${missionRoomPath(config, MISSION_ID)}`);
    return;
  }

  console.error("\n✗ Could not confirm channel delivery in logs within timeout.");
  console.error("POST succeeded — channel server is OK. Check manually: claude attach", session.id);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
