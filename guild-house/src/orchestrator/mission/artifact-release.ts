/**
 * artifact-release.md — read status for release gate on artifact_release_complete.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionRoomPath } from "../../paths";
import { assertMissionId } from "../core/board";

function pickFrontmatterScalar(raw: string, key: string): string | null {
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = raw.slice(3, end);
  for (const line of block.split("\n")) {
    const match = line.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))\\s*$`));
    if (match) return (match[1] ?? match[2] ?? match[3]).trim();
  }
  return null;
}

/** Read artifact-release.md status frontmatter; null when file missing or unparsable. */
export async function readArtifactReleaseStatus(
  config: Config,
  missionId: string,
): Promise<string | null> {
  assertMissionId(missionId);
  const filePath = join(missionRoomPath(config, missionId), "artifact-release.md");
  try {
    const raw = await readFile(filePath, "utf8");
    return pickFrontmatterScalar(raw, "status");
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
