/**
 * Mission event log (memories/common/events.jsonl) with role-based type validation.
 *
 * project-owner may write PO types; squad members write member types only.
 */
import type { Config } from "../../config";
import { eventsPath } from "../../paths";
import type { EventEntry, EventType } from "../../types/mission";
import { assertMissionId } from "../core/board";
import { appendJsonl, readJsonl } from "../core/jsonl";
import { getMission } from "./pickup";
import { ensureEventsFile } from "./scaffold";

const PO_EVENT_TYPES = new Set<EventType>(["milestone", "directive", "evaluator_done", "round_note"]);
const MEMBER_EVENT_TYPES = new Set<EventType>(["status", "evidence", "qa_pass", "qa_fail"]);

function isPoWriter(from: string): boolean {
  return from === "project-owner";
}

function validateEventType(from: string, type: string): EventType {
  if (!PO_EVENT_TYPES.has(type as EventType) && !MEMBER_EVENT_TYPES.has(type as EventType)) {
    throw new Error(`Invalid event type: ${type}`);
  }

  if (isPoWriter(from)) {
    if (!PO_EVENT_TYPES.has(type as EventType)) {
      throw new Error(`Invalid event type for project-owner: ${type}`);
    }
    return type as EventType;
  }

  if (!MEMBER_EVENT_TYPES.has(type as EventType)) {
    throw new Error(`Invalid event type for member ${from}: ${type}`);
  }

  return type as EventType;
}

/** Read memories/common/events.jsonl for a mission. */
export async function readEvents(config: Config, missionId: string): Promise<EventEntry[]> {
  assertMissionId(missionId);
  return readJsonl<EventEntry>(eventsPath(config, missionId));
}

/** Append event with role-based type validation (PO vs squad member). */
export async function appendEventEntry(
  config: Config,
  missionId: string,
  input: { from: string; body: string; type: string },
): Promise<EventEntry> {
  assertMissionId(missionId);

  if (!input.from.trim()) throw new Error("Missing from");
  if (!input.body.trim()) throw new Error("Missing body");
  if (!input.type?.trim()) throw new Error("Missing type");

  await ensureEventsFile(config, missionId);

  const type = validateEventType(input.from.trim(), input.type.trim());

  const entry: EventEntry = {
    ts: new Date().toISOString(),
    from: input.from.trim(),
    type,
    body: input.body.trim(),
  };

  await appendJsonl(eventsPath(config, missionId), entry);
  return entry;
}

/** Event log summary for GET /missions/:id/events. */
export async function getEventsSummary(config: Config, missionId: string) {
  assertMissionId(missionId);
  const mission = await getMission(config, missionId);
  if (!mission) return null;

  const entries = await readEvents(config, missionId);
  return {
    missionId,
    board: mission.board,
    entries,
    count: entries.length,
  };
}
