/**
 * retrospective/ — gates for retrospective_complete and mission_complete.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionRoomPath } from "../../paths";
import { assertMissionId } from "../core/board";

const WORKFLOW_REPORT = "retrospective/workflow-report.md";

/** True when retrospective/workflow-report.md exists and is non-empty. */
export async function workflowReportExists(config: Config, missionId: string): Promise<boolean> {
  assertMissionId(missionId);
  const filePath = join(missionRoomPath(config, missionId), WORKFLOW_REPORT);
  try {
    const content = (await readFile(filePath, "utf8")).trim();
    return content.length > 0;
  } catch {
    return false;
  }
}

/** Throw when workflow-report.md is missing or empty. */
export async function requireWorkflowReport(config: Config, missionId: string): Promise<void> {
  if (!(await workflowReportExists(config, missionId))) {
    throw new Error(
      "retrospective_complete requires retrospective/workflow-report.md (non-empty)",
    );
  }
}

/** Throw when mission_complete called without prior retrospective_complete signal. */
export function requireRetrospectiveCompleteSignal(lastSignalType: string | undefined): void {
  if (lastSignalType !== "retrospective_complete") {
    throw new Error(
      "mission_complete requires retrospective_complete signal first",
    );
  }
}
