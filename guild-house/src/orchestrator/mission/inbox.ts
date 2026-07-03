/**
 * Mission inbox.md — orchestrator writes guild-master directives; PO reads on restore/attach.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "../../config";
import { missionRoomPath } from "../../paths";
import { assertMissionId } from "../core/board";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";

function formatInboxBlock(directive: string): string {
  const timestamp = new Date().toISOString();
  return `\n\n---\n**${timestamp}** (guild-house)\n\n${directive.trim()}\n`;
}

/** Write or append guild-master directive to inbox.md and set inbox_pending. */
export async function writeMissionInbox(
  config: Config,
  missionId: string,
  directive: string,
  options?: { append?: boolean },
): Promise<void> {
  assertMissionId(missionId);
  const inboxPath = join(missionRoomPath(config, missionId), "inbox.md");
  const block = formatInboxBlock(directive);

  if (options?.append) {
    let existing = "";
    try {
      existing = await readFile(inboxPath, "utf8");
    } catch {
      existing = "# Inbox\n\nGuild master directives.\n";
    }
    await writeFile(inboxPath, `${existing}${block}`, "utf8");
  } else {
    await writeFile(inboxPath, `# Inbox\n\nGuild master directives.\n${block}`, "utf8");
  }

  const checkpoint = await readCheckpoint(config, missionId);
  if (checkpoint) {
    await writeCheckpoint(config, missionId, { ...checkpoint, inbox_pending: true });
  }
}
