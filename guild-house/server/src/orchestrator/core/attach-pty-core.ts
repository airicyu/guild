/**
 * Shared Bun PTY helpers for browser attach and orchestrator session poke.
 *
 * Ephemeral poke spawns a dedicated short-lived PTY — never WS serverTerminals map entries.
 */
import type { Subprocess } from "bun";

export const ATTACH_DEFAULT_COLS = 80;
export const ATTACH_DEFAULT_ROWS = 24;
export const ATTACH_LAUNCH_DELAY_MS = 500;
/** Delay between message body and Enter submit (separate writes). */
export const POKE_SUBMIT_DELAY_MS = 80;
/** Wait after Enter before tearing down ephemeral poke PTY. */
export const POKE_POST_INJECT_SETTLE_MS = 1500;
export const POKE_PTY_EXIT_WAIT_MS = 2000;
export const POKE_SUBMIT_CHAR = "\r";

export type EphemeralAttachPokeResult = {
  delivered: boolean;
  reason?: string;
  durationMs?: number;
  outputTail?: string;
};

export function attachTerminalEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "3",
  };
}

export function buildAttachLine(claudeCommand: string, sessionId: string): string {
  return `${claudeCommand} attach ${sessionId}\r`;
}

export function decodeTerminalData(data: string | Uint8Array): string {
  return typeof data === "string" ? data : new TextDecoder().decode(data);
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
}

export function attachLooksReady(output: string): boolean {
  const plain = stripAnsi(output);
  if (/attached/i.test(plain)) return true;
  if (/esc to (?:exit|detach)/i.test(plain)) return true;
  if (/Connected to/i.test(plain)) return true;
  if (/❯/.test(plain)) return true;
  return false;
}

/** Stricter ready gate for ephemeral poke — avoid injecting into bash before `claude attach` settles. */
export function pokeAttachLooksReady(output: string, sinceAttachMs: number): boolean {
  const plain = stripAnsi(output);
  if (/attached/i.test(plain)) return true;
  if (/esc to (?:exit|detach)/i.test(plain)) return true;
  if (/Connected to/i.test(plain)) return true;
  if (sinceAttachMs >= 3000) return true;
  return false;
}

type TerminalWriter = { write(data: string): void };

/** Write poke message then Enter as separate PTY writes (single-buffer `\r` often does not submit). */
export async function writeTerminalPokeSubmit(
  terminal: TerminalWriter,
  message: string,
): Promise<void> {
  terminal.write(message);
  await Bun.sleep(POKE_SUBMIT_DELAY_MS);
  terminal.write(POKE_SUBMIT_CHAR);
}

export function spawnEphemeralBashPty(
  cwd: string,
  onData: (chunk: string) => void,
  cols = ATTACH_DEFAULT_COLS,
  rows = ATTACH_DEFAULT_ROWS,
): Subprocess {
  return Bun.spawn({
    cmd: ["bash", "--noprofile", "--norc"],
    terminal: {
      cols,
      rows,
      name: "xterm-256color",
      data(_terminal, data) {
        onData(decodeTerminalData(data));
      },
    },
    cwd,
    env: attachTerminalEnv(),
  });
}

export function killEphemeralPty(proc: Subprocess): void {
  try {
    proc.kill();
  } catch (err) {
    console.warn("[attach-pty-core] ephemeral PTY kill error:", err);
  }
}

export async function waitForEphemeralPtyExit(
  proc: Subprocess,
  timeoutMs = POKE_PTY_EXIT_WAIT_MS,
): Promise<void> {
  await Promise.race([proc.exited.catch(() => undefined), Bun.sleep(timeoutMs)]);
}

/**
 * Ephemeral attach poke — kill poke PTY only; background --bg job keeps running.
 */
export async function runEphemeralAttachPoke(input: {
  claudeCommand: string;
  sessionId: string;
  cwd: string;
  message: string;
  timeoutMs: number;
}): Promise<EphemeralAttachPokeResult> {
  const started = Date.now();
  const { claudeCommand, sessionId, cwd, message, timeoutMs } = input;

  let output = "";
  const proc = spawnEphemeralBashPty(cwd, (chunk) => {
    output += chunk;
    if (output.length > 32_000) output = output.slice(-24_000);
  });

  try {
    await Bun.sleep(ATTACH_LAUNCH_DELAY_MS);

    proc.terminal?.write(buildAttachLine(claudeCommand, sessionId));

    const attachStarted = Date.now();
    const injectDeadline = started + timeoutMs;
    let injected = false;

    while (Date.now() < injectDeadline) {
      const sinceAttach = Date.now() - attachStarted;
      const ready = pokeAttachLooksReady(output, sinceAttach);

      if (ready && !injected && proc.terminal) {
        await writeTerminalPokeSubmit(proc.terminal, message);
        injected = true;
        await Bun.sleep(POKE_POST_INJECT_SETTLE_MS);
        break;
      }
      await Bun.sleep(100);
    }

    if (!injected) {
      return {
        delivered: false,
        reason: "attach inject timeout",
        durationMs: Date.now() - started,
        outputTail: stripAnsi(output).slice(-800),
      };
    }

    return {
      delivered: true,
      durationMs: Date.now() - started,
      outputTail: stripAnsi(output).slice(-800),
    };
  } finally {
    killEphemeralPty(proc);
    await waitForEphemeralPtyExit(proc);
  }
}
