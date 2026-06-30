/**
 * Mission checkpoint.yaml — orchestrator-only read/write (custom YAML subset, no library).
 *
 * PO must use POST /missions/:id/signals; never edit checkpoint directly.
 * Parser accepts legacy awaiting_eric as alias for awaiting_guild_master.
 */
import { readFile, writeFile } from "node:fs/promises";
import type { Config } from "../../config";
import { checkpointPath } from "../../paths";
import type { Checkpoint, ClaudeSession, LastSignal, MissionPhase } from "../../types/mission";
import {
  applySessionLine,
  pickBareValue,
  pickQuotedValue,
  serializeLastSignal,
  serializeSession,
} from "../core/checkpoint-yaml";

/** Build initial checkpoint object for a newly picked-up mission. */
export function buildCheckpoint(input: {
  missionId: string;
  session: ClaudeSession;
  phase?: MissionPhase;
  pickedUpAt?: string;
}): Checkpoint {
  return {
    mission_id: input.missionId,
    claude_session: input.session,
    phase: input.phase ?? "evaluating",
    round: 0,
    awaiting_guild_master: false,
    inbox_pending: false,
    picked_up_at: input.pickedUpAt ?? new Date().toISOString(),
    last_signal: null,
  };
}

/** Serialize checkpoint to YAML string for disk write. */
export function serializeCheckpoint(checkpoint: Checkpoint): string {
  const lines = [
    serializeSession(checkpoint.claude_session),
    "",
    `mission_id: "${checkpoint.mission_id}"`,
    `phase: ${checkpoint.phase}`,
    `round: ${checkpoint.round}`,
    `awaiting_guild_master: ${checkpoint.awaiting_guild_master}`,
    `inbox_pending: ${checkpoint.inbox_pending}`,
    `picked_up_at: "${checkpoint.picked_up_at}"`,
  ];

  if (checkpoint.last_signal) {
    lines.push("", serializeLastSignal(checkpoint.last_signal));
  }

  return `${lines.join("\n")}\n`;
}

/** Write checkpoint.yaml — orchestrator-only; PO must use signals API. */
export async function writeCheckpoint(config: Config, missionId: string, checkpoint: Checkpoint): Promise<void> {
  await writeFile(checkpointPath(config, missionId), serializeCheckpoint(checkpoint), "utf8");
}

/** Read checkpoint.yaml; null when file missing or unreadable. */
export async function readCheckpoint(config: Config, missionId: string): Promise<Checkpoint | null> {
  try {
    return parseCheckpoint(await readFile(checkpointPath(config, missionId), "utf8"), missionId);
  } catch {
    return null;
  }
}

/** Read checkpoint or throw if missing. */
export async function requireCheckpoint(config: Config, missionId: string): Promise<Checkpoint> {
  const checkpoint = await readCheckpoint(config, missionId);
  if (!checkpoint) throw new Error(`Missing checkpoint for ${missionId}`);
  return checkpoint;
}

/** Parse checkpoint YAML; accepts legacy awaiting_eric alias. */
export function parseCheckpoint(raw: string, fallbackMissionId: string): Checkpoint {
  const session: Partial<ClaudeSession> = { cwd: "" };
  let missionId = fallbackMissionId;
  let phase: MissionPhase = "evaluating";
  let round = 0;
  let awaitingGuildMaster = false;
  let inboxPending = false;
  let pickedUpAt = "";
  let lastSignal: LastSignal | null = null;
  let inLastSignal = false;
  const signalDraft: Partial<LastSignal> = {};

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
        else if (child.startsWith("type:")) signalDraft.type = pickBareValue(child) as LastSignal["type"];
        else if (child.startsWith("summary:")) signalDraft.summary = pickQuotedValue(child);
        continue;
      }
    }

    applySessionLine(session, trimmed);
    if (trimmed.startsWith("mission_id:")) missionId = pickQuotedValue(trimmed);
    else if (trimmed.startsWith("phase:")) phase = pickBareValue(trimmed) as MissionPhase;
    else if (trimmed.startsWith("round:")) round = Number.parseInt(pickBareValue(trimmed), 10) || 0;
    else if (trimmed.startsWith("awaiting_guild_master:"))
      awaitingGuildMaster = pickBareValue(trimmed) === "true";
    else if (trimmed.startsWith("awaiting_eric:"))
      awaitingGuildMaster = pickBareValue(trimmed) === "true"; // legacy field name
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
    throw new Error(`Invalid checkpoint for ${fallbackMissionId}`);
  }

  return {
    mission_id: missionId,
    claude_session: {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      status: session.status ?? "running",
    },
    phase,
    round,
    awaiting_guild_master: awaitingGuildMaster,
    inbox_pending: inboxPending,
    picked_up_at: pickedUpAt,
    last_signal: lastSignal,
  };
}
