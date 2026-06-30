/**
 * Discovery outbox.jsonl — intake lead → guild master (mirrors mission outbox).
 *
 * escalateDiscoveryToGuildMaster appends outbox + awaiting_input signal; rollback on failure.
 */
import type { Config } from "../../config";
import { discoveryOutboxPath } from "../../paths";
import type { DiscoveryCheckpoint } from "../../types/discovery";
import type { OutboxEntry, OutboxUrgency } from "../../types/mission";
import { assertIdeaId } from "../core/idea-id";
import { appendJsonl, readJsonl, writeJsonl } from "../core/jsonl";
import { getIdea } from "./ideas";
import { handleDiscoverySignal } from "./lifecycle";

const URGENCIES = new Set<OutboxUrgency>(["low", "normal", "high"]);

function newOutboxId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Read discovery outbox.jsonl entries. */
export async function readDiscoveryOutbox(config: Config, ideaId: string): Promise<OutboxEntry[]> {
  assertIdeaId(ideaId);
  return readJsonl<OutboxEntry>(discoveryOutboxPath(config, ideaId));
}

/** Append discovery outbox entry and set inbox_pending. */
export async function appendDiscoveryOutboxEntry(
  config: Config,
  ideaId: string,
  input: {
    question: string;
    from?: string;
    urgency?: OutboxUrgency;
    context?: string;
  },
): Promise<OutboxEntry> {
  assertIdeaId(ideaId);

  const urgency = input.urgency ?? "normal";
  if (!URGENCIES.has(urgency)) {
    throw new Error(`Invalid urgency: ${urgency}`);
  }

  const entry: OutboxEntry = {
    id: newOutboxId(),
    ts: new Date().toISOString(),
    from: input.from ?? "intake-lead",
    question: input.question,
    urgency,
    context: input.context,
    read: false,
  };

  await appendJsonl(discoveryOutboxPath(config, ideaId), entry);
  return entry;
}

async function removeDiscoveryOutboxEntry(
  config: Config,
  ideaId: string,
  entryId: string,
): Promise<void> {
  const entries = await readDiscoveryOutbox(config, ideaId);
  await writeJsonl(
    discoveryOutboxPath(config, ideaId),
    entries.filter((entry) => entry.id !== entryId),
  );
}

/** Append outbox then fire awaiting_input signal; rolls back on failure. */
export async function escalateDiscoveryToGuildMaster(
  config: Config,
  ideaId: string,
  input: {
    question: string;
    from?: string;
    urgency?: OutboxUrgency;
    context?: string;
  },
): Promise<{ entry: OutboxEntry; checkpoint: DiscoveryCheckpoint }> {
  if (!input.question.trim()) {
    throw new Error("Missing question");
  }

  const from = input.from ?? "intake-lead";
  const entry = await appendDiscoveryOutboxEntry(config, ideaId, { ...input, from });

  try {
    const checkpoint = await handleDiscoverySignal(config, ideaId, {
      type: "awaiting_input",
      by: from,
      summary: input.question,
    });
    return { entry, checkpoint };
  } catch (err) {
    await removeDiscoveryOutboxEntry(config, ideaId, entry.id);
    throw err;
  }
}

/** Outbox summary for a discovery idea. */
export async function getDiscoveryOutboxSummary(config: Config, ideaId: string) {
  assertIdeaId(ideaId);
  const idea = await getIdea(config, ideaId);
  if (!idea) return null;

  const entries = await readDiscoveryOutbox(config, ideaId);
  const unread = entries.filter((e) => !e.read);

  return {
    ideaId,
    board: idea.board,
    entries,
    unreadCount: unread.length,
  };
}

/** Mark discovery outbox entries read by id. */
export async function markDiscoveryOutboxRead(
  config: Config,
  ideaId: string,
  ids?: string[],
): Promise<{ ideaId: string; marked: number }> {
  assertIdeaId(ideaId);
  const idea = await getIdea(config, ideaId);
  if (!idea) throw new Error(`Idea ${ideaId} not found`);

  const entries = await readDiscoveryOutbox(config, ideaId);
  let marked = 0;

  for (const entry of entries) {
    if (entry.read) continue;
    if (ids && ids.length > 0 && !ids.includes(entry.id)) continue;
    entry.read = true;
    marked += 1;
  }

  await writeJsonl(discoveryOutboxPath(config, ideaId), entries);
  return { ideaId, marked };
}
