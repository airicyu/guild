/**
 * Discovery team event log at discovery-rooms/{id}/events.jsonl.
 *
 * Types: note, milestone, status. No PO/member role split (unlike mission events).
 */
import { stat, writeFile } from "node:fs/promises";
import type { Config } from "../../config";
import { discoveryEventsPath, discoveryRoomPath } from "../../paths";
import type { DiscoveryEventEntry, DiscoveryEventLogRequest, DiscoveryEventType } from "../../types/discovery";
import { assertIdeaId } from "../core/idea-id";
import { appendJsonl, readJsonl } from "../core/jsonl";
import { getIdea } from "./ideas";

const EVENT_TYPES = new Set<DiscoveryEventType>(["note", "milestone", "status"]);

async function ensureDiscoveryEventsFile(config: Config, ideaId: string): Promise<void> {
  try {
    await readJsonl(discoveryEventsPath(config, ideaId));
  } catch {
    await writeFile(discoveryEventsPath(config, ideaId), "", "utf8");
  }
}

/** Read discovery room events.jsonl. */
export async function readDiscoveryEvents(config: Config, ideaId: string): Promise<DiscoveryEventEntry[]> {
  assertIdeaId(ideaId);
  return readJsonl<DiscoveryEventEntry>(discoveryEventsPath(config, ideaId));
}

/** Append discovery event with type validation. */
export async function appendDiscoveryEventEntry(
  config: Config,
  ideaId: string,
  input: DiscoveryEventLogRequest,
): Promise<DiscoveryEventEntry> {
  assertIdeaId(ideaId);

  if (!input.from.trim()) throw new Error("Missing from");
  if (!input.body.trim()) throw new Error("Missing body");
  if (!input.type?.trim()) throw new Error("Missing type");

  const type = input.type.trim() as DiscoveryEventType;
  if (!EVENT_TYPES.has(type)) {
    throw new Error(`Invalid discovery event type: ${input.type}`);
  }

  try {
    await stat(discoveryRoomPath(config, ideaId));
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

  await appendJsonl(discoveryEventsPath(config, ideaId), entry);
  return entry;
}

/** Event log summary for GET /discoveries/:id/events. */
export async function getDiscoveryEventsSummary(config: Config, ideaId: string) {
  assertIdeaId(ideaId);
  const idea = await getIdea(config, ideaId);
  if (!idea) return null;

  const entries = await readDiscoveryEvents(config, ideaId);
  return {
    ideaId,
    board: idea.board,
    entries,
    count: entries.length,
  };
}
