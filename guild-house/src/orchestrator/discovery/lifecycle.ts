/**
 * Discovery phase transitions via signals from intake lead (tools/signal.sh).
 *
 * Maps: start_drafting, packages_ready, request_approval, awaiting_input.
 * Requires idea on discovering board; rejects when phase is closed.
 */
import type { Config } from "../../config";
import type { DiscoveryCheckpoint, DiscoverySignalRequest, DiscoverySignalType } from "../../types/discovery";
import { assertIdeaId } from "../core/idea-id";
import { listBoard } from "../core/board";
import { readDiscoveryCheckpoint, writeDiscoveryCheckpoint } from "./checkpoint";

const SIGNAL_TYPES = new Set<DiscoverySignalType>([
  "start_drafting",
  "packages_ready",
  "request_approval",
  "awaiting_input",
]);

function recordSignal(
  checkpoint: DiscoveryCheckpoint,
  request: DiscoverySignalRequest,
): DiscoveryCheckpoint {
  return {
    ...checkpoint,
    last_signal: {
      at: new Date().toISOString(),
      by: request.by ?? "intake-lead",
      type: request.type,
      summary: request.summary,
    },
  };
}

/** Load checkpoint; throw if idea not on discovering board or phase is closed. */
export async function requireDiscoveringCheckpoint(
  config: Config,
  ideaId: string,
): Promise<DiscoveryCheckpoint> {
  assertIdeaId(ideaId);
  const board = await listBoard(config);
  if (!board.discovering.includes(ideaId)) {
    throw new Error(`Idea ${ideaId} is not on the discovering board`);
  }

  const checkpoint = await readDiscoveryCheckpoint(config, ideaId);
  if (!checkpoint) {
    throw new Error(`Missing discovery checkpoint for ${ideaId}`);
  }
  if (checkpoint.phase === "closed") {
    throw new Error(`Discovery ${ideaId} is already closed`);
  }

  return checkpoint;
}

/** Apply intake lead signal; updates discovery checkpoint phase. */
export async function handleDiscoverySignal(
  config: Config,
  ideaId: string,
  request: DiscoverySignalRequest,
): Promise<DiscoveryCheckpoint> {
  assertIdeaId(ideaId);

  if (!SIGNAL_TYPES.has(request.type)) {
    throw new Error(`Invalid discovery signal type: ${request.type}`);
  }

  let checkpoint = recordSignal(await requireDiscoveringCheckpoint(config, ideaId), request);

  // Phase map — intake lead must not edit checkpoint.yaml directly.
  switch (request.type) {
    case "start_drafting":
      checkpoint = { ...checkpoint, phase: "drafting", awaiting_guild_master: false };
      break;

    case "packages_ready":
      checkpoint = { ...checkpoint, phase: "presenting", awaiting_guild_master: false };
      break;

    case "request_approval":
      checkpoint = {
        ...checkpoint,
        phase: "awaiting_approval",
        awaiting_guild_master: true,
      };
      break;

    case "awaiting_input":
      checkpoint = { ...checkpoint, awaiting_guild_master: true };
      break;
  }

  await writeDiscoveryCheckpoint(config, ideaId, checkpoint);
  return checkpoint;
}
