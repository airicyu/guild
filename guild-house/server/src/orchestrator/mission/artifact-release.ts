/**
 * artifact-release.md — read status for release gate on artifact_release_complete.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { frontmatterScalar } from "../../frontmatter";
import { missionRoomPath } from "../../paths";
import { assertMissionId } from "../core/board";

/** Read artifact-release.md status frontmatter; null when file missing or unparsable. */
export async function readArtifactReleaseStatus(
  config: Config,
  missionId: string,
): Promise<string | null> {
  assertMissionId(missionId);
  const filePath = join(missionRoomPath(config, missionId), "artifact-release.md");
  try {
    const raw = await readFile(filePath, "utf8");
    return frontmatterScalar(raw, "status");
  } catch {
    return null;
  }
}

/** Throw when status is not `released` — gate for artifact_release_complete signal. */
export async function requireArtifactReleaseReleased(config: Config, missionId: string): Promise<void> {
  const status = await readArtifactReleaseStatus(config, missionId);
  if (status !== "released") {
    throw new Error(
      `artifact_release_complete requires artifact-release.md status: released (current: ${status ?? "missing"})`,
    );
  }
}
