/**
 * Mission outbox.jsonl — team → guild master questions with read/unread tracking.
 *
 * escalateToGuildMaster appends outbox then fires blocked signal; rolls back on signal failure.
 * listUnreadOutbox scans working + archive missions and discovering ideas.
 */
import type { Config } from "../../config";
import { outboxPath } from "../../paths";
import type { Checkpoint, OutboxEntry, OutboxItem, OutboxUrgency } from "../../types/mission";
import { assertMissionId, listBoard } from "../core/board";
import { readDiscoveryOutbox } from "../discovery/outbox";
import { appendJsonl, readJsonl, writeJsonl } from "../core/jsonl";
import { handleSignal } from "./lifecycle";
import { getMission } from "./pickup";

const URGENCIES = new Set<OutboxUrgency>(["low", "normal", "high"]);

function newOutboxId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Read mission outbox.jsonl entries. */
export async function readMissionOutbox(config: Config, missionId: string): Promise<OutboxEntry[]> {
  assertMissionId(missionId);
  return readJsonl<OutboxEntry>(outboxPath(config, missionId));
}

/** Append outbox entry and set inbox_pending on checkpoint. */
export async function appendOutboxEntry(
  config: Config,
  missionId: string,
  input: {
    question: string;
    from?: string;
    urgency?: OutboxUrgency;
    context?: string;
  },
): Promise<OutboxEntry> {
  assertMissionId(missionId);

  const urgency = input.urgency ?? "normal";
  if (!URGENCIES.has(urgency)) {
    throw new Error(`Invalid urgency: ${urgency}`);
  }

  const entry: OutboxEntry = {
    id: newOutboxId(),
    ts: new Date().toISOString(),
    from: input.from ?? "project-owner",
    question: input.question,
    urgency,
    context: input.context,
    read: false,
  };

  await appendJsonl(outboxPath(config, missionId), entry);
  return entry;
}

async function removeOutboxEntry(config: Config, missionId: string, entryId: string): Promise<void> {
  const entries = await readMissionOutbox(config, missionId);
  await writeJsonl(
    outboxPath(config, missionId),
    entries.filter((entry) => entry.id !== entryId),
  );
}

/** Append outbox entry then fire blocked signal; rolls back on signal failure. */
export async function escalateToGuildMaster(
  config: Config,
  missionId: string,
  input: {
    question: string;
    from?: string;
    urgency?: OutboxUrgency;
    context?: string;
  },
): Promise<{ entry: OutboxEntry; checkpoint: Checkpoint }> {
  if (!input.question.trim()) {
    throw new Error("Missing question");
  }

  const from = input.from ?? "project-owner";
  const entry = await appendOutboxEntry(config, missionId, { ...input, from });

  try {
    const checkpoint = await handleSignal(config, missionId, {
      type: "blocked",
      by: from,
      summary: input.question,
    });
    return { entry, checkpoint };
  } catch (err) {
    await removeOutboxEntry(config, missionId, entry.id);
    throw err;
  }
}

/** Scan working + archive missions and discovering ideas for unread outbox items. */
export async function listUnreadOutbox(config: Config): Promise<OutboxItem[]> {
  const board = await listBoard(config);
  const items: OutboxItem[] = [];

  for (const missionId of [...board.working, ...board.archive]) {
    const entries = await readMissionOutbox(config, missionId);
    for (const entry of entries) {
      if (!entry.read) items.push({ ...entry, missionId });
    }
  }

  for (const ideaId of board.discovering) {
    const entries = await readDiscoveryOutbox(config, ideaId);
    for (const entry of entries) {
      if (!entry.read) items.push({ ...entry, ideaId });
    }
  }

  return items.sort((a, b) => a.ts.localeCompare(b.ts));
}

/** Outbox summary for a mission (entries + unread count). */
export async function getMissionOutboxSummary(config: Config, missionId: string) {
  assertMissionId(missionId);
  const mission = await getMission(config, missionId);
  if (!mission) return null;

  const entries = await readMissionOutbox(config, missionId);
  const unread = entries.filter((e) => !e.read);

  return {
    missionId,
    board: mission.board,
    entries,
    unreadCount: unread.length,
  };
}

/** Mark outbox entries read by id; clears inbox_pending when all read. */
export async function markOutboxRead(
  config: Config,
  missionId: string,
  ids?: string[],
): Promise<{ missionId: string; marked: number }> {
  assertMissionId(missionId);
  const mission = await getMission(config, missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);

  const entries = await readMissionOutbox(config, missionId);
  let marked = 0;

  for (const entry of entries) {
    if (entry.read) continue;
    if (ids && ids.length > 0 && !ids.includes(entry.id)) continue;
    entry.read = true;
    marked += 1;
  }

  await writeJsonl(outboxPath(config, missionId), entries);
  return { missionId, marked };
}
