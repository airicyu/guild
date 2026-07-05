/**
 * Guild master approve artifacts — close-out gate before artifact release.
 *
 * Does not stop PO session or move board. Notifies PO via inbox + channel.
 */
import type { Config } from "../../config";
import type { Checkpoint } from "../../types/mission";
import { assertMissionId, isOnWorkingBoard, listBoard } from "../core/board";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import { deliverGuildMasterDirective } from "./guild-master-notify";

/** Approve mission deliverables; transitions to releasing phase on working board. */
export async function approveMissionArtifacts(
  config: Config,
  missionId: string,
): Promise<{ missionId: string; checkpoint: Checkpoint; notify: { channel: { delivered: boolean; reason?: string } } }> {
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
      `Mission ${missionId} must be awaiting_artifact_review before approve (current: ${checkpoint.phase})`,
    );
  }

  const directive = [
    "Guild master approved artifacts.",
    "Deliverables are accepted — proceed with artifact release per artifact-release.md and the PO playbook.",
    "Do not call mission_complete until retrospective aggregation is complete.",
  ].join(" ");

  const notify = await deliverGuildMasterDirective(config, missionId, {
    event: "artifacts_approved",
    directive,
  });
  console.log(
    `[approve-artifacts] mission=${missionId} phase→releasing channel.delivered=${notify.channel.delivered}${notify.channel.reason ? ` (${notify.channel.reason})` : ""}`,
  );

  const updated: Checkpoint = {
    ...checkpoint,
    phase: "releasing",
    awaiting_guild_master: false,
  };
  await writeCheckpoint(config, missionId, updated);

  return { missionId, checkpoint: updated, notify };
}
