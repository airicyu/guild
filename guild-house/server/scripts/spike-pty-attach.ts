#!/usr/bin/env bun
/**
 * Bun PTY spike: claude attach stdin test (WSL/Linux)
 * Usage: bun scripts/spike-pty-attach.ts <shortId> [cwd]
 */
const shortId = process.argv[2];
const cwd = process.argv[3] ?? process.cwd();
const claudeCommand = process.env.CLAUDE_COMMAND ?? "claude";

if (!shortId) {
  console.error("Usage: bun scripts/spike-pty-attach.ts <shortId> [cwd]");
  process.exit(1);
}

console.log(`[spike] Attach: ${claudeCommand} attach ${shortId}`);
console.log(`[spike] cwd: ${cwd}`);

const proc = Bun.spawn({
  cmd: [claudeCommand, "attach", shortId],
  terminal: {
    cols: 80,
    rows: 24,
    name: "xterm-256color",
    data(_terminal, data) {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      process.stdout.write(text);
    },
  },
  cwd,
  env: {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "3",
  },
});

proc.exited.then((exitCode) => {
  console.log(`\n[spike] attach process exited code=${exitCode}`);
  process.exit(exitCode ?? 0);
});

process.stdin.setRawMode?.(true);
process.stdin.on("data", (key) => {
  proc.terminal?.write(key.toString());
});

console.log("[spike] Type here; Ctrl+C kills attach PTY only (not the PO bg job)");

process.on("SIGINT", () => {
  console.log("\n[spike] Killing attach PTY...");
  proc.kill();
});
