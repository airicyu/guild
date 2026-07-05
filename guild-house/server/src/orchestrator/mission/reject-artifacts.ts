/**
 * Guild master reject artifacts — mission stays on working board, phase blocked.
 */
import type { Config } from "../../config";
import type { Checkpoint } from "../../types/mission";
import { assertMissionId, isOnWorkingBoard, listBoard } from "../core/board";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import { deliverGuildMasterDirective, type GuildMasterNotifyResult } from "./guild-master-notify";

export interface RejectArtifactsRequest {
  reason?: string;
  notes?: string;
}

/** Reject mission deliverables; PO remains on working board for remediation. */
export async function rejectMissionArtifacts(
  config: Config,
  missionId: string,
  input: RejectArtifactsRequest = {},
): Promise<{ missionId: string; checkpoint: Checkpoint; notify: GuildMasterNotifyResult }> {
  assertMissionId(missionId);

  const board = await listBoard(config);
  if (!isOnWorkingBoard(board, missionId)) {
    throw new Error(`Mission ${missionId} is not on the working board`);
  }

  const checkpoint = await readCheckpoint(config, missionId);
  if (!checkpoint) {
    throw new Error(`Missing checkpoint for ${missionId}`);
  }
  if (checkpoint.phase !== "awaiting_artifact_review") {
    throw new Error(
      `Mission ${missionId} must be awaiting_artifact_review before reject (current: ${checkpoint.phase})`,
    );
  }

  const reason = input.reason?.trim() || input.notes?.trim() || "Guild master rejected artifacts without a detailed reason.";
  const directive = [
    "Guild master rejected artifacts.",
    reason,
    "Mission stays on working board. Read inbox and await guild master directive (amend, rework, or abort).",
    "After fixes, signal artifacts_ready_for_review again when ready.",
  ].join(" ");

  const notify = await deliverGuildMasterDirective(config, missionId, {
    event: "artifacts_rejected",
    directive,
    appendInbox: true,
    pokePhase: "blocked",
    pokeMode: checkpoint.mode,
  });

  const updated: Checkpoint = {
    ...checkpoint,
    phase: "blocked",
    awaiting_guild_master: true,
  };
  await writeCheckpoint(config, missionId, updated);

  return { missionId, checkpoint: updated, notify };
}
