/**
 * Thin wrappers around Claude CLI — agents list, stop, respawn, running checks.
 *
 * isSessionRunning = presence in `claude agents --json` background list (not job-state file).
 * Windows invokes via cmd /c. tryRespawnSession swallows failures (returns false).
 */
import type { Config } from "../../config";

function claudeCmd(config: Config, args: string[]): string[] {
  if (process.platform === "win32") {
    return ["cmd", "/c", config.claudeCommand, ...args];
  }
  return [config.claudeCommand, ...args];
}

function agentsCmd(config: Config): string[] {
  return claudeCmd(config, ["agents", "--json"]);
}

async function runClaude(config: Config, args: string[]): Promise<string> {
  const proc = Bun.spawn({
    cmd: claudeCmd(config, args),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(
      `${config.claudeCommand} ${args.join(" ")} failed (exit ${exitCode}): ${stderr || stdout}`.trim(),
    );
  }

  return `${stdout}\n${stderr}`.trim();
}

export interface BackgroundAgent {
  id: string;
  sessionId?: string;
  name?: string;
  cwd?: string;
}

interface AgentRecord {
  id: string;
  sessionId?: string;
  name?: string;
  cwd?: string;
  kind?: string;
}

/** Parse `claude agents --json`; null when CLI fails or output is invalid. */
export async function listBackgroundAgents(config: Config): Promise<BackgroundAgent[] | null> {
  const proc = Bun.spawn({
    cmd: agentsCmd(config),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return null;

  try {
    const records = JSON.parse(stdout) as AgentRecord[];
    return records
      .filter((r) => r.kind === "background" && r.id)
      .map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        name: r.name,
        cwd: r.cwd,
      }));
  } catch {
    return null;
  }
}

/** Find a background agent by short id from the agents list. */
export async function findBackgroundAgent(
  config: Config,
  shortId: string,
): Promise<BackgroundAgent | null> {
  const agents = await listBackgroundAgents(config);
  if (!agents) return null;
  return agents.find((a) => a.id === shortId) ?? null;
}

/** Run `claude stop {sessionId}` — kills the background job. */
export async function stopSession(config: Config, sessionId: string): Promise<void> {
  await runClaude(config, ["stop", sessionId]);
}

/** Run `claude respawn {sessionId}` — restart a stopped background job. */
export async function respawnSession(config: Config, sessionId: string): Promise<void> {
  await runClaude(config, ["respawn", sessionId]);
}

/** True when short id appears in `claude agents --json` background list. */
export async function isSessionRunning(config: Config, sessionId: string): Promise<boolean> {
  const agent = await findBackgroundAgent(config, sessionId);
  return agent !== null;
}

/** Respawn then re-probe; returns false on any failure (non-throwing). */
export async function tryRespawnSession(config: Config, sessionId: string): Promise<boolean> {
  try {
    await respawnSession(config, sessionId);
    return isSessionRunning(config, sessionId);
  } catch {
    return false;
  }
}
