/**
 * Browser terminal attach over WebSocket — Bun PTY + `claude attach` in bash.
 *
 * Product contracts:
 * - One shared server PTY per resource (mission or discovery); WS clients bind to it.
 * - One active WS client per resource; new client supersedes old (attachGen cancels in-flight open).
 * - WS close kills server attach PTY only — background job keeps running.
 * - ensure*SessionLive runs on every WS open.
 */
import type { Config } from "../config";
import { ensureMissionSessionLive } from "../orchestrator/mission/session-lifecycle";
import type { MissionSessionInfo } from "../types/mission";
import {
  ATTACH_DEFAULT_COLS,
  ATTACH_DEFAULT_ROWS,
  ATTACH_LAUNCH_DELAY_MS,
  attachTerminalEnv,
  buildAttachLine,
  decodeTerminalData,
  POKE_POST_INJECT_SETTLE_MS,
  writeTerminalPokeSubmit,
} from "../orchestrator/core/attach-pty-core";
import type { ServerWebSocket, Subprocess } from "bun";

const DEFAULT_COLS = ATTACH_DEFAULT_COLS;
const DEFAULT_ROWS = ATTACH_DEFAULT_ROWS;

export type AttachPipeline = "mission" | "discovery";

export type AttachWsData = {
  pipeline: AttachPipeline;
  resourceId: string;
  /** Bound server terminal process (shared per resource while WS is active). */
  pty: Subprocess | null;
  lastCols: number;
  lastRows: number;
  /** Incremented on each open/close — cancels in-flight async attach. */
  attachGen: number;
  /** Superseded by a newer attach client — do not kill shared terminal on close. */
  superseded?: boolean;
};

export type AttachMessage =
  | { type: "chat_input"; data: string }
  | { type: "pty_resize"; cols: number; rows: number }
  | { type: "pty_output"; data: string }
  | { type: "connected"; resourceId: string; pipeline: AttachPipeline }
  | { type: "error"; message: string };

type ServerTerminal = {
  key: string;
  resourceId: string;
  pipeline: AttachPipeline;
  sessionId: string;
  proc: Subprocess;
  cols: number;
  rows: number;
  attachLaunched: boolean;
  attachLaunchTimer: ReturnType<typeof setTimeout> | null;
};

/** One attach WS client per resource — prevents StrictMode / reconnect double-PTY races. */
const activeAttachByKey = new Map<string, ServerWebSocket<AttachWsData>>();
const serverTerminals = new Map<string, ServerTerminal>();

function terminalKey(pipeline: AttachPipeline, resourceId: string): string {
  return `${pipeline}:${resourceId}`;
}


function getServerTerminal(key: string): ServerTerminal | undefined {
  return serverTerminals.get(key);
}

function broadcastToClient(key: string, message: AttachMessage): void {
  const ws = activeAttachByKey.get(key);
  if (ws) send(ws, message);
}

function isAttachCancelled(ws: ServerWebSocket<AttachWsData>, gen: number): boolean {
  return ws.data.attachGen !== gen || ws.readyState !== WebSocket.OPEN;
}

function isActiveAttach(ws: ServerWebSocket<AttachWsData>): boolean {
  const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
  const terminal = getServerTerminal(key);
  return (
    activeAttachByKey.get(key) === ws &&
    terminal !== undefined &&
    ws.data.pty === terminal.proc
  );
}

function safeAttachWrite(ws: ServerWebSocket<AttachWsData>, proc: Subprocess, data: string): void {
  if (!isActiveAttach(ws) || ws.data.pty !== proc) return;
  try {
    proc.terminal?.write(data);
  } catch (err) {
    console.warn("[attach-pty] PTY write failed:", err);
  }
}

function safeAttachResize(
  ws: ServerWebSocket<AttachWsData>,
  proc: Subprocess,
  cols: number,
  rows: number,
): void {
  if (ws.data.pty !== proc) return;
  if (cols === ws.data.lastCols && rows === ws.data.lastRows) return;

  const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
  const terminal = getServerTerminal(key);
  if (terminal) {
    terminal.cols = cols;
    terminal.rows = rows;
  }

  try {
    proc.terminal?.resize(cols, rows);
    ws.data.lastCols = cols;
    ws.data.lastRows = rows;
  } catch (err) {
    console.warn("[attach-pty] PTY resize failed:", err);
  }
}

function send(ws: ServerWebSocket<AttachWsData>, message: AttachMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function notifyClientEnded(key: string, reason: string): void {
  const ws = activeAttachByKey.get(key);
  if (!ws) return;
  send(ws, { type: "error", message: reason });
  try {
    ws.close(4100, "pty ended");
  } catch {
    // ws may already be closing
  }
}

function releaseAttach(ws: ServerWebSocket<AttachWsData>): void {
  const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
  const current = activeAttachByKey.get(key);
  if (current === ws) {
    activeAttachByKey.delete(key);
  }
}

function supersedeAttach(ws: ServerWebSocket<AttachWsData>): void {
  const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
  const existing = activeAttachByKey.get(key);
  if (existing && existing !== ws) {
    console.log(`[attach-pty] ${key} superseding previous attach client`);
    existing.data.superseded = true;
    try {
      existing.close(4000, "superseded");
    } catch {
      // ignore
    }
  }
  activeAttachByKey.set(key, ws);
}

function killServerTerminal(key: string): void {
  const terminal = serverTerminals.get(key);
  if (!terminal) return;
  serverTerminals.delete(key);
  try {
    terminal.proc.kill();
  } catch (err) {
    console.log("[attach-pty] server terminal kill error:", err);
  }
}

function launchAttachInTerminal(config: Config, terminal: ServerTerminal): void {
  if (terminal.attachLaunched) return;
  terminal.attachLaunched = true;
  if (terminal.attachLaunchTimer) {
    clearTimeout(terminal.attachLaunchTimer);
    terminal.attachLaunchTimer = null;
  }

  const attachLine = buildAttachLine(config.claudeCommand, terminal.sessionId);
  try {
    terminal.proc.terminal?.write(attachLine);
    console.log(
      `[attach-pty] ${terminal.key} launched attach at ${terminal.cols}x${terminal.rows}`,
    );
  } catch (err) {
    console.warn(`[attach-pty] ${terminal.key} failed to launch attach:`, err);
  }
}

function scheduleAttachLaunch(config: Config, terminal: ServerTerminal): void {
  if (terminal.attachLaunched || terminal.attachLaunchTimer) return;
  terminal.attachLaunchTimer = setTimeout(() => {
    terminal.attachLaunchTimer = null;
    launchAttachInTerminal(config, terminal);
  }, ATTACH_LAUNCH_DELAY_MS);
}

function spawnServerTerminal(
  config: Config,
  pipeline: AttachPipeline,
  resourceId: string,
  sessionId: string,
  cwd: string,
  cols = DEFAULT_COLS,
  rows = DEFAULT_ROWS,
): ServerTerminal {
  const key = terminalKey(pipeline, resourceId);

  const proc = Bun.spawn({
    cmd: ["bash", "--noprofile", "--norc"],
    terminal: {
      cols,
      rows,
      name: "xterm-256color",
      data(_terminal, data) {
        broadcastToClient(key, {
          type: "pty_output",
          data: decodeTerminalData(data),
        });
      },
    },
    cwd,
    env: attachTerminalEnv(),
  });

  const terminal: ServerTerminal = {
    key,
    resourceId,
    pipeline,
    sessionId,
    proc,
    cols,
    rows,
    attachLaunched: false,
    attachLaunchTimer: null,
  };
  serverTerminals.set(key, terminal);

  proc.exited.then((exitCode) => {
    if (serverTerminals.get(key) !== terminal) return;
    if (terminal.attachLaunchTimer) clearTimeout(terminal.attachLaunchTimer);
    serverTerminals.delete(key);
    console.log(`[attach-pty] ${key} server terminal exited code=${exitCode}`);
    const ws = activeAttachByKey.get(key);
    if (ws) {
      ws.data.pty = null;
      releaseAttach(ws);
      notifyClientEnded(key, "Terminal session ended — click Reconnect");
    }
  });

  console.log(`[attach-pty] ${key} server terminal spawned (session ${sessionId}, ${cols}x${rows})`);
  return terminal;
}

function getOrCreateServerTerminal(
  config: Config,
  pipeline: AttachPipeline,
  resourceId: string,
  sessionId: string,
  cwd: string,
  cols = DEFAULT_COLS,
  rows = DEFAULT_ROWS,
): ServerTerminal {
  const key = terminalKey(pipeline, resourceId);
  const existing = serverTerminals.get(key);
  if (existing && existing.sessionId === sessionId) {
    return existing;
  }
  if (existing) {
    killServerTerminal(key);
  }
  return spawnServerTerminal(config, pipeline, resourceId, sessionId, cwd, cols, rows);
}

export type AttachRoute = {
  pipeline: AttachPipeline;
  resourceId: string;
};

/** Parse WS attach path for mission or discovery pipeline. */
export function extractAttachRoute(pathname: string): AttachRoute | null {
  const missionMatch = pathname.match(/^\/ws\/missions\/([^/]+)\/attach$/);
  if (missionMatch) {
    return { pipeline: "mission", resourceId: decodeURIComponent(missionMatch[1]) };
  }
  const discoveryMatch = pathname.match(/^\/ws\/discoveries\/([^/]+)\/attach$/);
  if (discoveryMatch) {
    return { pipeline: "mission", resourceId: decodeURIComponent(discoveryMatch[1]) };
  }
  return null;
}
/** Validate WS upgrade via ?token= or Bearer header. */
export function validateWsAuth(config: Config, req: Request): boolean {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken === config.apiKey) return true;

  const header = req.headers.get("authorization");
  return header === `Bearer ${config.apiKey}`;
}

/** Reject WS from origins outside config.uiOrigins (no Origin header allowed). */
export function validateWsOrigin(config: Config, req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  return config.uiOrigins.includes(origin);
}

async function ensureSessionLive(
  config: Config,
  _pipeline: AttachPipeline,
  resourceId: string,
): Promise<MissionSessionInfo> {
  const result = await ensureMissionSessionLive(config, resourceId);
  return result.session;
}

function notLiveMessage(_pipeline: AttachPipeline, restoreRequired: boolean): string {
  return restoreRequired
    ? "Session is not live — restore the session first"
    : "Session is not available for attach";
}

/** WS open: ensureLive → spawn shared PTY → bind xterm stream. */
export async function handleAttachOpen(
  config: Config,
  ws: ServerWebSocket<AttachWsData>,
): Promise<void> {
  const { pipeline, resourceId } = ws.data;
  const key = terminalKey(pipeline, resourceId);
  const gen = ++ws.data.attachGen;

  try {
    const session = await ensureSessionLive(config, pipeline, resourceId);

    if (isAttachCancelled(ws, gen)) {
      console.log(`[attach-pty] ${key} open cancelled after ensureLive (gen ${gen})`);
      return;
    }

    if (!session.live || !session.attachCmd) {
      send(ws, {
        type: "error",
        message: notLiveMessage(pipeline, session.restoreRequired),
      });
      ws.close(4403, "session not live");
      return;
    }

    supersedeAttach(ws);

    if (isAttachCancelled(ws, gen)) {
      console.log(`[attach-pty] ${key} open cancelled before bind (gen ${gen})`);
      releaseAttach(ws);
      return;
    }

    const terminal = getOrCreateServerTerminal(
      config,
      pipeline,
      resourceId,
      session.id,
      session.cwd,
      ws.data.lastCols || DEFAULT_COLS,
      ws.data.lastRows || DEFAULT_ROWS,
    );

    ws.data.pty = terminal.proc;
    ws.data.lastCols = terminal.cols;
    ws.data.lastRows = terminal.rows;

    send(ws, { type: "connected", resourceId, pipeline });
    if (!terminal.attachLaunched) {
      scheduleAttachLaunch(config, terminal);
    }
    console.log(`[attach-pty] ${key} client bound to server terminal (session ${session.id})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[attach-pty] ${key} open failed:`, message);
    send(ws, { type: "error", message });
    ws.close(4500, message.slice(0, 123));
  }
}

/** Forward browser keystrokes to shared attach PTY. */
export function handleAttachMessage(
  ws: ServerWebSocket<AttachWsData>,
  rawMessage: string | Buffer,
): void {
  let message: AttachMessage;
  try {
    message = JSON.parse(rawMessage.toString()) as AttachMessage;
  } catch (err) {
    console.error("[attach-pty] Failed to parse message:", err);
    return;
  }

  const proc = ws.data.pty;
  if (!proc) {
    if (message.type === "chat_input") {
      const key = terminalKey(ws.data.pipeline, ws.data.resourceId);
      notifyClientEnded(key, "Terminal is not active — click Reconnect");
    }
    return;
  }

  switch (message.type) {
    case "chat_input":
      if (message.data) safeAttachWrite(ws, proc, message.data);
      break;
    case "pty_resize":
      if (message.cols > 0 && message.rows > 0) {
        safeAttachResize(ws, proc, message.cols, message.rows);
      }
      break;
    default:
      break;
  }
}

/** True when a browser WS attach client holds the mission terminal. */
export function isMissionAttachWsActive(missionId: string): boolean {
  return activeAttachByKey.has(terminalKey("mission", missionId));
}

const ATTACH_INJECT_POLL_MS = 100;
const ATTACH_INJECT_WAIT_MS = 4000;

/**
 * Inject poke text through the live browser attach server PTY (same path as chat_input).
 * Prefer this over ephemeral poke when guild master already has Terminal tab open.
 */
export async function injectMissionAttachChatInput(
  missionId: string,
  message: string,
): Promise<{ delivered: boolean; reason?: string }> {
  const key = terminalKey("mission", missionId);
  if (!activeAttachByKey.has(key)) {
    return { delivered: false, reason: "attach not active" };
  }

  const deadline = Date.now() + ATTACH_INJECT_WAIT_MS;
  while (Date.now() < deadline) {
    const terminal = serverTerminals.get(key);
    const writer = terminal?.proc.terminal;
    if (terminal?.attachLaunched && writer) {
      await writeTerminalPokeSubmit(writer, message);
      await Bun.sleep(POKE_POST_INJECT_SETTLE_MS);
      return { delivered: true };
    }
    await Bun.sleep(ATTACH_INJECT_POLL_MS);
  }

  return { delivered: false, reason: "attach not ready" };
}

/** WS close: kill server attach PTY only — background PO job keeps running. */
export function handleAttachClose(ws: ServerWebSocket<AttachWsData>): void {
  const { pipeline, resourceId } = ws.data;
  const key = terminalKey(pipeline, resourceId);
  ws.data.attachGen++;
  ws.data.pty = null;

  if (ws.data.superseded) {
    console.log(`[attach-pty] ${key} superseded client closed — keeping server terminal`);
    releaseAttach(ws);
    return;
  }

  console.log(`[attach-pty] ${key} client disconnected — killing server terminal only`);
  releaseAttach(ws);
  killServerTerminal(key);
}
