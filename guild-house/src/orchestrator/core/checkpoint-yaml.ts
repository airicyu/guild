/**
 * Shared YAML helpers for mission and discovery checkpoint.yaml (custom subset, no library).
 */
import type { ClaudeSession } from "../../types/mission";

/** Extract double-quoted YAML value; unescapes backslashes and quotes. */
export function pickQuotedValue(line: string): string {
  const match = line.match(/:\s*"(.*)"/);
  return match?.[1]?.replace(/\\\\/g, "\\").replace(/\\"/g, '"') ?? "";
}

/** Extract unquoted YAML value after the first colon. */
export function pickBareValue(line: string): string {
  return line.split(":").slice(1).join(":").trim();
}

/** Serialize claude_session block for checkpoint.yaml. */
export function serializeSession(session: ClaudeSession): string {
  const lines = [
    "claude_session:",
    `  id: "${session.id}"`,
    `  name: "${session.name}"`,
    `  cwd: "${session.cwd.replace(/\\/g, "\\\\")}"`,
    `  status: ${session.status}`,
  ];
  if (session.session_id) lines.push(`  session_id: "${session.session_id}"`);
  if (session.job_state) lines.push(`  job_state: ${session.job_state}`);
  if (session.synced_at) lines.push(`  synced_at: "${session.synced_at}"`);
  return lines.join("\n");
}

/** Serialize last_signal block for checkpoint.yaml. */
export function serializeLastSignal(signal: {
  at: string;
  by: string;
  type: string;
  summary?: string;
}): string {
  const lines = [
    "last_signal:",
    `  at: "${signal.at}"`,
    `  by: "${signal.by}"`,
    `  type: ${signal.type}`,
  ];
  if (signal.summary) {
    lines.push(`  summary: "${signal.summary.replace(/"/g, '\\"')}"`);
  }
  return lines.join("\n");
}

/** Apply one YAML line to a partial ClaudeSession during checkpoint parse. */
export function applySessionLine(session: Partial<ClaudeSession>, trimmed: string): void {
  if (trimmed.startsWith("id:") && !trimmed.startsWith("mission_id:") && !trimmed.startsWith("idea_id:")) {
    session.id = pickQuotedValue(trimmed);
  } else if (trimmed.startsWith("session_id:")) session.session_id = pickQuotedValue(trimmed);
  else if (trimmed.startsWith("name:")) session.name = pickQuotedValue(trimmed);
  else if (trimmed.startsWith("cwd:")) session.cwd = pickQuotedValue(trimmed);
  else if (trimmed.startsWith("status:")) session.status = pickBareValue(trimmed) as ClaudeSession["status"];
  else if (trimmed.startsWith("job_state:")) session.job_state = pickBareValue(trimmed) as ClaudeSession["job_state"];
  else if (trimmed.startsWith("synced_at:")) session.synced_at = pickQuotedValue(trimmed);
}
