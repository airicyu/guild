/**
 * Spawn Claude Code --bg sessions for PO and discovery intake lead.
 *
 * Parses `backgrounded · {hex}` from spawn output; fallback polls agents --json after 500ms.
 * sessionCommands builds attach/resume/stop/respawn/logs strings for API responses.
 */
import type { Config } from "../../config";
import { discoveryRoomPath, missionRoomPath, poSessionName, discoverySessionName } from "../../paths";
import type { ClaudeSession } from "../../types/mission";

const SPAWN_LINE = /backgrounded · ([a-f0-9]+)(?: · (.+))?/;

interface AgentRecord {
  id: string;
  name?: string;
  cwd?: string;
  kind?: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function spawnCommand(config: Config, sessionName: string, prompt: string): string[] {
  const args = [
    config.claudeCommand,
    "--bg",
    "-n",
    sessionName,
    "--permission-mode",
    config.claudePermissionMode,
    prompt,
  ];
  // Prompt must come before --dangerously-load-development-channels; otherwise
  // Claude parses the prompt text as another channel server entry and exits 1.
  if (config.claudeDevChannels) {
    args.push("--dangerously-load-development-channels", "server:guild-channel");
  }
  if (process.platform === "win32") {
    return ["cmd", "/c", ...args];
  }
  return args;
}

function agentsCommand(config: Config): string[] {
  if (process.platform === "win32") {
    return ["cmd", "/c", config.claudeCommand, "agents", "--json"];
  }
  return [config.claudeCommand, "agents", "--json"];
}

/** Spawn `claude --bg` in cwd; parse short id from output or agents poll. */
export async function spawnBackgroundSession(
  config: Config,
  input: { sessionName: string; cwd: string; prompt: string },
): Promise<ClaudeSession> {
  const { sessionName, cwd, prompt } = input;

  const proc = Bun.spawn({
    cmd: spawnCommand(config, sessionName, prompt),
    cwd,
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
    throw new Error(`Spawn failed (exit ${exitCode}): ${stderr || stdout}`);
  }

  const combined = `${stdout}\n${stderr}`;
  const parsed = parseSpawnOutput(combined, sessionName);
  if (parsed) {
    return {
      id: parsed.id,
      name: parsed.name ?? sessionName,
      cwd,
      status: "running",
    };
  }

  const fromAgents = await findSessionViaAgents(config, sessionName, cwd);
  if (fromAgents) return fromAgents;

  throw new Error(`Could not parse session id from spawn output: ${combined.trim()}`);
}

/** Spawn PO background session in mission room with handoff prompt. */
export async function spawnPoSession(
  config: Config,
  missionId: string,
  prompt: string,
): Promise<ClaudeSession> {
  const sessionName = poSessionName(missionId);
  const cwd = missionRoomPath(config, missionId);
  return spawnBackgroundSession(config, { sessionName, cwd, prompt });
}

/** Spawn discovery intake lead background session in discovery room. */
export async function spawnDiscoveryLead(
  config: Config,
  ideaId: string,
  prompt: string,
): Promise<ClaudeSession> {
  const sessionName = discoverySessionName(ideaId);
  const cwd = discoveryRoomPath(config, ideaId);
  return spawnBackgroundSession(config, { sessionName, cwd, prompt });
}

function parseSpawnOutput(output: string, fallbackName: string): { id: string; name?: string } | null {
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(SPAWN_LINE);
    if (match) return { id: match[1], name: match[2] ?? fallbackName };
  }
  return null;
}

async function findSessionViaAgents(
  config: Config,
  sessionName: string,
  cwd: string,
): Promise<ClaudeSession | null> {
  await Bun.sleep(500);

  const proc = Bun.spawn({
    cmd: agentsCommand(config),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  let records: AgentRecord[];
  try {
    records = JSON.parse(stdout) as AgentRecord[];
  } catch {
    return null;
  }

  const targetCwd = normalizePath(cwd);
  const match = records.find(
    (r) =>
      r.kind === "background" &&
      r.name === sessionName &&
      r.cwd &&
      normalizePath(r.cwd) === targetCwd,
  );

  if (!match?.id) return null;

  return {
    id: match.id,
    name: match.name ?? sessionName,
    cwd,
    status: "running",
  };
}

/** Build attach/resume/stop/respawn/logs CLI strings for API session responses. */
export function sessionCommands(
  session: Pick<ClaudeSession, "id" | "name" | "cwd">,
  claudeCommand: string,
) {
  return {
    id: session.id,
    name: session.name,
    cwd: session.cwd,
    attachCmd: `${claudeCommand} attach ${session.id}`,
    resumeCmd: `${claudeCommand} -r ${session.name}`,
    stopCmd: `${claudeCommand} stop ${session.id}`,
    respawnCmd: `${claudeCommand} respawn ${session.id}`,
    logsCmd: `${claudeCommand} logs ${session.id}`,
  };
}
