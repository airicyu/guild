/**
 * Intake event log (memories/common/events.jsonl).
 */
import { stat, writeFile } from "node:fs/promises";
import type { Config } from "../../config";
import { eventsPath, missionRoomPath } from "../../paths";
import type {
  DiscoveryEventEntry,
  DiscoveryEventLogRequest,
  DiscoveryEventType,
} from "../../types/discovery";
import { assertNoteId } from "../core/note-id";
import { appendJsonl, readJsonl } from "../core/jsonl";

const EVENT_TYPES = new Set<DiscoveryEventType>(["note", "milestone", "status"]);

async function ensureDiscoveryEventsFile(config: Config, ideaId: string): Promise<void> {
  try {
    await readJsonl(eventsPath(config, ideaId));
  } catch {
    await writeFile(eventsPath(config, ideaId), "", "utf8");
  }
}

/** Read discovery room events.jsonl. */
export async function readDiscoveryEvents(config: Config, ideaId: string): Promise<DiscoveryEventEntry[]> {
  assertNoteId(ideaId);
  return readJsonl<DiscoveryEventEntry>(eventsPath(config, ideaId));
}

/** Append discovery event with type validation. */
export async function appendDiscoveryEventEntry(
  config: Config,
  ideaId: string,
  input: DiscoveryEventLogRequest,
): Promise<DiscoveryEventEntry> {
  assertNoteId(ideaId);

  if (!input.from.trim()) throw new Error("Missing from");
  if (!input.body.trim()) throw new Error("Missing body");
  if (!input.type?.trim()) throw new Error("Missing type");

  const type = input.type.trim() as DiscoveryEventType;
  if (!EVENT_TYPES.has(type)) {
    throw new Error(`Invalid discovery event type: ${input.type}`);
  }

  try {
    await stat(missionRoomPath(config, ideaId));
  } catch {
    throw new Error(`Discovery room not found for ${ideaId}`);
  }

  await ensureDiscoveryEventsFile(config, ideaId);

  const entry: DiscoveryEventEntry = {
    ts: new Date().toISOString(),
    from: input.from.trim(),
    type,
    body: input.body.trim(),
  };

  await appendJsonl(eventsPath(config, ideaId), entry);
  return entry;
}
