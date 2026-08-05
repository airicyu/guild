/**
 * Read Claude background job state from ~/.claude/jobs/{shortId}/state.json.
 *
 * Missing job dir → missing; unreadable → unknown. Complements agents-list probe.
 */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { JobState } from "../../types/mission";

export interface JobStateProbe {
  jobState: JobState;
  sessionId?: string;
}

/** Read job state from ~/.claude/jobs/{shortId}/state.json. */
export async function readJobState(shortId: string): Promise<JobStateProbe> {
  const jobDir = join(homedir(), ".claude", "jobs", shortId);

  try {
    await stat(jobDir);
  } catch {
    return { jobState: "missing" };
  }

  try {
    const raw = await readFile(join(jobDir, "state.json"), "utf8");
    const parsed = JSON.parse(raw) as { state?: string; sessionId?: string };
    const state = parsed.state;
    if (state === "running" || state === "done") {
      return { jobState: state, sessionId: parsed.sessionId };
    }
    return { jobState: "unknown", sessionId: parsed.sessionId };
  } catch {
    return { jobState: "unknown" };
  }
}
