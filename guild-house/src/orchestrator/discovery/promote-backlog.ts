/**
 * Ideas-backlog → ideas promotion — one idea folder at a time (0.3.0 Phase 5).
 */
import { rename, stat } from "node:fs/promises";
import type { Config } from "../../config";
import { ideaBoardEntryPath } from "../../paths";
import { listBoard, resolveIdeasBacklogEntryPath } from "../core/board";
import { assertIdeaId } from "../core/idea-id";

/** Move ideas-backlog/{ideaId} → ideas/{ideaId} after guild master promotes. */
export async function promoteIdeasBacklogToIdeas(
  config: Config,
  ideaId: string,
): Promise<{ ideaId: string; stage: "ideas" }> {
  assertIdeaId(ideaId);

  const board = await listBoard(config);
  if (!board["ideas-backlog"].includes(ideaId)) {
    throw new Error(`Ideas-backlog entry not found: ${ideaId}`);
  }

  const src = await resolveIdeasBacklogEntryPath(config, ideaId);
  if (!src) {
    throw new Error(`Ideas-backlog folder missing on disk: ${ideaId}`);
  }

  const dest = ideaBoardEntryPath(config, "ideas", ideaId);
  try {
    await stat(dest);
    throw new Error(`Ideas entry already exists: ${ideaId}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Ideas entry already exists")) {
      throw err;
    }
    // dest missing — ok
  }

  await rename(src, dest);
  return { ideaId, stage: "ideas" };
}
