/**
 * Mission event log (memories/common/events.jsonl) with role-based type validation.
 *
 * project-owner may write PO types; squad members write member types only.
 */
import type { Config } from "../../config";
import { join } from "node:path";
import type { EventEntry, EventType } from "../../types/mission";
import { assertMissionId } from "../core/board";
import { resolveMissionRoomPath } from "../core/room-achive";
import { appendJsonl, readJsonl } from "../core/jsonl";
import { appendDiscoveryEventEntry } from "../discovery/events";
import { readCheckpoint } from "./checkpoint";
import { isIntakePhase } from "../../types/mission";
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

async function missionEventsPath(config: Config, missionId: string): Promise<string> {
  const roomPath = await resolveMissionRoomPath(config, missionId);
  if (!roomPath) {
    throw new Error(`Missing mission room for ${missionId}`);
  }
  return join(roomPath, "memories", "common", "events.jsonl");
}

/** Read memories/common/events.jsonl for a mission. */
export async function readEvents(config: Config, missionId: string): Promise<EventEntry[]> {
  assertMissionId(missionId);
  const roomPath = await resolveMissionRoomPath(config, missionId);
  if (!roomPath) return [];
  return readJsonl<EventEntry>(join(roomPath, "memories", "common", "events.jsonl"));
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

  const checkpoint = await readCheckpoint(config, missionId);
  if (checkpoint && (checkpoint.mode === "intake" || isIntakePhase(checkpoint.phase))) {
    const intakeEntry = await appendDiscoveryEventEntry(config, missionId, {
      from: input.from.trim(),
      body: input.body.trim(),
      type: input.type.trim(),
    });
    return {
      ts: intakeEntry.ts,
      from: intakeEntry.from,
      type: intakeEntry.type as EventEntry["type"],
      body: intakeEntry.body,
    };
  }

  await ensureEventsFile(config, missionId);

  const type = validateEventType(input.from.trim(), input.type.trim());

  const entry: EventEntry = {
    ts: new Date().toISOString(),
    from: input.from.trim(),
    type,
    body: input.body.trim(),
  };

  await appendJsonl(await missionEventsPath(config, missionId), entry);
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
