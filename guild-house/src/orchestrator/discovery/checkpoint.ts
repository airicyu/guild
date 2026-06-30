/**
 * Discovery checkpoint.yaml — orchestrator-only (parallel to mission checkpoint.ts).
 *
 * Default phase exploring. Intake lead uses POST /discoveries/:id/signals, not direct edits.
 */
import { readFile, writeFile } from "node:fs/promises";
import type { Config } from "../../config";
import { discoveryCheckpointPath } from "../../paths";
import type {
  DiscoveryCheckpoint,
  DiscoveryLastSignal,
  DiscoveryPhase,
} from "../../types/discovery";
import type { ClaudeSession } from "../../types/mission";
import {
  applySessionLine,
  pickBareValue,
  pickQuotedValue,
  serializeLastSignal,
  serializeSession,
} from "../core/checkpoint-yaml";

/** Build initial discovery checkpoint for a newly picked-up idea. */
export function buildDiscoveryCheckpoint(input: {
  ideaId: string;
  session: ClaudeSession;
  phase?: DiscoveryPhase;
  pickedUpAt?: string;
}): DiscoveryCheckpoint {
  return {
    idea_id: input.ideaId,
    claude_session: input.session,
    phase: input.phase ?? "exploring",
    awaiting_guild_master: false,
    inbox_pending: false,
    picked_up_at: input.pickedUpAt ?? new Date().toISOString(),
    last_signal: null,
  };
}

/** Serialize discovery checkpoint to YAML string. */
export function serializeDiscoveryCheckpoint(checkpoint: DiscoveryCheckpoint): string {
  const lines = [
    serializeSession(checkpoint.claude_session),
    "",
    `idea_id: "${checkpoint.idea_id}"`,
    `phase: ${checkpoint.phase}`,
    `awaiting_guild_master: ${checkpoint.awaiting_guild_master}`,
    `inbox_pending: ${checkpoint.inbox_pending}`,
    `picked_up_at: "${checkpoint.picked_up_at}"`,
  ];

  if (checkpoint.last_signal) {
    lines.push("", serializeLastSignal(checkpoint.last_signal));
  }

  return `${lines.join("\n")}\n`;
}

/** Write discovery checkpoint.yaml — orchestrator-only. */
export async function writeDiscoveryCheckpoint(
  config: Config,
  ideaId: string,
  checkpoint: DiscoveryCheckpoint,
): Promise<void> {
  await writeFile(discoveryCheckpointPath(config, ideaId), serializeDiscoveryCheckpoint(checkpoint), "utf8");
}

/** Read discovery checkpoint.yaml; null when missing. */
export async function readDiscoveryCheckpoint(
  config: Config,
  ideaId: string,
): Promise<DiscoveryCheckpoint | null> {
  try {
    return parseDiscoveryCheckpoint(await readFile(discoveryCheckpointPath(config, ideaId), "utf8"), ideaId);
  } catch {
    return null;
  }
}

/** Parse discovery checkpoint YAML from raw string. */
export function parseDiscoveryCheckpoint(raw: string, fallbackIdeaId: string): DiscoveryCheckpoint {
  const session: Partial<ClaudeSession> = { cwd: "" };
  let ideaId = fallbackIdeaId;
  let phase: DiscoveryPhase = "exploring";
  let awaitingGuildMaster = false;
  let inboxPending = false;
  let pickedUpAt = "";
  let lastSignal: DiscoveryLastSignal | null = null;
  let inLastSignal = false;
  const signalDraft: Partial<DiscoveryLastSignal> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed === "last_signal:") {
      inLastSignal = true;
      continue;
    }

    if (inLastSignal) {
      if (!line.startsWith("  ") && !line.startsWith("\t")) {
        inLastSignal = false;
      } else {
        const child = trimmed;
        if (child.startsWith("at:")) signalDraft.at = pickQuotedValue(child);
        else if (child.startsWith("by:")) signalDraft.by = pickQuotedValue(child);
        else if (child.startsWith("type:")) signalDraft.type = pickBareValue(child);
        else if (child.startsWith("summary:")) signalDraft.summary = pickQuotedValue(child);
        continue;
      }
    }

    applySessionLine(session, trimmed);
    if (trimmed.startsWith("idea_id:")) ideaId = pickQuotedValue(trimmed);
    else if (trimmed.startsWith("phase:")) phase = pickBareValue(trimmed) as DiscoveryPhase;
    else if (trimmed.startsWith("awaiting_guild_master:"))
      awaitingGuildMaster = pickBareValue(trimmed) === "true";
    else if (trimmed.startsWith("awaiting_eric:"))
      awaitingGuildMaster = pickBareValue(trimmed) === "true";
    else if (trimmed.startsWith("inbox_pending:")) inboxPending = pickBareValue(trimmed) === "true";
    else if (trimmed.startsWith("picked_up_at:")) pickedUpAt = pickQuotedValue(trimmed);
  }

  if (signalDraft.at && signalDraft.by && signalDraft.type) {
    lastSignal = {
      at: signalDraft.at,
      by: signalDraft.by,
      type: signalDraft.type,
      summary: signalDraft.summary,
    };
  }

  if (!session.id || !session.name || !session.cwd) {
    throw new Error(`Invalid discovery checkpoint for ${fallbackIdeaId}`);
  }

  return {
    idea_id: ideaId,
    claude_session: {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      status: session.status ?? "running",
      session_id: session.session_id,
      job_state: session.job_state,
      synced_at: session.synced_at,
    },
    phase,
    awaiting_guild_master: awaitingGuildMaster,
    inbox_pending: inboxPending,
    picked_up_at: pickedUpAt,
    last_signal: lastSignal,
  };
}
